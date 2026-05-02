import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body || {};
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Missing or invalid 'name' field" });
    return;
  }
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error: any) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/objects/*filePath", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
    const raw = (req.params as any).filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${filePath}`;
    const { db, documentsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.storageKey, objectPath));
    if (!doc) { res.status(404).json({ error: "No encontrado" }); return; }
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Not found" }); return; }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
