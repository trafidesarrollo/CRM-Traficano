import { Router, type IRouter } from "express";
import { db, emailsTable, opportunitiesTable, productsTable, activitiesTable } from "@workspace/db";
import { eq, and, sql, ilike } from "drizzle-orm";
import { auditAction } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/emails", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;

    let conditions: any[] = [];
    if (category && category !== "all") conditions.push(eq(emailsTable.category, category as any));
    if (status) conditions.push(eq(emailsTable.status, status as any));
    if (assignedTo) conditions.push(eq(emailsTable.assignedSalespersonId, assignedTo));

    const [data, countResult] = await Promise.all([
      conditions.length > 0
        ? db.select().from(emailsTable).where(and(...conditions)).limit(limit).offset(offset).orderBy(emailsTable.receivedAt)
        : db.select().from(emailsTable).limit(limit).offset(offset).orderBy(emailsTable.receivedAt),
      db.select({ count: sql<number>`count(*)` }).from(emailsTable),
    ]);

    res.json({ data, total: Number(countResult[0].count), page, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al listar emails" });
  }
});

router.get("/emails/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await db.select().from(emailsTable).where(eq(emailsTable.id, id)).limit(1);
    if (!data[0]) {
      res.status(404).json({ error: "Email no encontrado" });
      return;
    }
    res.json(data[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener email" });
  }
});

router.post("/emails/:id/classify", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, notes } = req.body;

    const existing = await db.select().from(emailsTable).where(eq(emailsTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Email no encontrado" });
      return;
    }

    const [updated] = await db.update(emailsTable)
      .set({ category, categoryConfirmed: true, notes })
      .where(eq(emailsTable.id, id))
      .returning();

    await auditAction(req, "reclasificar_email", "email", id, {
      oldCategory: existing[0].category,
      newCategory: category,
    });

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al clasificar email" });
  }
});

router.post("/emails/:id/process", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const emails = await db.select().from(emailsTable).where(eq(emailsTable.id, id)).limit(1);
    const email = emails[0];
    if (!email) {
      res.status(404).json({ error: "Email no encontrado" });
      return;
    }

    await db.update(emailsTable).set({ status: "processing" }).where(eq(emailsTable.id, id));

    let extractedData: any = {};
    let matchedProducts: any[] = [];

    try {
      const { callAI } = await import("../lib/ai.js");
      extractedData = await callAI("extraction", email.body, email.subject);
    } catch (aiErr) {
      req.log.warn(aiErr, "AI extraction failed, using fallback");
      extractedData = {
        company: email.fromName || email.fromEmail.split("@")[1],
        contact: email.fromName,
        products: [],
        measurements: [],
        quantities: [],
        standards: [],
        urgency: "normal",
        missingData: [],
      };
    }

    if (extractedData.measurements && extractedData.measurements.length > 0) {
      for (const measurement of extractedData.measurements) {
        const products = await db.select().from(productsTable)
          .where(ilike(productsTable.dimensions, `%${measurement}%`))
          .limit(5);
        matchedProducts.push(...products);
      }
    }

    const [opportunity] = await db.insert(opportunitiesTable).values({
      title: `Cotización - ${email.fromName || email.fromEmail} - ${email.subject}`,
      emailId: id,
      status: "new",
      priority: extractedData.urgency === "urgent" ? "urgent" : "medium",
      description: email.body.substring(0, 500),
      extractedProducts: extractedData,
    }).returning();

    await db.update(emailsTable).set({
      status: "processed",
      opportunityId: opportunity.id,
      extractedData,
    }).where(eq(emailsTable.id, id));

    await db.insert(activitiesTable).values({
      type: "email",
      title: `Email procesado: ${email.subject}`,
      description: `Oportunidad creada automáticamente`,
      emailId: id,
      opportunityId: opportunity.id,
    });

    await auditAction(req, "procesar_email", "email", id, {
      opportunityId: opportunity.id,
      matchedProducts: matchedProducts.length,
    });

    const [updatedEmail] = await db.select().from(emailsTable).where(eq(emailsTable.id, id)).limit(1);

    res.json({ email: updatedEmail, opportunity, extractedData, matchedProducts });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al procesar email" });
  }
});

router.post("/emails/:id/reply-draft", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const emails = await db.select().from(emailsTable).where(eq(emailsTable.id, id)).limit(1);
    const email = emails[0];
    if (!email) {
      res.status(404).json({ error: "Email no encontrado" });
      return;
    }

    let draft = {
      subject: `Re: ${email.subject}`,
      body: "",
      bodyHtml: "",
    };

    try {
      const { callAI } = await import("../lib/ai.js");
      const result = await callAI("reply_draft", email.body, email.subject);
      draft.body = result.body || draft.body;
      draft.bodyHtml = result.bodyHtml || draft.body;
    } catch (aiErr) {
      req.log.warn(aiErr, "AI draft failed, using template");
      draft.body = `Estimado/a ${email.fromName || "cliente"},\n\nHemos recibido su consulta y nos pondremos en contacto a la brevedad para responder su pedido de cotización.\n\nSaludos cordiales,\nEl equipo comercial`;
      draft.bodyHtml = draft.body.replace(/\n/g, "<br>");
    }

    res.json(draft);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al generar borrador" });
  }
});

router.post("/emails/:id/send-reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { subject, body } = req.body;

    await db.update(emailsTable).set({ status: "replied" }).where(eq(emailsTable.id, id));

    await db.insert(activitiesTable).values({
      type: "email",
      title: `Respuesta enviada: ${subject}`,
      description: body.substring(0, 200),
      emailId: id,
    });

    await auditAction(req, "enviar_respuesta", "email", id, { subject });

    res.json({ message: "Respuesta registrada" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al enviar respuesta" });
  }
});

export default router;
