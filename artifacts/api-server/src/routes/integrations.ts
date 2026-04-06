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
    phone: body.phone,
    externalCallId: body.external_call_id,
    bodyKeys: Object.keys(body),
  }, "Anura webhook received");

  try {
    await db.insert(anuraWebhooksTable).values({
      event: body.event || null,
      externalCallId: body.external_call_id || null,
      phone: body.phone || null,
      toNumber: body.to_number || null,
      direction: body.direction || null,
      status: body.status || null,
      durationSeconds: body.duration_seconds ? parseInt(body.duration_seconds) : null,
      agentId: body.agent_id || null,
      recordingUrl: body.recording_mp3_url || null,
      occurredAt: body.occurred_at || null,
      rawPayload: body,
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
