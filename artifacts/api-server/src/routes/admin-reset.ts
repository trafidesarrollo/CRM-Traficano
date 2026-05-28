import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const ALLOWED_TABLES: Record<string, { label: string; truncateQuery: string; countQuery: string }> = {
  clients: {
    label: "Clientes",
    truncateQuery: "TRUNCATE TABLE clients RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM clients",
  },
  contacts: {
    label: "Contactos",
    truncateQuery: "TRUNCATE TABLE contacts RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM contacts",
  },
  opportunities: {
    label: "Oportunidades",
    truncateQuery: "TRUNCATE TABLE opportunities RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM opportunities",
  },
  quotes: {
    label: "Cotizaciones",
    truncateQuery: "TRUNCATE TABLE quotes RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM quotes",
  },
  orders: {
    label: "Pedidos",
    truncateQuery: "TRUNCATE TABLE orders RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM orders",
  },
  tasks: {
    label: "Tareas",
    truncateQuery: "TRUNCATE TABLE tasks RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM tasks",
  },
  activities: {
    label: "Actividades",
    truncateQuery: "TRUNCATE TABLE activities RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM activities",
  },
  followups: {
    label: "Seguimientos",
    truncateQuery: "TRUNCATE TABLE followups RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM followups",
  },
  products: {
    label: "Productos",
    truncateQuery: "TRUNCATE TABLE products RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM products",
  },
  salespeople: {
    label: "Vendedores",
    truncateQuery: "TRUNCATE TABLE salespeople RESTART IDENTITY CASCADE",
    countQuery: "SELECT COUNT(*) as count FROM salespeople",
  },
};

router.get("/admin/reset/counts", async (req, res) => {
  try {
    const results: Record<string, { label: string; count: number }> = {};
    await Promise.all(
      Object.entries(ALLOWED_TABLES).map(async ([key, cfg]) => {
        const rows = await db.execute(sql.raw(cfg.countQuery));
        results[key] = { label: cfg.label, count: Number((rows as any)[0]?.count ?? 0) };
      })
    );
    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al obtener conteos" });
  }
});

router.delete("/admin/reset/:table", async (req, res) => {
  const callerRole = (req as any).userRole;
  if (callerRole !== "admin") {
    res.status(403).json({ error: "Solo el administrador puede usar esta función" });
    return;
  }
  const { table } = req.params;
  const cfg = ALLOWED_TABLES[table];
  if (!cfg) {
    res.status(400).json({ error: `Tabla no permitida: ${table}` });
    return;
  }
  try {
    await db.execute(sql.raw(cfg.truncateQuery));
    req.log.warn({ table, userId: (req as any).session?.userId }, `ADMIN RESET: tabla ${table} vaciada`);
    res.json({ ok: true, message: `Tabla "${cfg.label}" eliminada correctamente` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Error al vaciar la tabla" });
  }
});

export default router;
