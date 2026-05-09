import { z } from "zod";

import type {
  GenerateSyntheticTelemetryInput,
  GenerateSyntheticTelemetryResponse,
} from "@iser/shared";

import { DatapointTelemetryModel } from "../models/datapoint-telemetry.js";
import { DatapointModel } from "../models/datapoint.js";
import { SiteModel } from "../models/site.js";

const telemetryInputSchema = z.object({
  datapointIdentifiers: z.array(z.string().min(1)).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  granularityMinutes: z.union([z.literal(1), z.literal(5)]),
  errorMargin: z.number().min(0).max(1),
  missingValueMargin: z.number().min(0).max(1),
  valueSpec: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("range"),
      min: z.number(),
      max: z.number(),
    }),
    z.object({
      kind: z.literal("list"),
      values: z.array(z.string().min(1)),
    }),
    z.object({
      kind: z.literal("percentage"),
    }),
  ]),
});

type NormalizedTelemetryInput = z.infer<typeof telemetryInputSchema>;

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function randomNumber(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function formatNumericValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function chooseRandom<T>(values: T[]) {
  return values[randomInt(values.length)];
}

function chooseDifferent<T>(values: T[], current: T) {
  if (values.length === 0) {
    return current;
  }

  if (values.length === 1) {
    return values[0] ?? current;
  }

  const alternatives = values.filter((value) => value !== current);
  return chooseRandom(alternatives) ?? current;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createNumericSeriesGenerator(
  min: number,
  max: number,
  errorMargin: number,
  sampleCount: number,
  percentage = false,
) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const span = Math.max(upper - lower, percentage ? 100 : 1);
  const baselineDriftLimit = span * (percentage ? 0.005 : 0.01);
  let index = 0;
  let current = randomNumber(lower, upper);
  let velocity = randomNumber(-span * 0.015, span * 0.015);
  let baseline = randomNumber(lower, upper);
  let anomalyStart = -1;
  let anomalyLength = 0;
  let anomalyMode: "drift" | "fluctuate" | null = null;
  let anomalyDirection = 1;
  let recoverySteps = 0;

  if (Math.random() < errorMargin) {
    anomalyLength = Math.max(3, Math.round(sampleCount * (0.08 + Math.random() * 0.12)));
    anomalyLength = Math.min(sampleCount, anomalyLength);
    anomalyStart = randomInt(Math.max(sampleCount - anomalyLength + 1, 1));
    if (anomalyStart + anomalyLength > sampleCount) {
      anomalyStart = Math.max(0, sampleCount - anomalyLength);
    }
    anomalyMode = Math.random() < 0.5 ? "drift" : "fluctuate";
    anomalyDirection = Math.random() < 0.5 ? -1 : 1;
  }

  return () => {
    const inAnomaly = anomalyMode !== null && index >= anomalyStart && index < anomalyStart + anomalyLength;
    const justExitedAnomaly = anomalyMode !== null && index === anomalyStart + anomalyLength;

    if (inAnomaly) {
      if (anomalyMode === "drift") {
        const step = randomNumber(span * 0.02, span * 0.06) * anomalyDirection;
        current += step;
        velocity = step;
      } else {
        current += randomNumber(-span * 0.12, span * 0.12);
      }
    } else if (justExitedAnomaly) {
      recoverySteps = Math.max(3, Math.round(sampleCount * 0.06));
    } else if (recoverySteps > 0) {
      current += (baseline - current) * 0.35;
      velocity *= 0.5;
      recoverySteps -= 1;
    } else {
      velocity = velocity * 0.8 + randomNumber(-baselineDriftLimit, baselineDriftLimit);
      current += velocity + randomNumber(-span * 0.01, span * 0.01);
      current += (randomNumber(lower, upper) - current) * 0.08;
      current = clamp(current, lower, upper);
      baseline = clamp(baseline * 0.9 + randomNumber(lower, upper) * 0.1, lower, upper);
    }

    index += 1;
    return formatNumericValue(current);
  };
}

function createCategoricalSeriesGenerator(values: string[], errorMargin: number, sampleCount: number) {
  let index = 0;
  let current = chooseRandom(values) ?? "UNKNOWN";
  let holdRemaining = Math.max(2, Math.round(sampleCount * 0.06));
  let anomalyStart = -1;
  let anomalyLength = 0;

  if (Math.random() < errorMargin) {
    anomalyLength = Math.max(3, Math.round(sampleCount * (0.1 + Math.random() * 0.15)));
    anomalyLength = Math.min(sampleCount, anomalyLength);
    anomalyStart = randomInt(Math.max(sampleCount - anomalyLength + 1, 1));
    if (anomalyStart + anomalyLength > sampleCount) {
      anomalyStart = Math.max(0, sampleCount - anomalyLength);
    }
  }

  return () => {
    const inAnomaly = anomalyStart >= 0 && index >= anomalyStart && index < anomalyStart + anomalyLength;

    if (inAnomaly) {
      if (index === anomalyStart || Math.random() < 0.75) {
        current = chooseDifferent(values, current);
      }
    } else if (holdRemaining <= 0) {
      current = chooseDifferent(values, current);
      holdRemaining = Math.max(2, Math.round(sampleCount * 0.04 + Math.random() * 4));
    } else {
      holdRemaining -= 1;
    }

    index += 1;
    return current;
  };
}

function* iterateTimestamps(startAt: Date, endAt: Date, granularityMinutes: 1 | 5) {
  const stepMs = granularityMinutes * 60_000;
  for (let timestamp = startAt.getTime(); timestamp <= endAt.getTime(); timestamp += stepMs) {
    yield new Date(timestamp);
  }
}

async function insertTelemetryChunk(
  documents: Array<{
    datapointIdentifier: string;
    timestamp: Date;
    value: string;
    siteId: string;
  }>,
) {
  if (documents.length === 0) return 0;
  await DatapointTelemetryModel.insertMany(documents, { ordered: false });
  return documents.length;
}

export async function generateSyntheticTelemetry(
  siteId: string,
  input: GenerateSyntheticTelemetryInput,
): Promise<GenerateSyntheticTelemetryResponse | null> {
  const parsedInput = telemetryInputSchema.parse(input);
  const site = await SiteModel.findById(siteId).lean();
  if (!site) return null;

  const startAt = new Date(parsedInput.startAt);
  const endAt = new Date(parsedInput.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("startAt and endAt must be valid dates");
  }
  if (endAt.getTime() < startAt.getTime()) {
    throw new Error("endAt must be after startAt");
  }

  if (parsedInput.valueSpec.kind === "range" && parsedInput.valueSpec.max < parsedInput.valueSpec.min) {
    throw new Error("valueSpec.max must be greater than or equal to valueSpec.min");
  }
  if (parsedInput.valueSpec.kind === "list" && parsedInput.valueSpec.values.length === 0) {
    throw new Error("valueSpec.values must not be empty");
  }

  const datapoints = await DatapointModel.find(
    parsedInput.datapointIdentifiers?.length
      ? { siteId, identifier: { $in: parsedInput.datapointIdentifiers } }
      : { siteId },
  )
    .select({ identifier: 1 })
    .lean();

  if (parsedInput.datapointIdentifiers?.length) {
    const found = new Set(datapoints.map((datapoint) => datapoint.identifier));
    const missing = parsedInput.datapointIdentifiers.filter((identifier) => !found.has(identifier));
    if (missing.length > 0) {
      throw new Error(`Unknown datapoint identifiers: ${missing.join(", ")}`);
    }
  }

  const documents: Array<{
    datapointIdentifier: string;
    timestamp: Date;
    value: string;
    siteId: string;
  }> = [];
  let recordsCreated = 0;
  let recordsSkipped = 0;
  const flushThreshold = 1000;
  const timestamps = [...iterateTimestamps(startAt, endAt, parsedInput.granularityMinutes)];

  for (const datapoint of datapoints) {
    const series =
      parsedInput.valueSpec.kind === "list"
        ? createCategoricalSeriesGenerator(parsedInput.valueSpec.values, parsedInput.errorMargin, timestamps.length)
        : createNumericSeriesGenerator(
            parsedInput.valueSpec.kind === "percentage" ? 0 : parsedInput.valueSpec.min,
            parsedInput.valueSpec.kind === "percentage" ? 100 : parsedInput.valueSpec.max,
            parsedInput.errorMargin,
            timestamps.length,
            parsedInput.valueSpec.kind === "percentage",
          );

    for (const timestamp of timestamps) {
      const value = series();
      if (Math.random() < parsedInput.missingValueMargin) {
        recordsSkipped += 1;
        continue;
      }

      documents.push({
        datapointIdentifier: datapoint.identifier,
        timestamp,
        value,
        siteId,
      });

      if (documents.length >= flushThreshold) {
        recordsCreated += await insertTelemetryChunk(documents.splice(0, documents.length));
      }
    }
  }

  recordsCreated += await insertTelemetryChunk(documents.splice(0, documents.length));

  return {
    siteId: String(site._id),
    siteName: site.name,
    datapointCount: datapoints.length,
    recordsCreated,
    recordsSkipped,
  };
}
