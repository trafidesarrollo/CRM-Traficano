import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Factory, Plus, Eye, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

type POrder = {
  id: number; number: string; productName: string | null; productNameFromMaster: string | null;
  locationName: string | null; locationCode: string | null;
  plannedQty: string; producedQty: string; rejectedQty: string; unit: string | null;
  status: string; priority: string; plannedEnd: string | null; notes: string | null;
};
type Loc = { id: number; code: string; name: string };

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-slate-500/20 text-slate-300" },
  in_progress: { label: "En proceso", color: "bg-blue-500/20 text-blue-300" },
  completed: { label: "Completada", color: "bg-green-500/20 text-green-300" },
  cancelled: { label: "Cancelada", color: "bg-red-500/20 text-red-300" },
};
const PRIORITY: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function ProductionList() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<POrder[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState<any>({ number: "", productName: "", plannedQty: "1", unit: "u", priority: "medium", locationId: "", notes: "" });
  const [openLoc, setOpenLoc] = useState(false);
  const [locForm, setLocForm] = useState({ code: "", name: "", description: "" });

  async function load() {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (locFilter !== "all") params.set("locationId", locFilter);
    const r = await fetch(`${API}/api/production/orders?${params}`, { credentials: "include" });
    setOrders(await r.json());
  }
  async function loadLocs() {
    const r = await fetch(`${API}/api/production/locations`, { credentials: "include" });
    setLocations(await r.json());
  }
  useEffect(() => { loadLocs(); }, []);
  useEffect(() => { load(); }, [statusFilter, locFilter]);

  async function create() {
    const body = { ...form, locationId: form.locationId ? parseInt(form.locationId) : null };
    const r = await fetch(`${API}/api/production/orders`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { toast({ title: "Orden creada" }); setOpenCreate(false); setForm({ number: "", productName: "", plannedQty: "1", unit: "u", priority: "medium", locationId: "", notes: "" }); load(); }
    else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  }
  async function createLoc() {
    const r = await fetch(`${API}/api/production/locations`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(locForm) });
    if (r.ok) { toast({ title: "Ubicación creada" }); setOpenLoc(false); setLocForm({ code: "", name: "", description: "" }); loadLocs(); }
    else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
  }
  async function del(id: number) {
    if (!confirm("¿Eliminar la orden de producción y todos sus registros?")) return;
    const r = await fetch(`${API}/api/production/orders/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { toast({ title: "Eliminada" }); load(); }
  }

  const filtered = orders.filter(o => `${o.number} ${o.productName || ""} ${o.productNameFromMaster || ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-3"><Factory className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />Producción</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/production/dashboard"><Button variant="outline" size="sm">KPIs</Button></Link>
          <Button variant="outline" size="sm" onClick={() => setOpenLoc(true)}>+ Ubicación</Button>
          <Button size="sm" onClick={() => setOpenCreate(true)} aria-label="Nueva orden de producción"><Plus className="w-4 h-4 mr-1" />Nueva orden</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input placeholder="Buscar por número o producto…" value={search} onChange={e => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={locFilter} onValueChange={setLocFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Ubicación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.code} · {l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {filtered.map(o => {
          const planned = parseFloat(o.plannedQty) || 0;
          const produced = parseFloat(o.producedQty) || 0;
          const pct = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
          const s = STATUS[o.status] || STATUS.pending;
          return (
            <Card key={o.id} className="bg-card/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm text-muted-foreground">{o.number}</div>
                    <div className="font-medium">{o.productName || o.productNameFromMaster || "—"}</div>
                  </div>
                  <Badge className={s.color}>{s.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{o.locationName || "Sin ubicación"} · <Badge variant="outline" className={PRIORITY[o.priority]}>{o.priority}</Badge></div>
                <div className="h-2 bg-white/5 rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                <div className="flex justify-between text-xs"><span>{produced.toFixed(0)} / {planned.toFixed(0)} {o.unit}</span><span>{pct.toFixed(0)}%</span></div>
                <div className="flex gap-2 pt-1">
                  <Link href={`/production/${o.id}`} className="flex-1"><Button size="sm" className="w-full">Registrar</Button></Link>
                  <Button size="sm" variant="ghost" onClick={() => del(o.id)} aria-label="Eliminar"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-muted-foreground p-8">No hay órdenes</div>}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-muted-foreground text-left">
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Producto</th>
                <th className="p-3">Ubicación</th>
                <th className="p-3 text-right">Plan</th>
                <th className="p-3 text-right">Producido</th>
                <th className="p-3 text-right">Rechazado</th>
                <th className="p-3">Avance</th>
                <th className="p-3">Prioridad</th>
                <th className="p-3">Estado</th>
                <th className="p-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const planned = parseFloat(o.plannedQty) || 0;
                const produced = parseFloat(o.producedQty) || 0;
                const rejected = parseFloat(o.rejectedQty) || 0;
                const pct = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
                const s = STATUS[o.status] || STATUS.pending;
                return (
                  <tr key={o.id} className="border-b border-border/30 hover:bg-white/5">
                    <td className="p-3 font-mono">{o.number}</td>
                    <td className="p-3 font-medium max-w-xs truncate">{o.productName || o.productNameFromMaster || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{o.locationName ? `${o.locationCode || ""} ${o.locationName}` : "—"}</td>
                    <td className="p-3 text-right font-mono">{planned.toFixed(0)} {o.unit}</td>
                    <td className="p-3 text-right font-mono">{produced.toFixed(0)}</td>
                    <td className="p-3 text-right font-mono text-red-400">{rejected.toFixed(0)}</td>
                    <td className="p-3 min-w-[120px]"><div className="h-2 bg-white/5 rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div><div className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(0)}%</div></td>
                    <td className="p-3"><Badge variant="outline" className={PRIORITY[o.priority]}>{o.priority}</Badge></td>
                    <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                    <td className="p-3 flex gap-1">
                      <Link href={`/production/${o.id}`}><Button size="sm" variant="ghost" aria-label="Abrir orden"><Eye className="w-4 h-4" /></Button></Link>
                      <Button size="sm" variant="ghost" aria-label="Eliminar" onClick={() => del(o.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (<tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No hay órdenes</td></tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva orden de producción</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Número *</Label><Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="OP-0001" /></div>
            <div><Label>Producto</Label><Input value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad planificada *</Label><Input type="number" step="0.01" value={form.plannedQty} onChange={e => setForm({ ...form, plannedQty: e.target.value })} /></div>
              <div><Label>Unidad</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ubicación</Label>
                <Select value={form.locationId || "none"} onValueChange={v => setForm({ ...form, locationId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin ubicación</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.code} · {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={create} disabled={!form.number || !form.plannedQty}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openLoc} onOpenChange={setOpenLoc}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva ubicación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Código *</Label><Input value={locForm.code} onChange={e => setLocForm({ ...locForm, code: e.target.value })} placeholder="L-01" /></div>
            <div><Label>Nombre *</Label><Input value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} placeholder="Línea 1" /></div>
            <div><Label>Descripción</Label><Input value={locForm.description} onChange={e => setLocForm({ ...locForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenLoc(false)}>Cancelar</Button>
            <Button onClick={createLoc} disabled={!locForm.code || !locForm.name}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
