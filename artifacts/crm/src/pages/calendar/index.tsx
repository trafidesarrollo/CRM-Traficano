import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Plus,
  CheckCircle2, Circle, Clock, Building2, User,
  FileText, CalendarClock, DollarSign, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isPast, isSameDay, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL || "";

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-500",
  medium: "bg-yellow-500",
  low:    "bg-blue-500",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-300 border-red-500/30",
  high:   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  low:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
};
const TYPE_LABELS: Record<string, string> = {
  task: "Tarea", call: "Llamada", meeting: "Reunión",
  email: "Email", followup: "Seguimiento", reminder: "Recordatorio",
};
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pendiente",   color: "text-yellow-300" },
  in_progress: { label: "En progreso", color: "text-blue-300" },
  completed:   { label: "Completada",  color: "text-green-400" },
  cancelled:   { label: "Cancelada",   color: "text-slate-400" },
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

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";

  const [tasks, setTasks] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [anchor, setAnchor] = useState<Date>(startOfWeekMonday(new Date()));

  // Day modal
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selTask, setSelTask] = useState<any>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selQuote, setSelQuote] = useState<any>(null);
  const [quoteDetailOpen, setQuoteDetailOpen] = useState(false);
  const [newFollowupDate, setNewFollowupDate] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);

  // Salesperson id for vendedor filtering
  const [salespersonId, setSalespersonId] = useState<number | null>(null);
  useEffect(() => {
    if (!isVendedor || !user?.id) return;
    fetch(`${API}/api/salespeople?limit=200`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        const sp = list.find((s: any) => s.userId === user.id);
        if (sp) setSalespersonId(sp.id);
      }).catch(() => {});
  }, [isVendedor, user?.id]);

  const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(anchor); d.setDate(d.getDate() + i); return d;
  }), [anchor]);

  useEffect(() => {
    const from = anchor.toISOString();
    const to = new Date(anchor.getTime() + 7 * 24 * 3600 * 1000).toISOString();

    // Tasks
    const taskParams = new URLSearchParams({ from, to, limit: "500" });
    if (isVendedor && user?.id) taskParams.set("assignedTo", String(user.id));
    fetch(`${API}/api/tasks?${taskParams}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setTasks(Array.isArray(d) ? d : (d.data || [])))
      .catch(() => setTasks([]));

    // Quote followups
    const qParams = new URLSearchParams({ from, to });
    if (isVendedor && salespersonId) qParams.set("salespersonId", String(salespersonId));
    fetch(`${API}/api/quotes/followups?${qParams}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setQuotes(Array.isArray(d) ? d : []))
      .catch(() => setQuotes([]));
  }, [anchor, isVendedor, user?.id, salespersonId]);

  const tasksFor = (d: Date) => tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), d));
  const quotesFor = (d: Date) => quotes.filter(q => {
    const ref = q.followupDate || q.dueDate;
    return ref && isSameDay(parseISO(ref), d);
  });

  const move = (n: number) => {
    const x = new Date(anchor); x.setDate(x.getDate() + n * 7); setAnchor(x);
  };

  const openDay = (d: Date) => {
    setSelectedDay(d);
    setDayModalOpen(true);
  };

  const toggleTask = async (t: any) => {
    const newStatus = t.status === "completed" ? "pending" : "completed";
    await fetch(`${API}/api/tasks/${t.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...(newStatus === "completed" ? { completedAt: new Date().toISOString() } : { completedAt: null }) }),
    });
    // Refresh
    const from = anchor.toISOString();
    const to = new Date(anchor.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    const taskParams = new URLSearchParams({ from, to, limit: "500" });
    if (isVendedor && user?.id) taskParams.set("assignedTo", String(user.id));
    fetch(`${API}/api/tasks?${taskParams}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setTasks(Array.isArray(d) ? d : (d.data || [])));
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
        toast({ title: "Fecha actualizada" });
        setQuoteDetailOpen(false);
        // Refresh quotes
        const from = anchor.toISOString();
        const to = new Date(anchor.getTime() + 7 * 24 * 3600 * 1000).toISOString();
        const qParams = new URLSearchParams({ from, to });
        if (isVendedor && salespersonId) qParams.set("salespersonId", String(salespersonId));
        fetch(`${API}/api/quotes/followups?${qParams}`, { credentials: "include" })
          .then(r => r.json()).then(d => setQuotes(Array.isArray(d) ? d : []));
      } else toast({ title: "Error al guardar", variant: "destructive" });
    } finally { setSavingQuote(false); }
  };

  const dayTasks = selectedDay ? tasksFor(selectedDay) : [];
  const dayQuotes = selectedDay ? quotesFor(selectedDay) : [];

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Calendario</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor(startOfWeekMonday(new Date()))}>Hoy</Button>
            <Button variant="outline" size="icon" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-medium min-w-[200px] text-center">
              {anchor.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — {days[6].toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <Button variant="outline" size="icon" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Link href="/tasks"><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva</Button></Link>
          </div>
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((d, i) => {
            const isToday = isSameDay(d, new Date());
            const dayT = tasksFor(d);
            const dayQ = quotesFor(d);
            const total = dayT.length + dayQ.length;
            return (
              <Card
                key={i}
                className={`transition-all cursor-pointer hover:bg-white/5 ${isToday ? "border-primary" : ""}`}
                onClick={() => openDay(d)}
              >
                <CardContent className="p-2 min-h-[160px]">
                  <div className="text-xs uppercase text-muted-foreground">
                    {d.toLocaleDateString("es-AR", { weekday: "short" })}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>

                  <div className="space-y-1 mt-2">
                    {total === 0 && <div className="text-xs text-muted-foreground">—</div>}

                    {/* Tasks — show up to 3 */}
                    {dayT.slice(0, 3).map(t => (
                      <div key={`t-${t.id}`} className={`text-xs p-1 rounded flex items-center gap-1 ${t.status === "completed" ? "opacity-40 line-through" : ""}`}>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] || "bg-gray-500"}`} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}

                    {/* Quote followups — show up to 2 */}
                    {dayQ.slice(0, 2).map(q => (
                      <div key={`q-${q.id}`} className="text-xs p-1 rounded flex items-center gap-1 text-primary/80">
                        <CalendarClock className="w-3 h-3 shrink-0" />
                        <span className="truncate">{q.number || q.clientName || `Cot. #${q.id}`}</span>
                      </div>
                    ))}

                    {/* Overflow badge */}
                    {total > 5 && (
                      <div className="text-xs text-muted-foreground pl-1">+{total - 5} más</div>
                    )}
                  </div>

                  {/* Bottom count */}
                  {total > 0 && (
                    <div className="mt-2 flex gap-1">
                      {dayT.length > 0 && <span className="text-xs bg-white/10 rounded px-1">{dayT.length} tarea{dayT.length > 1 ? "s" : ""}</span>}
                      {dayQ.length > 0 && <span className="text-xs bg-primary/10 text-primary rounded px-1">{dayQ.length} seg.</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Day detail modal ── */}
      <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogDescription className="sr-only">Detalle del día</DialogDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalIcon className="w-5 h-5 text-primary" />
              {selectedDay && format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-5 pt-1">
              {/* Tasks section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold">Tareas</h3>
                  {dayTasks.length > 0 && <Badge variant="outline" className="text-xs">{dayTasks.length}</Badge>}
                </div>
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sin tareas este día.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayTasks.map(t => (
                      <div
                        key={t.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-white/5 transition-all ${t.status === "completed" ? "opacity-50 border-border/30" : "border-border/60"}`}
                        onClick={() => { setSelTask(t); setTaskDetailOpen(true); setDayModalOpen(false); }}
                      >
                        <div onClick={e => { e.stopPropagation(); toggleTask(t); }}>
                          {t.status === "completed"
                            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary shrink-0" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-sm font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] || "bg-gray-400"}`} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {t.dueDate && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock className="w-3 h-3" />{format(parseISO(t.dueDate), "HH:mm")}</span>}
                            {t.clientName && <span className="text-xs text-muted-foreground">{t.clientName}</span>}
                            <span className={`text-xs ${STATUS_CONFIG[t.status]?.color}`}>{STATUS_CONFIG[t.status]?.label}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{TYPE_LABELS[t.type] || t.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border/40" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <CalendarClock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Seguimientos de cotizaciones</span>
                  {dayQuotes.length > 0 && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{dayQuotes.length}</Badge>}
                </div>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              {/* Quote followups section */}
              <div>
                {dayQuotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sin seguimientos de cotizaciones este día.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayQuotes.map(q => (
                      <div
                        key={q.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/5 transition-all"
                        onClick={() => { setSelQuote(q); setNewFollowupDate(q.followupDate ? format(parseISO(q.followupDate), "yyyy-MM-dd'T'HH:mm") : ""); setQuoteDetailOpen(true); setDayModalOpen(false); }}
                      >
                        <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium">{q.number || `Cot. #${q.id}`}</span>
                            <Badge className={`text-xs ${getQuoteStatusBadge(q).color}`}>{getQuoteStatusBadge(q).label}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {q.clientName && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Building2 className="w-3 h-3" />{q.clientName}</span>}
                            {!isVendedor && q.salespersonName && <span className="text-xs text-muted-foreground">{q.salespersonName}</span>}
                            {q.followupDate && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock className="w-3 h-3" />{format(parseISO(q.followupDate), "HH:mm")}</span>}
                            {q.total && Number(q.total) > 0 && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{q.currency} {Number(q.total).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {dayTasks.length === 0 && dayQuotes.length === 0 && (
                <div className="text-center py-4">
                  <CalIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-muted-foreground text-sm">Día libre, sin actividades.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Task detail from calendar ── */}
      <Dialog open={taskDetailOpen} onOpenChange={v => { setTaskDetailOpen(v); if (!v) setDayModalOpen(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogDescription className="sr-only">Detalle de tarea</DialogDescription>
          {selTask && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3 pr-6">
                  <div className="mt-1">
                    {selTask.status === "completed"
                      ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                      : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <DialogTitle className="text-left">{selTask.title}</DialogTitle>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge className={`text-xs ${PRIORITY_COLORS[selTask.priority]}`}>{PRIORITY_LABELS[selTask.priority]}</Badge>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[selTask.type]}</Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-3 pt-1 text-sm">
                {selTask.dueDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{format(parseISO(selTask.dueDate), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}</span>
                  </div>
                )}
                {selTask.clientName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{selTask.clientName}</span>
                  </div>
                )}
                {selTask.assigneeName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4 shrink-0" />
                    <span>{selTask.assigneeName}</span>
                  </div>
                )}
                {selTask.description && (
                  <p className="p-3 bg-white/5 rounded-lg text-muted-foreground">{selTask.description}</p>
                )}
                <hr className="border-border/40" />
                {selTask.status !== "completed" ? (
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={async () => { await toggleTask(selTask); setSelTask({ ...selTask, status: "completed" }); toast({ title: "Tarea cerrada" }); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />Marcar como cerrada
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={async () => { await toggleTask(selTask); setSelTask({ ...selTask, status: "pending" }); toast({ title: "Tarea reabierta" }); }}>
                    <Circle className="w-4 h-4 mr-2" />Reabrir tarea
                  </Button>
                )}
                <Link href="/tasks" onClick={() => setTaskDetailOpen(false)}>
                  <Button variant="outline" className="w-full text-xs">Ver todas las tareas</Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Quote followup detail from calendar ── */}
      <Dialog open={quoteDetailOpen} onOpenChange={v => { setQuoteDetailOpen(v); if (!v) setDayModalOpen(true); }}>
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
              <div className="space-y-4 pt-1 text-sm">
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
                {selQuote.description && (
                  <p className="p-3 bg-white/5 rounded-lg text-muted-foreground">{selQuote.description}</p>
                )}
                <hr className="border-border/40" />
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-primary" />Actualizar fecha de seguimiento
                  </Label>
                  <Input type="datetime-local" value={newFollowupDate} onChange={e => setNewFollowupDate(e.target.value)} />
                  <Button className="w-full" onClick={updateQuoteFollowup} disabled={savingQuote || !newFollowupDate}>
                    <CalendarClock className="w-4 h-4 mr-2" />Guardar nueva fecha
                  </Button>
                </div>
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
