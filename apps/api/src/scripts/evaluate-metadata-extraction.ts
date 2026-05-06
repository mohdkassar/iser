import mongoose from "mongoose";
import type { DatapointSummary, ExtractedMetadata, MetadataExtractionVersion } from "@iser/shared";
import groundTruthDatapoints from "../../../../docs/iser.datapoints3-ground-truth.json" with { type: "json" };

import { connectToDatabase } from "../lib/mongoose.js";
import { DatapointModel } from "../models/datapoint.js";
import { SiteModel } from "../models/site.js";
import {
  extractMetadata,
  extractMetadataBatch,
  extractRoomMetadataBatch,
} from "../services/metadata-extractor.js";
import { buildRoomClusters } from "../services/room-clustering.js";
import type { BatchedDatapointInput } from "../types/metadata.js";

interface SeedDatapoint {
  rawName: string;
  identifier: string;
  manufacturer: string;
  groundTruth?: string;
}

interface EvaluationRow {
  version: MetadataExtractionVersion;
  batchSize: number;
  threshold: number;
  datapoints: number;
  clusters: number;
  precision: number;
  recall: number;
  f1: number;
  adjustedRandIndex: number;
  tokenCost: number;
}

const defaultBatchSizes = [10, 25, 50];
const defaultThreshold = 0.5;
const defaultVersions: MetadataExtractionVersion[] = ["v1", "v2", "v3"];

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function formatDuration(startedAt: number) {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const inlineValue = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (inlineValue !== undefined) return inlineValue;

  const argIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (argIndex === -1) return undefined;

  const value = process.argv[argIndex + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function parseBatchSizes() {
  const raw = getArgValue("batch-sizes");
  if (!raw) return defaultBatchSizes;

  const values = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return values.length > 0 ? values : defaultBatchSizes;
}

function parseVersions() {
  const raw = getArgValue("versions");
  if (!raw) return defaultVersions;

  const versions = raw
    .split(",")
    .map((version) => version.trim().toLowerCase())
    .filter(Boolean);
  const invalidVersions = versions.filter((version) => !defaultVersions.includes(version as MetadataExtractionVersion));

  if (invalidVersions.length > 0) {
    throw new Error(`Invalid metadata extraction versions: ${invalidVersions.join(", ")}. Use v1, v2, and/or v3.`);
  }

  return versions.length > 0 ? (versions as MetadataExtractionVersion[]) : defaultVersions;
}

function parseThresholds() {
  const raw = getArgValue("thresholds") ?? getArgValue("threshold");
  if (!raw) return [defaultThreshold];

  const values = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite)
    .map((value) => Math.min(1, Math.max(0, value)));

  return values.length > 0 ? Array.from(new Set(values)) : [defaultThreshold];
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\bgrm\b|\bgr\b/g, "grow room")
    .replace(/\brm\b/g, "room")
    .replace(/\b0+(\d+)/g, "$1")
    .replace(/\s+/g, "")
    .trim();
}

function buildGroundTruthByIdentifier(seedDatapoints: SeedDatapoint[]) {
  const truthByIdentifier = new Map<string, string>();
  const missingGroundTruth: string[] = [];

  for (const datapoint of seedDatapoints) {
    if (!datapoint.groundTruth?.trim()) {
      missingGroundTruth.push(datapoint.identifier);
      continue;
    }

    truthByIdentifier.set(datapoint.identifier, normalizeLabel(datapoint.groundTruth));
  }

  if (missingGroundTruth.length > 0) {
    throw new Error(
      `docs/iser.datapoints3-ground-truth.json is missing groundTruth for ${missingGroundTruth.length} datapoints: ` +
        missingGroundTruth.slice(0, 10).join(", "),
    );
  }

  return truthByIdentifier;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function extractMetadataForVersion(
  datapoints: BatchedDatapointInput[],
  version: MetadataExtractionVersion,
  batchSize: number,
) {
  const metadataByIdentifier = new Map<string, ExtractedMetadata>();
  let tokenCost = 0;
  const startedAt = Date.now();

  if (version === "v1") {
    log(`Starting v1 extraction for ${datapoints.length} datapoints.`);

    for (const [index, datapoint] of datapoints.entries()) {
      const result = await extractMetadata(datapoint.rawName, datapoint.identifier, datapoint.manufacturer);
      metadataByIdentifier.set(datapoint.identifier, result.metadata);
      tokenCost += result.totalTokensUsed;

      if ((index + 1) % 25 === 0 || index + 1 === datapoints.length) {
        log(
          `v1 extraction progress: ${index + 1}/${datapoints.length} datapoints, ` +
            `${tokenCost} tokens, elapsed ${formatDuration(startedAt)}.`,
        );
      }
    }

    log(`Finished v1 extraction in ${formatDuration(startedAt)} with ${tokenCost} tokens.`);
    return { metadataByIdentifier, tokenCost };
  }

  const datapointBatches = chunk(datapoints, batchSize);
  log(`Starting ${version} extraction for ${datapoints.length} datapoints in ${datapointBatches.length} batches.`);

  for (const [index, datapointBatch] of datapointBatches.entries()) {
    const batchStartedAt = Date.now();
    log(
      `${version} batch ${index + 1}/${datapointBatches.length}: extracting ${datapointBatch.length} datapoints.`,
    );

    const result =
      version === "v3"
        ? await extractRoomMetadataBatch(datapointBatch)
        : await extractMetadataBatch(datapointBatch);

    for (const [identifier, metadata] of Object.entries(result.results)) {
      metadataByIdentifier.set(identifier, metadata);
    }
    tokenCost += result.totalTokensUsed;

    log(
      `${version} batch ${index + 1}/${datapointBatches.length}: received ` +
        `${Object.keys(result.results).length}/${datapointBatch.length} results, ` +
        `${result.totalTokensUsed} tokens, batch elapsed ${formatDuration(batchStartedAt)}, ` +
        `total elapsed ${formatDuration(startedAt)}.`,
    );
  }

  log(`Finished ${version} extraction in ${formatDuration(startedAt)} with ${tokenCost} tokens.`);
  return { metadataByIdentifier, tokenCost };
}

function buildPredictedLabels(datapoints: DatapointSummary[], threshold: number) {
  const clusters = buildRoomClusters(datapoints, threshold);
  const labels = new Map<string, string>();

  clusters.forEach((cluster, index) => {
    const label = `cluster${index + 1}`;
    cluster.datapoints.forEach((datapoint) => labels.set(datapoint.identifier, label));
  });

  return { clusters, labels };
}

function combinations2(value: number) {
  return value < 2 ? 0 : (value * (value - 1)) / 2;
}

function calculatePairwiseMetrics(trueLabels: string[], predictedLabels: string[]) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (let left = 0; left < trueLabels.length; left += 1) {
    for (let right = left + 1; right < trueLabels.length; right += 1) {
      const sameTruth = trueLabels[left] === trueLabels[right];
      const samePrediction = predictedLabels[left] === predictedLabels[right];

      if (sameTruth && samePrediction) truePositive += 1;
      if (!sameTruth && samePrediction) falsePositive += 1;
      if (sameTruth && !samePrediction) falseNegative += 1;
    }
  }

  const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1 };
}

function calculateAdjustedRandIndex(trueLabels: string[], predictedLabels: string[]) {
  const total = trueLabels.length;
  if (total < 2) return 1;

  const contingency = new Map<string, number>();
  const truthCounts = new Map<string, number>();
  const predictionCounts = new Map<string, number>();

  trueLabels.forEach((truth, index) => {
    const prediction = predictedLabels[index]!;
    contingency.set(`${truth}\u0000${prediction}`, (contingency.get(`${truth}\u0000${prediction}`) ?? 0) + 1);
    truthCounts.set(truth, (truthCounts.get(truth) ?? 0) + 1);
    predictionCounts.set(prediction, (predictionCounts.get(prediction) ?? 0) + 1);
  });

  const sumContingency = Array.from(contingency.values()).reduce((sum, value) => sum + combinations2(value), 0);
  const sumTruth = Array.from(truthCounts.values()).reduce((sum, value) => sum + combinations2(value), 0);
  const sumPrediction = Array.from(predictionCounts.values()).reduce((sum, value) => sum + combinations2(value), 0);
  const totalPairs = combinations2(total);
  const expectedIndex = (sumTruth * sumPrediction) / totalPairs;
  const maxIndex = (sumTruth + sumPrediction) / 2;
  const denominator = maxIndex - expectedIndex;

  if (denominator === 0) {
    return sumContingency === maxIndex ? 1 : 0;
  }

  return (sumContingency - expectedIndex) / denominator;
}

function roundMetric(value: number) {
  return Number(value.toFixed(4));
}

async function evaluateRun(
  dbDatapoints: DatapointSummary[],
  truthByIdentifier: Map<string, string>,
  version: MetadataExtractionVersion,
  batchSize: number,
  thresholds: number[],
): Promise<EvaluationRow[]> {
  const startedAt = Date.now();
  log(`Evaluating ${version} with batch size ${batchSize} across thresholds: ${thresholds.join(", ")}.`);

  const extractionInput = dbDatapoints.map(({ rawName, identifier, manufacturer }) => ({
    rawName,
    identifier,
    manufacturer,
  }));
  const { metadataByIdentifier, tokenCost } = await extractMetadataForVersion(extractionInput, version, batchSize);

  const enrichedDatapoints = dbDatapoints.map((datapoint) => ({
    ...datapoint,
    metadata: metadataByIdentifier.get(datapoint.identifier),
  }));
  const rows = thresholds.map((threshold) => {
    log(`${version} batch size ${batchSize}, threshold ${threshold}: building room clusters.`);
    const { clusters, labels: predictedLabelsByIdentifier } = buildPredictedLabels(enrichedDatapoints, threshold);
    log(`${version} batch size ${batchSize}, threshold ${threshold}: generated ${clusters.length} clusters.`);

    const evaluableDatapoints = enrichedDatapoints.filter((datapoint) =>
      truthByIdentifier.has(datapoint.identifier),
    );
    const trueLabels = evaluableDatapoints.map((datapoint) => truthByIdentifier.get(datapoint.identifier)!);
    const predictedLabels = evaluableDatapoints.map(
      (datapoint) => predictedLabelsByIdentifier.get(datapoint.identifier) ?? "unassigned",
    );
    log(
      `${version} batch size ${batchSize}, threshold ${threshold}: ` +
        `calculating metrics for ${evaluableDatapoints.length} datapoints.`,
    );

    const pairwise = calculatePairwiseMetrics(trueLabels, predictedLabels);
    const row = {
      version,
      batchSize,
      threshold,
      datapoints: evaluableDatapoints.length,
      clusters: clusters.length,
      precision: roundMetric(pairwise.precision),
      recall: roundMetric(pairwise.recall),
      f1: roundMetric(pairwise.f1),
      adjustedRandIndex: roundMetric(calculateAdjustedRandIndex(trueLabels, predictedLabels)),
      tokenCost,
    };

    log(
      `${version} batch size ${batchSize}, threshold ${threshold}: ` +
        `(precision=${row.precision}, recall=${row.recall}, f1=${row.f1}, ` +
        `ari=${row.adjustedRandIndex}, tokens=${tokenCost}).`,
    );

    return row;
  });

  log(`${version} batch size ${batchSize}: completed in ${formatDuration(startedAt)}.`);
  return rows;
}

async function main() {
  const scriptStartedAt = Date.now();
  const batchSizes = parseBatchSizes();
  const versions = parseVersions();
  const thresholds = parseThresholds();
  log(`Loading ground truth from docs/iser.datapoints3-ground-truth.json.`);
  const truthByIdentifier = buildGroundTruthByIdentifier(groundTruthDatapoints as SeedDatapoint[]);
  log(`Loaded ${truthByIdentifier.size} ground-truth labels.`);

  log("Connecting to MongoDB.");
  await connectToDatabase();
  log("Connected to MongoDB.");

  log("Loading third seed site MAN-03.");
  const site = await SiteModel.findOne({ code: "MAN-03" }).lean();
  if (!site) {
    throw new Error("Third seed site MAN-03 was not found. Start the API once so development seed data is inserted.");
  }

  log(`Loading datapoints for ${site.name} (${site.code}).`);
  const datapoints = await DatapointModel.find({ siteId: site._id }).sort({ identifier: 1 }).lean();
  const dbDatapoints: DatapointSummary[] = datapoints.map((datapoint) => ({
    id: datapoint._id.toString(),
    siteId: datapoint.siteId.toString(),
    rawName: datapoint.rawName,
    identifier: datapoint.identifier,
    manufacturer: datapoint.manufacturer,
    metadata: datapoint.metadata as ExtractedMetadata | undefined,
  }));

  if (dbDatapoints.length === 0) {
    throw new Error("Third seed site MAN-03 has no datapoints.");
  }

  const missingTruthCount = dbDatapoints.filter((datapoint) => !truthByIdentifier.has(datapoint.identifier)).length;
  if (missingTruthCount > 0) {
    throw new Error(`Ground-truth labels are missing for ${missingTruthCount} datapoints on MAN-03.`);
  }

  log(
    `Evaluating ${dbDatapoints.length} datapoints from MAN-03 at clustering thresholds ${thresholds.join(", ")}. ` +
      "tokenCost is total OpenAI tokens used.",
  );
  log(`Metadata extraction versions: ${versions.join(", ")}.`);
  log(`Batch sizes for v2/v3: ${batchSizes.join(", ")}. v1 runs with batch size 1.`);

  const rows: EvaluationRow[] = [];

  for (const version of versions) {
    const sizes = version === "v1" ? [1] : batchSizes;
    for (const batchSize of sizes) {
      rows.push(...(await evaluateRun(dbDatapoints, truthByIdentifier, version, batchSize, thresholds)));
    }
  }

  log(`Evaluation completed in ${formatDuration(scriptStartedAt)}.`);
  console.table(rows);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    log("Disconnecting from MongoDB.");
    await mongoose.disconnect();
  });
