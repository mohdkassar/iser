import type { ClusterSummary, DatapointSummary } from "@iser/shared";

export type RoomCluster = {
  id: string;
  canonicalName: string;
  aliases: Set<string>;
  datapoints: DatapointSummary[];
};

export type PreparedRoomCluster = Omit<ClusterSummary, "id" | "updatedAt">;

export type DeviceClusteringRoomInput = {
  roomClusterId: string;
  roomClusterLabel: string;
  datapoints: DatapointSummary[];
};
