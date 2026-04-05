import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { extractionsTable, productEquivalencesTable, productsTable, emailsTable } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";
import {
  normalizeMeasurement,
  normalizeStandard,
  calculateMatchScore,
  type MatchResult,
} from "../lib/measurement-normalizer.js";

const router = Router();

async function aiExtractRequirements(emailBody: string): Promise<Array<{
  originalText: string;
  productFamily: string;
  measurement: string;
  standard: string;
  quantity: string;
  unit: string;
}>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const prompt = `Analiza el siguiente email comercial/industrial y extrae TODOS los productos o materiales mencionados con sus especificaciones técnicas.

Para cada item encontrado, devuelve un JSON con:
- originalText: el texto original donde se menciona el producto
- productFamily: familia de producto (ej: "tubo", "caño", "brida", "válvula", "chapa", "barra", "perfil", "fitting", "codo", "te", "reducción", "junta", "empaquetadura")
- measurement: medida detectada (ej: "2 pulgadas", "DN50", "4\"", "60.3mm", "3/4\"")
- standard: norma técnica si se menciona (ej: "ASTM A53", "API 5L", "SCH 40", "IRAM 2502")
- quantity: cantidad solicitada (ej: "100", "5 toneladas", "200 metros")
- unit: unidad de la cantidad (ej: "unidades", "metros", "kg", "toneladas")

Si no se encuentra algún campo, dejarlo como string vacío.
Responder SOLO con un array JSON válido, sin markdown ni explicación.

Email:
${emailBody}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un experto en productos industriales argentinos (tubos, caños, accesorios, válvulas, chapas, perfiles). Extraes especificaciones técnicas de emails comerciales con precisión." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI extraction error:", err);
    return [];
  }
}

async function findMatchingProducts(
  measurement: string,
  standard: string,
  productFamily: string,
): Promise<MatchResult[]> {
  const normalized = normalizeMeasurement(measurement);
  const normStd = standard ? normalizeStandard(standard) : undefined;

  const conditions = [];
  if (productFamily) {
    conditions.push(
      or(
        ilike(productsTable.name, `%${productFamily}%`),
        ilike(productsTable.category, `%${productFamily}%`),
        ilike(productsTable.description, `%${productFamily}%`),
      ),
    );
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(100);

  const results: MatchResult[] = [];

  for (const product of products) {
    const dims = product.dimensions || product.name || "";
    const { score, matchType, matchedOn } = calculateMatchScore(
      normalized.value,
      normalized.unit,
      dims,
      normStd,
      product.standard,
    );

    if (matchType !== "no_match") {
      results.push({
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        productDimensions: product.dimensions,
        productStandard: product.standard,
        matchType,
        score,
        matchedOn,
      });
    }
  }

  const equivalences = await db
    .select({
      productId: productEquivalencesTable.productId,
      alias: productEquivalencesTable.alias,
    })
    .from(productEquivalencesTable)
    .where(
      or(
        ilike(productEquivalencesTable.alias, `%${measurement}%`),
        standard ? ilike(productEquivalencesTable.alias, `%${standard}%`) : undefined,
      ),
    );

  for (const eq of equivalences) {
    const existing = results.find((r) => r.productId === eq.productId);
    if (existing) {
      existing.score += 15;
      existing.matchedOn += "+equivalencia";
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

router.post("/extract/:emailId", async (req: Request, res: Response) => {
  const emailId = parseInt(req.params.emailId);
  if (isNaN(emailId)) {
    res.status(400).json({ error: "ID de email inválido" });
    return;
  }

  const [email] = await db.select().from(emailsTable).where(eq(emailsTable.id, emailId)).limit(1);

  if (!email) {
    res.status(404).json({ error: "Email no encontrado" });
    return;
  }

  const body = email.body || email.subject || "";
  const aiItems = await aiExtractRequirements(body);

  const extractions = [];
  for (const item of aiItems) {
    const normalized = item.measurement ? normalizeMeasurement(item.measurement) : null;
    const matches = await findMatchingProducts(item.measurement, item.standard, item.productFamily);
    const bestMatch = matches[0] || null;

    const [extraction] = await db.insert(extractionsTable).values({
      emailId,
      originalText: item.originalText,
      normalizedMeasurement: normalized?.normalizedText || null,
      detectedStandard: item.standard ? normalizeStandard(item.standard) : null,
      detectedQuantity: item.quantity || null,
      detectedUnit: item.unit || null,
      suggestedFamily: item.productFamily || null,
      suggestedProductId: bestMatch?.productId || null,
      matchType: bestMatch?.matchType || "no_match",
      matchScore: bestMatch ? String(bestMatch.score) : null,
      status: "pending",
      rawAiOutput: item as any,
    }).returning();

    extractions.push({
      ...extraction,
      matches,
      normalized,
    });
  }

  res.json({
    emailId,
    totalExtracted: extractions.length,
    extractions,
  });
});

router.get("/email/:emailId", async (req: Request, res: Response) => {
  const emailId = parseInt(req.params.emailId);
  if (isNaN(emailId)) {
    res.status(400).json({ error: "ID de email inválido" });
    return;
  }

  const extractions = await db
    .select()
    .from(extractionsTable)
    .where(eq(extractionsTable.emailId, emailId))
    .orderBy(desc(extractionsTable.createdAt));

  res.json(extractions);
});

router.patch("/:id/accept", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { productId, opportunityId } = req.body;

  const [updated] = await db
    .update(extractionsTable)
    .set({
      status: "accepted",
      suggestedProductId: productId || undefined,
      opportunityId: opportunityId || undefined,
    })
    .where(eq(extractionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Extracción no encontrada" });
    return;
  }

  res.json(updated);
});

router.patch("/:id/correct", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { productId, opportunityId } = req.body;
  const userId = (req.session as any).userId;

  if (!productId) {
    res.status(400).json({ error: "Se requiere productId para corregir" });
    return;
  }

  const [updated] = await db
    .update(extractionsTable)
    .set({
      status: "corrected",
      correctedProductId: productId,
      correctedByUserId: userId,
      opportunityId: opportunityId || undefined,
    })
    .where(eq(extractionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Extracción no encontrada" });
    return;
  }

  const [extraction] = await db.select().from(extractionsTable).where(eq(extractionsTable.id, id)).limit(1);
  if (extraction?.normalizedMeasurement) {
    await db.insert(productEquivalencesTable).values({
      productId,
      alias: extraction.normalizedMeasurement,
      aliasType: "measurement",
    });
  }

  res.json(updated);
});

router.patch("/:id/reject", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const [updated] = await db
    .update(extractionsTable)
    .set({ status: "rejected" })
    .where(eq(extractionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Extracción no encontrada" });
    return;
  }

  res.json(updated);
});

router.post("/normalize", async (req: Request, res: Response) => {
  const { text, standard } = req.body;
  if (!text) {
    res.status(400).json({ error: "Se requiere texto" });
    return;
  }

  const normalized = normalizeMeasurement(text);
  const normStd = standard ? normalizeStandard(standard) : null;

  res.json({ normalized, normalizedStandard: normStd });
});

router.get("/equivalences/:productId", async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId);

  const equivalences = await db
    .select()
    .from(productEquivalencesTable)
    .where(eq(productEquivalencesTable.productId, productId));

  res.json(equivalences);
});

router.post("/equivalences", async (req: Request, res: Response) => {
  const { productId, alias, aliasType } = req.body;

  if (!productId || !alias || !aliasType) {
    res.status(400).json({ error: "Se requiere productId, alias y aliasType" });
    return;
  }

  const [equiv] = await db
    .insert(productEquivalencesTable)
    .values({ productId, alias, aliasType })
    .returning();

  res.json(equiv);
});

router.post("/match", async (req: Request, res: Response) => {
  const { measurement, standard, productFamily } = req.body;
  if (!measurement) {
    res.status(400).json({ error: "Se requiere measurement" });
    return;
  }

  const normalized = normalizeMeasurement(measurement);
  const matches = await findMatchingProducts(measurement, standard || "", productFamily || "");

  res.json({ normalized, matches });
});

export default router;
