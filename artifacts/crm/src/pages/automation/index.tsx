import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Workflow, Plus, Edit, Trash2, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

const TRIGGERS = [
  { value: "quote.created", label: "Cotización creada" },
  { value: "quote.approved", label: "Cotización aprobada" },
  { value: "order.created", label: "Pedido creado" },
  { value: "order.shipped", label: "Pedido enviado" },
  { value: "opportunity.won", label: "Oportunidad ganada" },
  { value: "opportunity.stage_changed", label: "Oportunidad cambia de etapa" },
  { value: "task.overdue", label: "Tarea vencida" },
  { value: "client.created", label: "Cliente creado" },
];

const ACTIONS = [
  { value: "send_email", label: "Enviar email" },
  { value: "create_task", label: "Crear tarea" },
  { value: "create_notification", label: "Crear notificación" },
  { value: "update_field", label: "Actualizar campo" },
  { value: "assign_to", label: "Asignar a usuario" },
];

export default function Automation() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [tab, setTab] = useState<"rules" | "logs">("rules");
  const [form, setForm] = useState<any>({ name: "", description: "", triggerEvent: "quote.created", isActive: true, conditions: "[]", actions: "[]" });

  const load = async () => {
    const r = await fetch(`${API}/api/automation/rules`, { credentials: "include" });
    const d = await r.json(); setItems(d.data || []);
    const l = await fetch(`${API}/api/automation/logs`, { credentials: "include" });
    setLogs((await l.json()).data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { toast({ title: "Nombre requerido", variant: "destructive" }); return; }
    let conditions = [], actions = [];
    try { conditions = JSON.parse(form.conditions || "[]"); actions = JSON.parse(form.actions || "[]"); }
    catch (e) { toast({ title: "JSON inválido en condiciones o acciones", variant: "destructive" }); return; }
    const body = { ...form, conditions, actions };
    const url = editing ? `${API}/api/automation/rules/${editing.id}` : `${API}/api/automation/rules`;
    const r = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (r.ok) { toast({ title: editing ? "Actualizada" : "Creada" }); setOpen(false); setEditing(null); load(); }
    else toast({ title: "Error", variant: "destructive" });
  };

  const edit = (r: any) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || "", triggerEvent: r.triggerEvent, isActive: r.isActive, conditions: JSON.stringify(r.conditions || [], null, 2), actions: JSON.stringify(r.actions || [], null, 2) });
    setOpen(true);
  };
  const del = async (id: number) => { if (!confirm("¿Eliminar regla?")) return; await fetch(`${API}/api/automation/rules/${id}`, { method: "DELETE", credentials: "include" }); load(); };
  const toggle = async (r: any) => { await fetch(`${API}/api/automation/rules/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isActive: !r.isActive }) }); load(); };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Workflow className="h-6 w-6" /><h1 className="text-2xl font-bold">Automatizaciones</h1></div>
          <div className="flex gap-2">
            <Button variant={tab === "rules" ? "default" : "outline"} size="sm" onClick={() => setTab("rules")}>Reglas</Button>
            <Button variant={tab === "logs" ? "default" : "outline"} size="sm" onClick={() => setTab("logs")}><Activity className="h-4 w-4 mr-1" />Logs</Button>
            <Button onClick={() => { setEditing(null); setForm({ name: "", description: "", triggerEvent: "quote.created", isActive: true, conditions: "[]", actions: "[]" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nueva</Button>
          </div>
        </div>

        {tab === "rules" && (
          <div className="space-y-2">
            {items.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{r.name}</h3>
                      <Badge variant="outline">{TRIGGERS.find(t => t.value === r.triggerEvent)?.label || r.triggerEvent}</Badge>
                      {r.isActive ? <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Activa</Badge> : <Badge variant="outline">Inactiva</Badge>}
                    </div>
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                    <div className="text-xs text-muted-foreground mt-1">Ejecutada {r.runCount || 0} veces</div>
                  </div>
                  <div className="flex gap-1">
                    <Switch checked={r.isActive} onCheckedChange={() => toggle(r)} />
                    <Button size="sm" variant="outline" onClick={() => edit(r)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => del(r.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!items.length && <Card><CardContent className="p-8 text-center text-muted-foreground">No hay reglas configuradas</CardContent></Card>}
          </div>
        )}

        {tab === "logs" && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground"><th className="text-left p-2">Regla</th><th className="text-left p-2">Entidad</th><th className="text-left p-2">Estado</th><th className="text-left p-2">Mensaje</th><th className="text-left p-2">Fecha</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b">
                      <td className="p-2">#{l.ruleId}</td>
                      <td className="p-2">{l.entityType} #{l.entityId}</td>
                      <td className="p-2"><Badge variant="outline">{l.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{l.message}</td>
                      <td className="p-2 text-xs">{new Date(l.executedAt).toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                  {!logs.length && <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Sin ejecuciones registradas</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} regla</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descripción</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Disparador</Label>
                <Select value={form.triggerEvent} onValueChange={v => setForm({ ...form, triggerEvent: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Condiciones (JSON: array de {"{field, op, value}"})</Label>
                <Textarea rows={4} className="font-mono text-xs" value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })} placeholder='[{"field":"total","op":">","value":10000}]' />
              </div>
              <div><Label>Acciones (JSON: array de {"{type, params}"})</Label>
                <Textarea rows={4} className="font-mono text-xs" value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })} placeholder={`[{"type":"create_notification","params":{"title":"Cotización grande","userId":1}}]`} />
                <div className="text-xs text-muted-foreground mt-1">Tipos disponibles: {ACTIONS.map(a => a.value).join(", ")}</div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} /><Label>Activa</Label></div>
              <Button onClick={save} className="w-full">{editing ? "Actualizar" : "Crear"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
