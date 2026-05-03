import type { DatapointSummary } from "@iser/shared";
import type { PreparedRoomCluster, RoomCluster } from "../types/clustering.js";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\bgrm\b|\bgr\b/g, "grow room")
    .replace(/\brm\b/g, "room")
    .replace(/\b0+(\d+)/g, "$1")
    .replace(/\s+/g, "")
    .trim();
}

function aliasAllowed(alias: string) {
  const normalized = normalizeText(alias);
  if (!normalized || normalized.length <= 1) return false;
  if (/^\d+$/.test(normalized)) return false;
  return !["room", "zone", "sensor", "grow room"].includes(normalized);
}

function cosineSimilarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection += 1;
    }
  }
  return intersection / Math.sqrt(a.size * b.size);
}

function mergeRoomClusterInto(target: RoomCluster, source: RoomCluster) {
  source.aliases.forEach((alias) => target.aliases.add(alias));
  target.datapoints.push(...source.datapoints);

  if (target.canonicalName === "unassigned" && source.canonicalName !== "unassigned") {
    target.canonicalName = source.canonicalName;
  }
}

function shouldMergeRoomClusters(a: RoomCluster, b: RoomCluster) {
  if (a.canonicalName !== "unassigned" && a.canonicalName === b.canonicalName) {
    return true;
  }

  return cosineSimilarity(a.aliases, b.aliases) >= 0.3;
}

function consolidateRoomClusters(clusters: RoomCluster[]) {
  const consolidated = [...clusters];
  let merged = true;

  while (merged) {
    merged = false;

    for (let leftIndex = 0; leftIndex < consolidated.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < consolidated.length; rightIndex += 1) {
        const leftCluster = consolidated[leftIndex]!;
        const rightCluster = consolidated[rightIndex]!;

        if (!shouldMergeRoomClusters(leftCluster, rightCluster)) {
          continue;
        }

        mergeRoomClusterInto(leftCluster, rightCluster);
        consolidated.splice(rightIndex, 1);
        merged = true;
        break;
      }

      if (merged) {
        break;
      }
    }
  }

  return consolidated.map((cluster, index) => ({
    ...cluster,
    id: `room-${index + 1}`,
  }));
}

export function buildRoomClusters(datapoints: DatapointSummary[]) {
  const clusters: RoomCluster[] = [];

  for (const datapoint of datapoints) {
    const metadata = datapoint.metadata;
    if (!metadata) continue;

    const normalizedRoom = normalizeText(metadata.roomCandidate);
    const aliases = new Set(
      [metadata.roomCandidate, ...metadata.roomAliases].map(normalizeText).filter(aliasAllowed),
    );

    let matchedCluster = clusters.find((cluster) => cluster.canonicalName === normalizedRoom);

    if (!matchedCluster) {
      matchedCluster = clusters.find((cluster) => cosineSimilarity(cluster.aliases, aliases) >= 0.3);
    }

    if (!matchedCluster) {
      matchedCluster = {
        id: `room-${clusters.length + 1}`,
        canonicalName: normalizedRoom || "unassigned",
        aliases,
        datapoints: [],
      };
      clusters.push(matchedCluster);
    }

    aliases.forEach((alias) => matchedCluster!.aliases.add(alias));
    matchedCluster.datapoints.push(datapoint);
  }

  return consolidateRoomClusters(clusters);
}

export function toRoomClusterDocuments(
  siteId: string,
  roomClusters: ReturnType<typeof buildRoomClusters>,
): PreparedRoomCluster[] {
  return roomClusters.map((roomCluster) => ({
    siteId,
    type: "room",
    label: roomCluster.canonicalName,
    status: "pending",
    datapointIds: roomCluster.datapoints.map((datapoint) => datapoint.id),
    datapointCount: roomCluster.datapoints.length,
    metadata: {
      aliases: Array.from(roomCluster.aliases),
    },
    parentClusterId: undefined,
  }));
}
