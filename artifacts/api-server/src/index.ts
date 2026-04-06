import app from "./app";
import { logger } from "./lib/logger";
import { db, settingsTable } from "@workspace/db";

async function loadSettingsFromDb() {
  try {
    const settings = await db.select().from(settingsTable);
    for (const s of settings) {
      if (!process.env[s.key]) {
        process.env[s.key] = s.value;
      }
    }
    if (settings.length > 0) {
      logger.info({ count: settings.length }, "Settings loaded from database");
    }
  } catch (err) {
    logger.warn("Could not load settings from database (table may not exist yet)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

loadSettingsFromDb().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
