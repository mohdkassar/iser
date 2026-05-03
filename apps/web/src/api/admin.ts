import type {
  ClientDetail,
  ClientSummary,
  ClusterSummary,
  ExtractMetadataInput,
  ExtractMetadataResponse,
  RunClusteringResponse,
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
  runRoomClustering: (siteId: string) =>
    request<RunClusteringResponse>(`/api/admin/sites/${siteId}/clusters/rooms/run`, {
      method: "POST",
    }),
  runDeviceClustering: (siteId: string) =>
    request<RunClusteringResponse>(`/api/admin/sites/${siteId}/clusters/devices/run`, {
      method: "POST",
    }),
  runClustering: (siteId: string) =>
    request<RunClusteringResponse>(`/api/admin/sites/${siteId}/clusters/run`, { method: "POST" }),
  clearSiteClustersAndMetadata: (siteId: string) =>
    request<SiteDetail>(`/api/admin/sites/${siteId}/clusters/clear`, { method: "POST" }),
  updateCluster: (clusterId: string, body: UpdateClusterInput) =>
    request<ClusterSummary>(`/api/admin/clusters/${clusterId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
