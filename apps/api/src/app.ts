import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { adminRouter } from "./routes/admin.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.WEB_ORIGIN,
    }),
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/admin", adminRouter);

  return app;
}
