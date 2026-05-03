import mongoose from "mongoose";

import { env } from "../config/env.js";

let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectToDatabase() {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGODB_URI);
  }

  return connectionPromise;
}
