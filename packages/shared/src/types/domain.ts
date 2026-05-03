export type ClusterType = "room" | "device";
export type ClusterStatus = "pending" | "approved" | "rejected";
export type MetadataExtractionVersion = "v1" | "v2" | "v3";

export interface ExtractedMetadata {
  roomCandidate: string;
  roomAliases: string[];
  equipmentGroup?: string;
  deviceInstance?: string;
  deviceType?: string;
  subzone?: string;
  confidence: number;
}

export interface MetadataExtractionDetails {
  version: MetadataExtractionVersion;
  batchSize: number;
  extractedAt: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  slug: string;
  siteCount: number;
}

export interface SiteSummary {
  id: string;
  clientId: string;
  name: string;
  code: string;
  datapointCount: number;
  clusterCount: number;
  metadataExtractionTokensTotal: number;
}

export interface DatapointSummary {
  id: string;
  siteId: string;
  rawName: string;
  identifier: string;
  manufacturer: string;
  metadata?: ExtractedMetadata;
  metadataExtraction?: MetadataExtractionDetails;
}

export interface ClusterSummary {
  id: string;
  siteId: string;
  type: ClusterType;
  label: string;
  status: ClusterStatus;
  datapointIds: string[];
  datapointCount: number;
  parentClusterId?: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface ClientDetail extends ClientSummary {
  sites: SiteSummary[];
}

export interface SiteDetail extends SiteSummary {
  datapoints: DatapointSummary[];
  clusters: ClusterSummary[];
}
