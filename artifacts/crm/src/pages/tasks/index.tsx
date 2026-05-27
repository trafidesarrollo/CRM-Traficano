import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
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
  CheckCircle2, Circle, CalendarClock, User, Users, Building2,
  ChevronRight, Bell, X, FileText, DollarSign, ExternalLink, Filter,
  GitBranch, Link2
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

const getQuoteStatusBadge = (q: any): { label: string; color: string } => {
  if (q.quoteStatus === "FINALIZADA") return { label: "Finalizada",  color: "bg-green-500/20 text-green-300 border-green-500/30" };
  if (q.quoteStatus === "PERDIDA")    return { label: "Perdida",     color: "bg-red-500/20 text-red-300 border-red-500/30" };
  if (q.quoteStatus === "DESISTIDA")  return { label: "Desistida",   color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
  return QUOTE_STATUS[q.status] || { label: q.status, color: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
};

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isVendedor = user?.role === "vendedor";

  const isAdmin = user?.role === "admin" || user?.role === "gerente_comercial" || user?.role === "gerente";

  const [items, setItems] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [quickFilter, setQuickFilter] = useState<"all" | "today">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "programadas" | "atrasadas" | "cerradas">("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [newOpen, setNewOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [clientTeamMembers, setClientTeamMembers] = useState<any[]>([]);
  const [teamAssignees, setTeamAssignees] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<any>({
    title: "", description: "", type: "task", priority: "medium",
    assignedTo: "", clientId: "", dueDate: "",
  });

  const handleClientChange = (clientId: string) => {
    setForm((f: any) => ({ ...f, clientId, assignedTo: "" }));
    if (!clientId) { setClientTeamMembers([]); setTeamAssignees(new Set()); return; }
    const client = clients.find((c: any) => String(c.id) === clientId);
    if (!client?.assignedTeamId) { setClientTeamMembers([]); setTeamAssignees(new Set()); return; }
    const team = teams.find((t: any) => t.id === client.assignedTeamId);
    const members = (team?.members || []).filter((m: any) => m.userId != null);
    setClientTeamMembers(members);
    setTeamAssignees(new Set(members.map((m: any) => m.userId as number)));
  };

  // Task detail modal
  const [selected, setSelected] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [showFollowupForm, setShowFollowupForm] = useState(false);

  // Thread state (parent + children of selected task)
  const [threadParent, setThreadParent] = useState<any>(null);
  const [threadChildren, setThreadChildren] = useState<any[]>([]);

  // Bitácora / close form
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  // Child task modal (shown after closing a task)
  const [childModal, setChildModal] = useState<{ open: boolean; parentTask: any } | null>(null);
  const [childForm, setChildForm] = useState<any>({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "" });
  const [creatingChild, setCreatingChild] = useState(false);

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
      if (quickFilter === "today") params.set("view", "today");
      if (isVendedor && user?.id) params.set("assignedTo", String(user.id));
      else if (!isVendedor && filterAssignee !== "all") params.set("assignedTo", filterAssignee);
      if (filterPriority && filterPriority !== "all") params.set("priority", filterPriority);
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) {
        const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
        params.set("to", to.toISOString());
      }
      const r = await fetch(`${API}/api/tasks?${params}`, { credentials: "include" });
      const j = await r.json();
      setItems(Array.isArray(j) ? j : []);
      const statsParams = new URLSearchParams();
      if (!isVendedor && filterAssignee !== "all") statsParams.set("assignedTo", filterAssignee);
      const s = await fetch(`${API}/api/tasks/stats/summary?${statsParams}`, { credentials: "include" });
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
      if (quickFilter === "today") {
        params.set("from", startOfDay(now).toISOString());
        params.set("to", endOfDay(now).toISOString());
      }
      if (isVendedor && salespersonId) params.set("salespersonId", String(salespersonId));
      const r = await fetch(`${API}/api/quotes/followups?${params}`, { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        setFollowups(Array.isArray(j) ? j : []);
      }
    } catch { setFollowups([]); }
  };

  useEffect(() => { if (user !== undefined) load(); }, [quickFilter, filterPriority, filterAssignee, dateFrom, dateTo, user]);
  useEffect(() => { if (user !== undefined) loadFollowups(); }, [quickFilter, user, salespersonId]);

  useEffect(() => {
    fetch(`${API}/api/users/assignable`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`${API}/api/clients?limit=300`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`${API}/api/commercial-teams`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setTeams(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const [creating, setCreating] = useState(false);
  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const clientName = clients.find((c: any) => String(c.id) === String(form.clientId))?.companyName;
      const autoTitle = clientName || form.description || "Nueva tarea";
      const base: any = {
        ...form,
        title: autoTitle,
        type: "task",
        clientId: form.clientId ? parseInt(form.clientId) : null,
        dueDate: form.dueDate || null,
      };

      // Build assigneeIds — always group-based; fallback to creator
      const assigneeIds: number[] = teamAssignees.size > 0
        ? Array.from(teamAssignees).filter(Boolean) as number[]
        : user?.id ? [user.id] : [];

      const r = await fetch(`${API}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...base, assigneeIds }),
      });

      if (r.ok) {
        const count = assigneeIds.length;
        toast({ title: count > 1 ? `Tarea grupal creada para ${count} vendedores` : "Tarea creada" });
        setNewOpen(false);
        setForm({ title: "", description: "", type: "task", priority: "medium", assignedTo: "", clientId: "", dueDate: "" });
        setClientTeamMembers([]);
        setTeamAssignees(new Set());
        load();
      } else toast({ title: "Error al crear", variant: "destructive" });
    } finally {
      setCreating(false);
    }
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

  const confirmClose = async () => {
    if (!selected) return;
    const now = new Date().toISOString();
    await patch(selected.id, { status: "completed", completedAt: now });
    if (selected.clientId && closeNote.trim()) {
      const TASK_TO_ACTIVITY: Record<string, string> = {
        call: "call", meeting: "visit", email: "email",
        followup: "follow_up", task: "task", reminder: "task",
      };
      await fetch(`${API}/api/activities`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: TASK_TO_ACTIVITY[selected.type] || "task",
          title: selected.title,
          description: closeNote.trim(),
          clientId: selected.clientId,
          completedAt: now,
          outcome: closeNote.trim(),
        }),
      });
    }
    setShowCloseForm(false);
    setCloseNote("");
    toast({ title: "Tarea cerrada", description: closeNote.trim() ? "Bitácora registrada en el cliente" : undefined });
    load();

    // Offer to create a child (follow-up) task
    const parentSnapshot = { ...selected };
    setDetailOpen(false);
    setChildForm({
      title: parentSnapshot.title || "",
      description: "",
      priority: parentSnapshot.priority || "medium",
      dueDate: "",
      assignedTo: String(parentSnapshot.assignedTo || ""),
    });
    setChildModal({ open: true, parentTask: parentSnapshot });
  };

  const createChildTask = async () => {
    if (!childModal || !childForm.dueDate) return;
    setCreatingChild(true);
    try {
      const r = await fetch(`${API}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: childForm.title || childModal.parentTask.title,
          description: childForm.description || undefined,
          type: childModal.parentTask.type || "task",
          priority: childForm.priority,
          status: "pending",
          clientId: childModal.parentTask.clientId || undefined,
          assignedTo: childForm.assignedTo ? parseInt(childForm.assignedTo) : undefined,
          dueDate: new Date(childForm.dueDate).toISOString(),
          parentTaskId: childModal.parentTask.id,
        }),
      });
      if (r.ok) {
        const created = await r.json();
        toast({ title: "Tarea de seguimiento creada", description: `Vinculada al hilo de Tarea #${childModal.parentTask.id}` });
        setChildModal(null);
        load();
        // If the parent task is currently open, refresh its thread
        if (selected && selected.id === childModal.parentTask.id) {
          loadThread(selected);
        }
      } else toast({ title: "Error al crear tarea", variant: "destructive" });
    } finally { setCreatingChild(false); }
  };

  const closeTask = () => {
    setShowCloseForm(true);
    setCloseNote("");
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

  const loadThread = async (task: any) => {
    setThreadParent(null);
    setThreadChildren([]);
    // Load parent
    if (task.parentTaskId) {
      try {
        const r = await fetch(`${API}/api/tasks/${task.parentTaskId}`, { credentials: "include" });
        if (r.ok) setThreadParent(await r.json());
      } catch {}
    }
    // Load children
    try {
      const r = await fetch(`${API}/api/tasks?parentTaskId=${task.id}`, { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        setThreadChildren(Array.isArray(j) ? j : []);
      }
    } catch {}
  };

  const openDetail = (task: any) => {
    if (task.clientId) {
      window.open(`/clients/${task.clientId}?taskId=${task.id}`, "_blank");
      return;
    }
    setSelected(task); setDetailOpen(true);
    setShowFollowupForm(false); setFollowupDate(""); setFollowupNote("");
    setShowCloseForm(false); setCloseNote("");
    loadThread(task);
  };

  const openDetailById = async (id: number) => {
    try {
      const r = await fetch(`${API}/api/tasks/${id}`, { credentials: "include" });
      if (r.ok) {
        const task = await r.json();
        if (task.clientId) {
          window.open(`/clients/${task.clientId}?taskId=${task.id}`, "_blank");
          return;
        }
        setSelected(task);
        setDetailOpen(true);
        setShowFollowupForm(false); setFollowupDate(""); setFollowupNote("");
        setShowCloseForm(false); setCloseNote("");
        loadThread(task);
      }
    } catch {}
  };

  const openQuoteDetail = (q: any) => {
    navigate(`/quotes/${q.id}`);
  };

  const isOverdue = (t: any) => t.dueDate && t.status !== "completed" && isPast(parseISO(t.dueDate));
  const isFollowupOverdue = (q: any) => {
    const d = q.followupDate || q.dueDate;
    return d && isPast(parseISO(d));
  };

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
                <DialogDescription>
                  {isVendedor
                    ? "La tarea quedará asignada a vos automáticamente."
                    : "Seleccioná el cliente y el equipo que recibirá la tarea."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">

                {/* ── Admin / Gerente: selector de cliente ── */}
                {isAdmin && (
                  <div>
                    <Label>Cliente <span className="text-destructive">*</span></Label>
                    <Select value={form.clientId} onValueChange={handleClientChange}>
                      <SelectTrigger><SelectValue placeholder="Seleccioná un cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* ── Vendedor: aviso de auto-asignación ── */}
                {isVendedor && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm text-blue-300">
                    <User className="w-4 h-4 shrink-0" />
                    Esta tarea se asignará a <strong className="ml-1">{(user as any)?.fullName || (user as any)?.username}</strong>
                  </div>
                )}

                <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

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
                  <div><Label>Vencimiento</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
                </div>

                {/* ── Admin/Gerente: equipo del cliente ── */}
                {isAdmin && (
                  <>
                    {!form.clientId && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                        <Users className="w-3.5 h-3.5" />
                        Seleccioná un cliente para ver el equipo disponible.
                      </p>
                    )}

                    {form.clientId && clientTeamMembers.length === 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Este cliente no tiene un equipo comercial asignado. Podés asignarlo desde la ficha del cliente.</span>
                      </div>
                    )}

                    {clientTeamMembers.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Asignar al equipo</Label>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <button
                              type="button"
                              className="hover:text-foreground underline-offset-2 hover:underline"
                              onClick={() => setTeamAssignees(new Set(clientTeamMembers.map((m: any) => m.userId)))}
                            >Todos</button>
                            <span>·</span>
                            <button
                              type="button"
                              className="hover:text-foreground underline-offset-2 hover:underline"
                              onClick={() => setTeamAssignees(new Set())}
                            >Ninguno</button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2">
                          {clientTeamMembers.map((m: any) => {
                            const checked = teamAssignees.has(m.userId);
                            return (
                              <label key={m.userId} className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setTeamAssignees(prev => {
                                      const next = new Set(prev);
                                      checked ? next.delete(m.userId) : next.add(m.userId);
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4 rounded accent-primary"
                                />
                                <div>
                                  <span className="text-sm font-medium">{m.fullName || m.username}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {m.role === "vendedor" ? "Vendedor" : "Apoyo"}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        {teamAssignees.size === 0 && (
                          <p className="text-xs text-destructive">Seleccioná al menos un miembro del equipo.</p>
                        )}
                        {teamAssignees.size > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {teamAssignees.size === 1 ? "1 persona recibirá esta tarea." : `${teamAssignees.size} personas recibirán esta tarea compartida.`}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <Button
                  className="w-full"
                  onClick={create}
                  disabled={
                    creating ||
                    (isAdmin && !form.clientId) ||
                    (isAdmin && clientTeamMembers.length > 0 && teamAssignees.size === 0)
                  }
                >
                  {creating ? "Creando..." : isAdmin && teamAssignees.size > 1
                    ? `Crear tarea grupal (${teamAssignees.size} vendedores)`
                    : "Crear tarea"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats — totales de todo el equipo (admin) o propias (vendedor) */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          {filterAssignee !== "all"
            ? <span>Total de <strong className="text-foreground">{users.find((u: any) => String(u.id) === filterAssignee)?.fullName ?? "vendedor"}</strong></span>
            : <span>Totales de todos los vendedores</span>
          }
        </div>
      )}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="border-yellow-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Pendientes</div>
            <div className="text-3xl font-bold">{stats.pending ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <AlertCircle className="w-3 h-3 text-red-400" />Vencidas
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.overdue ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-blue-400" />Hoy
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.today ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Completadas</div>
            <div className="text-3xl font-bold text-green-400">{stats.completed ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-5 p-3 rounded-xl bg-white/3 border border-border/40">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filtros</span>
        </div>
        {/* Quick: Todas / Hoy */}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={quickFilter === "all" ? "default" : "outline"}
            className="h-8 text-xs px-3"
            onClick={() => setQuickFilter("all")}
          >Todas</Button>
          <Button
            size="sm"
            variant={quickFilter === "today" ? "default" : "outline"}
            className="h-8 text-xs px-3"
            onClick={() => setQuickFilter("today")}
          >Hoy</Button>
        </div>
        {/* Vendedor — solo visible para no-vendedores */}
        {!isVendedor && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Vendedor:</span>
            <Select value={filterAssignee} onValueChange={v => setFilterAssignee(v)}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Estado */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Estado:</span>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="programadas">Programadas</SelectItem>
              <SelectItem value="atrasadas">Atrasadas</SelectItem>
              <SelectItem value="cerradas">Cerradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Priority */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Prioridad:</span>
          <Select value={filterPriority} onValueChange={v => setFilterPriority(v)}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Desde:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Hasta:</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>
        {/* Clear date filters */}
        {(dateFrom || dateTo || filterPriority !== "all" || filterAssignee !== "all" || filterStatus !== "all") && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
            onClick={() => { setDateFrom(""); setDateTo(""); setFilterPriority("all"); setFilterAssignee("all"); setFilterStatus("all"); }}
          >
            <X className="w-3 h-3 mr-1" />Limpiar
          </Button>
        )}
      </div>

      {/* ── Task list ── */}
      {(() => {
        const now = new Date();
        const visibleItems = items.filter(t => {
          const done = t.status === "completed" || t.status === "cancelled";
          const overdue = !done && t.dueDate && new Date(t.dueDate) < now;
          if (filterStatus === "cerradas")   return done;
          if (filterStatus === "atrasadas")  return !!overdue;
          if (filterStatus === "programadas") return !done && !overdue;
          return true;
        });

        const getFlag = (t: any) => {
          const done = t.status === "completed" || t.status === "cancelled";
          const overdue = !done && t.dueDate && new Date(t.dueDate) < now;
          if (done)    return { label: "Cerrada",    cls: "bg-green-500/15 text-green-400 border-green-500/30",  left: "border-l-green-500/60"  };
          if (overdue) return { label: "Atrasada",   cls: "bg-red-500/15 text-red-400 border-red-500/30",        left: "border-l-red-500/70"    };
          return       { label: "Programada",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",       left: "border-l-blue-500/40"   };
        };

        return (
          <div className="space-y-2 mb-8">
            {visibleItems.map(t => {
              const flag = getFlag(t);
              const done = t.status === "completed" || t.status === "cancelled";
              return (
                <Card key={t.id} className={`transition-all cursor-pointer hover:bg-white/5 border-l-2 ${flag.left} ${done ? "opacity-70" : ""} ${(t.deferCount ?? 0) > 0 ? "border-orange-500/20" : ""}`} onClick={() => openDetail(t)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div onClick={e => { e.stopPropagation(); patch(t.id, { status: done ? "pending" : "completed" }).then(load); }}>
                      {done
                        ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary shrink-0 transition-colors" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                        {/* Bandera de estado */}
                        <Badge variant="outline" className={`text-xs font-semibold ${flag.cls}`}>{flag.label}</Badge>
                        <Badge className={`text-xs ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</Badge>
                        {t.clientName && <span className="text-xs text-muted-foreground">· {t.clientName}</span>}
                        {!isVendedor && t.assigneeName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            · <User className="w-3 h-3 text-blue-400" /><span className="text-blue-300">{t.assigneeName}</span>
                          </span>
                        )}
                        {done && t.closedByName && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            · <CheckCircle2 className="w-3 h-3" />Cerrada por <strong>{t.closedByName}</strong>
                          </span>
                        )}
                        {(t.deferCount ?? 0) > 0 && <span className="text-xs text-orange-400 flex items-center gap-0.5"><RefreshCw className="w-3 h-3" />Diferida {t.deferCount}x</span>}
                        {(t.childrenCount ?? 0) > 0 && (
                          <span className="text-xs text-violet-400 flex items-center gap-0.5">
                            <GitBranch className="w-3 h-3" />Tareas relacionadas: {t.childrenCount}
                          </span>
                        )}
                        {t.parentTaskId && (
                          <span className="text-xs text-cyan-400 flex items-center gap-0.5">
                            <Link2 className="w-3 h-3" />Hilo
                          </span>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl">{t.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {t.dueDate && (
                          <span className={`text-xs flex items-center gap-1 ${!done && new Date(t.dueDate) < now ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                            <Calendar className="w-3 h-3" />Programada: {format(parseISO(t.dueDate), "dd/MM/yy HH:mm", { locale: es })}
                          </span>
                        )}
                        {t.completedAt && (
                          <span className="text-xs flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="w-3 h-3" />Cerrada: {format(parseISO(t.completedAt), "dd/MM/yy HH:mm", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
            {visibleItems.length === 0 && (
              <Card><CardContent className="p-8 text-center">
                <ListTodo className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-muted-foreground text-sm">
                  {filterStatus !== "all" ? `No hay tareas ${filterStatus}.` : isVendedor ? "No tenés tareas asignadas por el momento." : "Sin tareas para mostrar."}
                </p>
              </CardContent></Card>
            )}
          </div>
        );
      })()}

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

        {quickFilter === "all" && (
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
                    <Badge className={`text-xs ${getQuoteStatusBadge(q).color}`}>{getQuoteStatusBadge(q).label}</Badge>
                    {q.priority && q.priority !== "NINGUNA" && (
                      <Badge variant="outline" className="text-xs">{q.priority}</Badge>
                    )}
                    {q.clientName && <span className="text-xs text-muted-foreground">· {q.clientName}</span>}
                    {!isVendedor && q.salespersonName && <span className="text-xs text-muted-foreground">· {q.salespersonName}</span>}
                  </div>
                  {q.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{q.description}</p>}
                  <div className={`text-xs mt-1 flex items-center gap-1 ${isFollowupOverdue(q) ? "text-orange-400 font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" />
                    {q.followupDate
                      ? <>Seguimiento: {format(parseISO(q.followupDate), "EEE d MMM, HH:mm", { locale: es })}</>
                      : q.dueDate
                        ? <>Vence: {format(parseISO(q.dueDate), "EEE d MMM", { locale: es })}</>
                        : null
                    }
                    {isFollowupOverdue(q) && " · VENCIDO"}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {q.total && Number(q.total) > 0 && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                        <DollarSign className="w-3 h-3" />Total: {q.currency || "USD"} {Number(q.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {q.totalKg && Number(q.totalKg) > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {Number(q.totalKg).toLocaleString("es-AR", { minimumFractionDigits: 2 })} kg
                      </span>
                    )}
                    {q.quoteType && (
                      <span className="text-xs text-muted-foreground">{q.quoteType}</span>
                    )}
                  </div>
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
                      <span>Equipo: <strong className="text-blue-300">{selected.assigneeName}</strong></span>
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
                      <span>
                        Cerrada el {format(parseISO(selected.completedAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                        {selected.closedByName && <> · por <strong>{selected.closedByName}</strong></>}
                      </span>
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

                {/* ── Thread view ── */}
                {(threadParent || threadChildren.length > 0 || selected.parentTaskId) && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-400 mb-1">
                      <GitBranch className="w-3.5 h-3.5" />Hilo de tareas
                    </div>

                    {/* Parent task */}
                    {threadParent && (
                      <button
                        onClick={() => openDetailById(threadParent.id)}
                        className="w-full text-left flex items-center gap-2 p-2 rounded-md hover:bg-white/5 transition-colors border border-white/5"
                      >
                        <div className="shrink-0">
                          {threadParent.status === "completed"
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <Circle className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">↑ Origen:</span>
                            <span className={`text-xs font-medium truncate ${threadParent.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {threadParent.title}
                            </span>
                          </div>
                          {threadParent.dueDate && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(threadParent.dueDate), "d MMM yyyy", { locale: es })}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </button>
                    )}

                    {/* Current task position */}
                    <div className="flex items-center gap-2 p-2 rounded-md bg-white/5 border border-violet-500/30">
                      <div className="shrink-0">
                        {selected.status === "completed"
                          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                          : <Circle className="w-4 h-4 text-violet-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-violet-300 truncate block">
                          → {selected.title} <span className="text-violet-500">(esta)</span>
                        </span>
                        {selected.dueDate && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(selected.dueDate), "d MMM yyyy", { locale: es })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Child tasks */}
                    {threadChildren.map(child => (
                      <button
                        key={child.id}
                        onClick={() => openDetailById(child.id)}
                        className="w-full text-left flex items-center gap-2 p-2 rounded-md hover:bg-white/5 transition-colors border border-white/5"
                      >
                        <div className="shrink-0">
                          {child.status === "completed"
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <Circle className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">↓ Seguimiento:</span>
                            <span className={`text-xs font-medium truncate ${child.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {child.title}
                            </span>
                          </div>
                          {child.dueDate && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(child.dueDate), "d MMM yyyy", { locale: es })}
                              {child.status === "completed" && <span className="ml-2 text-green-400">✓ Cerrada</span>}
                              {child.status !== "completed" && child.dueDate && new Date(child.dueDate) < new Date() && (
                                <span className="ml-2 text-red-400">Vencida</span>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}

                    {/* Quick link to create follow-up */}
                    <button
                      onClick={() => {
                        setChildForm({
                          title: selected.title,
                          description: "",
                          priority: selected.priority || "medium",
                          dueDate: "",
                          assignedTo: String(selected.assignedTo || ""),
                        });
                        setChildModal({ open: true, parentTask: selected });
                      }}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-violet-500/10 text-xs text-violet-400 hover:text-violet-300 transition-colors border border-dashed border-violet-500/20"
                    >
                      <Plus className="w-3 h-3" />Agregar seguimiento al hilo
                    </button>
                  </div>
                )}

                {/* If no thread yet, show a create-followup shortcut */}
                {!selected.parentTaskId && threadChildren.length === 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setChildForm({
                          title: selected.title,
                          description: "",
                          priority: selected.priority || "medium",
                          dueDate: "",
                          assignedTo: String(selected.assignedTo || ""),
                        });
                        setChildModal({ open: true, parentTask: selected });
                      }}
                      className="text-xs text-muted-foreground hover:text-violet-400 flex items-center gap-1 transition-colors"
                    >
                      <GitBranch className="w-3 h-3" />Crear tarea de seguimiento vinculada
                    </button>
                  </div>
                )}

                <hr className="border-border/40" />
                {showCloseForm ? (
                  <div className="space-y-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        Bitácora de cierre
                      </p>
                      <button onClick={() => setShowCloseForm(false)}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">¿Qué se hizo? {selected.clientId && <span className="text-green-400">(se registrará en el cliente)</span>}</Label>
                      <Textarea
                        rows={3}
                        value={closeNote}
                        onChange={e => setCloseNote(e.target.value)}
                        placeholder="Describí brevemente lo que se realizó..."
                        className="mt-1 text-sm"
                        autoFocus
                      />
                    </div>
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={confirmClose} disabled={saving}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />Confirmar cierre
                    </Button>
                  </div>
                ) : showFollowupForm ? (
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

      {/* ── Child task modal (post-close) ── */}
      <Dialog open={!!childModal?.open} onOpenChange={(open) => { if (!open) setChildModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogDescription className="sr-only">Crear tarea hija</DialogDescription>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                <GitBranch className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <DialogTitle>¿Creás una tarea de seguimiento?</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quedará vinculada a <strong className="text-foreground">Tarea #{childModal?.parentTask?.id}</strong>
                </p>
              </div>
            </div>
          </DialogHeader>

          {childModal && (
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-sm">Título</Label>
                <Input
                  className="mt-1"
                  value={childForm.title}
                  onChange={e => setChildForm((f: any) => ({ ...f, title: e.target.value }))}
                  placeholder={childModal.parentTask.title}
                />
              </div>
              <div>
                <Label className="text-sm">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={2}
                  value={childForm.description}
                  onChange={e => setChildForm((f: any) => ({ ...f, description: e.target.value }))}
                  placeholder="¿Qué hay que hacer en este seguimiento?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Prioridad</Label>
                  <Select value={childForm.priority} onValueChange={v => setChildForm((f: any) => ({ ...f, priority: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Fecha <span className="text-red-400">*</span></Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={childForm.dueDate}
                    onChange={e => setChildForm((f: any) => ({ ...f, dueDate: e.target.value }))}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => setChildModal(null)}>
                  No, gracias
                </Button>
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
                  disabled={!childForm.dueDate || creatingChild}
                  onClick={createChildTask}
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  {creatingChild ? "Creando..." : "Crear tarea hija"}
                </Button>
              </div>
            </div>
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
                      <Badge className={`text-xs ${getQuoteStatusBadge(selQuote).color}`}>{getQuoteStatusBadge(selQuote).label}</Badge>
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
                      <DollarSign className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Total USD: <strong className="text-emerald-400">{selQuote.currency || "USD"} {Number(selQuote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                  )}
                  {selQuote.totalKg && Number(selQuote.totalKg) > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-4 h-4 shrink-0 text-center text-xs font-bold text-amber-400">kg</span>
                      <span>Kilos total: <strong className="text-foreground">{Number(selQuote.totalKg).toLocaleString("es-AR", { minimumFractionDigits: 2 })} kg</strong></span>
                    </div>
                  )}
                  {selQuote.quoteType && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>Tipo: <strong className="text-foreground">{selQuote.quoteType}</strong></span>
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
