const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
async function request(path, init) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
        },
        ...init,
    });
    if (!response.ok) {
        throw new Error(`Request failed for ${path}`);
    }
    return (await response.json());
}
export const adminApi = {
    listClients: () => request("/api/admin/clients"),
    getClient: (clientId) => request(`/api/admin/clients/${clientId}`),
    getSite: (siteId) => request(`/api/admin/sites/${siteId}`),
    extractMetadata: (siteId, body) => request(`/api/admin/sites/${siteId}/metadata/extract`, {
        method: "POST",
        body: JSON.stringify(body),
    }),
    runRoomClustering: (siteId, body) => request(`/api/admin/sites/${siteId}/clusters/rooms/run`, {
        method: "POST",
        body: JSON.stringify(body),
    }),
    runDeviceClustering: (siteId) => request(`/api/admin/sites/${siteId}/clusters/devices/run`, {
        method: "POST",
    }),
    runClustering: (siteId) => request(`/api/admin/sites/${siteId}/clusters/run`, { method: "POST" }),
    clearSiteClustersAndMetadata: (siteId) => request(`/api/admin/sites/${siteId}/clusters/clear`, { method: "POST" }),
    generateSyntheticTelemetry: (siteId, body) => request(`/api/admin/sites/${siteId}/telemetry/generate`, {
        method: "POST",
        body: JSON.stringify(body),
    }),
    askRoomAgent: (siteId, clusterId, body) => request(`/api/admin/sites/${siteId}/rooms/${clusterId}/agent`, {
        method: "POST",
        body: JSON.stringify(body),
    }),
    updateCluster: (clusterId, body) => request(`/api/admin/clusters/${clusterId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    }),
    mergeRoomClusters: (clusterId, body) => request(`/api/admin/clusters/${clusterId}/merge`, {
        method: "POST",
        body: JSON.stringify(body),
    }),
};
