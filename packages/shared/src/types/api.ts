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

export interface RunRoomClusteringInput {
  threshold?: number;
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

export interface MergeRoomClustersInput {
  sourceClusterId: string;
}

export interface RoomAgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RoomAgentRequest {
  messages: RoomAgentMessage[];
}

export interface RoomAgentUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RoomAgentResponse {
  answer: string;
  usage: RoomAgentUsage;
  toolCallsUsed: number;
}

export type SyntheticTelemetryValueSpec =
  | {
      kind: "range";
      min: number;
      max: number;
    }
  | {
      kind: "list";
      values: string[];
    }
  | {
      kind: "percentage";
    };

export interface GenerateSyntheticTelemetryInput {
  datapointIdentifiers?: string[];
  startAt: string;
  endAt: string;
  granularityMinutes: 1 | 5;
  errorMargin: number;
  missingValueMargin: number;
  valueSpec: SyntheticTelemetryValueSpec;
}

export interface GenerateSyntheticTelemetryResponse {
  siteId: string;
  siteName: string;
  datapointCount: number;
  recordsCreated: number;
  recordsSkipped: number;
}
