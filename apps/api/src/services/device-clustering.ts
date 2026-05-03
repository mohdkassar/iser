import type { DatapointSummary, ExtractedMetadata } from "@iser/shared";
import type { DeviceClusteringRoomInput, PreparedRoomCluster } from "../types/clustering.js";

function deviceTypeSimilarity(a: string, b: string) {
  if (a === "unknown" || b === "unknown") return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.75;
  return 0;
}

function scoreDeviceSimilarity(a: ExtractedMetadata, b: ExtractedMetadata) {
  const aDeviceInstance = a.deviceInstance ?? "unknown";
  const bDeviceInstance = b.deviceInstance ?? "unknown";
  const aEquipmentGroup = a.equipmentGroup ?? "unknown";
  const bEquipmentGroup = b.equipmentGroup ?? "unknown";
  const aSubzone = a.subzone ?? "unknown";
  const bSubzone = b.subzone ?? "unknown";
  const aDeviceType = a.deviceType ?? "unknown";
  const bDeviceType = b.deviceType ?? "unknown";

  return (
    0.45 * Number(aDeviceInstance !== "unknown" && aDeviceInstance === bDeviceInstance) +
    0.3 * Number(aEquipmentGroup !== "unknown" && aEquipmentGroup === bEquipmentGroup) +
    0.15 * Number(aSubzone !== "unknown" && aSubzone === bSubzone) +
    0.1 * deviceTypeSimilarity(aDeviceType, bDeviceType)
  );
}

export function buildDeviceClusters(roomId: string, datapoints: DatapointSummary[]) {
  const visited = new Set<string>();
  const result: Array<{
    id: string;
    roomId: string;
    label: string;
    datapoints: DatapointSummary[];
  }> = [];

  for (const datapoint of datapoints) {
    if (visited.has(datapoint.id) || !datapoint.metadata) continue;

    const stack = [datapoint];
    const component: DatapointSummary[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current.id) || !current.metadata) continue;

      visited.add(current.id);
      component.push(current);

      for (const candidate of datapoints) {
        if (visited.has(candidate.id) || !candidate.metadata) continue;

        if (scoreDeviceSimilarity(current.metadata, candidate.metadata) >= 0.7) {
          stack.push(candidate);
        }
      }
    }

    const first = component[0];
    result.push({
      id: `device-${roomId}-${result.length + 1}`,
      roomId,
      label: first?.metadata?.deviceInstance || `device-${result.length + 1}`,
      datapoints: component,
    });
  }

  return result;
}

export function toDeviceClusterDocuments(
  siteId: string,
  roomClusters: DeviceClusteringRoomInput[],
): PreparedRoomCluster[] {
  const clusters: PreparedRoomCluster[] = [];

  roomClusters.forEach((roomCluster) => {
    const deviceClusters = buildDeviceClusters(roomCluster.roomClusterId, roomCluster.datapoints);
    deviceClusters.forEach((deviceCluster) => {
      clusters.push({
        siteId,
        type: "device",
        label: deviceCluster.label,
        status: "pending",
        datapointIds: deviceCluster.datapoints.map((datapoint) => datapoint.id),
        datapointCount: deviceCluster.datapoints.length,
        metadata: {
          roomClusterLabel: roomCluster.roomClusterLabel,
        },
        parentClusterId: roomCluster.roomClusterId,
      });
    });
  });

  return clusters;
}
