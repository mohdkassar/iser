import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase } from "./lib/mongoose.js";
import "./models/datapoint-telemetry.js";
import { seedDevelopmentData } from "./seed/dev-seed.js";

async function bootstrap() {
  await connectToDatabase();
  if (env.NODE_ENV === "development") {
    await seedDevelopmentData();
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exitCode = 1;
});
