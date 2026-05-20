import { Router, type IRouter } from "express";
import { getCurrentRate, fetchAndStoreRate } from "../lib/exchange-rate.js";
import { requireMinRole } from "../middleware/auth.js";

const router: IRouter = Router();

// Public (any authenticated user): get current daily rate
router.get("/exchange-rate", async (req, res) => {
  try {
    const rate = await getCurrentRate();
    res.json(rate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin/gerente: manually trigger a refresh
router.post(
  "/exchange-rate/refresh",
  requireMinRole("gerente"),
  async (req, res) => {
    try {
      const result = await fetchAndStoreRate();
      if (!result) {
        res.status(502).json({ error: "No se pudo obtener la tasa del BNA" });
        return;
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
