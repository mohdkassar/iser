import type {
  DatapointSummary,
  MetadataExtractionVersion,
  SiteSummary,
  ClusterSummary,
  ClusterStatus,
} from "./domain";

export interface RunClusteringResponse {
  site: SiteSummary;
  clusters: ClusterSummary[];
}

export interface ExtractMetadataResponse {
  site: SiteSummary;
  datapoints: DatapointSummary[];
}

export interface ExtractMetadataInput {
  version: MetadataExtractionVersion;
  batchSize?: number;
}

export interface UpdateClusterInput {
  status?: ClusterStatus;
  label?: string;
  metadata?: Record<string, unknown>;
}
