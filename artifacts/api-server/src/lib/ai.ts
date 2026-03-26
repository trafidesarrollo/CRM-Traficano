import { db, promptsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";

async function callOpenAI(systemPrompt: string, userContent: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

const DEFAULT_CLASSIFICATION_PROMPT = `Eres un clasificador de correos comerciales para una empresa industrial B2B argentina.
Analiza el email y clasifícalo en una de estas categorías:
- quote_request: Pedido de cotización de productos o servicios
- complaint: Reclamo, queja o problema con un producto/servicio
- inquiry: Pregunta, consulta o solicitud de información
- follow_up: Seguimiento de una cotización o pedido anterior
- supplier: Comunicación de un proveedor
- internal: Comunicación interna de la empresa
- spam: Publicidad, spam o comunicación no deseada
- other: Otros tipos de email

Responde SOLO con JSON en este formato:
{
  "category": "quote_request",
  "confidence": 0.95,
  "reasoning": "El email solicita cotización de tubos de acero con especificaciones técnicas"
}`;

const DEFAULT_EXTRACTION_PROMPT = `Eres un extractor de datos de pedidos de cotización para una empresa industrial B2B argentina.
Extrae toda la información relevante del email de pedido de cotización.

Responde SOLO con JSON en este formato:
{
  "company": "Nombre de la empresa solicitante",
  "contact": "Nombre del contacto",
  "products": ["producto1", "producto2"],
  "measurements": ["DN50", "6 metros", "1 pulgada"],
  "quantities": [{"product": "caño", "quantity": 100, "unit": "unidades"}],
  "standards": ["ASTM A53", "API 5L"],
  "urgency": "normal|urgent|low",
  "missingData": ["precio", "fecha de entrega"],
  "notes": "Observaciones adicionales"
}`;

const DEFAULT_REPLY_PROMPT = `Eres un asistente comercial de una empresa industrial B2B argentina.
Genera un borrador de respuesta profesional y cordial para el email de pedido de cotización.
La respuesta debe:
- Confirmar la recepción del pedido
- Mencionar que se está procesando
- Indicar tiempo estimado de respuesta
- Usar un tono profesional pero cercano
- Estar en español argentino

Responde SOLO con JSON en este formato:
{
  "body": "Texto plano del email",
  "bodyHtml": "HTML del email"
}`;

export async function callAI(type: "classification" | "extraction" | "reply_draft", emailBody: string, emailSubject?: string): Promise<any> {
  let systemPrompt = type === "classification" ? DEFAULT_CLASSIFICATION_PROMPT
    : type === "extraction" ? DEFAULT_EXTRACTION_PROMPT
    : DEFAULT_REPLY_PROMPT;

  try {
    const activePrompts = await db.select().from(promptsTable)
      .where(and(eq(promptsTable.type, type), eq(promptsTable.isActive, true)))
      .limit(1);
    if (activePrompts[0]) {
      systemPrompt = activePrompts[0].content;
    }
  } catch {
  }

  const userContent = emailSubject
    ? `Asunto: ${emailSubject}\n\nCuerpo del email:\n${emailBody}`
    : emailBody;

  const rawOutput = await callOpenAI(systemPrompt, userContent);
  return JSON.parse(rawOutput);
}

export async function callAIWithPrompt(promptContent: string, sampleText: string): Promise<any> {
  const rawOutput = await callOpenAI(promptContent, sampleText);
  return JSON.parse(rawOutput);
}
