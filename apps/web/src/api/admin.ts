import type {
  ClientDetail,
  ClientSummary,
  ClusterSummary,
  ExtractMetadataInput,
  ExtractMetadataResponse,
  GenerateSyntheticTelemetryInput,
  GenerateSyntheticTelemetryResponse,
  RoomAgentRequest,
  RoomAgentResponse,
  RunClusteringResponse,
  RunRoomClusteringInput,
  MergeRoomClustersInput,
  SiteDetail,
  UpdateClusterInput,
} from "@iser/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return (await response.json()) as T;
}

export const adminApi = {
  listClients: () => request<ClientSummary[]>("/api/admin/clients"),
  getClient: (clientId: string) => request<ClientDetail>(`/api/admin/clients/${clientId}`),
  getSite: (siteId: string) => request<SiteDetail>(`/api/admin/sites/${siteId}`),
  extractMetadata: (siteId: string, body: ExtractMetadataInput) =>
    request<ExtractMetadataResponse>(`/api/admin/sites/${siteId}/metadata/extract`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runRoomClustering: (siteId: string, body: RunRoomClusteringInput) =>
    request<RunClusteringResponse>(`/api/admin/sites/${siteId}/clusters/rooms/run`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runDeviceClustering: (siteId: string) =>
    request<RunClusteringResponse>(`/api/admin/sites/${siteId}/clusters/devices/run`, {
      method: "POST",
    }),
  runClustering: (siteId: string) =>
    request<RunClusteringResponse>(`/api/admin/sites/${siteId}/clusters/run`, { method: "POST" }),
  clearSiteClustersAndMetadata: (siteId: string) =>
    request<SiteDetail>(`/api/admin/sites/${siteId}/clusters/clear`, { method: "POST" }),
  generateSyntheticTelemetry: (siteId: string, body: GenerateSyntheticTelemetryInput) =>
    request<GenerateSyntheticTelemetryResponse>(`/api/admin/sites/${siteId}/telemetry/generate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  askRoomAgent: (siteId: string, clusterId: string, body: RoomAgentRequest) =>
    request<RoomAgentResponse>(`/api/admin/sites/${siteId}/rooms/${clusterId}/agent`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCluster: (clusterId: string, body: UpdateClusterInput) =>
    request<ClusterSummary>(`/api/admin/clusters/${clusterId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  mergeRoomClusters: (clusterId: string, body: MergeRoomClustersInput) =>
    request<SiteDetail>(`/api/admin/clusters/${clusterId}/merge`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
