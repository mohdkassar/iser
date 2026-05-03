import { Schema, Types, model } from "mongoose";

const siteSchema = new Schema(
  {
    clientId: { type: Types.ObjectId, ref: "Client", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    metadataExtractionTokensTotal: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const SiteModel = model("Site", siteSchema);
