import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, quotesTable, clientsTable, salespeopleTable, opportunitiesTable } from "@workspace/db";
import { sql, gte, eq, desc } from "drizzle-orm";
import ExcelJS from "exceljs";

const router: IRouter = Router();

router.get("/reports/export/sales.xlsx", async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || "30");
    const since = new Date(Date.now() - days * 86400000);
    const orders = await db.select({
      id: ordersTable.id, number: ordersTable.number, date: ordersTable.date,
      total: ordersTable.total, currency: ordersTable.currency, status: ordersTable.status,
      client: clientsTable.companyName, salesperson: salespeopleTable.name,
    }).from(ordersTable)
      .leftJoin(clientsTable, eq(ordersTable.clientId, clientsTable.id))
      .leftJoin(salespeopleTable, eq(ordersTable.salespersonId, salespeopleTable.id))
      .where(gte(ordersTable.date, since))
      .orderBy(desc(ordersTable.date));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedidos");
    ws.columns = [
      { header: "N°", key: "number", width: 14 },
      { header: "Fecha", key: "date", width: 14 },
      { header: "Cliente", key: "client", width: 36 },
      { header: "Vendedor", key: "salesperson", width: 22 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Moneda", key: "currency", width: 8 },
      { header: "Total", key: "total", width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const o of orders) {
      ws.addRow({ ...o, date: o.date ? new Date(o.date).toLocaleDateString("es-AR") : "", total: Number(o.total || 0) });
    }
    ws.getColumn("total").numFmt = "#,##0.00";

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="ventas-${days}d.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.get("/reports/export/quotes.xlsx", async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.days as string) || "30");
    const since = new Date(Date.now() - days * 86400000);
    const rows = await db.select({
      id: quotesTable.id, number: quotesTable.number, date: quotesTable.date,
      total: quotesTable.total, currency: quotesTable.currency, status: quotesTable.quoteStatus,
      client: clientsTable.companyName, salesperson: salespeopleTable.name,
    }).from(quotesTable)
      .leftJoin(clientsTable, eq(quotesTable.clientId, clientsTable.id))
      .leftJoin(salespeopleTable, eq(quotesTable.salespersonId, salespeopleTable.id))
      .where(gte(quotesTable.date, since))
      .orderBy(desc(quotesTable.date));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cotizaciones");
    ws.columns = [
      { header: "N°", key: "number", width: 14 },
      { header: "Fecha", key: "date", width: 14 },
      { header: "Cliente", key: "client", width: 36 },
      { header: "Vendedor", key: "salesperson", width: 22 },
      { header: "Estado", key: "status", width: 18 },
      { header: "Moneda", key: "currency", width: 8 },
      { header: "Total", key: "total", width: 16 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    for (const r of rows) ws.addRow({ ...r, date: r.date ? new Date(r.date).toLocaleDateString("es-AR") : "", total: Number(r.total || 0) });
    ws.getColumn("total").numFmt = "#,##0.00";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cotizaciones-${days}d.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err: any) { if (!res.headersSent) res.status(500).json({ error: err.message }); }
});

router.get("/reports/export/pipeline.xlsx", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select({
      id: opportunitiesTable.id, title: opportunitiesTable.title, status: opportunitiesTable.status,
      estimatedValue: opportunitiesTable.estimatedValue, currency: opportunitiesTable.currency,
      stageEnteredAt: opportunitiesTable.stageEnteredAt, expectedCloseDate: opportunitiesTable.expectedCloseDate,
      client: clientsTable.companyName, salesperson: salespeopleTable.name,
    }).from(opportunitiesTable)
      .leftJoin(clientsTable, eq(opportunitiesTable.clientId, clientsTable.id))
      .leftJoin(salespeopleTable, eq(opportunitiesTable.salespersonId, salespeopleTable.id))
      .orderBy(desc(opportunitiesTable.createdAt));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pipeline");
    ws.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Título", key: "title", width: 36 },
      { header: "Estado", key: "status", width: 18 },
      { header: "Cliente", key: "client", width: 32 },
      { header: "Vendedor", key: "salesperson", width: 22 },
      { header: "Moneda", key: "currency", width: 8 },
      { header: "Valor estimado", key: "estimatedValue", width: 16 },
      { header: "En etapa desde", key: "stageEnteredAt", width: 18 },
      { header: "Cierre esperado", key: "expectedCloseDate", width: 16 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    for (const r of rows) ws.addRow({
      ...r,
      estimatedValue: Number(r.estimatedValue || 0),
      stageEnteredAt: r.stageEnteredAt ? new Date(r.stageEnteredAt).toLocaleDateString("es-AR") : "",
      expectedCloseDate: r.expectedCloseDate ? new Date(r.expectedCloseDate).toLocaleDateString("es-AR") : "",
    });
    ws.getColumn("estimatedValue").numFmt = "#,##0.00";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pipeline.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err: any) { if (!res.headersSent) res.status(500).json({ error: err.message }); }
});

export default router;
