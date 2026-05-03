import { Router } from "express";

import {
  clearSiteClustersAndMetadata,
  extractSiteMetadata,
  getClientDetail,
  getSiteDetail,
  listClients,
  runDeviceClustering,
  runRoomClustering,
  runClustering,
  updateCluster,
} from "../services/admin-service.js";

export const adminRouter = Router();

adminRouter.get("/clients", async (_request, response) => {
  response.json(await listClients());
});

adminRouter.get("/clients/:clientId", async (request, response) => {
  const result = await getClientDetail(request.params.clientId);
  if (!result) {
    response.status(404).json({ message: "Client not found" });
    return;
  }

  response.json(result);
});

adminRouter.get("/sites/:siteId", async (request, response) => {
  const result = await getSiteDetail(request.params.siteId);
  if (!result) {
    response.status(404).json({ message: "Site not found" });
    return;
  }

  response.json(result);
});

adminRouter.post("/sites/:siteId/metadata/extract", async (request, response) => {
  const version = request.body?.version === "v2" || request.body?.version === "v3" ? request.body.version : "v1";
  const batchSize =
    typeof request.body?.batchSize === "number" && Number.isFinite(request.body.batchSize)
      ? Math.max(1, Math.floor(request.body.batchSize))
      : undefined;

  const result = await extractSiteMetadata(request.params.siteId, {
    version,
    batchSize,
  });
  if (!result) {
    response.status(404).json({ message: "Site not found" });
    return;
  }

  response.status(201).json(result);
});

adminRouter.post("/sites/:siteId/clusters/run", async (request, response) => {
  const result = await runClustering(request.params.siteId);
  if (!result) {
    response.status(404).json({ message: "Site not found" });
    return;
  }

  response.status(201).json(result);
});

adminRouter.post("/sites/:siteId/clusters/rooms/run", async (request, response) => {
  const threshold =
    typeof request.body?.threshold === "number" && Number.isFinite(request.body.threshold)
      ? Math.min(1, Math.max(0, request.body.threshold))
      : undefined;

  const result = await runRoomClustering(request.params.siteId, { threshold });
  if (!result) {
    response.status(404).json({ message: "Site not found" });
    return;
  }

  response.status(201).json(result);
});

adminRouter.post("/sites/:siteId/clusters/devices/run", async (request, response) => {
  const result = await runDeviceClustering(request.params.siteId);
  if (!result) {
    response.status(404).json({ message: "Site not found" });
    return;
  }

  response.status(201).json(result);
});

adminRouter.post("/sites/:siteId/clusters/clear", async (request, response) => {
  const result = await clearSiteClustersAndMetadata(request.params.siteId);
  if (!result) {
    response.status(404).json({ message: "Site not found" });
    return;
  }

  response.json(result);
});

adminRouter.patch("/clusters/:clusterId", async (request, response) => {
  const result = await updateCluster(request.params.clusterId, request.body);
  if (!result) {
    response.status(404).json({ message: "Cluster not found" });
    return;
  }

  response.json(result);
});
