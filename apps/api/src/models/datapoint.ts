import { Schema, Types, model } from "mongoose";

const extractedMetadataSchema = new Schema(
  {
    roomCandidate: String,
    roomAliases: [String],
    equipmentGroup: String,
    deviceInstance: String,
    deviceType: String,
    subzone: String,
    confidence: Number,
  },
  { _id: false },
);

const metadataExtractionSchema = new Schema(
  {
    version: { type: String, enum: ["v1", "v2", "v3"], required: true },
    batchSize: { type: Number, required: true },
    extractedAt: { type: Date, required: true },
  },
  { _id: false },
);

const datapointSchema = new Schema(
  {
    siteId: { type: Types.ObjectId, ref: "Site", required: true, index: true },
    rawName: { type: String, required: true },
    identifier: { type: String, required: true },
    manufacturer: { type: String, required: true },
    metadata: { type: extractedMetadataSchema, required: false },
    metadataExtraction: { type: metadataExtractionSchema, required: false },
  },
  { timestamps: true },
);

export const DatapointModel = model("Datapoint", datapointSchema);
