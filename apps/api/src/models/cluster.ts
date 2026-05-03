import { Schema, Types, model } from "mongoose";

const clusterSchema = new Schema(
  {
    siteId: { type: Types.ObjectId, ref: "Site", required: true, index: true },
    type: { type: String, enum: ["room", "device"], required: true },
    label: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    datapointIds: [{ type: Types.ObjectId, ref: "Datapoint", required: true }],
    parentClusterId: { type: Types.ObjectId, ref: "Cluster", required: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const ClusterModel = model("Cluster", clusterSchema);
