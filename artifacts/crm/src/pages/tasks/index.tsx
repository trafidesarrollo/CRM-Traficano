import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Plus, Trash2, Clock, AlertCircle, Calendar, ListTodo, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const API = import.meta.env.VITE_API_URL || "";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-300 border-red-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tarea", call: "Llamada", meeting: "Reunión",
  email: "Email", followup: "Seguimiento", reminder: "Recordatorio",
};

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [view, setView] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    title: "", description: "", type: "task", priority: "medium",
    assignedTo: "", clientId: "", dueDate: "",
  });

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (view !== "all") params.set("view", view);
      // Vendedores solo ven sus propias tareas
      if (isVendedor && user?.id) params.set("assignedTo", String(user.id));
      const r = await fetch(`${API}/api/tasks?${params}`, { credentials: "include" });
      const j = await r.json();
      setItems(Array.isArray(j) ? j : []);
      const s = await fetch(`${API}/api/tasks/stats/summary`, { credentials: "include" });
      if (s.ok) {
        const sj = await s.json();
        setStats(sj && typeof sj === "object" && !Array.isArray(sj) ? sj : {});
      }
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { if (user !== undefined) load(); }, [view, user]);
  useEffect(() => {
    if (isVendedor) return; // vendedores no necesitan lista de usuarios ni pueden reasignar
    fetch(`${API}/api/users`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
    fetch(`${API}/api/clients?limit=300`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [isVendedor]);

  const create = async () => {
    if (!form.title) { toast({ title: "Título requerido", variant: "destructive" }); return; }
    const body: any = {
      ...form,
      // Vendedores se auto-asignan
      assignedTo: isVendedor ? (user?.id || null) : (form.assignedTo ? parseInt(form.assignedTo) : null),
      clientId: form.clientId ? parseInt(form.clientId) : null,
      dueDate: form.dueDate || null,
    };
    const r = await fetch(`${API}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (r.ok) {
      toast({ title: "Tarea creada" });
      setOpen(false);
      setForm({ title: "", description: "", type: "task", priority: "medium", assignedTo: "", clientId: "", dueDate: "" });
      load();
    } else toast({ title: "Error", variant: "destructive" });
  };

  const toggle = async (t: any) => {
    const newStatus = t.status === "completed" ? "pending" : "completed";
    await fetch(`${API}/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: newStatus }) });
    load();
  };

  const del = async (id: number) => {
    if (!confirm("¿Eliminar tarea?")) return;
    await fetch(`${API}/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const isOverdue = (t: any) => t.dueDate && t.status !== "completed" && new Date(t.dueDate) < new Date();

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <ListTodo className="w-8 h-8 text-primary" />Mis Tareas
          </h1>
          <p className="text-muted-foreground mt-1">
            {isVendedor ? "Tus tareas asignadas" : "Gestión de tareas del equipo"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nueva Tarea</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
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
                </div>
                <div><Label>Vencimiento</Label><Input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
                {!isVendedor && (
                  <div><Label>Asignar a</Label>
                    <Select value={form.assignedTo} onValueChange={v => setForm({ ...form, assignedTo: v })}>
                      <SelectTrigger><SelectValue placeholder="Yo" /></SelectTrigger>
                      <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {!isVendedor && (
                  <div><Label>Cliente relacionado</Label>
                    <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                      <SelectTrigger><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                      <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <Button className="w-full" onClick={create}>Crear tarea</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendientes</div><div className="text-3xl font-bold">{stats.pending || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-400" />Vencidas</div><div className="text-3xl font-bold text-red-400">{stats.overdue || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3 text-blue-400" />Hoy</div><div className="text-3xl font-bold text-blue-400">{stats.today || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Completadas</div><div className="text-3xl font-bold text-green-400">{stats.completed || 0}</div></CardContent></Card>
      </div>

      <div className="flex gap-2 mb-4">
        {[["all", "Todas"], ["today", "Hoy"], ["overdue", "Vencidas"]].map(([v, l]) => (
          <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>{l}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {items.map(t => (
          <Card key={t.id} className={`transition-all ${isOverdue(t) ? "border-red-500/50" : ""} ${(t.deferCount ?? 0) > 0 ? "border-orange-500/30" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <Checkbox checked={t.status === "completed"} onCheckedChange={() => toggle(t)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <Badge className={PRIORITY_COLORS[t.priority]}>{t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "medium" ? "Media" : "Baja"}</Badge>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[t.type] || t.type}</Badge>
                  {t.clientName && <span className="text-xs text-muted-foreground">· {t.clientName}</span>}
                  {!isVendedor && t.assigneeName && <span className="text-xs text-muted-foreground">· {t.assigneeName}</span>}
                  {(t.deferCount ?? 0) > 0 && (
                    <span className="text-xs text-orange-400 flex items-center gap-0.5">
                      <RefreshCw className="w-3 h-3" />Diferida {t.deferCount}x
                    </span>
                  )}
                </div>
                {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                {t.dueDate && (
                  <div className={`text-xs mt-1 flex items-center gap-1 ${isOverdue(t) ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" />
                    {new Date(t.dueDate).toLocaleString("es-AR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {isOverdue(t) && " · VENCIDA"}
                  </div>
                )}
              </div>
              {!isVendedor && (
                <Button size="sm" variant="ghost" onClick={() => del(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              )}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <ListTodo className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">
                {isVendedor ? "No tenés tareas asignadas por el momento." : "Sin tareas para mostrar."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
