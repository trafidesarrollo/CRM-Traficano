import { Router, type IRouter } from "express";
import { db, promptsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const data = await db.select().from(promptsTable).orderBy(promptsTable.createdAt);
    res.json(data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar prompts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, type, content, notes } = req.body;
    const existing = await db.select().from(promptsTable)
      .where(and(eq(promptsTable.name, name), eq(promptsTable.type, type)))
      .orderBy(promptsTable.version);
    const version = existing.length > 0 ? existing[existing.length - 1].version + 1 : 1;
    const [prompt] = await db.insert(promptsTable).values({ name, type, content, notes, version, isActive: false }).returning();

    await auditAction(req, "crear_prompt", "prompt", prompt.id, { name, type, version });

    res.status(201).json(prompt);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al crear prompt" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(promptsTable).set(req.body).where(eq(promptsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Prompt no encontrado" });
      return;
    }

    await auditAction(req, "modificar_prompt", "prompt", id);

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al actualizar prompt" });
  }
});

router.post("/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const prompts = await db.select().from(promptsTable).where(eq(promptsTable.id, id)).limit(1);
    if (!prompts[0]) {
      res.status(404).json({ error: "Prompt no encontrado" });
      return;
    }

    await db.update(promptsTable)
      .set({ isActive: false })
      .where(eq(promptsTable.type, prompts[0].type));

    const [activated] = await db.update(promptsTable)
      .set({ isActive: true })
      .where(eq(promptsTable.id, id))
      .returning();

    await auditAction(req, "activar_prompt", "prompt", id, { name: prompts[0].name, type: prompts[0].type });

    res.json(activated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al activar prompt" });
  }
});

router.post("/:id/test", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { sampleText } = req.body;

    const prompts = await db.select().from(promptsTable).where(eq(promptsTable.id, id)).limit(1);
    if (!prompts[0]) {
      res.status(404).json({ error: "Prompt no encontrado" });
      return;
    }

    try {
      const { callAIWithPrompt } = await import("../lib/ai.js");
      const result = await callAIWithPrompt(prompts[0].content, sampleText);
      res.json({ result, rawOutput: JSON.stringify(result) });
    } catch (aiErr: any) {
      res.json({ result: { error: "AI no disponible" }, rawOutput: aiErr?.message || "Error desconocido" });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al probar prompt" });
  }
});

export default router;
