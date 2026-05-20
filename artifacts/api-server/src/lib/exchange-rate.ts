import cron from "node-cron";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const SELL_KEY = "exchange_rate_usd_sell";
const DATE_KEY = "exchange_rate_date";
const SOURCE_KEY = "exchange_rate_source";

// Argentina is UTC-3 (no DST). 11:00 ART = 14:00 UTC.
const CRON_SCHEDULE = "0 14 * * *";

async function upsertSetting(key: string, value: string) {
  const existing = await db
    .select({ id: settingsTable.id })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(settingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

export async function fetchAndStoreRate(): Promise<{
  sell: number;
  date: string;
  source: string;
} | null> {
  try {
    // dolarapi.com returns Banco Nación official rates
    const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      headers: { "User-Agent": "CRM-B2B/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      venta?: number;
      compra?: number;
      fechaActualizacion?: string;
    };

    const sell = data.venta;
    if (!sell || typeof sell !== "number") {
      throw new Error("Respuesta sin campo 'venta'");
    }

    // Date in Argentina time (UTC-3)
    const now = new Date();
    const argDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const dateStr = argDate.toISOString().slice(0, 10);
    const sourceStr = data.fechaActualizacion ?? new Date().toISOString();

    await Promise.all([
      upsertSetting(SELL_KEY, String(sell)),
      upsertSetting(DATE_KEY, dateStr),
      upsertSetting(SOURCE_KEY, sourceStr),
    ]);

    logger.info({ sell, date: dateStr }, "Tasa USD BNA actualizada");
    return { sell, date: dateStr, source: sourceStr };
  } catch (err: any) {
    logger.error({ err: err.message }, "Error al obtener tasa USD BNA");
    return null;
  }
}

export async function getCurrentRate(): Promise<{
  sell: number | null;
  date: string | null;
  source: string | null;
  stale: boolean;
}> {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(
        eq(settingsTable.key, SELL_KEY)
      );
    const dateRow = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, DATE_KEY))
      .limit(1);
    const sourceRow = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, SOURCE_KEY))
      .limit(1);

    if (rows.length === 0) return { sell: null, date: null, source: null, stale: true };

    const sell = parseFloat(rows[0].value);
    const date = dateRow[0]?.value ?? null;
    const source = sourceRow[0]?.value ?? null;

    // Check if today's rate is loaded (Argentina date)
    const now = new Date();
    const argDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayArg = argDate.toISOString().slice(0, 10);
    const stale = date !== todayArg;

    return { sell, date, source, stale };
  } catch {
    return { sell: null, date: null, source: null, stale: true };
  }
}

export function startExchangeRateScheduler() {
  // Schedule: every day at 14:00 UTC = 11:00 ART
  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info("Scheduler: actualizando tasa USD BNA (11:00 ART)");
    await fetchAndStoreRate();
  });

  // On startup: fetch if today's rate is not yet stored
  getCurrentRate().then(async ({ date, stale }) => {
    const now = new Date();
    const argDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayArg = argDate.toISOString().slice(0, 10);
    // Fetch if no rate stored, or if it's stale AND past 11:00 ART
    const argHour = argDate.getUTCHours();
    if (!date || (stale && argHour >= 11)) {
      logger.info("Startup: obteniendo tasa USD BNA inicial");
      await fetchAndStoreRate();
    } else {
      logger.info({ date }, "Tasa USD BNA ya cargada para hoy");
    }
  });
}
