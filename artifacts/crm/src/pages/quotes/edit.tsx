import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { DocumentUploader } from "@/components/document-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, ArrowLeft, Plus, Trash2, FileText, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

interface Line {
  id?: number;
  productType?: string;
  productId?: number | null;
  productName?: string;
  productCode?: string;
  unit?: string;
  quantity: string;
  quantityKg: string;
  unitPrice: string;
  unitPriceUm: string;
  netTotal: string;
  deliveryTime?: string;
  clientCode?: string;
  notes?: string;
}

const blankLine = (): Line => ({
  productType: "REVENTA", productName: "", unit: "UN",
  quantity: "1", quantityKg: "0", unitPrice: "0", unitPriceUm: "0", netTotal: "0",
});

export default function QuoteEdit() {
  const [, params] = useRoute("/quotes/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = !params || params.id === "new";
  const id = isNew ? null : parseInt(params!.id);

  const [clients, setClients] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [saleConditions, setSaleConditions] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const dueDefault = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState<any>({
    clientId: "", contactId: "", opportunityId: "", salespersonId: "", priceListId: "", saleConditionId: "",
    cuit: "", date: today, deliveryDate: "", dueDate: dueDefault, followupDate: "",
    currency: "USD", exchangeRate: "0", exchangeRateType: "DIVISA VENTA BNA",
    quoteStatus: "EN PROCESO", priority: "ALTA", quoteType: "COTIZACION", orderType: "REVENTA",
    description: "", internalNote: "", reference: "", purchaseOrder: "",
    createSchedule: false, status: "draft",
  });
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/clients?limit=500`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/salespeople`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/products`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/price-lists`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/sale-conditions`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/opportunities`, { credentials: "include" }).then(r => r.json()),
    ]).then(([cl, sp, pr, pl, sc, op]) => {
      setClients(cl.data || cl || []);
      setSalespeople(Array.isArray(sp) ? sp : []);
      setProducts(Array.isArray(pr) ? pr : (pr.data || []));
      setPriceLists(pl || []);
      setSaleConditions(sc || []);
      setOpportunities(op.data || op || []);
      const def = (pl || []).find((x: any) => x.isDefault);
      if (def && isNew) setForm((f: any) => ({ ...f, priceListId: String(def.id) }));
    });
  }, []);

  useEffect(() => {
    if (!form.clientId) { setContacts([]); return; }
    fetch(`${API}/api/contacts?clientId=${form.clientId}`, { credentials: "include" })
      .then(r => r.json()).then(d => setContacts(Array.isArray(d) ? d : (d.data || [])));
  }, [form.clientId]);

  useEffect(() => {
    if (isNew || !id) return;
    fetch(`${API}/api/quotes/${id}`, { credentials: "include" }).then(r => r.json()).then(q => {
      setForm({
        clientId: q.clientId ? String(q.clientId) : "",
        contactId: q.contactId ? String(q.contactId) : "",
        opportunityId: q.opportunityId ? String(q.opportunityId) : "",
        salespersonId: q.salespersonId ? String(q.salespersonId) : "",
        priceListId: q.priceListId ? String(q.priceListId) : "",
        saleConditionId: q.saleConditionId ? String(q.saleConditionId) : "",
        cuit: q.cuit || "",
        date: q.date ? q.date.slice(0, 10) : today,
        deliveryDate: q.deliveryDate ? q.deliveryDate.slice(0, 10) : "",
        dueDate: q.dueDate ? q.dueDate.slice(0, 10) : "",
        followupDate: q.followupDate ? q.followupDate.slice(0, 10) : "",
        currency: q.currency || "USD",
        exchangeRate: q.exchangeRate || "0",
        exchangeRateType: q.exchangeRateType || "DIVISA VENTA BNA",
        quoteStatus: q.quoteStatus || "EN PROCESO",
        priority: q.priority || "ALTA",
        quoteType: q.quoteType || "COTIZACION",
        orderType: q.orderType || "REVENTA",
        description: q.description || "",
        internalNote: q.internalNote || "",
        reference: q.reference || "",
        purchaseOrder: q.purchaseOrder || "",
        createSchedule: !!q.createSchedule,
        status: q.status || "draft",
      });
      setLines((q.lines || []).map((l: any) => ({
        id: l.id,
        productType: l.productType || "REVENTA",
        productId: l.productId,
        productName: l.productName || "",
        productCode: l.productCode || "",
        unit: l.unit || "UN",
        quantity: String(l.quantity ?? 1),
        quantityKg: String(l.quantityKg ?? 0),
        unitPrice: String(l.unitPrice ?? 0),
        unitPriceUm: String(l.unitPriceUm ?? 0),
        netTotal: String(l.netTotal ?? 0),
        deliveryTime: l.deliveryTime || "",
        clientCode: l.clientCode || "",
        notes: l.notes || "",
      })));
    });
  }, [id]);

  const totals = lines.reduce((acc, l) => {
    const q = parseFloat(l.quantity) || 0;
    const p = parseFloat(l.unitPrice) || 0;
    const kg = parseFloat(l.quantityKg) || 0;
    const net = q * p;
    acc.net += net;
    acc.kg += kg;
    return acc;
  }, { net: 0, kg: 0 });
  const avgKg = totals.kg > 0 ? totals.net / totals.kg : 0;

  const addLine = () => setLines([...lines, blankLine()]);
  const updateLine = (i: number, patch: Partial<Line>) => {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], ...patch };
    const q = parseFloat(newLines[i].quantity) || 0;
    const p = parseFloat(newLines[i].unitPrice) || 0;
    newLines[i].netTotal = String((q * p).toFixed(2));
    setLines(newLines);
  };
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setProductInLine = (i: number, productId: string) => {
    const p = products.find((x: any) => x.id === parseInt(productId));
    if (!p) return;
    updateLine(i, {
      productId: p.id,
      productName: p.name,
      productCode: p.code || "",
      unit: p.unit || "UN",
      unitPrice: p.price ? String(p.price) : "0",
    });
  };

  const save = async () => {
    if (!form.clientId) { toast({ title: "Cliente requerido", variant: "destructive" }); return; }
    const body: any = {
      ...form,
      clientId: parseInt(form.clientId),
      contactId: form.contactId ? parseInt(form.contactId) : null,
      opportunityId: form.opportunityId ? parseInt(form.opportunityId) : null,
      salespersonId: form.salespersonId ? parseInt(form.salespersonId) : null,
      priceListId: form.priceListId ? parseInt(form.priceListId) : null,
      saleConditionId: form.saleConditionId ? parseInt(form.saleConditionId) : null,
      lines: lines.filter(l => l.productName).map((l, idx) => ({
        ...l, lineNumber: idx + 1,
        productId: l.productId || null,
      })),
    };
    const url = isNew ? `${API}/api/quotes` : `${API}/api/quotes/${id}`;
    const r = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (r.ok) {
      const data = await r.json();
      toast({ title: "Cotización guardada" });
      if (isNew) setLocation(`/quotes/${data.id}`);
    } else {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const convertToOrder = async () => {
    if (!confirm("¿Convertir esta cotización en pedido de cliente?")) return;
    const r = await fetch(`${API}/api/quotes/${id}/convert-to-order`, { method: "POST", credentials: "include" });
    if (r.ok) {
      const j = await r.json();
      toast({ title: `Pedido ${j.orderNumber} creado` });
      setLocation(`/orders/${j.orderId}`);
    } else toast({ title: "Error al convertir", variant: "destructive" });
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/quotes"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Cotización de venta / {isNew ? "Nuevo" : `#${id}`}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="outline" onClick={convertToOrder}><ShoppingCart className="w-4 h-4 mr-2" />Convertir a pedido</Button>}
          <Button onClick={save}><Save className="w-4 h-4 mr-2" />Guardar</Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>CUIT</Label><Input value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} /></div>

            <div>
              <Label>Condición de venta *</Label>
              <Select value={form.saleConditionId} onValueChange={v => setForm({ ...form, saleConditionId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {saleConditions.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contacto</Label>
              <Select value={form.contactId} onValueChange={v => setForm({ ...form, contactId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contacto..." /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName || c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div><Label>Fecha *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Fecha de entrega</Label><Input type="date" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} /></div>

            <div>
              <Label>Lista de precios *</Label>
              <Select value={form.priceListId} onValueChange={v => setForm({ ...form, priceListId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {priceLists.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Fecha de vencimiento</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>

            <div>
              <Label>Moneda *</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">Dólar - u$s</SelectItem>
                  <SelectItem value="ARS">Pesos - $</SelectItem>
                  <SelectItem value="EUR">Euro - €</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Tasa de cambio</Label><Input type="number" step="0.0001" value={form.exchangeRate} onChange={e => setForm({ ...form, exchangeRate: e.target.value })} /></div>

            <div className="col-span-2">
              <Label>Tipo de cambio</Label>
              <Select value={form.exchangeRateType} onValueChange={v => setForm({ ...form, exchangeRateType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIVISA VENTA BNA">DIVISA VENTA BNA</SelectItem>
                  <SelectItem value="DIVISA COMPRA BNA">DIVISA COMPRA BNA</SelectItem>
                  <SelectItem value="DOLAR MEP">DOLAR MEP</SelectItem>
                  <SelectItem value="DOLAR BLUE">DOLAR BLUE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div><Label>Precio medio por Kg</Label><Input value={avgKg.toFixed(4)} disabled /></div>
            <div><Label>Monto neto</Label><Input value={totals.net.toFixed(2)} disabled /></div>
            <div><Label>Total Kg</Label><Input value={totals.kg.toFixed(2)} disabled /></div>
            <div><Label>Total</Label><Input value={totals.net.toFixed(2)} disabled className="font-bold text-lg" /></div>

            <div>
              <Label>Estado de cotización</Label>
              <Input value={form.quoteStatus} onChange={e => setForm({ ...form, quoteStatus: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridad *</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NINGUNA">NINGUNA</SelectItem>
                  <SelectItem value="BAJA">BAJA</SelectItem>
                  <SelectItem value="MEDIA">MEDIA</SelectItem>
                  <SelectItem value="ALTA">ALTA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de cotización *</Label>
              <Select value={form.quoteType} onValueChange={v => setForm({ ...form, quoteType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COTIZACION">COTIZACION</SelectItem>
                  <SelectItem value="LICITACION">LICITACION</SelectItem>
                  <SelectItem value="OFERTA">OFERTA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vendedor</Label>
              <Select value={form.salespersonId} onValueChange={v => setForm({ ...form, salespersonId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {salespeople.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de orden *</Label>
              <Select value={form.orderType} onValueChange={v => setForm({ ...form, orderType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVENTA">REVENTA</SelectItem>
                  <SelectItem value="PRODUCCION">PRODUCCION</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <Label>Crear seguimiento</Label>
              <Switch checked={form.createSchedule} onCheckedChange={v => setForm({ ...form, createSchedule: v })} />
            </div>
            {form.createSchedule && (
              <div className="col-span-2"><Label>Fecha de seguimiento</Label><Input type="date" value={form.followupDate} onChange={e => setForm({ ...form, followupDate: e.target.value })} /></div>
            )}

            <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Nota interna</Label><Textarea rows={3} value={form.internalNote} onChange={e => setForm({ ...form, internalNote: e.target.value })} /></div>

            <div><Label>Referencia</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
            <div><Label>Orden de compra</Label><Input value={form.purchaseOrder} onChange={e => setForm({ ...form, purchaseOrder: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Líneas</h2>
            <Button size="sm" onClick={addLine}><Plus className="w-4 h-4 mr-2" />Agregar línea</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50">
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th className="p-2 w-12">#</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2 min-w-[200px]">Producto</th>
                  <th className="p-2">UM</th>
                  <th className="p-2 w-24">Cantidad</th>
                  <th className="p-2 w-24">Cant. Kg</th>
                  <th className="p-2 w-28">Precio</th>
                  <th className="p-2 w-28 text-right">Total neto</th>
                  <th className="p-2">Plazo</th>
                  <th className="p-2">Cod. cliente</th>
                  <th className="p-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2">
                      <Select value={l.productType} onValueChange={v => updateLine(i, { productType: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REVENTA">REVENTA</SelectItem>
                          <SelectItem value="PRODUCCION">PRODUCCION</SelectItem>
                          <SelectItem value="SERVICIO">SERVICIO</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Select value={l.productId ? String(l.productId) : ""} onValueChange={v => setProductInLine(i, v)}>
                          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Catálogo..." /></SelectTrigger>
                          <SelectContent>
                            {products.slice(0, 200).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input className="h-8 text-xs" placeholder="Producto..." value={l.productName} onChange={e => updateLine(i, { productName: e.target.value })} />
                      </div>
                    </td>
                    <td className="p-2"><Input className="h-8 text-xs w-16" value={l.unit} onChange={e => updateLine(i, { unit: e.target.value })} /></td>
                    <td className="p-2"><Input type="number" step="0.01" className="h-8 text-xs" value={l.quantity} onChange={e => updateLine(i, { quantity: e.target.value })} /></td>
                    <td className="p-2"><Input type="number" step="0.01" className="h-8 text-xs" value={l.quantityKg} onChange={e => updateLine(i, { quantityKg: e.target.value })} /></td>
                    <td className="p-2"><Input type="number" step="0.01" className="h-8 text-xs" value={l.unitPrice} onChange={e => updateLine(i, { unitPrice: e.target.value })} /></td>
                    <td className="p-2 text-right font-mono text-xs">{(parseFloat(l.quantity || "0") * parseFloat(l.unitPrice || "0")).toFixed(2)}</td>
                    <td className="p-2"><Input className="h-8 text-xs w-20" value={l.deliveryTime || ""} onChange={e => updateLine(i, { deliveryTime: e.target.value })} /></td>
                    <td className="p-2"><Input className="h-8 text-xs w-20" value={l.clientCode || ""} onChange={e => updateLine(i, { clientCode: e.target.value })} /></td>
                    <td className="p-2"><Button size="sm" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                  </tr>
                ))}
                {lines.length === 0 && (<tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Sin líneas. Agregá una línea.</td></tr>)}
              </tbody>
              <tfoot className="border-t border-border/50 font-bold">
                <tr>
                  <td colSpan={5}></td>
                  <td className="p-2 text-right">{totals.kg.toFixed(2)} kg</td>
                  <td></td>
                  <td className="p-2 text-right text-lg">{totals.net.toFixed(2)} {form.currency}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      {!isNew && id && <div className="mt-4"><DocumentUploader entityType="quote" entityId={id} /></div>}
    </AppLayout>
  );
}
