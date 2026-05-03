import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Trash2, Factory } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const API = import.meta.env.VITE_API_URL || "";

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-slate-500/20 text-slate-300" },
  in_progress: { label: "En proceso", color: "bg-blue-500/20 text-blue-300" },
  completed: { label: "Completada", color: "bg-green-500/20 text-green-300" },
  cancelled: { label: "Cancelada", color: "bg-red-500/20 text-red-300" },
};

export default function ProductionDetail() {
  const [, params] = useRoute("/production/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [now, setNow] = useState<string>(new Date().toISOString().slice(0, 16));
  const [form, setForm] = useState<any>({
    qtyProduced: "", qtyRejected: "0",
    startTime: "", endTime: "",
    operatorName: "", locationId: "", notes: "", incident: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    const [oR, rR, lR] = await Promise.all([
      fetch(`${API}/api/production/orders/${id}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/production/orders/${id}/records`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/api/production/locations`, { credentials: "include" }).then(r => r.json()),
    ]);
    setOrder(oR);
    setRecords(rR);
    setLocations(lR);
    setForm((f: any) => ({ ...f, locationId: f.locationId || (oR.locationId ? String(oR.locationId) : ""), operatorName: f.operatorName || (user as any)?.name || "" }));
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [id]);

  if (!order) return <AppLayout><div className="p-8 text-muted-foreground">Cargando…</div></AppLayout>;

  const planned = parseFloat(order.plannedQty) || 0;
  const produced = parseFloat(order.producedQty) || 0;
  const rejected = parseFloat(order.rejectedQty) || 0;
  const remaining = Math.max(0, planned - produced - rejected);
  const pct = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
  const efficiency = produced + rejected > 0 ? (produced / (produced + rejected)) * 100 : 0;
  const s = STATUS[order.status] || STATUS.pending;

  async function submit() {
    const qP = parseFloat(form.qtyProduced) || 0;
    const qR = parseFloat(form.qtyRejected) || 0;
    if (qP === 0 && qR === 0) { toast({ title: "Cargá al menos una cantidad", variant: "destructive" }); return; }
    if (planned > 0 && (produced + rejected + qP + qR) > planned) {
      if (!confirm(`El total superará la cantidad planificada (${planned}). ¿Registrar igual?`)) return;
    }
    setSaving(true);
    try {
      const body: any = {
        qtyProduced: qP.toString(),
        qtyRejected: qR.toString(),
        operatorId: (user as any)?.id || null,
        operatorName: form.operatorName || null,
        locationId: form.locationId ? parseInt(form.locationId) : null,
        notes: form.notes || null,
        incident: form.incident || null,
      };
      if (form.startTime) body.startTime = new Date(form.startTime).toISOString();
      if (form.endTime) body.endTime = new Date(form.endTime).toISOString();
      const r = await fetch(`${API}/api/production/orders/${id}/records`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) {
        toast({ title: "Registro guardado" });
        setForm({ ...form, qtyProduced: "", qtyRejected: "0", startTime: "", endTime: "", notes: "", incident: "" });
        load();
      } else { const e = await r.json(); toast({ title: "Error", description: e.error, variant: "destructive" }); }
    } finally { setSaving(false); }
  }

  async function changeStatus(status: string) {
    const r = await fetch(`${API}/api/production/orders/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) { toast({ title: "Estado actualizado" }); load(); }
  }

  async function delRecord(rid: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    const r = await fetch(`${API}/api/production/records/${rid}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { toast({ title: "Registro eliminado" }); load(); }
  }

  const closed = order.status === "completed" || order.status === "cancelled";

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/production"><Button variant="ghost" size="sm" aria-label="Volver"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <Factory className="w-6 h-6 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-muted-foreground">{order.number}</div>
          <h1 className="text-xl sm:text-2xl font-display font-bold truncate">{order.productName || order.productNameFromMaster || "Sin producto"}</h1>
        </div>
        <Badge className={s.color}>{s.label}</Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Planificado</div><div className="text-2xl font-bold font-mono">{planned.toFixed(0)} <span className="text-sm text-muted-foreground">{order.unit}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Producido</div><div className="text-2xl font-bold font-mono text-green-400">{produced.toFixed(0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Rechazado</div><div className="text-2xl font-bold font-mono text-red-400">{rejected.toFixed(0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Restante</div><div className="text-2xl font-bold font-mono">{remaining.toFixed(0)}</div></CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Avance</span><span className="font-mono">{pct.toFixed(1)}% · Eficiencia {efficiency.toFixed(1)}%</span></div>
          <div className="h-3 bg-white/5 rounded overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="text-xs text-muted-foreground">Ubicación: {order.locationName || "—"}</div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Register form */}
        <Card>
          <CardHeader><CardTitle className="text-base">Registrar producción</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {closed && <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 rounded p-3"><AlertTriangle className="w-4 h-4" />Orden cerrada — no se admiten más registros</div>}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad producida *</Label><Input inputMode="decimal" type="number" step="0.01" value={form.qtyProduced} onChange={e => setForm({ ...form, qtyProduced: e.target.value })} disabled={closed} className="text-lg" /></div>
              <div><Label>Cantidad rechazada</Label><Input inputMode="decimal" type="number" step="0.01" value={form.qtyRejected} onChange={e => setForm({ ...form, qtyRejected: e.target.value })} disabled={closed} className="text-lg" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Inicio</Label><Input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} disabled={closed} /></div>
              <div><Label>Fin</Label><Input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} disabled={closed} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Operador</Label><Input value={form.operatorName} onChange={e => setForm({ ...form, operatorName: e.target.value })} disabled={closed} /></div>
              <div><Label>Ubicación</Label>
                <Select value={form.locationId || "none"} onValueChange={v => setForm({ ...form, locationId: v === "none" ? "" : v })} disabled={closed}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin ubicación</SelectItem>
                    {locations.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.code} · {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observaciones</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} disabled={closed} /></div>
            <div><Label>Incidencia</Label><Textarea rows={2} value={form.incident} onChange={e => setForm({ ...form, incident: e.target.value })} disabled={closed} placeholder="Paro, falla, ajuste…" /></div>
            <div className="flex gap-2 pt-2">
              <Button onClick={submit} disabled={saving || closed} className="flex-1" size="lg">Registrar</Button>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/30">
              {order.status !== "in_progress" && order.status !== "completed" && <Button size="sm" variant="outline" onClick={() => changeStatus("in_progress")}>Marcar en proceso</Button>}
              {order.status !== "completed" && <Button size="sm" variant="outline" onClick={() => changeStatus("completed")}>Cerrar como completada</Button>}
              {order.status !== "cancelled" && order.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => changeStatus("cancelled")}>Cancelar orden</Button>}
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader><CardTitle className="text-base">Historial ({records.length})</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-auto">
            {records.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin registros aún</div>}
            {records.map(r => (
              <div key={r.id} className="border-b border-border/30 p-3 hover:bg-white/5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("es-AR")}</div>
                    <div className="font-medium">{r.operatorDisplay || "—"} · <span className="text-xs text-muted-foreground">{r.locationName || "sin ubic."}</span></div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Eliminar registro" onClick={() => delRecord(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                  <div><span className="text-muted-foreground text-xs">Prod</span><div className="font-mono text-green-400">{parseFloat(r.qtyProduced).toFixed(0)}</div></div>
                  <div><span className="text-muted-foreground text-xs">Rech</span><div className="font-mono text-red-400">{parseFloat(r.qtyRejected).toFixed(0)}</div></div>
                  <div><span className="text-muted-foreground text-xs">Min</span><div className="font-mono">{r.durationMin ? parseFloat(r.durationMin).toFixed(0) : "—"}</div></div>
                </div>
                {r.notes && <div className="text-xs text-muted-foreground mt-2 italic">{r.notes}</div>}
                {r.incident && <div className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.incident}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
