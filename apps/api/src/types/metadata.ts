import type { ExtractedMetadata } from "@iser/shared";

export interface MetadataExtractionResult {
  metadata: ExtractedMetadata;
  totalTokensUsed: number;
}

export interface BatchedDatapointInput {
  identifier: string;
  rawName: string;
  manufacturer: string;
}

export interface BatchedMetadataExtractionResult {
  results: Record<string, ExtractedMetadata>;
  totalTokensUsed: number;
}
