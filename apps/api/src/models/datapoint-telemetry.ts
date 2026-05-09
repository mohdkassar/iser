import { Schema, Types, model } from "mongoose";

const datapointTelemetrySchema = new Schema(
  {
    datapointIdentifier: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    value: { type: String, required: true },
    siteId: { type: Types.ObjectId, ref: "Site", required: true, index: true },
  },
  {
    collection: "datapointTelemetry",
  },
);

datapointTelemetrySchema.index({ siteId: 1, datapointIdentifier: 1, timestamp: -1 });

export const DatapointTelemetryModel = model("DatapointTelemetry", datapointTelemetrySchema);
