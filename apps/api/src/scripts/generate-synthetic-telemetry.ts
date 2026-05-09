import mongoose from "mongoose";

import type { GenerateSyntheticTelemetryInput } from "@iser/shared";

import { connectToDatabase } from "../lib/mongoose.js";
import { generateSyntheticTelemetry } from "../services/telemetry-generation.js";

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const inlineValue = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (inlineValue !== undefined) return inlineValue;

  const argIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (argIndex === -1) return undefined;

  const value = process.argv[argIndex + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function parseStringList(name: string) {
  const raw = getArgValue(name);
  return raw
    ? raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;
}

function parseNumber(name: string, defaultValue?: number) {
  const raw = getArgValue(name);
  if (!raw) return defaultValue;
  const value = Number(raw);
  return Number.isFinite(value) ? value : defaultValue;
}

function parseDate(name: string) {
  const raw = getArgValue(name);
  if (!raw) return undefined;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

async function main() {
  const siteId = getArgValue("site-id") ?? getArgValue("siteId");
  if (!siteId) {
    throw new Error("Missing required --site-id argument");
  }

  const valueMode = (getArgValue("value-mode") ?? "range").toLowerCase();
  const datapointIdentifiers = parseStringList("datapoints") ?? parseStringList("datapoint");
  const startAt = parseDate("start-at") ?? parseDate("startAt");
  const endAt = parseDate("end-at") ?? parseDate("endAt");
  const granularityMinutes = parseNumber("granularity", 5);
  const errorMargin = parseNumber("error-margin", 0.05);
  const missingValueMargin = parseNumber("missing-value-margin", 0.1);

  if (!startAt || !endAt) {
    throw new Error("Missing required --start-at and/or --end-at arguments");
  }

  const valueSpec: GenerateSyntheticTelemetryInput["valueSpec"] =
    valueMode === "list"
      ? {
          kind: "list" as const,
          values: parseStringList("allowed-values") ?? parseStringList("values") ?? [],
        }
      : valueMode === "percentage"
        ? {
            kind: "percentage" as const,
          }
        : {
            kind: "range" as const,
            min: parseNumber("range-min", 0) ?? 0,
            max: parseNumber("range-max", 5) ?? 5,
          };

  await connectToDatabase();

  const result = await generateSyntheticTelemetry(siteId, {
    datapointIdentifiers,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    granularityMinutes: granularityMinutes === 1 ? 1 : 5,
    errorMargin: Math.min(1, Math.max(0, errorMargin ?? 0.05)),
    missingValueMargin: Math.min(1, Math.max(0, missingValueMargin ?? 0.1)),
    valueSpec,
  });

  if (!result) {
    throw new Error(`Site not found: ${siteId}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
