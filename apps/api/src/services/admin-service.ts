import type {
  ClientDetail,
  ClientSummary,
  ClusterSummary,
  DatapointSummary,
  ExtractMetadataInput,
  ExtractMetadataResponse,
  RunClusteringResponse,
  RunRoomClusteringInput,
  SiteDetail,
  SiteSummary,
  UpdateClusterInput,
} from "@iser/shared";
import { Types } from "mongoose";

import { ClientModel } from "../models/client.js";
import { ClusterModel } from "../models/cluster.js";
import { DatapointModel } from "../models/datapoint.js";
import { SiteModel } from "../models/site.js";
import { toDeviceClusterDocuments } from "./device-clustering.js";
import { extractMetadata, extractMetadataBatch, extractRoomMetadataBatch } from "./metadata-extractor.js";
import { askRoomAgent as askRoomAgentService } from "./room-agent.js";
import { generateSyntheticTelemetry as generateSyntheticTelemetryService } from "./telemetry-generation.js";
import { buildRoomClusters, toRoomClusterDocuments } from "./room-clustering.js";

type MergeRoomClustersInput = {
  sourceClusterId: string;
};

function toId(value: unknown) {
  return String(value);
}

function toDatapointSummary(document: any): DatapointSummary {
  return {
    id: toId(document._id),
    siteId: toId(document.siteId),
    rawName: document.rawName,
    identifier: document.identifier,
    manufacturer: document.manufacturer,
    metadata: document.metadata ?? undefined,
    metadataExtraction: document.metadataExtraction
      ? {
          version: document.metadataExtraction.version,
          batchSize: document.metadataExtraction.batchSize,
          extractedAt: new Date(document.metadataExtraction.extractedAt).toISOString(),
        }
      : undefined,
  };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function toClusterSummary(document: any): ClusterSummary {
  return {
    id: toId(document._id),
    siteId: toId(document.siteId),
    type: document.type,
    label: document.label,
    status: document.status,
    datapointIds: document.datapointIds.map(toId),
    datapointCount: document.datapointIds.length,
    parentClusterId: document.parentClusterId ? toId(document.parentClusterId) : undefined,
    metadata: document.metadata ?? {},
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toSiteSummary(site: any, datapointCount: number, clusterCount: number): SiteSummary {
  return {
    id: toId(site._id),
    clientId: toId(site.clientId),
    name: site.name,
    code: site.code,
    datapointCount,
    clusterCount,
    metadataExtractionTokensTotal: site.metadataExtractionTokensTotal ?? 0,
  };
}

export async function listClients(): Promise<ClientSummary[]> {
  const clients = await ClientModel.aggregate([
    {
      $lookup: {
        from: "sites",
        localField: "_id",
        foreignField: "clientId",
        as: "sites",
      },
    },
    {
      $project: {
        name: 1,
        slug: 1,
        siteCount: { $size: "$sites" },
      },
    },
    { $sort: { name: 1 } },
  ]);

  return clients.map((client) => ({
    id: toId(client._id),
    name: client.name,
    slug: client.slug,
    siteCount: client.siteCount,
  }));
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const client = await ClientModel.findById(clientId).lean();
  if (!client) return null;

  const siteStats = await SiteModel.aggregate([
    { $match: { clientId: new Types.ObjectId(clientId) } },
    {
      $lookup: {
        from: "datapoints",
        localField: "_id",
        foreignField: "siteId",
        as: "datapoints",
      },
    },
    {
      $lookup: {
        from: "clusters",
        localField: "_id",
        foreignField: "siteId",
        as: "clusters",
      },
    },
    {
      $project: {
        clientId: 1,
        name: 1,
        code: 1,
        metadataExtractionTokensTotal: { $ifNull: ["$metadataExtractionTokensTotal", 0] },
        datapointCount: { $size: "$datapoints" },
        clusterCount: { $size: "$clusters" },
      },
    },
    { $sort: { name: 1 } },
  ]);

  const sites: SiteSummary[] = siteStats.map((site) => ({
    id: toId(site._id),
    clientId: toId(site.clientId),
    name: site.name,
    code: site.code,
    datapointCount: site.datapointCount,
    clusterCount: site.clusterCount,
    metadataExtractionTokensTotal: site.metadataExtractionTokensTotal,
  }));

  return {
    id: toId(client._id),
    name: client.name,
    slug: client.slug,
    siteCount: sites.length,
    sites,
  };
}

export async function getSiteDetail(siteId: string): Promise<SiteDetail | null> {
  const site = await SiteModel.findById(siteId).lean();
  if (!site) return null;

  const [datapoints, clusters] = await Promise.all([
    DatapointModel.find({ siteId }).sort({ rawName: 1 }).lean(),
    ClusterModel.find({ siteId }).sort({ updatedAt: -1 }).lean(),
  ]);

  return {
    id: toId(site._id),
    clientId: toId(site.clientId),
    name: site.name,
    code: site.code,
    datapointCount: datapoints.length,
    clusterCount: clusters.length,
    metadataExtractionTokensTotal: site.metadataExtractionTokensTotal ?? 0,
    datapoints: datapoints.map(toDatapointSummary),
    clusters: clusters.map(toClusterSummary),
  };
}

export async function extractSiteMetadata(
  siteId: string,
  input: ExtractMetadataInput,
): Promise<ExtractMetadataResponse | null> {
  const site = await SiteModel.findById(siteId).lean();
  if (!site) return null;

  const datapoints = await DatapointModel.find({ siteId }).lean();
  let tokensUsedThisRun = 0;
  const version = input.version;
  const batchSize = Math.max(1, version === "v2" || version === "v3" ? input.batchSize ?? 5 : 1);
  const extractionTimestamp = new Date();
  const targetDatapoints = datapoints;

  if (version === "v2" || version === "v3") {
    for (const batch of chunkArray(targetDatapoints, batchSize)) {
      const batchInput = batch.map((datapoint) => ({
        rawName: datapoint.rawName,
        identifier: datapoint.identifier,
        manufacturer: datapoint.manufacturer,
      }));
      const extractionResult =
        version === "v3" ? await extractRoomMetadataBatch(batchInput) : await extractMetadataBatch(batchInput);

      tokensUsedThisRun += extractionResult.totalTokensUsed;

      await Promise.all(
        batch.map((datapoint) =>
          DatapointModel.updateOne(
            { _id: datapoint._id },
            {
              $set: {
                metadata: extractionResult.results[datapoint.identifier],
                metadataExtraction: {
                  version,
                  batchSize,
                  extractedAt: extractionTimestamp,
                },
              },
            },
          ),
        ),
      );
    }
  } else {
    for (const datapoint of targetDatapoints) {
      const extractionResult = await extractMetadata(
        datapoint.rawName,
        datapoint.identifier,
        datapoint.manufacturer,
      );

      tokensUsedThisRun += extractionResult.totalTokensUsed;

      await DatapointModel.updateOne(
        { _id: datapoint._id },
        {
          $set: {
            metadata: extractionResult.metadata,
            metadataExtraction: {
              version,
              batchSize,
              extractedAt: extractionTimestamp,
            },
          },
        },
      );
    }
  }

  const [updatedSite, enrichedDatapoints] = await Promise.all([
    SiteModel.findByIdAndUpdate(
      siteId,
      { $inc: { metadataExtractionTokensTotal: tokensUsedThisRun } },
      { new: true },
    ).lean(),
    DatapointModel.find({ siteId }).sort({ rawName: 1 }).lean(),
  ]);

  return {
    site: {
      id: toId(updatedSite?._id ?? site._id),
      clientId: toId(updatedSite?.clientId ?? site.clientId),
      name: updatedSite?.name ?? site.name,
      code: updatedSite?.code ?? site.code,
      datapointCount: datapoints.length,
      clusterCount: await ClusterModel.countDocuments({ siteId }),
      metadataExtractionTokensTotal:
        updatedSite?.metadataExtractionTokensTotal ?? site.metadataExtractionTokensTotal ?? 0,
    },
    datapoints: enrichedDatapoints.map(toDatapointSummary),
  };
}

export async function runClustering(siteId: string): Promise<RunClusteringResponse | null> {
  return runRoomClustering(siteId);
}

export async function runRoomClustering(
  siteId: string,
  input: RunRoomClusteringInput = {},
): Promise<RunClusteringResponse | null> {
  const site = await SiteModel.findById(siteId).lean();
  if (!site) return null;
  const threshold =
    typeof input.threshold === "number" && Number.isFinite(input.threshold)
      ? Math.min(1, Math.max(0, input.threshold))
      : 0.5;

  const datapoints = await DatapointModel.find({ siteId }).lean();
  const enrichedDatapoints = datapoints
    .map(toDatapointSummary)
    .filter((datapoint): datapoint is DatapointSummary & { metadata: NonNullable<DatapointSummary["metadata"]> } =>
      Boolean(datapoint.metadata),
    );

  const roomClusters = buildRoomClusters(enrichedDatapoints, threshold);
  const roomClusterDocuments = toRoomClusterDocuments(siteId, roomClusters);

  await ClusterModel.deleteMany({ siteId });

  const createdRooms = await ClusterModel.insertMany(
    roomClusterDocuments.map((cluster) => ({
      siteId,
      type: "room",
      label: cluster.label,
      status: cluster.status,
      datapointIds: cluster.datapointIds,
      metadata: cluster.metadata,
    })),
  );

  return {
    site: toSiteSummary(site, datapoints.length, createdRooms.length),
    clusters: createdRooms.map(toClusterSummary),
  };
}

export async function runDeviceClustering(siteId: string): Promise<RunClusteringResponse | null> {
  const site = await SiteModel.findById(siteId).lean();
  if (!site) return null;

  const [datapoints, roomClusters] = await Promise.all([
    DatapointModel.find({ siteId }).lean(),
    ClusterModel.find({ siteId, type: "room" }).lean(),
  ]);

  const datapointById = new Map(
    datapoints.map((datapoint) => [toId(datapoint._id), toDatapointSummary(datapoint)]),
  );

  const deviceClusterDocuments = toDeviceClusterDocuments(
    siteId,
    roomClusters.map((roomCluster) => ({
      roomClusterId: toId(roomCluster._id),
      roomClusterLabel: typeof roomCluster.label === "string" ? roomCluster.label : "unknown",
      datapoints: roomCluster.datapointIds
        .map((datapointId: unknown) => datapointById.get(toId(datapointId)))
        .filter((datapoint): datapoint is DatapointSummary => Boolean(datapoint?.metadata)),
    })),
  );

  await ClusterModel.deleteMany({ siteId, type: "device" });

  const createdDevices = await ClusterModel.insertMany(
    deviceClusterDocuments.map((cluster) => ({
      siteId,
      type: "device",
      label: cluster.label,
      status: cluster.status,
      datapointIds: cluster.datapointIds,
      metadata: cluster.metadata,
      parentClusterId: cluster.parentClusterId,
    })),
  );

  return {
    site: toSiteSummary(site, datapoints.length, roomClusters.length + createdDevices.length),
    clusters: createdDevices.map(toClusterSummary),
  };
}

export async function clearSiteClustersAndMetadata(siteId: string): Promise<SiteDetail | null> {
  const site = await SiteModel.findById(siteId).lean();
  if (!site) return null;

  await Promise.all([
    ClusterModel.deleteMany({ siteId }),
    DatapointModel.updateMany({ siteId }, { $unset: { metadata: 1, metadataExtraction: 1 } }),
    SiteModel.updateOne({ _id: siteId }, { $set: { metadataExtractionTokensTotal: 0 } }),
  ]);

  return getSiteDetail(siteId);
}

export async function updateCluster(clusterId: string, input: UpdateClusterInput) {
  const cluster = await ClusterModel.findByIdAndUpdate(
    clusterId,
    {
      ...(input.status ? { status: input.status } : {}),
      ...(input.label ? { label: input.label } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    { new: true },
  ).lean();

  return cluster ? toClusterSummary(cluster) : null;
}

function toAliasList(metadata: Record<string, unknown> | undefined) {
  const aliases = metadata?.aliases;
  return Array.isArray(aliases)
    ? aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
    : [];
}

export async function mergeRoomClusters(
  targetClusterId: string,
  input: MergeRoomClustersInput,
): Promise<SiteDetail | null> {
  const [targetCluster, sourceCluster] = await Promise.all([
    ClusterModel.findById(targetClusterId),
    ClusterModel.findById(input.sourceClusterId),
  ]);

  if (!targetCluster || !sourceCluster) {
    return null;
  }

  if (String(targetCluster.siteId) !== String(sourceCluster.siteId)) {
    throw new Error("Clusters must belong to the same site");
  }

  if (targetCluster.type !== "room" || sourceCluster.type !== "room") {
    throw new Error("Only room clusters can be merged");
  }

  if (targetCluster.status !== "pending" || sourceCluster.status !== "pending") {
    throw new Error("Only pending room clusters can be merged");
  }

  if (String(targetCluster._id) === String(sourceCluster._id)) {
    throw new Error("Cannot merge a cluster into itself");
  }

  const mergedDatapointIds = Array.from(
    new Set([...targetCluster.datapointIds, ...sourceCluster.datapointIds].map(toId)),
  );
  const targetMetadata = (targetCluster.metadata ?? {}) as Record<string, unknown>;
  const sourceMetadata = (sourceCluster.metadata ?? {}) as Record<string, unknown>;
  const mergedAliases = Array.from(new Set([...toAliasList(targetMetadata), ...toAliasList(sourceMetadata)]));
  const mergedMetadata = {
    ...targetMetadata,
    aliases: mergedAliases,
  };

  await ClusterModel.updateOne(
    { _id: targetCluster._id },
    {
      $set: {
        datapointIds: mergedDatapointIds,
        metadata: mergedMetadata,
      },
    },
  );
  await ClusterModel.deleteOne({ _id: sourceCluster._id });

  return getSiteDetail(String(targetCluster.siteId));
}

export const generateSyntheticTelemetry = generateSyntheticTelemetryService;
export const askRoomAgent = askRoomAgentService;
