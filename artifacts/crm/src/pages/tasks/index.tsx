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
import {
  Plus, Trash2, Clock, AlertCircle, Calendar, ListTodo, RefreshCw,
  CheckCircle2, Circle, CalendarClock, User, Building2, FileText,
  ChevronRight, Bell, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isPast } from "date-fns";
import { es } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL || "";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-300 border-red-500/30",
  high:   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  low:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja",
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tarea", call: "Llamada", meeting: "Reunión",
  email: "Email", followup: "Seguimiento", reminder: "Recordatorio",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pendiente",   color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  in_progress: { label: "En progreso", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  completed:   { label: "Completada",  color: "bg-green-500/20 text-green-300 border-green-500/30" },
  cancelled:   { label: "Cancelada",   color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [view, setView] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    title: "", description: "", type: "task", priority: "medium",
    assignedTo: "", clientId: "", dueDate: "",
  });

  // Detail modal state
  const [selected, setSelected] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [showFollowupForm, setShowFollowupForm] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (view !== "all") params.set("view", view);
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
    if (isVendedor) return;
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
      assignedTo: isVendedor ? (user?.id || null) : (form.assignedTo ? parseInt(form.assignedTo) : null),
      clientId: form.clientId ? parseInt(form.clientId) : null,
      dueDate: form.dueDate || null,
    };
    const r = await fetch(`${API}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (r.ok) {
      toast({ title: "Tarea creada" });
      setNewOpen(false);
      setForm({ title: "", description: "", type: "task", priority: "medium", assignedTo: "", clientId: "", dueDate: "" });
      load();
    } else toast({ title: "Error", variant: "destructive" });
  };

  const patch = async (id: number, data: any) => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/tasks/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        const updated = await r.json();
        setItems(ts => ts.map(t => t.id === id ? { ...t, ...updated } : t));
        setSelected((s: any) => s?.id === id ? { ...s, ...updated } : s);
      }
    } finally { setSaving(false); }
  };

  const closeTask = async () => {
    if (!selected) return;
    await patch(selected.id, { status: "completed", completedAt: new Date().toISOString() });
    toast({ title: "Tarea cerrada" });
    load();
  };

  const reopenTask = async () => {
    if (!selected) return;
    await patch(selected.id, { status: "pending", completedAt: null });
    toast({ title: "Tarea reabierta" });
    load();
  };

  const scheduleFollowup = async () => {
    if (!selected || !followupDate) {
      toast({ title: "Seleccioná una fecha de seguimiento", variant: "destructive" }); return;
    }
    // Create a new followup task linked to this one
    const body: any = {
      title: `Seguimiento: ${selected.title}`,
      type: "followup",
      priority: selected.priority,
      description: followupNote || `Seguimiento de tarea: ${selected.title}`,
      assignedTo: selected.assignedTo,
      clientId: selected.clientId,
      dueDate: new Date(followupDate).toISOString(),
    };
    const r = await fetch(`${API}/api/tasks`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      toast({ title: "Seguimiento agendado", description: `Para el ${format(new Date(followupDate), "EEEE d MMM 'a las' HH:mm", { locale: es })}` });
      setShowFollowupForm(false);
      setFollowupDate("");
      setFollowupNote("");
      load();
    } else {
      toast({ title: "Error al agendar", variant: "destructive" });
    }
  };

  const del = async (id: number) => {
    if (!confirm("¿Eliminar tarea?")) return;
    await fetch(`${API}/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    setDetailOpen(false);
    load();
  };

  const openDetail = (task: any) => {
    setSelected(task);
    setDetailOpen(true);
    setShowFollowupForm(false);
    setFollowupDate("");
    setFollowupNote("");
  };

  const isOverdue = (t: any) => t.dueDate && t.status !== "completed" && isPast(parseISO(t.dueDate));

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
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendientes</div><div className="text-3xl font-bold">{stats.pending || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-400" />Vencidas</div><div className="text-3xl font-bold text-red-400">{stats.overdue || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3 text-blue-400" />Hoy</div><div className="text-3xl font-bold text-blue-400">{stats.today || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Completadas</div><div className="text-3xl font-bold text-green-400">{stats.completed || 0}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {[["all", "Todas"], ["today", "Hoy"], ["overdue", "Vencidas"]].map(([v, l]) => (
          <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>{l}</Button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {items.map(t => (
          <Card
            key={t.id}
            className={`transition-all cursor-pointer hover:bg-white/5 ${isOverdue(t) ? "border-red-500/40" : ""} ${(t.deferCount ?? 0) > 0 ? "border-orange-500/20" : ""} ${t.status === "completed" ? "opacity-60" : ""}`}
            onClick={() => openDetail(t)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div onClick={e => { e.stopPropagation(); patch(t.id, { status: t.status === "completed" ? "pending" : "completed" }).then(load); }}>
                {t.status === "completed"
                  ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary shrink-0 transition-colors" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <Badge className={`text-xs ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</Badge>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[t.type] || t.type}</Badge>
                  {t.clientName && <span className="text-xs text-muted-foreground">· {t.clientName}</span>}
                  {!isVendedor && t.assigneeName && <span className="text-xs text-muted-foreground">· {t.assigneeName}</span>}
                  {(t.deferCount ?? 0) > 0 && (
                    <span className="text-xs text-orange-400 flex items-center gap-0.5">
                      <RefreshCw className="w-3 h-3" />Diferida {t.deferCount}x
                    </span>
                  )}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl">{t.description}</p>}
                {t.dueDate && (
                  <div className={`text-xs mt-1 flex items-center gap-1 ${isOverdue(t) ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" />
                    {format(parseISO(t.dueDate), "EEE d MMM, HH:mm", { locale: es })}
                    {isOverdue(t) && " · VENCIDA"}
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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

      {/* ── Detail modal ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-6">
                  <div className="mt-1">
                    {selected.status === "completed"
                      ? <CheckCircle2 className="w-6 h-6 text-green-400" />
                      : <Circle className="w-6 h-6 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-left text-lg leading-snug">{selected.title}</DialogTitle>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge className={`text-xs ${PRIORITY_COLORS[selected.priority]}`}>{PRIORITY_LABELS[selected.priority]}</Badge>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[selected.type]}</Badge>
                      <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[selected.status]?.color}`}>
                        {STATUS_CONFIG[selected.status]?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-1">
                {/* Meta info */}
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {selected.dueDate && (
                    <div className={`flex items-center gap-2 ${isOverdue(selected) ? "text-red-400" : "text-muted-foreground"}`}>
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Vence: <strong>{format(parseISO(selected.dueDate), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}</strong>
                        {isOverdue(selected) && " · VENCIDA"}
                      </span>
                    </div>
                  )}
                  {selected.assigneeName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4 shrink-0" />
                      <span>Asignado a: <strong className="text-foreground">{selected.assigneeName}</strong></span>
                    </div>
                  )}
                  {selected.clientName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>Cliente: <strong className="text-foreground">{selected.clientName}</strong></span>
                    </div>
                  )}
                  {selected.completedAt && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Cerrada el {format(parseISO(selected.completedAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}</span>
                    </div>
                  )}
                  {(selected.deferCount ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-orange-400">
                      <RefreshCw className="w-4 h-4 shrink-0" />
                      <span>Diferida {selected.deferCount} vez{selected.deferCount > 1 ? "ces" : ""}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selected.description && (
                  <div className="p-3 bg-white/5 rounded-lg text-sm text-muted-foreground leading-relaxed">
                    {selected.description}
                  </div>
                )}

                <hr className="border-border/40" />

                {/* Followup form */}
                {showFollowupForm ? (
                  <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-primary" />Agendar seguimiento
                      </p>
                      <button onClick={() => setShowFollowupForm(false)}>
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-xs">Fecha y hora *</Label>
                      <Input
                        type="datetime-local"
                        value={followupDate}
                        onChange={e => setFollowupDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nota (opcional)</Label>
                      <Textarea
                        rows={2}
                        value={followupNote}
                        onChange={e => setFollowupNote(e.target.value)}
                        placeholder="¿Qué vas a hacer en el seguimiento?"
                        className="mt-1 text-sm"
                      />
                    </div>
                    <Button className="w-full" onClick={scheduleFollowup} disabled={saving || !followupDate}>
                      <Bell className="w-4 h-4 mr-2" />Confirmar seguimiento
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Primary action: close or reopen */}
                    {selected.status !== "completed" ? (
                      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={closeTask} disabled={saving}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />Marcar como cerrada
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={reopenTask} disabled={saving}>
                        <Circle className="w-4 h-4 mr-2" />Reabrir tarea
                      </Button>
                    )}

                    {/* Schedule followup */}
                    <Button
                      variant="outline"
                      className="w-full border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => setShowFollowupForm(true)}
                    >
                      <CalendarClock className="w-4 h-4 mr-2" />Agendar seguimiento
                    </Button>

                    {/* Change status to in_progress */}
                    {selected.status === "pending" && (
                      <Button
                        variant="outline"
                        className="w-full text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                        onClick={() => patch(selected.id, { status: "in_progress" })}
                        disabled={saving}
                      >
                        En progreso
                      </Button>
                    )}
                  </div>
                )}

                {/* Delete — only for non-vendedores */}
                {!isVendedor && !showFollowupForm && (
                  <div className="flex justify-end pt-1">
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs" onClick={() => del(selected.id)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar tarea
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
