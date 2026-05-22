import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getOppStatusLabel, getFunctionalRoleLabel } from "@/lib/translations";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, List, LayoutGrid, GripVertical, FileText, ExternalLink, ChevronRight, DollarSign, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

const API_BASE = import.meta.env.VITE_API_URL || "";

const STATUS_ORDER = ["new", "quote_requested", "quoted", "negotiating", "won", "lost"] as const;
const SLA_LIMITS: Record<string, number> = {
  new: 4,
  quote_requested: 24,
  quoted: 72,
};

const QUOTE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: "Borrador",   color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  sent:     { label: "Enviada",    color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  approved: { label: "Aprobada",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rechazada",  color: "bg-red-500/15 text-red-400 border-red-500/30" },
  partial:  { label: "Parcial",    color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  expired:  { label: "Vencida",    color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

function getSlaStatus(status: string, stageEnteredAt: string | null) {
  if (!stageEnteredAt || !SLA_LIMITS[status]) return null;
  const hoursElapsed = (Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60);
  const limit = SLA_LIMITS[status];
  if (hoursElapsed >= limit) return "red";
  if (hoursElapsed >= limit * 0.8) return "yellow";
  return "green";
}

function SlaBadge({ status, stageEnteredAt }: { status: string; stageEnteredAt: string | null }) {
  const sla = getSlaStatus(status, stageEnteredAt);
  if (!sla) return null;
  const colors = { green: "bg-green-500", yellow: "bg-yellow-500", red: "bg-red-500" };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[sla]}`} title={`SLA: ${sla}`}></span>;
}

function KanbanCard({ opp, salespeople, onClick }: { opp: any; salespeople: any[]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opp.id.toString(), data: { opp } });
  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const farmer = salespeople.find(s => s.id === opp.farmerId);

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className="bg-card border border-border/50 rounded-xl p-3 mb-2 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <p className="font-medium text-sm truncate">{opp.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <SlaBadge status={opp.status} stageEnteredAt={opp.stageEnteredAt} />
          <button onClick={onClick} className="hover:text-primary transition-colors">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab active:cursor-grabbing" {...listeners} />
        </div>
      </div>
      {opp.estimatedValue && (
        <p className="text-lg font-bold mt-1">{opp.currency || "ARS"} {Number(opp.estimatedValue).toLocaleString()}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {farmer && <span>Farmer: {farmer.name}</span>}
        {opp._quoteCount > 0 && (
          <span className="flex items-center gap-0.5 ml-auto">
            <FileText className="w-3 h-3" />{opp._quoteCount}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ status, opps, salespeople, onCardClick }: { status: string; opps: any[]; salespeople: any[]; onCardClick: (opp: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[200px] max-w-[250px] ${isOver ? "ring-2 ring-primary/50 rounded-xl" : ""}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold truncate">{getOppStatusLabel(status)}</h3>
        <Badge variant="outline" className="text-xs">{opps.length}</Badge>
      </div>
      <div className="bg-white/5 rounded-xl p-2 min-h-[200px]">
        {opps.map(opp => (
          <KanbanCard key={opp.id} opp={opp} salespeople={salespeople} onClick={() => onCardClick(opp)} />
        ))}
      </div>
    </div>
  );
}

function QuoteTimeline({ quotes, onNewQuote }: { quotes: any[]; onNewQuote: () => void }) {
  const [, navigate] = useLocation();

  if (quotes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No hay cotizaciones vinculadas aún.</p>
        <Button size="sm" className="mt-3" onClick={onNewQuote}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Nueva cotización
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {quotes.map((q: any, idx: number) => {
        const cfg = QUOTE_STATUS_CONFIG[q.status] || QUOTE_STATUS_CONFIG.draft;
        const isLatest = idx === 0;
        return (
          <div key={q.id}
            className={`relative flex gap-3 p-3 rounded-xl border transition-colors hover:bg-white/5 cursor-pointer ${isLatest ? "border-primary/30 bg-primary/5" : "border-border/40"}`}
            onClick={() => navigate(`/quotes/${q.id}`)}>
            <div className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${isLatest ? "bg-primary" : "bg-muted-foreground/40"}`} />
              {idx < quotes.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold">{q.number || `#${q.id}`}</span>
                {isLatest && <span className="text-xs text-primary font-medium">Vigente</span>}
                <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(q.date), "dd/MM/yyyy", { locale: es })}
                </span>
                {q.netAmount && Number(q.netAmount) > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <DollarSign className="w-3 h-3" />
                    {q.currency} {Number(q.netAmount).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                  </span>
                )}
                {q.salespersonName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />{q.salespersonName}
                  </span>
                )}
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
          </div>
        );
      })}
      <Button size="sm" variant="outline" className="w-full mt-2" onClick={onNewQuote}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />Nueva versión de cotización
      </Button>
    </div>
  );
}

export default function Opportunities() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [opps, setOpps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [filterPipelineId, setFilterPipelineId] = useState<string>("all");
  const [clients, setClients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpp, setEditOpp] = useState<any>(null);
  const [dragOpp, setDragOpp] = useState<any>(null);

  const [detailOpp, setDetailOpp] = useState<any>(null);
  const [detailQuotes, setDetailQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  type OppForm = {
    title: string; clientId: string; status: string; priority: string;
    estimatedValue: string; currency: string; description: string;
    hunterId: string; farmerId: string; pipelineId: string; stageId: string;
  };
  const [form, setForm] = useState<OppForm>({
    title: "", clientId: "", status: "new", priority: "medium",
    estimatedValue: "", currency: "ARS", description: "",
    hunterId: "", farmerId: "", pipelineId: "", stageId: "",
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, spRes, clRes] = await Promise.all([
        fetch(`${API_BASE}/api/opportunities?limit=200`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/salespeople`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/clients?limit=200`, { credentials: "include" }).then(r => r.json()),
      ]);
      const allOpps = (oppsRes.data || []).filter((o: any) => filterPipelineId === "all" || String(o.pipelineId || "") === filterPipelineId);
      setOpps(allOpps);
      setTotal(allOpps.length);
      setSalespeople(Array.isArray(spRes) ? spRes : []);
      setClients(clRes.data || clRes || []);
      const pRes = await fetch(`${API_BASE}/api/pipelines`, { credentials: "include" }).then(r => r.json());
      setPipelines(pRes.data || []);
    } catch {} finally { setLoading(false); }
  }, [filterPipelineId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (opp: any) => {
    setDetailOpp(opp);
    setDetailOpen(true);
    setLoadingQuotes(true);
    try {
      const data = await fetch(`${API_BASE}/api/opportunities/${opp.id}/quotes`, { credentials: "include" }).then(r => r.json());
      setDetailQuotes(Array.isArray(data) ? data : []);
    } catch {
      setDetailQuotes([]);
    } finally {
      setLoadingQuotes(false);
    }
  };

  const handleNewQuote = () => {
    if (!detailOpp) return;
    const params = new URLSearchParams();
    if (detailOpp.clientId) params.set("clientId", String(detailOpp.clientId));
    params.set("opportunityId", String(detailOpp.id));
    navigate(`/quotes/new?${params.toString()}`);
  };

  const hunters = salespeople.filter(s => s.functionalRole === "hunter");
  const farmers = salespeople.filter(s => s.functionalRole === "farmer");

  const openCreate = () => {
    setEditOpp(null);
    const def = pipelines.find(p => p.isDefault) || pipelines[0];
    setForm({ title: "", clientId: "", status: "new", priority: "medium", estimatedValue: "", currency: "ARS", description: "", hunterId: "", farmerId: "", pipelineId: def?.id?.toString() || "", stageId: def?.stages?.[0]?.id?.toString() || "" });
    setDialogOpen(true);
  };

  const openEdit = (opp: any) => {
    setEditOpp(opp);
    setForm({
      title: opp.title, clientId: opp.clientId?.toString() || "", status: opp.status,
      priority: opp.priority, estimatedValue: opp.estimatedValue?.toString() || "",
      currency: opp.currency || "ARS", description: opp.description || "",
      hunterId: opp.hunterId?.toString() || "", farmerId: opp.farmerId?.toString() || "",
      pipelineId: opp.pipelineId?.toString() || "", stageId: opp.stageId?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (form.hunterId && form.farmerId && form.hunterId === form.farmerId) {
      toast({ title: "Hunter y Farmer no pueden ser el mismo vendedor", variant: "destructive" });
      return;
    }
    const body: any = {
      title: form.title,
      status: form.status,
      priority: form.priority,
      currency: form.currency,
      description: form.description || undefined,
      clientId: form.clientId ? parseInt(form.clientId) : undefined,
      estimatedValue: form.estimatedValue || undefined,
      hunterId: form.hunterId ? parseInt(form.hunterId) : null,
      farmerId: form.farmerId ? parseInt(form.farmerId) : null,
      pipelineId: form.pipelineId ? parseInt(form.pipelineId) : null,
      stageId: form.stageId ? parseInt(form.stageId) : null,
    };

    try {
      const url = editOpp ? `${API_BASE}/api/opportunities/${editOpp.id}` : `${API_BASE}/api/opportunities`;
      const method = editOpp ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || "Error al guardar", variant: "destructive" });
        return;
      }
      toast({ title: editOpp ? "Oportunidad actualizada" : "Oportunidad creada" });
      setDialogOpen(false);
      fetchData();
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const opp = opps.find(o => o.id.toString() === event.active.id);
    setDragOpp(opp || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragOpp(null);
    const { active, over } = event;
    if (!over) return;
    const oppId = active.id;
    const newStatus = over.id as string;
    const opp = opps.find(o => o.id.toString() === oppId);
    if (!opp || opp.status === newStatus) return;

    try {
      const res = await fetch(`${API_BASE}/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error || "Error al mover", variant: "destructive" });
        return;
      }
      setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, status: newStatus, stageEnteredAt: new Date().toISOString() } : o));
      toast({ title: `Movido a ${getOppStatusLabel(newStatus)}` });
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "-";
    const cl = clients.find((c: any) => c.id === clientId);
    return cl?.companyName || cl?.company_name || "-";
  };

  const getSpName = (id: number | null) => {
    if (!id) return "-";
    return salespeople.find(s => s.id === id)?.name || "-";
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  const getOppStatusColor = (s: string) => {
    switch(s) {
      case 'won': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'lost': return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'negotiating': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'quoted': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'quote_requested': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
  };

  const detailClient = detailOpp ? clients.find((c: any) => c.id === detailOpp.clientId) : null;
  const latestQuote = detailQuotes[0];

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Oportunidades</h1>
          <p className="text-muted-foreground mt-1">{total} oportunidades en total</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
              <List className="w-4 h-4 mr-1" />Lista
            </Button>
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => setView("kanban")}>
              <LayoutGrid className="w-4 h-4 mr-1" />Kanban
            </Button>
          </div>
          <Select value={filterPipelineId} onValueChange={setFilterPipelineId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pipelines</SelectItem>
              {pipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : view === "list" ? (
        <div className="overflow-x-auto rounded-2xl border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground bg-white/5">
                <th className="py-3 px-3 font-medium">SLA</th>
                <th className="py-3 px-3 font-medium">Título</th>
                <th className="py-3 px-3 font-medium">Estado</th>
                <th className="py-3 px-3 font-medium">Prioridad</th>
                <th className="py-3 px-3 font-medium">Cliente</th>
                <th className="py-3 px-3 font-medium">Hunter</th>
                <th className="py-3 px-3 font-medium">Farmer</th>
                <th className="py-3 px-3 font-medium">Valor</th>
                <th className="py-3 px-3 font-medium">Cotizaciones</th>
                <th className="py-3 px-3 font-medium">Creado</th>
                <th className="py-3 px-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">No hay oportunidades.</td></tr>
              ) : opps.map(opp => (
                <tr key={opp.id}
                  className="border-b border-border/20 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => openDetail(opp)}>
                  <td className="py-3 px-3"><SlaBadge status={opp.status} stageEnteredAt={opp.stageEnteredAt} /></td>
                  <td className="py-3 px-3 font-medium">{opp.title}</td>
                  <td className="py-3 px-3"><Badge variant="outline" className={getOppStatusColor(opp.status)}>{getOppStatusLabel(opp.status)}</Badge></td>
                  <td className="py-3 px-3"><Badge variant="outline" className={getPriorityColor(opp.priority)}>{opp.priority}</Badge></td>
                  <td className="py-3 px-3 text-muted-foreground">{getClientName(opp.clientId)}</td>
                  <td className="py-3 px-3 text-muted-foreground">{getSpName(opp.hunterId)}</td>
                  <td className="py-3 px-3 text-muted-foreground">{getSpName(opp.farmerId)}</td>
                  <td className="py-3 px-3 font-semibold">{opp.estimatedValue ? `${opp.currency || "ARS"} ${Number(opp.estimatedValue).toLocaleString()}` : "-"}</td>
                  <td className="py-3 px-3">
                    {opp._quoteCount ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" />{opp._quoteCount}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{format(new Date(opp.createdAt), "dd/MM/yy", { locale: es })}</td>
                  <td className="py-3 px-3">
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openEdit(opp); }}>Editar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_ORDER.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                opps={opps.filter(o => o.status === status)}
                salespeople={salespeople}
                onCardClick={openDetail}
              />
            ))}
          </div>
          <DragOverlay>
            {dragOpp && (
              <div className="bg-card border border-primary/50 rounded-xl p-3 shadow-2xl w-[220px]">
                <p className="font-medium text-sm">{dragOpp.title}</p>
                {dragOpp.estimatedValue && (
                  <p className="text-lg font-bold mt-1">{dragOpp.currency || "ARS"} {Number(dragOpp.estimatedValue).toLocaleString()}</p>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Opportunity Detail Panel ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{detailOpp?.title}</DialogTitle>
            <DialogDescription className="sr-only">Detalle de oportunidad</DialogDescription>
          </DialogHeader>

          {detailOpp && (
            <div className="space-y-5 mt-1">
              {/* ── Header info ── */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/40 bg-white/5 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
                  <p className="font-semibold">{getClientName(detailOpp.clientId)}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-white/5 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor estimado</p>
                  <p className="font-semibold">
                    {detailOpp.estimatedValue
                      ? `${detailOpp.currency || "ARS"} ${Number(detailOpp.estimatedValue).toLocaleString()}`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-white/5 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Estado</p>
                  <Badge variant="outline" className={getOppStatusColor(detailOpp.status)}>
                    {getOppStatusLabel(detailOpp.status)}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border/40 bg-white/5 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Equipo</p>
                  <div className="text-xs space-y-0.5">
                    {detailOpp.hunterId && <p>Hunter: <span className="font-medium">{getSpName(detailOpp.hunterId)}</span></p>}
                    {detailOpp.farmerId && <p>Farmer: <span className="font-medium">{getSpName(detailOpp.farmerId)}</span></p>}
                    {!detailOpp.hunterId && !detailOpp.farmerId && <p className="text-muted-foreground">Sin asignar</p>}
                  </div>
                </div>
              </div>

              {detailOpp.description && (
                <div className="rounded-lg border border-border/40 bg-white/5 p-3 text-sm text-muted-foreground">
                  {detailOpp.description}
                </div>
              )}

              {/* ── Latest quote highlight ── */}
              {latestQuote && !loadingQuotes && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cotización vigente</p>
                      <p className="font-mono font-bold">{latestQuote.number || `#${latestQuote.id}`}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {latestQuote.currency} {latestQuote.netAmount ? Number(latestQuote.netAmount).toLocaleString("es-AR") : "0"}
                        {" · "}{format(new Date(latestQuote.date), "dd/MM/yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className={QUOTE_STATUS_CONFIG[latestQuote.status]?.color}>
                        {QUOTE_STATUS_CONFIG[latestQuote.status]?.label}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); navigate(`/quotes/${latestQuote.id}`); }}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Ver
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Quote history ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Historial de cotizaciones ({detailQuotes.length})</h3>
                  <Button size="sm" onClick={handleNewQuote}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />Nueva cotización
                  </Button>
                </div>
                {loadingQuotes ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                ) : (
                  <QuoteTimeline quotes={detailQuotes} onNewQuote={handleNewQuote} />
                )}
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-2 pt-1 border-t border-border/40">
                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEdit(detailOpp); }}>
                  Editar oportunidad
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDetailOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editOpp ? "Editar Oportunidad" : "Nueva Oportunidad"}</DialogTitle>
            <DialogDescription className="sr-only">Formulario de oportunidad</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map(s => (
                      <SelectItem key={s} value={s}>{getOppStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pipeline</Label>
                <Select value={form.pipelineId} onValueChange={v => {
                  const p = pipelines.find(pp => String(pp.id) === v);
                  setForm({ ...form, pipelineId: v, stageId: p?.stages?.[0]?.id?.toString() || "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{pipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Etapa</Label>
                <Select value={form.stageId} onValueChange={v => setForm({ ...form, stageId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(pipelines.find(p => String(p.id) === form.pipelineId)?.stages || []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {(Array.isArray(clients) ? clients : []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.companyName || c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hunter origen</Label>
                <Select value={form.hunterId} onValueChange={v => setForm({ ...form, hunterId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {hunters.map(h => (
                      <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Farmer asignado</Label>
                <Select value={form.farmerId} onValueChange={v => setForm({ ...form, farmerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {farmers.map(f => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor estimado</Label>
                <Input type="number" value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: e.target.value })} />
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <Button className="w-full" disabled={!form.title} onClick={handleSave}>
              {editOpp ? "Guardar cambios" : "Crear Oportunidad"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
