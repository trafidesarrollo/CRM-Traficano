import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, ArrowLeft, FileText, ShoppingCart, Contact2, Activity,
  Phone, Mail, Globe, MapPin, DollarSign, Percent, Pencil, Save, X,
  CheckCircle2, Circle, Clock, ListTodo, UserSquare, Users, UserCheck, Loader2,
  CalendarClock, GitBranch, History, ChevronDown, ChevronUp, ArrowRight,
  RefreshCw, Bell, Trash2, AlertCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ClientDialog } from "@/components/client-dialog";

const API = import.meta.env.VITE_API_URL || "";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Borrador",  color: "bg-gray-500/20 text-gray-300" },
  sent:     { label: "Enviada",   color: "bg-blue-500/20 text-blue-300" },
  approved: { label: "Aprobada",  color: "bg-green-500/20 text-green-300" },
  rejected: { label: "Rechazada", color: "bg-red-500/20 text-red-300" },
  partial:  { label: "Parcial",   color: "bg-yellow-500/20 text-yellow-300" },
  expired:  { label: "Vencida",   color: "bg-orange-500/20 text-orange-300" },
};

const getQuoteStatusBadge = (q: any): { label: string; color: string } => {
  if (q.quoteStatus === "APROBADA" || q.quoteStatus === "FINALIZADA") return { label: "APROBADA",  color: "bg-green-500/20 text-green-300" };
  if (q.quoteStatus === "PERDIDA")   return { label: "PERDIDA",   color: "bg-red-500/20 text-red-300" };
  if (q.quoteStatus === "DESISTIDA") return { label: "DESISTIDA", color: "bg-slate-500/20 text-slate-300" };
  return STATUS_LABELS[q.status] || { label: q.status, color: "bg-gray-500/20 text-gray-300" };
};

const CLIENT_STATUS: Record<string, { label: string; color: string }> = {
  prospect:  { label: "Prospecto",         color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  potential: { label: "Cliente Potencial", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  inactive:  { label: "Inactivo",          color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  final:     { label: "Cliente Final",     color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞", visit: "🏢", email: "📧", task: "✅", note: "📝", follow_up: "🔔",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n || 0);
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-4 w-4" />{label}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id;
  const { user } = useAuth();
  const role = (user as any)?.role;
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Task reminder from URL param
  const taskId = new URLSearchParams(window.location.search).get("taskId");
  const [reminderTask, setReminderTask] = useState<any>(null);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // ── Task detail modal (read-only + full thread + close/followup) ──
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalData, setTaskModalData] = useState<any>(null);
  // fullThread = [...ancestors, currentTask, ...children] all sorted oldest→newest
  const [taskThread, setTaskThread] = useState<{ items: any[]; currentId: number } | null>(null);
  const [taskThreadLoading, setTaskThreadLoading] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskShowFollowup, setTaskShowFollowup] = useState(false);
  const [taskFollowupDate, setTaskFollowupDate] = useState("");
  const [taskFollowupTitle, setTaskFollowupTitle] = useState("");
  const [taskFollowupDesc, setTaskFollowupDesc] = useState("");
  const [taskFollowupAssigneeId, setTaskFollowupAssigneeId] = useState<number | null>(null);

  const openTaskModal = async (task: any) => {
    setTaskModalData({ ...task });
    setTaskModalOpen(true);
    setTaskShowFollowup(false);
    setTaskFollowupDate((() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })());
    setTaskFollowupTitle(data?.client?.companyName || data?.client?.company_name || task.title || "");
    setTaskFollowupDesc("");
    // Default: assign followup to same person as current task, or first team member
    const members = data?.teamInfo?.members ?? [];
    const currentAssignee = members.find((m: any) => m.userId === (task.assigned_to ?? task.assignedTo));
    setTaskFollowupAssigneeId(currentAssignee?.userId ?? members[0]?.userId ?? null);
    setTaskThread(null);
    if (task.id) {
      setTaskThreadLoading(true);
      try {
        // Fetch ancestors (chain) and direct children in parallel
        const [chainRes, childrenRes] = await Promise.all([
          fetch(`${API}/api/tasks/${task.id}/chain`, { credentials: "include" }),
          fetch(`${API}/api/tasks?parentTaskId=${task.id}&limit=50`, { credentials: "include" }),
        ]);
        const chain: any[] = chainRes.ok ? await chainRes.json() : [];
        const childrenData = childrenRes.ok ? await childrenRes.json() : [];
        const children: any[] = Array.isArray(childrenData) ? childrenData : (childrenData.tasks || []);
        // chain = [...ancestors, currentTask]; combine with children (exclude current from children if duplicated)
        const allItems = [
          ...chain,
          ...children.filter(c => c.id !== task.id),
        ];
        setTaskThread({ items: allItems, currentId: task.id });
      } catch {} finally { setTaskThreadLoading(false); }
    }
  };

  const closeTaskWithFollowup = async (createFollowup: boolean) => {
    if (!taskModalData) return;
    setTaskSaving(true);
    try {
      const closeRes = await fetch(`${API}/api/tasks/${taskModalData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed", completedAt: new Date().toISOString() }),
      });
      if (!closeRes.ok) {
        toast({ title: "Error al cerrar la tarea", variant: "destructive" });
        return;
      }

      if (createFollowup && taskFollowupDate && taskFollowupTitle.trim() && id) {
        const assigneeId = taskFollowupAssigneeId;
        await fetch(`${API}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: taskFollowupTitle.trim(),
            type: "followup",
            priority: taskModalData.priority || "medium",
            status: "pending",
            description: taskFollowupDesc || undefined,
            dueDate: new Date(taskFollowupDate + "T12:00:00").toISOString(),
            clientId: parseInt(id),
            parentTaskId: taskModalData.id,
            assigneeIds: assigneeId ? [assigneeId] : undefined,
          }),
        });
        toast({ title: "Tarea cerrada y seguimiento agendado" });
      } else {
        toast({ title: "Tarea cerrada" });
      }
      setTaskModalOpen(false);
      if (reminderTask && taskModalData && reminderTask.id === taskModalData.id) {
        setReminderTask((t: any) => ({ ...t, status: "completed", completedAt: new Date().toISOString() }));
      }
      load();
    } finally { setTaskSaving(false); }
  };

  useEffect(() => {
    if (!taskId) return;
    fetch(`${API}/api/tasks/${taskId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(t => { if (t) setReminderTask(t); })
      .catch(() => {});
  }, [taskId]);

  const [editOpen, setEditOpen] = useState(false);

  // ── Usuarios asignables ──
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API}/api/users/assignable`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setAssignableUsers)
      .catch(() => {});
  }, []);

  // ── Equipos comerciales ──
  const [teams, setTeams] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API}/api/commercial-teams`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setTeams(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const assignTeam = async (teamId: number | null) => {
    setSavingTeam(true);
    try {
      const r = await fetch(`${API}/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedTeamId: teamId }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Error al asignar equipo");
      }
      toast({ title: teamId ? "Equipo asignado" : "Equipo desasignado" });
      setAssigningTeam(false);
      load();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSavingTeam(false); }
  };

  // ── Asignación de vendedor ──
  const isAdminOrManager = role === "admin" || role === "gerente" || role === "gerente_comercial";
  const [assigningVendedor, setAssigningVendedor] = useState(false);
  const [savingVendedor, setSavingVendedor] = useState(false);
  const [selectedSpId, setSelectedSpId] = useState<string>("");

  const assignVendedor = async (spId: number | null) => {
    setSavingVendedor(true);
    try {
      const r = await fetch(`${API}/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedSalespersonId: spId }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Error al asignar vendedor");
      }
      toast({ title: spId ? "Vendedor asignado" : "Vendedor desasignado" });
      setAssigningVendedor(false);
      load();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSavingVendedor(false);
    }
  };

  // ── Filtros de cotizaciones ──
  const [quoteDateFrom, setQuoteDateFrom] = useState("");
  const [quoteDateTo, setQuoteDateTo] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("all");

  // ── Filtro de actividades por vendedor ──
  const [activitySpFilter, setActivitySpFilter] = useState<number | "all">("all");
  const [salespeople, setSalespeople] = useState<any[]>([]);

  const BLANK_CONTACT = { firstName: "", lastName: "", position: "", email: "", phone: "", isPrimary: false };
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [savingContact, setSavingContact] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/clients/${id}/overview`, { credentials: "include" });
      if (!r.ok) throw new Error("No encontrado");
      const d = await r.json();
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    fetch(`${API}/api/salespeople`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setSalespeople(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);


  const saveContact = async () => {
    if (!contactForm.firstName.trim()) return;
    setSavingContact(true);
    try {
      const r = await fetch(`${API}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId: Number(id), ...contactForm }),
      });
      if (!r.ok) throw new Error("Error al crear contacto");
      toast({ title: "Contacto creado" });
      setContactOpen(false);
      setContactForm(BLANK_CONTACT);
      load();
    } catch {
      toast({ title: "Error al crear contacto", variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Cargando ficha...</div></AppLayout>;
  if (error || !data) return <AppLayout><div className="flex items-center justify-center h-64 text-destructive">{error || "Error al cargar cliente"}</div></AppLayout>;

  const { client, quotes, orders, contacts, activities, tasks = [], stats } = data;

  const TASK_TYPE_ICONS: Record<string, string> = {
    call: "📞", meeting: "🤝", email: "✉️", followup: "🔁", task: "✅", reminder: "🔔",
  };
  const TASK_STATUS_LABELS: Record<string, string> = {
    pending: "Pendiente", in_progress: "En progreso", completed: "Cerrada", deferred: "Diferida",
  };

  const activeQuotes = quotes.filter((q: any) => ["draft", "sent", "partial", "expired"].includes(q.status));

  const filteredQuotes = quotes.filter((q: any) => {
    if (quoteStatusFilter !== "all") {
      const qs = (q.quoteStatus || "").toUpperCase();
      const st = q.status || "";
      if (quoteStatusFilter === "APROBADA" && qs !== "APROBADA" && qs !== "FINALIZADA") return false;
      if (quoteStatusFilter === "PERDIDA" && qs !== "PERDIDA") return false;
      if (quoteStatusFilter === "DESISTIDA" && qs !== "DESISTIDA") return false;
      if (quoteStatusFilter === "draft" && st !== "draft") return false;
      if (quoteStatusFilter === "sent" && st !== "sent") return false;
    }
    if (quoteDateFrom) {
      const qDate = q.date ? new Date(q.date) : null;
      if (!qDate || qDate < new Date(quoteDateFrom)) return false;
    }
    if (quoteDateTo) {
      const qDate = q.date ? new Date(q.date) : null;
      if (!qDate || qDate > new Date(quoteDateTo + "T23:59:59")) return false;
    }
    return true;
  });

  const mergedTimeline = [
    ...activities.map((a: any) => ({ ...a, _kind: "activity" as const, _date: a.createdAt })),
    ...tasks.map((t: any) => ({ ...t, _kind: "task" as const, _date: t.created_at || t.createdAt })),
  ].sort((a, b) => new Date(b._date || 0).getTime() - new Date(a._date || 0).getTime());

  // Vendedores que tienen actividades en este cliente
  const spIdsWithActivity = [...new Set(
    activities.map((a: any) => a.salesperson_id ?? a.salespersonId).filter(Boolean)
  )];
  const spWithActivity = salespeople.filter((s: any) => spIdsWithActivity.includes(s.id));

  const filteredTimeline = activitySpFilter === "all"
    ? mergedTimeline
    : mergedTimeline.filter((item: any) => {
        if (item._kind === "task") return false; // tasks have no salesperson — hide when filtering
        return (item.salesperson_id ?? item.salespersonId) === activitySpFilter;
      });
  const cs = CLIENT_STATUS[client.status] || { label: client.status, color: "bg-gray-500/20 text-gray-300" };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/clients">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Clientes</Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">{client.company_name || client.companyName}</h1>
            <Badge className={cs.color}>{cs.label}</Badge>
            {activeQuotes.length > 0 && (
              <Link href={`/quotes?clientId=${client.id}`}>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer">
                  <FileText className="h-3 w-3" />
                  {activeQuotes.length} cotización{activeQuotes.length !== 1 ? "es" : ""} activa{activeQuotes.length !== 1 ? "s" : ""}
                </span>
              </Link>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1.5" />Editar cliente
          </Button>
        </div>

        {/* ── Task reminder banner ── */}
        {reminderTask && !reminderDismissed && (
          <div className={`rounded-lg border flex items-start gap-3 px-4 py-3 ${reminderTask.status === "completed" ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/5"}`}>
            {reminderTask.status === "completed"
              ? <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              : <Bell className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">
                {reminderTask.status === "completed" ? "✓ Tarea completada" : "Tarea pendiente"}
              </p>
              <p className="text-sm font-medium mt-0.5">{reminderTask.title}</p>
              {reminderTask.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{reminderTask.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {reminderTask.dueDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    Vence: {new Date(reminderTask.dueDate).toLocaleDateString("es-AR")}
                  </span>
                )}
                {reminderTask.assignee_name && (
                  <span className="text-xs text-blue-300 flex items-center gap-1">
                    <Users className="w-3 h-3" />{reminderTask.assignee_name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {reminderTask.status !== "completed" && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => openTaskModal(reminderTask)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Cerrar tarea
                </Button>
              )}
              <button onClick={() => setReminderDismissed(true)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Datos del cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(client.tax_id || client.taxId) && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">CUIT/RUT</span>
                  <span className="font-mono">{client.tax_id || client.taxId}</span>
                </div>
              )}
              {client.industry && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Industria</span>
                  <span>{client.industry}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{client.phone}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={client.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">{client.website}</a>
                </div>
              )}
              {(client.city || client.address) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{[client.address, client.city, client.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {(client.client_emails || client.clientEmails)?.length > 0 && (
                <div className="flex items-start gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {(client.client_emails || client.clientEmails || []).map((e: string, i: number) => (
                      <span key={i} className="text-xs bg-blue-500/10 text-blue-400 rounded-full px-2 py-0.5">{e}</span>
                    ))}
                  </div>
                </div>
              )}
              {(client.consumption_scale != null || client.consumptionScale != null) && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Escala USD</span>
                  <span className="font-mono text-amber-400">
                    u$s {Number(client.consumption_scale ?? client.consumptionScale).toLocaleString("es-AR")}
                  </span>
                </div>
              )}
              {client.notes && (
                <div className="text-muted-foreground text-xs italic border-t border-border/50 pt-2 mt-2">{client.notes}</div>
              )}
            </CardContent>
          </Card>

          {/* ── Equipo comercial ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4" />Equipo comercial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.teamInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{data.teamInfo.name}</p>
                      <p className="text-xs text-muted-foreground">{data.teamInfo.members?.length || 0} miembros</p>
                    </div>
                    {isAdminOrManager && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        onClick={() => { setSelectedTeamId(String(data.teamInfo.id)); setAssigningTeam(true); }}
                      >
                        Cambiar
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(data.teamInfo.members || []).map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                          {(m.fullName || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">{m.role === "vendedor" ? "Vendedor" : "Apoyo"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">Sin equipo asignado</p>
                  {isAdminOrManager && !assigningTeam && (
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => { setSelectedTeamId(""); setAssigningTeam(true); }}
                    >
                      + Asignar equipo
                    </button>
                  )}
                </div>
              )}

              {assigningTeam && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Seleccionar equipo</p>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="— Sin equipo —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin equipo —</SelectItem>
                      {teams.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={savingTeam}
                      onClick={() => assignTeam(selectedTeamId && selectedTeamId !== "none" ? Number(selectedTeamId) : null)}
                    >
                      {savingTeam ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAssigningTeam(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={FileText} label="Cotizaciones" value={String(stats.quotesCount)} sub={`${stats.wonQuotes} aprobadas`} />
            <StatCard icon={ShoppingCart} label="Pedidos" value={String(stats.ordersCount)} />
            <StatCard icon={DollarSign} label="Total cotizado" value={`u$s ${fmt(stats.totalQuoted)}`} />
            <StatCard icon={Percent} label="Conversión" value={`${stats.conversionRate.toFixed(1)}%`} sub="cot → pedido" />
          </div>
        </div>

        {/* ── Widget: Consumo propuesto vs. real facturado ── */}
        {(() => {
          const proposed = Number(client.consumption_scale ?? client.consumptionScale ?? 0);
          const invoiced = Number(stats.totalApproved ?? 0);
          const pct = proposed > 0 ? Math.min((invoiced / proposed) * 100, 100) : 0;
          const over = proposed > 0 && invoiced > proposed;
          if (proposed === 0 && invoiced === 0) return null;
          return (
            <Card className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consumo anual proyectado</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                  <span className={`text-3xl font-bold font-mono ${over ? "text-emerald-400" : invoiced > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                    {invoiced > 0 ? `u$s ${fmt(invoiced)}` : "u$s 0"}
                  </span>
                  {proposed > 0 && (
                    <>
                      <span className="text-muted-foreground text-lg">/</span>
                      <span className="text-xl font-mono text-amber-400">u$s {fmt(proposed)}</span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground ml-1">
                    · {stats.wonQuotes} {stats.wonQuotes === 1 ? "cotización cerrada" : "cotizaciones cerradas"}
                  </span>
                </div>
                {proposed > 0 && (
                  <>
                    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${over ? "bg-emerald-400" : pct >= 75 ? "bg-green-400" : pct >= 40 ? "bg-amber-400" : "bg-blue-400"}`}
                        style={{ width: `${Math.max(pct, invoiced > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">0%</span>
                      <span className={`text-xs font-medium ${over ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {over ? `${((invoiced / proposed) * 100).toFixed(0)}% — superado 🎯` : `${pct.toFixed(0)}% del objetivo`}
                      </span>
                      <span className="text-xs text-muted-foreground">100%</span>
                    </div>
                  </>
                )}
                {proposed === 0 && invoiced > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Sin escala declarada — hay {stats.wonQuotes} cotización{stats.wonQuotes !== 1 ? "es" : ""} cerrada{stats.wonQuotes !== 1 ? "s" : ""} por u$s {fmt(invoiced)}</p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <Tabs defaultValue="quotes">
          <TabsList>
            <TabsTrigger value="quotes"><FileText className="h-4 w-4 mr-1.5" />Cotizaciones ({quotes.length})</TabsTrigger>
            <TabsTrigger value="orders"><ShoppingCart className="h-4 w-4 mr-1.5" />Pedidos ({orders.length})</TabsTrigger>
            <TabsTrigger value="contacts"><Contact2 className="h-4 w-4 mr-1.5" />Contactos ({contacts.length})</TabsTrigger>
            <TabsTrigger value="activities"><Activity className="h-4 w-4 mr-1.5" />Actividades ({mergedTimeline.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="mt-4">
            {/* ── Filtros ── */}
            <div className="flex flex-wrap items-end gap-3 mb-3 p-3 bg-card/60 border border-border/40 rounded-xl">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Desde</label>
                <Input
                  type="date"
                  value={quoteDateFrom}
                  onChange={e => setQuoteDateFrom(e.target.value)}
                  className="h-8 text-sm w-36"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Hasta</label>
                <Input
                  type="date"
                  value={quoteDateTo}
                  onChange={e => setQuoteDateTo(e.target.value)}
                  className="h-8 text-sm w-36"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Estado</label>
                <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
                  <SelectTrigger className="h-8 text-sm w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="sent">Enviada</SelectItem>
                    <SelectItem value="APROBADA">APROBADA</SelectItem>
                    <SelectItem value="PERDIDA">PERDIDA</SelectItem>
                    <SelectItem value="DESISTIDA">DESISTIDA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(quoteDateFrom || quoteDateTo || quoteStatusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => { setQuoteDateFrom(""); setQuoteDateTo(""); setQuoteStatusFilter("all"); }}
                >
                  Limpiar filtros
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto self-end pb-1">
                {filteredQuotes.length} de {quotes.length}
              </span>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50">
                    <tr className="text-xs text-muted-foreground uppercase text-left">
                      <th className="p-3">Número</th><th className="p-3">Fecha</th><th className="p-3">Vendedor</th>
                      <th className="p-3">Mon.</th><th className="p-3 text-right">Monto</th><th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((q: any) => {
                      const s = getQuoteStatusBadge(q);
                      return (
                        <tr
                          key={q.id}
                          className="border-b border-border/30 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => navigate(`/quotes/${q.id}`)}
                        >
                          <td className="p-3 font-mono text-primary/90">{q.number || `#${q.id}`}</td>
                          <td className="p-3 text-muted-foreground">{q.date ? new Date(q.date).toLocaleDateString("es-AR") : "—"}</td>
                          <td className="p-3">{q.salesperson_name || "—"}</td>
                          <td className="p-3 text-xs">{q.currency === "ARS" ? "$" : "u$s"}</td>
                          <td className="p-3 text-right font-mono">{fmt(Number(q.net_amount || q.total || 0))}</td>
                          <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                        </tr>
                      );
                    })}
                    {filteredQuotes.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {quotes.length === 0 ? "Sin cotizaciones" : "Sin resultados para los filtros aplicados"}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50">
                    <tr className="text-xs text-muted-foreground uppercase text-left">
                      <th className="p-3">Número</th><th className="p-3">Fecha</th><th className="p-3">Vendedor</th>
                      <th className="p-3 text-right">Total</th><th className="p-3">Estado</th><th className="p-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any) => (
                      <tr key={o.id} className="border-b border-border/30 hover:bg-white/5">
                        <td className="p-3 font-mono">{o.number || `#${o.id}`}</td>
                        <td className="p-3 text-muted-foreground">{o.date ? new Date(o.date).toLocaleDateString("es-AR") : "—"}</td>
                        <td className="p-3">{o.salesperson_name || "—"}</td>
                        <td className="p-3 text-right font-mono">{fmt(Number(o.total || 0))}</td>
                        <td className="p-3"><Badge variant="outline">{o.status || "—"}</Badge></td>
                        <td className="p-3">
                          <Link href={`/orders/${o.id}`}><Button size="sm" variant="ghost" className="text-xs">Ver</Button></Link>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Sin pedidos</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => { setContactForm(BLANK_CONTACT); setContactOpen(true); }}>
                <Contact2 className="h-4 w-4 mr-1.5" />Nuevo contacto
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {contacts.map((c: any) => (
                <Card key={c.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{c.firstName} {c.lastName}</p>
                        {c.position && <p className="text-xs text-muted-foreground">{c.position}</p>}
                      </div>
                      {c.isPrimary && <Badge className="bg-primary/20 text-primary text-xs">Principal</Badge>}
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <a href={`mailto:${c.email}`} className="text-blue-400 hover:underline truncate">{c.email}</a>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{c.phone}</span>
                      </div>
                    )}
                    {c.address && (
                      <div className="text-xs text-muted-foreground">Dirección: {c.address}</div>
                    )}
                    {c.city && (
                      <div className="text-xs text-muted-foreground">Ciudad: {c.city}</div>
                    )}
                    {c.email && (
                      <div className="text-xs text-muted-foreground">Email: {c.email}</div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {contacts.length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground">Sin contactos registrados</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            {/* ── Filtro por vendedor ── */}
            {spWithActivity.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap mb-4 p-3 bg-card/60 border border-border/40 rounded-xl">
                <UserSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">Filtrar por vendedor:</span>
                <button
                  onClick={() => setActivitySpFilter("all")}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-all font-medium ${activitySpFilter === "all" ? "bg-primary/20 border-primary/50 text-primary" : "border-border/40 text-muted-foreground hover:border-border/70"}`}
                >
                  Todos ({activities.length})
                </button>
                {spWithActivity.map((sp: any) => {
                  const count = activities.filter((a: any) => (a.salesperson_id ?? a.salespersonId) === sp.id).length;
                  const active = activitySpFilter === sp.id;
                  return (
                    <button
                      key={sp.id}
                      onClick={() => setActivitySpFilter(sp.id)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all font-medium ${active ? "bg-primary/20 border-primary/50 text-primary" : "border-border/40 text-muted-foreground hover:border-border/70"}`}
                    >
                      {sp.name} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              {filteredTimeline.map((item: any) => {
                if (item._kind === "activity") {
                  const spName = salespeople.find((s: any) => s.id === (item.salesperson_id ?? item.salespersonId))?.name;
                  return (
                    <Card key={`act-${item.id}`}>
                      <CardContent className="p-3 flex items-start gap-3">
                        <span className="text-xl mt-0.5">{ACTIVITY_ICONS[item.type] || "📌"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString("es-AR") : "—"}
                            </span>
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                          {item.outcome && <p className="text-xs text-primary/80 mt-1">Resultado: {item.outcome}</p>}
                          {spName && (
                            <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                              <UserSquare className="h-3 w-3" />{spName}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                // Task item
                const isCompleted = item.status === "completed";
                const taskQuoteId = item.quoteId ?? item.quote_id ?? null;
                return (
                  <Card
                    key={`task-${item.id}`}
                    className={`cursor-pointer transition-colors hover:border-primary/40 ${isCompleted ? "border-green-500/20" : "border-orange-500/20"}`}
                    onClick={() => openTaskModal(item)}
                  >
                    <CardContent className="p-3 flex items-start gap-3">
                      <span className="text-xl mt-0.5">{TASK_TYPE_ICONS[item.type] || "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <Badge className={`text-xs shrink-0 ${isCompleted ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                              {TASK_STATUS_LABELS[item.status] || item.status}
                            </Badge>
                            {item.parent_task_id && <GitBranch className="w-3 h-3 text-violet-400 shrink-0" />}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {item._date ? new Date(item._date).toLocaleDateString("es-AR") : "—"}
                          </span>
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                        {item.assignee_name && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />Asignada a: {item.assignee_name}
                            {item.completed_at && (
                              <span className="ml-2 text-green-400">
                                · Cerrada el {new Date(item.completed_at).toLocaleDateString("es-AR")}
                                {item.closed_by_name && <span className="font-semibold"> por {item.closed_by_name}</span>}
                              </span>
                            )}
                          </p>
                        )}
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${taskQuoteId ? "text-primary/70" : "text-blue-400/60"}`}>
                          <ListTodo className="h-3 w-3" />
                          {taskQuoteId ? "Tarea — Ver cotización →" : "Clic para ver / editar"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredTimeline.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {activitySpFilter !== "all"
                    ? "Este vendedor no tiene actividades registradas con este cliente."
                    : "Sin actividades ni tareas registradas"}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal de detalle de tarea ── */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogDescription className="sr-only">Detalle de tarea</DialogDescription>
          {taskModalData && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-6">
                  <div className="mt-1 shrink-0">
                    {taskModalData.status === "completed"
                      ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                      : <Circle className="w-5 h-5 text-orange-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-semibold leading-snug">{taskModalData.title}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge className={`text-xs ${taskModalData.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                        {TASK_STATUS_LABELS[taskModalData.status] || taskModalData.status}
                      </Badge>
                      {(taskModalData.parent_task_id || taskModalData.parentTaskId) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-violet-400 border border-violet-500/30 rounded-full px-2 py-0.5">
                          <GitBranch className="w-3 h-3" />Seguimiento
                        </span>
                      )}
                      {taskModalData.priority === "high" && <span className="text-[11px] text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">Alta prioridad</span>}
                      {taskModalData.priority === "urgent" && <span className="text-[11px] text-red-300 border border-red-400/30 rounded-full px-2 py-0.5 bg-red-500/10">⚡ Urgente</span>}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-1">
                {/* Metadatos */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {(taskModalData.dueDate || taskModalData.due_date) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      <span>Vence: <span className="text-foreground">{new Date((taskModalData.dueDate || taskModalData.due_date)).toLocaleDateString("es-AR")}</span></span>
                    </div>
                  )}
                  {taskModalData.assignee_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate text-blue-300">{taskModalData.assignee_name}</span>
                    </div>
                  )}
                  {taskModalData.status === "completed" && (taskModalData.completedAt || taskModalData.completed_at) && (
                    <div className="flex items-center gap-2 text-green-400 col-span-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Cerrada el {new Date(taskModalData.completedAt || taskModalData.completed_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                      {(taskModalData.closedByName || taskModalData.closed_by_name) && (
                        <span className="font-semibold">por {taskModalData.closedByName || taskModalData.closed_by_name}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Descripción */}
                {taskModalData.description && (
                  <div className="rounded-lg bg-white/5 border border-border/40 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {taskModalData.description}
                  </div>
                )}

                {/* Hilo completo */}
                {(taskThreadLoading || (taskThread && taskThread.items.length > 1)) && (
                  <div className="border-t border-border/40 pt-3">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
                      <History className="w-3.5 h-3.5" />Hilo completo de seguimientos
                      {taskThread && <span className="ml-1 text-muted-foreground/50">({taskThread.items.length} tareas)</span>}
                    </p>
                    {taskThreadLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando hilo…
                      </div>
                    ) : taskThread && (
                      <div className="relative pl-5">
                        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/40" />
                        {taskThread.items.map((item) => {
                          const isCurrent = item.id === taskThread.currentId;
                          const isDone = item.status === "completed";
                          const itemDate = item.completedAt || item.dueDate || item.due_date;
                          return (
                            <div key={item.id} className="relative mb-3 last:mb-0">
                              {/* dot */}
                              <div className={`absolute -left-5 top-2 w-3 h-3 rounded-full border-2 flex items-center justify-center
                                ${isCurrent
                                  ? "border-primary bg-primary"
                                  : isDone
                                    ? "border-green-500 bg-green-500/20"
                                    : "border-orange-400 bg-orange-400/15"
                                }`}
                              />
                              <div className={`rounded-lg border p-2.5 text-xs transition-colors
                                ${isCurrent
                                  ? "border-primary/50 bg-primary/5 shadow-sm"
                                  : isDone
                                    ? "border-green-500/20 bg-green-500/5"
                                    : "border-orange-400/20 bg-orange-400/5"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {isCurrent && <span className="text-[10px] font-bold text-primary shrink-0">ESTA</span>}
                                    <p className={`font-medium leading-snug ${isCurrent ? "text-foreground" : "text-foreground/75"}`}>
                                      {item.title}
                                    </p>
                                  </div>
                                  <Badge className={`text-[10px] shrink-0 border-0
                                    ${isDone ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400"}`}>
                                    {isDone ? "Cerrada" : "Abierta"}
                                  </Badge>
                                </div>
                                {item.description && (
                                  <p className="text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1.5 text-muted-foreground/60 flex-wrap">
                                  {itemDate && (
                                    <span className="flex items-center gap-1">
                                      {isDone
                                        ? <CheckCircle2 className="w-3 h-3 text-green-500/60" />
                                        : <CalendarClock className="w-3 h-3" />}
                                      {new Date(itemDate).toLocaleDateString("es-AR")}
                                    </span>
                                  )}
                                  {(item.assigneeNames?.length > 0 || item.assignee_name) && (
                                    <span className="flex items-center gap-1">
                                      <Users className="w-3 h-3" />
                                      {item.assigneeNames?.join(", ") || item.assignee_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones de cierre */}
                {taskModalData.status !== "completed" && (
                  <div className="border-t border-border/40 pt-3 space-y-3">
                    {!taskShowFollowup ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => closeTaskWithFollowup(false)}
                          disabled={taskSaving}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-400" />
                          {taskSaving ? "Cerrando…" : "Cerrar sin seguimiento"}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-violet-600 hover:bg-violet-500"
                          onClick={() => setTaskShowFollowup(true)}
                        >
                          <CalendarClock className="w-3.5 h-3.5 mr-1.5" />Cerrar y agendar
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-violet-400" />
                            Próximo seguimiento
                          </p>
                          <button onClick={() => setTaskShowFollowup(false)}>
                            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Título <span className="text-red-400">*</span></label>
                          <Input
                            className="mt-1"
                            value={taskFollowupTitle}
                            onChange={e => setTaskFollowupTitle(e.target.value)}
                            placeholder="¿Qué hay que hacer?"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Fecha <span className="text-red-400">*</span></label>
                          <Input
                            type="date"
                            className="mt-1"
                            value={taskFollowupDate}
                            onChange={e => setTaskFollowupDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Nota (opcional)</label>
                          <Textarea
                            rows={2}
                            className="mt-1 text-sm resize-none"
                            value={taskFollowupDesc}
                            onChange={e => setTaskFollowupDesc(e.target.value)}
                            placeholder="Contexto para el próximo contacto…"
                          />
                        </div>
                        {data?.teamInfo?.members?.length > 0 && (
                          <div>
                            <span className="text-[11px] text-muted-foreground block mb-1.5">Asignar seguimiento a:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {data.teamInfo.members.map((m: any) => {
                                const selected = taskFollowupAssigneeId === m.userId;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setTaskFollowupAssigneeId(m.userId)}
                                    className={`text-xs rounded-full px-3 py-1 border transition-all ${
                                      selected
                                        ? "bg-violet-600 border-violet-500 text-white font-semibold"
                                        : "bg-white/5 border-border/40 text-muted-foreground hover:border-violet-500/50 hover:text-foreground"
                                    }`}
                                  >
                                    {m.fullName || m.username}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <Button
                          className="w-full bg-violet-600 hover:bg-violet-500"
                          size="sm"
                          disabled={!taskFollowupDate || !taskFollowupTitle.trim() || taskSaving}
                          onClick={() => closeTaskWithFollowup(true)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          {taskSaving ? "Guardando…" : "Confirmar y agendar seguimiento"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {taskModalData.status === "completed" && (
                  <p className="text-xs text-center text-muted-foreground pt-1">Esta tarea ya está cerrada.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editClient={client}
        onSaved={load}
      />

      {/* ── Dialog: Nuevo Contacto ── */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Contact2 className="w-4 h-4" />Nuevo Contacto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={contactForm.firstName} onChange={e => setContactForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Juan" />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input value={contactForm.lastName} onChange={e => setContactForm(f => ({ ...f, lastName: e.target.value }))} placeholder="García" />
              </div>
            </div>
            <div>
              <Label>Cargo / Puesto</Label>
              <Input value={contactForm.position} onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))} placeholder="Comprador, Gerente de Planta..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@empresa.com" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+54 9 11 1234-5678" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPrimary"
                checked={contactForm.isPrimary}
                onCheckedChange={v => setContactForm(f => ({ ...f, isPrimary: !!v }))}
              />
              <Label htmlFor="isPrimary" className="cursor-pointer">Contacto principal</Label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setContactOpen(false)}>
                <X className="h-4 w-4 mr-1" />Cancelar
              </Button>
              <Button size="sm" onClick={saveContact} disabled={savingContact || !contactForm.firstName.trim()}>
                <Save className="h-4 w-4 mr-1" />{savingContact ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
