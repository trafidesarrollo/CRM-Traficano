import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const ALLOWED_KEYS = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "OPENAI_API_KEY",
];

router.get("/", async (req, res) => {
  try {
    const all = await db.select().from(settingsTable);
    const result: Record<string, { configured: boolean; masked: string; updatedAt: string }> = {};
    for (const s of all) {
      if (ALLOWED_KEYS.includes(s.key)) {
        const val = s.value;
        const masked = val.length > 8 ? val.substring(0, 4) + "****" + val.substring(val.length - 4) : "****";
        result[s.key] = { configured: true, masked, updatedAt: s.updatedAt.toISOString() };
      }
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) {
      res.status(400).json({ error: "key y value son requeridos" });
      return;
    }
    if (!ALLOWED_KEYS.includes(key)) {
      res.status(400).json({ error: `Clave no permitida: ${key}` });
      return;
    }

    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
    } else {
      await db.insert(settingsTable).values({ key, value });
    }

    process.env[key] = value;

    res.json({ message: `${key} guardado correctamente` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al guardar configuración" });
  }
});

router.delete("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_KEYS.includes(key)) {
      res.status(400).json({ error: `Clave no permitida: ${key}` });
      return;
    }
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    delete process.env[key];
    res.json({ message: `${key} eliminado` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al eliminar configuración" });
  }
});

export default router;
