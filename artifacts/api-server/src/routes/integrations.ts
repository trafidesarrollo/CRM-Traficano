import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.post("/integrations/anura/webhook", async (req: Request, res: Response) => {
  const receivedAt = new Date().toISOString();

  req.log.info({
    source: "anura",
    receivedAt,
    method: req.method,
    contentType: req.headers["content-type"],
    userAgent: req.headers["user-agent"],
    ip: req.ip || req.headers["x-forwarded-for"],
    bodyKeys: Object.keys(req.body || {}),
    body: req.body,
  }, "Anura webhook received");

  res.status(200).json({
    ok: true,
    receivedAt,
    message: "Webhook recibido correctamente",
  });
});

router.get("/integrations/anura/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "anura-webhook",
    timestamp: new Date().toISOString(),
  });
});

export default router;
