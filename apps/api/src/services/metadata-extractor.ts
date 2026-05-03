import OpenAI from "openai";
import type { ExtractedMetadata } from "@iser/shared";

import { env } from "../config/env.js";
import type {
  BatchedDatapointInput,
  BatchedMetadataExtractionResult,
  MetadataExtractionResult,
} from "../types/metadata.js";

const fallbackToken = "unknown";

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || fallbackToken;
}

function heuristicExtract(rawName: string): ExtractedMetadata {
  const tokens = normalizeToken(rawName).split(/\s+/).filter(Boolean);
  const roomToken = tokens.find((token) => token.startsWith("room") || token.startsWith("grow"));
  const ahuToken = tokens.find((token) => /(ahu|rtu|fan|pump|sensor)/.test(token));
  const zoneToken = tokens.find((token) => /^z\d+$/i.test(token));
  const tempToken = tokens.find((token) => /(temp|temperature|humidity|pressure|co2)/.test(token));

  return {
    roomCandidate: roomToken ?? fallbackToken,
    roomAliases: roomToken ? [roomToken, roomToken.replace("grow", "grm")] : [],
    equipmentGroup: ahuToken ?? fallbackToken,
    deviceInstance: ahuToken ?? fallbackToken,
    deviceType: tempToken ?? fallbackToken,
    subzone: zoneToken ?? fallbackToken,
    confidence: 0.45,
  };
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openaiClient;
}

export async function extractMetadata(rawName: string, identifier: string, manufacturer: string) {
  const client = getOpenAIClient();

  if (!client) {
    return {
      metadata: heuristicExtract(rawName),
      totalTokensUsed: 0,
    } satisfies MetadataExtractionResult;
  }

  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              `
              You are extracting structured metadata from industrial IoT datapoints.

Your goal is to interpret messy, inconsistent naming and return conservative, reusable metadata that can generalize across clients.

Important principles:
1. Do not hallucinate.
2. Prefer "unknown" over a weak guess.
3. Distinguish carefully between room identity, equipment identity, and measurement/control type.
4. Preserve evidence from the input instead of inventing long semantic expansions.
5. Use lowercase snake_case for all non-array string values.
6. room_aliases must contain only aliases that refer to the same physical room as room_candidate.
7. If no reliable room evidence exists, set room_candidate to "unknown" and room_aliases to [].

Field definitions:
- room_candidate:
  The most likely normalized identifier of the physical room or grow room referenced by the datapoint.
  This must refer only to location/room identity.
  It must NOT be an equipment name, device instance, sensor type, signal type, or subsystem.
  Good examples: "grm_a", "grm_b", "room_3"
  Bad examples: "ahu1", "coil", "co2", "supply_air_temp"

- room_aliases:
  A list of short aliases explicitly supported by the rawName and identifier that appear to refer to the same room as room_candidate.
  Include only aliases grounded in rawName and identifier.
  Do not invent aliases.
  Do not include generic terms like "room", "grow", "zone".
  Try to have more than one alias if possible but only if they are well supported by the input.

- equipment_group:
  The broad equipment family or subsystem, if present.
  Examples: "ahu", "irrigation", "lighting", "co2", "valve", "coil", "pump", "fan", "sensor"
  If unclear, return "unknown".

- device_instance:
  The specific device instance if present.
  Examples: "ahu1", "ahu2", "rtu3"
  If there is no clear instance, return "unknown".

- device_type:
  The signal or datapoint type.
  Examples: "supply_air_temp", "return_air_temp", "humidity", "co2", "flow", "pressure", "status", "command", "setpoint"
  If unclear, return "unknown".

- subzone:
  A finer location within the room, such as "z1", "z2", "bay_3", if clearly supported by the input.
  Otherwise return "unknown".

- confidence:
  A number between 0 and 1 representing confidence in the overall extraction.

Critical disambiguation rules:
- Tokens like AHU, RTU, fan, pump, coil, valve, duct, sensor, SAT, RAT, RH, CO2, flow, pressure usually indicate equipment or signal type, not room identity.
- A room_candidate should be based on location-like evidence such as room labels, grow room aliases, or repeated location markers.
- Do not expand abbreviations into speculative long phrases.
  For example, do not turn "GRMA" into "greenhouse_maintenance_area" unless the full phrase is explicitly present.
- If a token could be either room or equipment, prefer "unknown" unless the location meaning is clearly stronger.

Return only valid JSON matching the schema.
              `,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ rawName, identifier, manufacturer }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "datapoint_metadata",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "roomCandidate",
            "roomAliases",
            "equipmentGroup",
            "deviceInstance",
            "deviceType",
            "subzone",
            "confidence",
          ],
          properties: {
            roomCandidate: { type: "string" },
            roomAliases: { type: "array", items: { type: "string" } },
            equipmentGroup: { type: "string" },
            deviceInstance: { type: "string" },
            deviceType: { type: "string" },
            subzone: { type: "string" },
            confidence: { type: "number" },
          },
        },
      },
    },
  });

  const text = response.output_text;

  if (!text) {
    return {
      metadata: heuristicExtract(rawName),
      totalTokensUsed: response.usage?.total_tokens ?? 0,
    } satisfies MetadataExtractionResult;
  }

  return {
    metadata: JSON.parse(text) as ExtractedMetadata,
    totalTokensUsed: response.usage?.total_tokens ?? 0,
  } satisfies MetadataExtractionResult;
}

export async function extractMetadataBatch(datapoints: BatchedDatapointInput[]) {
  const client = getOpenAIClient();

  if (!client) {
    return {
      results: Object.fromEntries(
        datapoints.map((datapoint) => [datapoint.identifier, heuristicExtract(datapoint.rawName)]),
      ),
      totalTokensUsed: 0,
    } satisfies BatchedMetadataExtractionResult;
  }

  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are extracting structured metadata from industrial IoT datapoints in batches. " +
              "Return JSON with a datapoints array. Each item must include identifier, roomCandidate, roomAliases, " +
              "equipmentGroup, deviceInstance, deviceType, subzone, confidence. " +
              "Use only evidence in each datapoint plus neighboring context in the batch. " +
              "Do not mix identifiers or invent unsupported aliases. Use lowercase snake_case for scalar string values.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ datapoints }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "batched_datapoint_metadata",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["datapoints"],
          properties: {
            datapoints: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "identifier",
                  "roomCandidate",
                  "roomAliases",
                  "equipmentGroup",
                  "deviceInstance",
                  "deviceType",
                  "subzone",
                  "confidence",
                ],
                properties: {
                  identifier: { type: "string" },
                  roomCandidate: { type: "string" },
                  roomAliases: { type: "array", items: { type: "string" } },
                  equipmentGroup: { type: "string" },
                  deviceInstance: { type: "string" },
                  deviceType: { type: "string" },
                  subzone: { type: "string" },
                  confidence: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  });

  const text = response.output_text;
  if (!text) {
    return {
      results: Object.fromEntries(
        datapoints.map((datapoint) => [datapoint.identifier, heuristicExtract(datapoint.rawName)]),
      ),
      totalTokensUsed: response.usage?.total_tokens ?? 0,
    } satisfies BatchedMetadataExtractionResult;
  }

  const parsed = JSON.parse(text) as {
    datapoints: Array<{ identifier: string } & ExtractedMetadata>;
  };

  const results = Object.fromEntries(
    datapoints.map((datapoint) => [datapoint.identifier, heuristicExtract(datapoint.rawName)]),
  );

  parsed.datapoints.forEach((item) => {
    results[item.identifier] = {
      roomCandidate: item.roomCandidate,
      roomAliases: item.roomAliases,
      equipmentGroup: item.equipmentGroup,
      deviceInstance: item.deviceInstance,
      deviceType: item.deviceType,
      subzone: item.subzone,
      confidence: item.confidence,
    };
  });

  return {
    results,
    totalTokensUsed: response.usage?.total_tokens ?? 0,
  } satisfies BatchedMetadataExtractionResult;
}

export async function extractRoomMetadataBatch(datapoints: BatchedDatapointInput[]) {
  const client = getOpenAIClient();

  if (!client) {
    return {
      results: Object.fromEntries(
        datapoints.map((datapoint) => {
          const metadata = heuristicExtract(datapoint.rawName);
          return [
            datapoint.identifier,
            {
              roomCandidate: metadata.roomCandidate,
              roomAliases: metadata.roomAliases,
              confidence: metadata.confidence,
            },
          ];
        }),
      ),
      totalTokensUsed: 0,
    } satisfies BatchedMetadataExtractionResult;
  }

  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are extracting only room-identification metadata from industrial IoT datapoints in batches. " +
              "Focus on physical room identity and aliases only. Return JSON with a datapoints array. " +
              "Each item must include identifier, roomCandidate, roomAliases, confidence. " +
              "Do not return equipment, device, signal, or subzone metadata. " +
              "Use neighboring datapoints only to resolve room naming patterns. Do not invent aliases.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ datapoints }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "batched_room_metadata",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["datapoints"],
          properties: {
            datapoints: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["identifier", "roomCandidate", "roomAliases", "confidence"],
                properties: {
                  identifier: { type: "string" },
                  roomCandidate: { type: "string" },
                  roomAliases: { type: "array", items: { type: "string" } },
                  confidence: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  });

  const fallbackResults = Object.fromEntries(
    datapoints.map((datapoint) => {
      const metadata = heuristicExtract(datapoint.rawName);
      return [
        datapoint.identifier,
        {
          roomCandidate: metadata.roomCandidate,
          roomAliases: metadata.roomAliases,
          confidence: metadata.confidence,
        },
      ];
    }),
  );

  const text = response.output_text;
  if (!text) {
    return {
      results: fallbackResults,
      totalTokensUsed: response.usage?.total_tokens ?? 0,
    } satisfies BatchedMetadataExtractionResult;
  }

  const parsed = JSON.parse(text) as {
    datapoints: Array<{
      identifier: string;
      roomCandidate: string;
      roomAliases: string[];
      confidence: number;
    }>;
  };

  const results = { ...fallbackResults };
  parsed.datapoints.forEach((item) => {
    results[item.identifier] = {
      roomCandidate: item.roomCandidate,
      roomAliases: item.roomAliases,
      confidence: item.confidence,
    };
  });

  return {
    results,
    totalTokensUsed: response.usage?.total_tokens ?? 0,
  } satisfies BatchedMetadataExtractionResult;
}
