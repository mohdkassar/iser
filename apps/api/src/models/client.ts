import { Schema, model } from "mongoose";

const clientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true },
);

export const ClientModel = model("Client", clientSchema);
