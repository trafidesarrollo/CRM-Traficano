import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  Plus, Trash2, Clock, AlertCircle, Calendar, ListTodo, RefreshCw,
  CheckCircle2, Circle, CalendarClock, User, Building2,
  ChevronRight, Bell, X, FileText, DollarSign, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isPast, startOfDay, endOfDay } from "date-fns";
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
const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Borrador",  color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  sent:     { label: "Enviada",   color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  approved: { label: "Aprobada",  color: "bg-green-500/20 text-green-300 border-green-500/30" },
  rejected: { label: "Rechazada", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  partial:  { label: "Parcial",   color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  expired:  { label: "Vencida",   color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
};

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  const [items, setItems] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [view, setView] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    title: "", description: "", type: "task", priority: "medium",
    assignedTo: "", clientId: "", dueDate: "",
  });

  // Task detail modal
  const [selected, setSelected] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [showFollowupForm, setShowFollowupForm] = useState(false);

  // Quote followup modal
  const [selQuote, setSelQuote] = useState<any>(null);
  const [quoteDetailOpen, setQuoteDetailOpen] = useState(false);
  const [newFollowupDate, setNewFollowupDate] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);

  // Get salespersonId for vendedor filtering
  const [salespersonId, setSalespersonId] = useState<number | null>(null);
  useEffect(() => {
    if (!isVendedor || !user?.id) return;
    fetch(`${API}/api/salespeople?limit=200`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        const sp = list.find((s: any) => s.userId === user.id);
        if (sp) setSalespersonId(sp.id);
      })
      .catch(() => {});
  }, [isVendedor, user?.id]);

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
    } catch { setItems([]); }
  };

  const loadFollowups = async () => {
    try {
      const now = new Date();
      const params = new URLSearchParams();
      if (view === "today") {
        params.set("from", startOfDay(now).toISOString());
        params.set("to", endOfDay(now).toISOString());
      } else if (view === "overdue") {
        params.set("to", now.toISOString()); // past only
      }
      // "all" view: no date filter — show everything with followupDate
      if (isVendedor && salespersonId) params.set("salespersonId", String(salespersonId));
      const r = await fetch(`${API}/api/quotes/followups?${params}`, { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        setFollowups(Array.isArray(j) ? j : []);
      }
    } catch { setFollowups([]); }
  };

  useEffect(() => { if (user !== undefined) load(); }, [view, user]);
  useEffect(() => { if (user !== undefined) loadFollowups(); }, [view, user, salespersonId]);

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
    const body: any = {
      title: `Seguimiento: ${selected.title}`,
      type: "followup", priority: selected.priority,
      description: followupNote || `Seguimiento de tarea: ${selected.title}`,
      assignedTo: selected.assignedTo, clientId: selected.clientId,
      dueDate: new Date(followupDate).toISOString(),
    };
    const r = await fetch(`${API}/api/tasks`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      toast({ title: "Seguimiento agendado", description: `Para el ${format(new Date(followupDate), "EEEE d MMM 'a las' HH:mm", { locale: es })}` });
      setShowFollowupForm(false); setFollowupDate(""); setFollowupNote("");
      load();
    } else toast({ title: "Error al agendar", variant: "destructive" });
  };

  const del = async (id: number) => {
    if (!confirm("¿Eliminar tarea?")) return;
    await fetch(`${API}/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    setDetailOpen(false); load();
  };

  const updateQuoteFollowup = async () => {
    if (!selQuote || !newFollowupDate) {
      toast({ title: "Seleccioná una nueva fecha", variant: "destructive" }); return;
    }
    setSavingQuote(true);
    try {
      const r = await fetch(`${API}/api/quotes/${selQuote.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupDate: new Date(newFollowupDate).toISOString() }),
      });
      if (r.ok) {
        toast({ title: "Fecha actualizada", description: format(new Date(newFollowupDate), "EEEE d MMM 'a las' HH:mm", { locale: es }) });
        setNewFollowupDate("");
        loadFollowups();
      } else toast({ title: "Error al guardar", variant: "destructive" });
    } finally { setSavingQuote(false); }
  };

  const openDetail = (task: any) => {
    setSelected(task); setDetailOpen(true);
    setShowFollowupForm(false); setFollowupDate(""); setFollowupNote("");
  };

  const openQuoteDetail = (q: any) => {
    setSelQuote(q); setQuoteDetailOpen(true);
    setNewFollowupDate(q.followupDate ? format(parseISO(q.followupDate), "yyyy-MM-dd'T'HH:mm") : "");
  };

  const isOverdue = (t: any) => t.dueDate && t.status !== "completed" && isPast(parseISO(t.dueDate));
  const isFollowupOverdue = (q: any) => q.followupDate && isPast(parseISO(q.followupDate));

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
          <Button size="sm" variant="outline" onClick={() => { load(); loadFollowups(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nueva Tarea</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva tarea</DialogTitle>
                <DialogDescription>Completá los datos de la nueva tarea.</DialogDescription>
              </DialogHeader>
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

      {/* ── Task list ── */}
      <div className="space-y-2 mb-8">
        {items.map(t => (
          <Card key={t.id} className={`transition-all cursor-pointer hover:bg-white/5 ${isOverdue(t) ? "border-red-500/40" : ""} ${(t.deferCount ?? 0) > 0 ? "border-orange-500/20" : ""} ${t.status === "completed" ? "opacity-60" : ""}`} onClick={() => openDetail(t)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div onClick={e => { e.stopPropagation(); patch(t.id, { status: t.status === "completed" ? "pending" : "completed" }).then(load); }}>
                {t.status === "completed"
                  ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary shrink-0 transition-colors" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <Badge className={`text-xs ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</Badge>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[t.type] || t.type}</Badge>
                  {t.clientName && <span className="text-xs text-muted-foreground">· {t.clientName}</span>}
                  {!isVendedor && t.assigneeName && <span className="text-xs text-muted-foreground">· {t.assigneeName}</span>}
                  {(t.deferCount ?? 0) > 0 && <span className="text-xs text-orange-400 flex items-center gap-0.5"><RefreshCw className="w-3 h-3" />Diferida {t.deferCount}x</span>}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl">{t.description}</p>}
                {t.dueDate && (
                  <div className={`text-xs mt-1 flex items-center gap-1 ${isOverdue(t) ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" />{format(parseISO(t.dueDate), "EEE d MMM, HH:mm", { locale: es })}{isOverdue(t) && " · VENCIDA"}
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card><CardContent className="p-8 text-center">
            <ListTodo className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-muted-foreground text-sm">{isVendedor ? "No tenés tareas asignadas por el momento." : "Sin tareas para mostrar."}</p>
          </CardContent></Card>
        )}
      </div>

      {/* ── Quote followups section ── */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-border/50" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Seguimientos de cotizaciones</span>
            {followups.length > 0 && (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs ml-1">{followups.length}</Badge>
            )}
          </div>
          <div className="h-px flex-1 bg-border/50" />
        </div>

        {view === "all" && (
          <p className="text-xs text-muted-foreground text-center mb-3">
            Próximos 30 días
          </p>
        )}

        <div className="space-y-2">
          {followups.map(q => (
            <Card key={q.id} className={`cursor-pointer hover:bg-white/5 transition-all border-l-2 ${isFollowupOverdue(q) ? "border-l-orange-400 border-orange-500/30" : "border-l-primary/40"}`} onClick={() => openQuoteDetail(q)}>
              <CardContent className="p-4 flex items-center gap-3">
                <CalendarClock className={`w-5 h-5 shrink-0 ${isFollowupOverdue(q) ? "text-orange-400" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{q.number || `Cot. #${q.id}`}</span>
                    <Badge className={`text-xs ${QUOTE_STATUS[q.status]?.color || ""}`}>{QUOTE_STATUS[q.status]?.label || q.status}</Badge>
                    {q.priority && q.priority !== "NINGUNA" && (
                      <Badge variant="outline" className="text-xs">{q.priority}</Badge>
                    )}
                    {q.clientName && <span className="text-xs text-muted-foreground">· {q.clientName}</span>}
                    {!isVendedor && q.salespersonName && <span className="text-xs text-muted-foreground">· {q.salespersonName}</span>}
                  </div>
                  {q.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{q.description}</p>}
                  <div className={`text-xs mt-1 flex items-center gap-1 ${isFollowupOverdue(q) ? "text-orange-400 font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" />
                    Seguimiento: {format(parseISO(q.followupDate), "EEE d MMM, HH:mm", { locale: es })}
                    {isFollowupOverdue(q) && " · VENCIDO"}
                  </div>
                  {q.total && Number(q.total) > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-3 h-3" />{q.currency} {Number(q.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
          {followups.length === 0 && (
            <Card><CardContent className="p-6 text-center">
              <CalendarClock className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-muted-foreground text-sm">Sin seguimientos de cotizaciones pendientes.</p>
            </CardContent></Card>
          )}
        </div>
      </div>

      {/* ── Task detail modal ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogDescription className="sr-only">Detalle de tarea</DialogDescription>
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-6">
                  <div className="mt-1">
                    {selected.status === "completed"
                      ? <CheckCircle2 className="w-6 h-6 text-green-400" />
                      : <Circle className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-left text-lg leading-snug">{selected.title}</DialogTitle>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge className={`text-xs ${PRIORITY_COLORS[selected.priority]}`}>{PRIORITY_LABELS[selected.priority]}</Badge>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[selected.type]}</Badge>
                      <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[selected.status]?.color}`}>{STATUS_CONFIG[selected.status]?.label}</Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {selected.dueDate && (
                    <div className={`flex items-center gap-2 ${isOverdue(selected) ? "text-red-400" : "text-muted-foreground"}`}>
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Vence: <strong>{format(parseISO(selected.dueDate), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}</strong>{isOverdue(selected) && " · VENCIDA"}</span>
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
                {selected.description && (
                  <div className="p-3 bg-white/5 rounded-lg text-sm text-muted-foreground leading-relaxed">{selected.description}</div>
                )}
                <hr className="border-border/40" />
                {showFollowupForm ? (
                  <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" />Agendar seguimiento</p>
                      <button onClick={() => setShowFollowupForm(false)}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                    <div>
                      <Label className="text-xs">Fecha y hora *</Label>
                      <Input type="datetime-local" value={followupDate} onChange={e => setFollowupDate(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Nota (opcional)</Label>
                      <Textarea rows={2} value={followupNote} onChange={e => setFollowupNote(e.target.value)} placeholder="¿Qué vas a hacer en el seguimiento?" className="mt-1 text-sm" />
                    </div>
                    <Button className="w-full" onClick={scheduleFollowup} disabled={saving || !followupDate}>
                      <Bell className="w-4 h-4 mr-2" />Confirmar seguimiento
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selected.status !== "completed" ? (
                      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={closeTask} disabled={saving}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />Marcar como cerrada
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={reopenTask} disabled={saving}>
                        <Circle className="w-4 h-4 mr-2" />Reabrir tarea
                      </Button>
                    )}
                    <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10" onClick={() => setShowFollowupForm(true)}>
                      <CalendarClock className="w-4 h-4 mr-2" />Agendar seguimiento
                    </Button>
                    {selected.status === "pending" && (
                      <Button variant="outline" className="w-full text-blue-400 border-blue-500/30 hover:bg-blue-500/10" onClick={() => patch(selected.id, { status: "in_progress" })} disabled={saving}>
                        En progreso
                      </Button>
                    )}
                  </div>
                )}
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

      {/* ── Quote followup detail modal ── */}
      <Dialog open={quoteDetailOpen} onOpenChange={setQuoteDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogDescription className="sr-only">Detalle de seguimiento de cotización</DialogDescription>
          {selQuote && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-left">{selQuote.number || `Cotización #${selQuote.id}`}</DialogTitle>
                    <div className="flex gap-1.5 mt-1">
                      <Badge className={`text-xs ${QUOTE_STATUS[selQuote.status]?.color || ""}`}>{QUOTE_STATUS[selQuote.status]?.label || selQuote.status}</Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <div className="space-y-2 text-sm">
                  {selQuote.clientName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>Cliente: <strong className="text-foreground">{selQuote.clientName}</strong></span>
                    </div>
                  )}
                  {!isVendedor && selQuote.salespersonName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4 shrink-0" />
                      <span>Vendedor: <strong className="text-foreground">{selQuote.salespersonName}</strong></span>
                    </div>
                  )}
                  {selQuote.total && Number(selQuote.total) > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4 shrink-0" />
                      <span>Total: <strong className="text-foreground">{selQuote.currency} {Number(selQuote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                  )}
                  {selQuote.followupDate && (
                    <div className={`flex items-center gap-2 ${isFollowupOverdue(selQuote) ? "text-orange-400" : "text-muted-foreground"}`}>
                      <CalendarClock className="w-4 h-4 shrink-0" />
                      <span>Seguimiento: <strong>{format(parseISO(selQuote.followupDate), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}</strong>{isFollowupOverdue(selQuote) && " · VENCIDO"}</span>
                    </div>
                  )}
                </div>
                {selQuote.description && (
                  <div className="p-3 bg-white/5 rounded-lg text-sm text-muted-foreground">{selQuote.description}</div>
                )}

                <hr className="border-border/40" />

                {/* Update followup date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-primary" />Actualizar fecha de seguimiento
                  </Label>
                  <Input
                    type="datetime-local"
                    value={newFollowupDate}
                    onChange={e => setNewFollowupDate(e.target.value)}
                    className="text-sm"
                  />
                  <Button className="w-full" onClick={updateQuoteFollowup} disabled={savingQuote || !newFollowupDate}>
                    <CalendarClock className="w-4 h-4 mr-2" />Guardar nueva fecha
                  </Button>
                </div>

                {/* Go to quote */}
                <Link href={`/quotes/${selQuote.id}/edit`} onClick={() => setQuoteDetailOpen(false)}>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />Abrir cotización
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
