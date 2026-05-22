import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
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
  CheckCircle2, Circle, Clock, ListTodo, UserSquare
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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
  if (q.quoteStatus === "FINALIZADA") return { label: "Finalizada", color: "bg-green-500/20 text-green-300" };
  if (q.quoteStatus === "PERDIDA")    return { label: "Perdida",    color: "bg-red-500/20 text-red-300" };
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
  const canEdit = role === "admin" || role === "gerente" || role === "gerente_comercial";
  const { toast } = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Task reminder from URL param
  const taskId = new URLSearchParams(window.location.search).get("taskId");
  const [reminderTask, setReminderTask] = useState<any>(null);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [completingTask, setCompletingTask] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const defaultFollowup = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return {
      title: data?.client?.company_name || data?.client?.companyName || "",
      date: d.toISOString().slice(0, 10),
      priority: "medium" as "low" | "medium" | "high",
      status: "pending" as "pending" | "completed",
      description: "",
      assignedToUserId: String((user as any)?.id || ""),
    };
  };
  const [followupForm, setFollowupForm] = useState(defaultFollowup());

  useEffect(() => {
    if (completeModalOpen) {
      setFollowupForm(defaultFollowup());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeModalOpen]);

  useEffect(() => {
    if (!taskId) return;
    fetch(`${API}/api/tasks/${taskId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(t => { if (t) setReminderTask(t); })
      .catch(() => {});
  }, [taskId]);

  const completeTask = async (createFollowup: boolean) => {
    if (!reminderTask) return;
    setCompletingTask(true);
    try {
      const r = await fetch(`${API}/api/tasks/${reminderTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      });
      if (r.ok) {
        if (createFollowup && id) {
          await fetch(`${API}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: followupForm.title,
              type: "followup",
              priority: followupForm.priority,
              status: followupForm.status,
              description: followupForm.description || undefined,
              dueDate: followupForm.date ? new Date(followupForm.date + "T12:00:00").toISOString() : undefined,
              clientId: parseInt(id),
              assignedTo: followupForm.assignedToUserId ? parseInt(followupForm.assignedToUserId) : undefined,
            }),
          }).catch(() => {});
        }
        toast({ title: "Tarea completada", description: createFollowup ? "Seguimiento agendado." : undefined });
        setReminderTask((t: any) => ({ ...t, status: "completed" }));
        setCompleteModalOpen(false);
        setFollowupForm(defaultFollowup());
      } else {
        toast({ title: "Error al completar la tarea", variant: "destructive" });
      }
    } finally { setCompletingTask(false); }
  };
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // ── Usuarios asignables ──
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API}/api/users/assignable`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setAssignableUsers)
      .catch(() => {});
  }, []);

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

  const openEdit = () => {
    const c = data.client;
    setEditForm({
      companyName: c.company_name || c.companyName || "",
      taxId: c.tax_id || c.taxId || "",
      industry: c.industry || "",
      phone: c.phone || "",
      city: c.city || "",
      status: c.status || "prospect",
      notes: c.notes || "",
      consumptionScale: c.consumption_scale != null ? String(c.consumption_scale) : (c.consumptionScale != null ? String(c.consumptionScale) : ""),
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!r.ok) throw new Error("Error al guardar");
      setEditOpen(false);
      toast({ title: "Cliente actualizado" });
      load();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
        if (item._kind === "activity") {
          return (item.salesperson_id ?? item.salespersonId) === activitySpFilter;
        }
        return true; // tasks always shown
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
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1.5" />Editar cliente
          </Button>
        </div>

        {/* ── Task reminder banner ── */}
        {reminderTask && !reminderDismissed && (
          <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${reminderTask.status === "completed" ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
            {reminderTask.status === "completed"
              ? <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              : <ListTodo className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{reminderTask.status === "completed" ? "Tarea completada" : "Tarea pendiente"}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{reminderTask.title}</p>
              {reminderTask.description && <p className="text-xs text-muted-foreground mt-0.5">{reminderTask.description}</p>}
              {reminderTask.dueDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vence: {new Date(reminderTask.dueDate).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {reminderTask.status !== "completed" && (
                <Button size="sm" variant="outline" className="border-green-500/40 text-green-400 hover:bg-green-500/10" onClick={() => setCompleteModalOpen(true)} disabled={completingTask}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Completar
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
                <div className="flex items-end justify-between gap-4 mb-3 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Se propuso</p>
                    <p className="text-2xl font-bold font-mono text-amber-400">
                      {proposed > 0 ? `u$s ${fmt(proposed)}` : <span className="text-muted-foreground text-base font-normal">Sin definir</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Facturado · {stats.wonQuotes} {stats.wonQuotes === 1 ? "cotización cerrada" : "cotizaciones cerradas"}
                    </p>
                    <p className={`text-2xl font-bold font-mono ${over ? "text-emerald-400" : invoiced > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                      {invoiced > 0 ? `u$s ${fmt(invoiced)}` : "—"}
                    </p>
                  </div>
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
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50">
                    <tr className="text-xs text-muted-foreground uppercase text-left">
                      <th className="p-3">Número</th><th className="p-3">Fecha</th><th className="p-3">Vendedor</th>
                      <th className="p-3">Mon.</th><th className="p-3 text-right">Monto</th><th className="p-3">Estado</th><th className="p-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q: any) => {
                      const s = getQuoteStatusBadge(q);
                      return (
                        <tr key={q.id} className="border-b border-border/30 hover:bg-white/5">
                          <td className="p-3 font-mono">{q.number || `#${q.id}`}</td>
                          <td className="p-3 text-muted-foreground">{q.date ? new Date(q.date).toLocaleDateString("es-AR") : "—"}</td>
                          <td className="p-3">{q.salesperson_name || "—"}</td>
                          <td className="p-3 text-xs">{q.currency === "ARS" ? "$" : "u$s"}</td>
                          <td className="p-3 text-right font-mono">{fmt(Number(q.net_amount || q.total || 0))}</td>
                          <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                          <td className="p-3">
                            <Link href={`/quotes/${q.id}`}><Button size="sm" variant="ghost" className="text-xs">Ver</Button></Link>
                          </td>
                        </tr>
                      );
                    })}
                    {quotes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sin cotizaciones</td></tr>}
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
                const cardContent = (
                  <CardContent className="p-3 flex items-start gap-3">
                    <span className="text-xl mt-0.5">{TASK_TYPE_ICONS[item.type] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <Badge className={`text-xs shrink-0 ${isCompleted ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                            {TASK_STATUS_LABELS[item.status] || item.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item._date ? new Date(item._date).toLocaleDateString("es-AR") : "—"}
                        </span>
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                      {item.assignee_name && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />Asignada a: {item.assignee_name}
                          {item.completed_at && <span className="ml-2 text-green-400">· Cerrada el {new Date(item.completed_at).toLocaleDateString("es-AR")}</span>}
                        </p>
                      )}
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${taskQuoteId ? "text-primary/70" : "text-blue-400/60"}`}>
                        <ListTodo className="h-3 w-3" />
                        {taskQuoteId ? "Tarea — Ver cotización →" : "Tarea"}
                      </p>
                    </div>
                  </CardContent>
                );
                return taskQuoteId ? (
                  <Link key={`task-${item.id}`} href={`/quotes/${taskQuoteId}`}>
                    <Card className={`cursor-pointer transition-colors hover:border-primary/40 ${isCompleted ? "border-green-500/20" : "border-orange-500/20"}`}>
                      {cardContent}
                    </Card>
                  </Link>
                ) : (
                  <Card key={`task-${item.id}`} className={isCompleted ? "border-green-500/20" : "border-orange-500/20"}>
                    {cardContent}
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

      {/* Modal: Completar tarea → agendar seguimiento */}
      <Dialog open={completeModalOpen} onOpenChange={(o) => { if (!completingTask) setCompleteModalOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Agendar seguimiento
            </DialogTitle>
            <DialogDescription>
              Completá los datos del próximo seguimiento antes de cerrar la tarea.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="fu-title">Título</Label>
              <Input
                id="fu-title"
                value={followupForm.title}
                onChange={(e) => setFollowupForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Nombre del cliente"
              />
            </div>

            {/* Tipo (fijo) */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                Seguimiento
              </div>
            </div>

            {/* Fecha */}
            <div className="space-y-1.5">
              <Label htmlFor="fu-date">Fecha de seguimiento</Label>
              <Input
                id="fu-date"
                type="date"
                value={followupForm.date}
                onChange={(e) => setFollowupForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Prioridad y Estado en fila */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={followupForm.priority}
                  onValueChange={(v) => setFollowupForm((f) => ({ ...f, priority: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">ALTA</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">BAJA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={followupForm.status}
                  onValueChange={(v) => setFollowupForm((f) => ({ ...f, status: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Abierta</SelectItem>
                    <SelectItem value="completed">Cerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Asignar a */}
            <div className="space-y-1.5">
              <Label>Asignar a</Label>
              <Select
                value={followupForm.assignedToUserId || "none"}
                onValueChange={(v) => setFollowupForm((f) => ({ ...f, assignedToUserId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {assignableUsers.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="fu-desc">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                id="fu-desc"
                value={followupForm.description}
                onChange={(e) => setFollowupForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Confirmar disponibilidad para reunión…"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button variant="ghost" onClick={() => completeTask(false)} disabled={completingTask}>
              Cerrar sin agendar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => completeTask(true)}
              disabled={completingTask || !followupForm.title.trim() || !followupForm.date}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {completingTask ? "Guardando…" : "Completar y agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />Editar cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Razón social <span className="text-destructive">*</span></Label>
              <Input value={editForm.companyName || ""} onChange={e => setEditForm((f: any) => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>CUIT <span className="text-destructive">*</span></Label>
                <Input value={editForm.taxId || ""} onChange={e => setEditForm((f: any) => ({ ...f, taxId: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Industria <span className="text-destructive">*</span></Label>
                <Input value={editForm.industry || ""} onChange={e => setEditForm((f: any) => ({ ...f, industry: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Teléfono <span className="text-destructive">*</span></Label>
                <Input value={editForm.phone || ""} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Ciudad <span className="text-destructive">*</span></Label>
                <Input value={editForm.city || ""} onChange={e => setEditForm((f: any) => ({ ...f, city: e.target.value }))} />
              </div>
            </div>

            {/* Admin-only status override */}
            {canEdit && (
              <div className="space-y-1">
                <Label>Estado (override manual)</Label>
                <Select value={editForm.status || "prospect"} onValueChange={v => setEditForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospecto</SelectItem>
                    <SelectItem value="potential">Cliente Potencial</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="final">Cliente Final</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">El estado también se recalcula automáticamente según los campos completos y la Escala.</p>
              </div>
            )}

            {/* Escala de consumo — visible siempre en edit */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-amber-400 text-sm">
                Escala de Consumo (USD/año proyectado)
              </Label>
              <Input
                type="number" min="0" step="any"
                value={editForm.consumptionScale || ""}
                onChange={e => setEditForm((f: any) => ({ ...f, consumptionScale: e.target.value }))}
                placeholder="Ej: 50000"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">0 = Inactivo · &gt;0 = Potencial · Solo OC convierte en Cliente Final</p>
            </div>

            <div className="space-y-1">
              <Label>Notas internas</Label>
              <Textarea rows={3} value={editForm.notes || ""} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
              <X className="h-4 w-4 mr-1" />Cancelar
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />{saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
