import { Router, type IRouter, type Request, type Response } from "express";
import { db, quotesTable, quoteLinesTable, clientsTable, salespeopleTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";

const router: IRouter = Router();

router.get("/quotes/:id/pdf", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "Cotización no encontrada" }); return; }
    const lines = await db.select().from(quoteLinesTable).where(eq(quoteLinesTable.quoteId, id)).orderBy(quoteLinesTable.lineNumber);
    const [client] = quote.clientId ? await db.select().from(clientsTable).where(eq(clientsTable.id, quote.clientId)) : [null];
    const [salesperson] = quote.salespersonId ? await db.select().from(salespeopleTable).where(eq(salespeopleTable.id, quote.salespersonId)) : [null];

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${quote.number || "cotizacion"}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor("#0f172a").text("COTIZACIÓN", { align: "right" });
    doc.fontSize(10).fillColor("#64748b").text(quote.number || `#${quote.id}`, { align: "right" });
    doc.moveDown();
    doc.fillColor("#0f172a").fontSize(12).text("CRM Comercial", 40, 40);
    doc.fontSize(9).fillColor("#475569").text("Argentina", 40, 58);
    doc.moveDown(2);

    const startY = doc.y;
    doc.fontSize(10).fillColor("#0f172a").text("Cliente:", 40, startY);
    doc.fontSize(11).text(client?.companyName || "—", 40, startY + 14);
    if (client?.taxId) doc.fontSize(9).fillColor("#64748b").text(`CUIT: ${client.taxId}`, 40, startY + 30);
    if (client?.address) doc.text(`${client.address}, ${client.city || ""} ${client.country || ""}`, 40, startY + 44);

    doc.fontSize(10).fillColor("#0f172a").text("Fecha:", 320, startY);
    doc.fontSize(10).fillColor("#475569").text(new Date(quote.date).toLocaleDateString("es-AR"), 380, startY);
    doc.fontSize(10).fillColor("#0f172a").text("Validez:", 320, startY + 14);
    doc.fontSize(10).fillColor("#475569").text(quote.dueDate ? new Date(quote.dueDate).toLocaleDateString("es-AR") : "—", 380, startY + 14);
    doc.fontSize(10).fillColor("#0f172a").text("Vendedor:", 320, startY + 28);
    doc.fontSize(10).fillColor("#475569").text(salesperson?.name || "—", 380, startY + 28);
    doc.fontSize(10).fillColor("#0f172a").text("Moneda:", 320, startY + 42);
    doc.fontSize(10).fillColor("#475569").text(quote.currency || "ARS", 380, startY + 42);

    doc.moveDown(5);

    let y = doc.y + 10;
    doc.fillColor("#1e293b").rect(40, y, 515, 22).fill();
    doc.fillColor("#ffffff").fontSize(9);
    doc.text("#", 45, y + 7, { width: 20 });
    doc.text("Producto", 70, y + 7, { width: 200 });
    doc.text("Cant", 275, y + 7, { width: 35, align: "right" });
    doc.text("Kg", 315, y + 7, { width: 45, align: "right" });
    doc.text("P. Unit", 365, y + 7, { width: 60, align: "right" });
    doc.text("Subtotal", 430, y + 7, { width: 120, align: "right" });
    y += 22;

    let totalKg = 0, totalNet = 0;
    doc.fillColor("#0f172a").fontSize(9);
    for (const line of lines) {
      const qty = parseFloat(line.quantity || "0");
      const kg = parseFloat(line.quantityKg || "0");
      const price = parseFloat(line.unitPrice || "0");
      const subtotal = qty * price;
      totalKg += kg; totalNet += subtotal;
      if (y > 720) { doc.addPage(); y = 40; }
      doc.text(String(line.lineNumber), 45, y + 4, { width: 20 });
      doc.text(line.productName || "—", 70, y + 4, { width: 200 });
      doc.text(qty.toFixed(2), 275, y + 4, { width: 35, align: "right" });
      doc.text(kg.toFixed(2), 315, y + 4, { width: 45, align: "right" });
      doc.text(price.toFixed(2), 365, y + 4, { width: 60, align: "right" });
      doc.text(subtotal.toFixed(2), 430, y + 4, { width: 120, align: "right" });
      doc.moveTo(40, y + 18).lineTo(555, y + 18).strokeColor("#e2e8f0").stroke();
      y += 22;
    }

    y += 10;
    doc.fontSize(10).fillColor("#0f172a");
    doc.text(`Total kg:`, 365, y, { width: 60, align: "right" });
    doc.text(`${totalKg.toFixed(2)} kg`, 430, y, { width: 120, align: "right" });
    y += 16;
    doc.fontSize(13).fillColor("#0f172a");
    doc.text(`TOTAL:`, 365, y, { width: 60, align: "right" });
    doc.text(`${quote.currency || "ARS"} ${totalNet.toFixed(2)}`, 430, y, { width: 120, align: "right" });

    if (quote.description) {
      y += 40;
      doc.fontSize(9).fillColor("#64748b").text("Observaciones:", 40, y);
      doc.fontSize(9).fillColor("#475569").text(quote.description, 40, y + 14, { width: 515 });
    }

    doc.fontSize(8).fillColor("#94a3b8").text(
      `Generado el ${new Date().toLocaleString("es-AR")} · CRM Comercial`,
      40, 800, { width: 515, align: "center" }
    );

    doc.end();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;
