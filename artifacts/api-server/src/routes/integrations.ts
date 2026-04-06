import { Router, type IRouter, type Request, type Response } from "express";
import { db, anuraWebhooksTable } from "@workspace/db";

const router: IRouter = Router();

async function handleAnuraWebhook(req: Request, res: Response) {
  const receivedAt = new Date().toISOString();
  const body = req.body || {};

  req.log.info({
    source: "anura",
    receivedAt,
    event: body.event,
    phone: body.phone || body.callerid,
    externalCallId: body.external_call_id || body.raw_call_id || body.id,
    bodyKeys: Object.keys(body),
  }, "Anura webhook received");

  const phone = body.phone || body.callerid || null;
  const toNumber = body.to_number || body.callednumber || null;
  const externalCallId = body.external_call_id || body.raw_call_id || body.id || null;
  const agentId = body.agent_id || body.raw_agent_id || body.agentid || null;
  const duration = body.duration_seconds || body.duration;
  const recordingUrl = body.recording_mp3_url || body.audio_file_mp3 || null;
  const occurredAt = body.occurred_at || body.timestamp || null;
  const rawPayload = body.raw_payload || body;

  try {
    await db.insert(anuraWebhooksTable).values({
      event: body.event || null,
      externalCallId,
      phone,
      toNumber,
      direction: body.direction || null,
      status: body.status || null,
      durationSeconds: duration ? parseInt(String(duration)) : null,
      agentId,
      recordingUrl,
      occurredAt,
      rawPayload,
    });
  } catch (err) {
    req.log.error(err, "Error saving Anura webhook to DB");
  }

  res.status(200).json({
    ok: true,
    receivedAt,
    message: "Webhook recibido correctamente",
  });
}

router.post("/anura", handleAnuraWebhook);
router.post("/integrations/anura/webhook", handleAnuraWebhook);

router.get("/integrations/anura/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "anura-webhook",
    timestamp: new Date().toISOString(),
  });
});

export default router;
