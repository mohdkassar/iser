import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions/completions.js";
import { Types } from "mongoose";
import { z } from "zod";
import type { RoomAgentRequest, RoomAgentResponse, RoomAgentUsage } from "@iser/shared";

import { env } from "../config/env.js";
import { ClusterModel } from "../models/cluster.js";
import { DatapointModel } from "../models/datapoint.js";
import { DatapointTelemetryModel } from "../models/datapoint-telemetry.js";
import { SiteModel } from "../models/site.js";

const roomAgentRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1),
    }),
  ),
});

const roomAgentTools = [
  {
    type: "function",
    function: {
      name: "get_room_context",
      description:
        "Fetch the room summary, aliases, and a compact datapoint list from MongoDB. Use this before answering room-level questions.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50,
            description: "Maximum number of datapoints to include in the compact summary.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_room_datapoints",
      description:
        "Search datapoints in the room by raw name, identifier, metadata, aliases, or manufacturer.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1 },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 50,
            description: "Maximum number of matches to return.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_telemetry_sample",
      description:
        "Fetch a limited sample of telemetry documents for one or more datapoints in the room. Use this when the user asks for raw examples.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          datapointIdentifiers: {
            type: "array",
            items: { type: "string" },
            description: "Specific datapoint identifiers to sample. Leave empty to sample the whole room.",
          },
          startAt: {
            type: "string",
            description: "ISO 8601 start time. Optional.",
          },
          endAt: {
            type: "string",
            description: "ISO 8601 end time. Optional.",
          },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 200,
            description: "Maximum number of telemetry documents to return.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_telemetry_aggregation",
      description:
        "Run one of the predefined telemetry aggregation templates over room datapoints. Use this for analysis instead of raw telemetry when possible.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["templateName"],
        properties: {
          templateName: {
            type: "string",
            enum: ["summary_stats", "hourly_buckets", "value_distribution"],
          },
          datapointIdentifiers: {
            type: "array",
            items: { type: "string" },
            description: "Specific datapoint identifiers to analyze. Leave empty to analyze the whole room.",
          },
          startAt: {
            type: "string",
            description: "ISO 8601 start time. Optional.",
          },
          endAt: {
            type: "string",
            description: "ISO 8601 end time. Optional.",
          },
        },
      },
    },
  },
] satisfies ChatCompletionTool[];

type RoomDatapointSummary = {
  id: string;
  rawName: string;
  identifier: string;
  manufacturer: string;
  humanReadableName: string;
  metadata?: {
    roomCandidate?: string;
    roomAliases?: string[];
    equipmentGroup?: string;
    deviceInstance?: string;
    deviceType?: string;
    subzone?: string;
    confidence?: number;
  };
};

type RoomContext = {
  site: {
    id: string;
    name: string;
    code: string;
  };
  room: {
    id: string;
    label: string;
    status: string;
    type: string;
    aliases: string[];
  };
  datapoints: RoomDatapointSummary[];
};

type TelemetryAggregationTemplate = "summary_stats" | "hourly_buckets" | "value_distribution";

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

function toId(value: unknown) {
  return String(value);
}

function normalizeAliases(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const aliases = (metadata as { aliases?: unknown }).aliases;
  return Array.isArray(aliases)
    ? aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
    : [];
}

function toDatapointSummary(document: any): RoomDatapointSummary {
  return {
    id: toId(document._id),
    rawName: document.rawName,
    identifier: document.identifier,
    manufacturer: document.manufacturer,
    humanReadableName: document.metadata?.humanReadableName ?? document.rawName,
    metadata: document.metadata
      ? {
          roomCandidate: document.metadata.roomCandidate,
          roomAliases: Array.isArray(document.metadata.roomAliases) ? document.metadata.roomAliases : [],
          equipmentGroup: document.metadata.equipmentGroup,
          deviceInstance: document.metadata.deviceInstance,
          deviceType: document.metadata.deviceType,
          subzone: document.metadata.subzone,
          confidence: document.metadata.confidence,
        }
      : undefined,
  };
}

function toRoomContext(site: any, cluster: any, datapoints: any[]): RoomContext {
  return {
    site: {
      id: toId(site._id),
      name: site.name,
      code: site.code,
    },
    room: {
      id: toId(cluster._id),
      label: cluster.label,
      status: cluster.status,
      type: cluster.type,
      aliases: normalizeAliases(cluster.metadata),
    },
    datapoints: datapoints.map(toDatapointSummary).sort((left, right) => {
      const leftName = left.humanReadableName ?? left.rawName;
      const rightName = right.humanReadableName ?? right.rawName;
      return leftName.localeCompare(rightName);
    }),
  };
}

async function loadRoomContext(siteId: string, clusterId: string) {
  const siteObjectId = new Types.ObjectId(siteId);
  const [site, cluster] = await Promise.all([
    SiteModel.findById(siteId).lean(),
    ClusterModel.findOne({
      _id: clusterId,
      siteId: siteObjectId,
      type: "room",
    }).lean(),
  ]);

  if (!site || !cluster) {
    return null;
  }

  const datapoints = await DatapointModel.find({
    _id: { $in: cluster.datapointIds },
    siteId: siteObjectId,
  }).lean();

  return {
    site,
    cluster,
    room: toRoomContext(site, cluster, datapoints),
  };
}

function parseDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return date;
}

function clampLimit(value: number | undefined, max: number, fallback: number) {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(value as number)));
}

function scoreDatapoint(datapoint: RoomDatapointSummary, query: string) {
  const searchable = [
    datapoint.rawName,
    datapoint.identifier,
    datapoint.manufacturer,
    datapoint.humanReadableName,
    datapoint.metadata?.roomCandidate,
    ...(datapoint.metadata?.roomAliases ?? []),
    datapoint.metadata?.equipmentGroup,
    datapoint.metadata?.deviceInstance,
    datapoint.metadata?.deviceType,
    datapoint.metadata?.subzone,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  if (!query) {
    return 1;
  }

  let score = 0;
  for (const field of searchable) {
    if (field === query) {
      score += 10;
    } else if (field.includes(query)) {
      score += 3;
    }
  }

  return score;
}

async function getRoomContextTool(siteId: string, clusterId: string, limit = 12) {
  const context = await loadRoomContext(siteId, clusterId);
  if (!context) {
    return null;
  }

  return {
    site: context.room.site,
    room: context.room.room,
    datapointCount: context.room.datapoints.length,
    datapoints: context.room.datapoints.slice(0, clampLimit(limit, 50, 12)),
  };
}

async function searchRoomDatapointsTool(
  siteId: string,
  clusterId: string,
  query: string,
  limit = 20,
) {
  const context = await loadRoomContext(siteId, clusterId);
  if (!context) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const ranked = context.room.datapoints
    .map((datapoint) => ({ datapoint, score: scoreDatapoint(datapoint, normalizedQuery) }))
    .filter(({ score }) => normalizedQuery.length === 0 || score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.datapoint.humanReadableName.localeCompare(right.datapoint.humanReadableName),
    )
    .slice(0, clampLimit(limit, 50, 20))
    .map(({ datapoint, score }) => ({ ...datapoint, score }));

  return {
    query,
    matches: ranked,
  };
}

function buildTelemetryMatch(siteId: string, datapointIdentifiers: string[], startAt?: string, endAt?: string) {
  const match: Record<string, unknown> = {
    siteId: new Types.ObjectId(siteId),
    datapointIdentifier: { $in: datapointIdentifiers },
  };

  const timestamp: Record<string, unknown> = {};
  const startDate = parseDate(startAt);
  const endDate = parseDate(endAt);

  if (startDate) {
    timestamp.$gte = startDate;
  }

  if (endDate) {
    timestamp.$lte = endDate;
  }

  if (Object.keys(timestamp).length > 0) {
    match.timestamp = timestamp;
  }

  return match;
}

async function getTelemetrySampleTool(
  siteId: string,
  clusterId: string,
  input: {
    datapointIdentifiers?: string[];
    startAt?: string;
    endAt?: string;
    limit?: number;
  },
) {
  const context = await loadRoomContext(siteId, clusterId);
  if (!context) {
    return null;
  }

  const roomIdentifiers = context.room.datapoints.map((datapoint) => datapoint.identifier);
  const datapointIdentifiers =
    input.datapointIdentifiers && input.datapointIdentifiers.length > 0
      ? input.datapointIdentifiers.filter((identifier) => roomIdentifiers.includes(identifier))
      : roomIdentifiers;

  if (datapointIdentifiers.length === 0) {
    return {
      datapointIdentifiers: [],
      sampleCount: 0,
      samples: [],
    };
  }

  const limit = clampLimit(input.limit, 200, 50);
  const docs = await DatapointTelemetryModel.find(
    buildTelemetryMatch(siteId, datapointIdentifiers, input.startAt, input.endAt),
  )
    .sort({ timestamp: 1, datapointIdentifier: 1 })
    .limit(limit)
    .lean();

  const grouped = new Map<string, Array<{ timestamp: string; value: string }>>();
  for (const doc of docs) {
    const bucket = grouped.get(doc.datapointIdentifier) ?? [];
    bucket.push({
      timestamp: new Date(doc.timestamp).toISOString(),
      value: doc.value,
    });
    grouped.set(doc.datapointIdentifier, bucket);
  }

  return {
    datapointIdentifiers,
    sampleCount: docs.length,
    truncated: docs.length >= limit,
    samples: [...grouped.entries()].map(([identifier, samples]) => ({
      identifier,
      samples,
    })),
  };
}

async function getTelemetryAggregationTool(
  siteId: string,
  clusterId: string,
  input: {
    templateName: TelemetryAggregationTemplate;
    datapointIdentifiers?: string[];
    startAt?: string;
    endAt?: string;
  },
) {
  const context = await loadRoomContext(siteId, clusterId);
  if (!context) {
    return null;
  }

  const roomIdentifiers = context.room.datapoints.map((datapoint) => datapoint.identifier);
  const datapointIdentifiers =
    input.datapointIdentifiers && input.datapointIdentifiers.length > 0
      ? input.datapointIdentifiers.filter((identifier) => roomIdentifiers.includes(identifier))
      : roomIdentifiers;

  if (datapointIdentifiers.length === 0) {
    return {
      templateName: input.templateName,
      datapointIdentifiers: [],
      results: [],
    };
  }

  const match = buildTelemetryMatch(siteId, datapointIdentifiers, input.startAt, input.endAt);

  if (input.templateName === "summary_stats") {
    const results = await DatapointTelemetryModel.aggregate([
      { $match: match },
      { $sort: { timestamp: 1 } },
      {
        $addFields: {
          numericValue: {
            $convert: {
              input: "$value",
              to: "double",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $group: {
          _id: "$datapointIdentifier",
          sampleCount: { $sum: 1 },
          firstTimestamp: { $first: "$timestamp" },
          lastTimestamp: { $last: "$timestamp" },
          firstValue: { $first: "$value" },
          lastValue: { $last: "$value" },
          numericSampleCount: {
            $sum: {
              $cond: [{ $ne: ["$numericValue", null] }, 1, 0],
            },
          },
          numericSum: {
            $sum: {
              $cond: [{ $ne: ["$numericValue", null] }, "$numericValue", 0],
            },
          },
          minNumericValue: { $min: "$numericValue" },
          maxNumericValue: { $max: "$numericValue" },
          samples: {
            $push: {
              timestamp: "$timestamp",
              value: "$value",
              numericValue: "$numericValue",
            },
          },
          uniqueValues: { $addToSet: "$value" },
        },
      },
      {
        $project: {
          sampleCount: 1,
          firstTimestamp: 1,
          lastTimestamp: 1,
          firstValue: 1,
          lastValue: 1,
          numericSampleCount: 1,
          numericSum: 1,
          minNumericValue: 1,
          maxNumericValue: 1,
          samples: 1,
          uniqueValueCount: { $size: "$uniqueValues" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      templateName: input.templateName,
      datapointIdentifiers,
      results: results.map((result) => ({
        identifier: result._id,
        sampleCount: result.sampleCount,
        firstTimestamp: result.firstTimestamp ? new Date(result.firstTimestamp).toISOString() : null,
        lastTimestamp: result.lastTimestamp ? new Date(result.lastTimestamp).toISOString() : null,
        firstValue: result.firstValue,
        lastValue: result.lastValue,
        numericSampleCount: result.numericSampleCount,
        minNumericValue: result.minNumericValue,
        maxNumericValue: result.maxNumericValue,
        minNumericValueTimestamp:
          result.minNumericValue === null || result.minNumericValue === undefined
            ? null
            : (result.samples.find((sample: { numericValue: number | null; timestamp: string }) =>
                sample.numericValue === result.minNumericValue,
              )?.timestamp
              ? new Date(
                  result.samples.find((sample: { numericValue: number | null; timestamp: string }) =>
                    sample.numericValue === result.minNumericValue,
                  )!.timestamp,
                ).toISOString()
              : null),
        maxNumericValueTimestamp:
          result.maxNumericValue === null || result.maxNumericValue === undefined
            ? null
            : (result.samples.find((sample: { numericValue: number | null; timestamp: string }) =>
                sample.numericValue === result.maxNumericValue,
              )?.timestamp
              ? new Date(
                  result.samples.find((sample: { numericValue: number | null; timestamp: string }) =>
                    sample.numericValue === result.maxNumericValue,
                  )!.timestamp,
                ).toISOString()
              : null),
        averageNumericValue:
          result.numericSampleCount > 0 ? result.numericSum / result.numericSampleCount : null,
        uniqueValueCount: result.uniqueValueCount,
      })),
    };
  }

  if (input.templateName === "hourly_buckets") {
    const results = await DatapointTelemetryModel.aggregate([
      { $match: match },
      {
        $addFields: {
          numericValue: {
            $convert: {
              input: "$value",
              to: "double",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $group: {
          _id: {
            datapointIdentifier: "$datapointIdentifier",
            bucket: {
              $dateTrunc: {
                date: "$timestamp",
                unit: "hour",
              },
            },
          },
          sampleCount: { $sum: 1 },
          numericSampleCount: {
            $sum: {
              $cond: [{ $ne: ["$numericValue", null] }, 1, 0],
            },
          },
          numericSum: {
            $sum: {
              $cond: [{ $ne: ["$numericValue", null] }, "$numericValue", 0],
            },
          },
          minNumericValue: { $min: "$numericValue" },
          maxNumericValue: { $max: "$numericValue" },
          samples: {
            $push: {
              timestamp: "$timestamp",
              value: "$value",
              numericValue: "$numericValue",
            },
          },
        },
      },
      {
        $sort: {
          "_id.datapointIdentifier": 1,
          "_id.bucket": 1,
        },
      },
    ]);

    const grouped = new Map<
      string,
      Array<{
        bucketStart: string;
        sampleCount: number;
        numericSampleCount: number;
        averageNumericValue: number | null;
        minNumericValue: number | null;
        maxNumericValue: number | null;
        minNumericValueTimestamp: string | null;
        maxNumericValueTimestamp: string | null;
      }>
    >();

    for (const result of results) {
      const bucket = grouped.get(result._id.datapointIdentifier) ?? [];
      const minNumericSample = result.samples.find(
        (sample: { numericValue: number | null; timestamp: string }) =>
          sample.numericValue === result.minNumericValue,
      );
      const maxNumericSample = result.samples.find(
        (sample: { numericValue: number | null; timestamp: string }) =>
          sample.numericValue === result.maxNumericValue,
      );
      bucket.push({
        bucketStart: new Date(result._id.bucket).toISOString(),
        sampleCount: result.sampleCount,
        numericSampleCount: result.numericSampleCount,
        averageNumericValue:
          result.numericSampleCount > 0 ? result.numericSum / result.numericSampleCount : null,
        minNumericValue: result.minNumericValue,
        maxNumericValue: result.maxNumericValue,
        minNumericValueTimestamp: minNumericSample ? new Date(minNumericSample.timestamp).toISOString() : null,
        maxNumericValueTimestamp: maxNumericSample ? new Date(maxNumericSample.timestamp).toISOString() : null,
      });
      grouped.set(result._id.datapointIdentifier, bucket);
    }

    return {
      templateName: input.templateName,
      datapointIdentifiers,
      results: [...grouped.entries()].map(([identifier, buckets]) => ({
        identifier,
        buckets,
      })),
    };
  }

  const results = await DatapointTelemetryModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          datapointIdentifier: "$datapointIdentifier",
          value: "$value",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        count: -1,
        "_id.datapointIdentifier": 1,
      },
    },
  ]);

  const grouped = new Map<string, Array<{ value: string; count: number }>>();
  for (const result of results) {
    const bucket = grouped.get(result._id.datapointIdentifier) ?? [];
    bucket.push({
      value: result._id.value,
      count: result.count,
    });
    grouped.set(result._id.datapointIdentifier, bucket);
  }

  return {
    templateName: input.templateName,
    datapointIdentifiers,
    results: [...grouped.entries()].map(([identifier, values]) => ({
      identifier,
      values: values.slice(0, 10),
    })),
  };
}

export async function askRoomAgent(
  siteId: string,
  clusterId: string,
  input: RoomAgentRequest,
): Promise<RoomAgentResponse | null> {
  const parsedInput = roomAgentRequestSchema.parse(input);
  const conversationMessages = parsedInput.messages.slice(-12);
  const context = await loadRoomContext(siteId, clusterId);
  if (!context) {
    return null;
  }

  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API key is not configured");
  }

  const systemPrompt = [
    "You are an analysis assistant for a single room in an industrial IoT application.",
    "Answer only using the room context and telemetry that you retrieve through tools.",
    "Keep responses concise, factual, and grounded in evidence.",
    "Prefer predefined telemetry aggregations over raw telemetry samples whenever possible.",
    "Use raw telemetry samples only when the user asks for examples or when aggregation is insufficient.",
    "Do not send large telemetry dumps in your final answer.",
    "When you use telemetry, explain what you inspected and what it implies.",
    `Current room: ${context.room.room.label} (${context.room.room.status}, ${context.room.room.type}).`,
    `Room aliases: ${context.room.room.aliases.length > 0 ? context.room.room.aliases.join(", ") : "none"}.`,
    `Datapoint count: ${context.room.datapoints.length}.`,
    "Available tools:",
    "- get_room_context(limit): fetch a compact room summary and a small datapoint sample.",
    "- search_room_datapoints(query, limit): search room datapoints by names, identifiers, aliases, or metadata.",
    "- get_telemetry_sample(datapointIdentifiers, startAt, endAt, limit): fetch a limited sample of raw telemetry rows.",
    "- get_telemetry_aggregation(templateName, datapointIdentifiers, startAt, endAt): run one of the predefined templates.",
    "Aggregation templates:",
    "- summary_stats: counts, timestamps, first/last values, and numeric stats per datapoint.",
    "- hourly_buckets: hourly trend buckets with numeric stats per datapoint.",
    "- value_distribution: counts of values per datapoint, useful for categorical telemetry.",
    "If you need more data, call a tool. If the question is ambiguous, ask a concise clarifying question.",
  ].join(" ");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let toolCallsUsed = 0;
  let responseText = "";

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      tools: roomAgentTools,
      tool_choice: "auto",
      temperature: 0.2,
    });

    promptTokens += response.usage?.prompt_tokens ?? 0;
    completionTokens += response.usage?.completion_tokens ?? 0;
    totalTokens += response.usage?.total_tokens ?? 0;

    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage) {
      break;
    }

    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      responseText = assistantMessage.content ?? "";
      break;
    }

    toolCallsUsed += assistantMessage.tool_calls.length;

    for (const toolCall of assistantMessage.tool_calls) {
      const parsedArguments = (() => {
        try {
          return JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          return {};
        }
      })();

      let toolResult: unknown = null;

      try {
        switch (toolCall.function.name) {
          case "get_room_context":
            toolResult = await getRoomContextTool(
              siteId,
              clusterId,
              typeof parsedArguments.limit === "number" ? parsedArguments.limit : undefined,
            );
            break;
          case "search_room_datapoints":
            toolResult = await searchRoomDatapointsTool(
              siteId,
              clusterId,
              typeof parsedArguments.query === "string" ? parsedArguments.query : "",
              typeof parsedArguments.limit === "number" ? parsedArguments.limit : undefined,
            );
            break;
          case "get_telemetry_sample":
            toolResult = await getTelemetrySampleTool(siteId, clusterId, {
              datapointIdentifiers: Array.isArray(parsedArguments.datapointIdentifiers)
                ? parsedArguments.datapointIdentifiers.filter((value): value is string => typeof value === "string")
                : undefined,
              startAt: typeof parsedArguments.startAt === "string" ? parsedArguments.startAt : undefined,
              endAt: typeof parsedArguments.endAt === "string" ? parsedArguments.endAt : undefined,
              limit: typeof parsedArguments.limit === "number" ? parsedArguments.limit : undefined,
            });
            break;
          case "get_telemetry_aggregation":
            toolResult = await getTelemetryAggregationTool(siteId, clusterId, {
              templateName:
                parsedArguments.templateName === "summary_stats" ||
                parsedArguments.templateName === "hourly_buckets" ||
                parsedArguments.templateName === "value_distribution"
                  ? parsedArguments.templateName
                  : "summary_stats",
              datapointIdentifiers: Array.isArray(parsedArguments.datapointIdentifiers)
                ? parsedArguments.datapointIdentifiers.filter((value): value is string => typeof value === "string")
                : undefined,
              startAt: typeof parsedArguments.startAt === "string" ? parsedArguments.startAt : undefined,
              endAt: typeof parsedArguments.endAt === "string" ? parsedArguments.endAt : undefined,
            });
            break;
          default:
            toolResult = {
              error: `Unknown tool: ${toolCall.function.name}`,
            };
            break;
        }
      } catch (error) {
        toolResult = {
          error: error instanceof Error ? error.message : "Tool execution failed",
        };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  if (!responseText) {
    throw new Error("The agent could not produce a response");
  }

  const usage: RoomAgentUsage = {
    promptTokens,
    completionTokens,
    totalTokens,
  };

  return {
    answer: responseText,
    usage,
    toolCallsUsed,
  };
}
