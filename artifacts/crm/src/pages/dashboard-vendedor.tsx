import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Plus, Users, CalendarDays, Package, Clock,
  CheckCircle2, Send, ListTodo, AlertCircle, Activity, Target,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n || 0);
}

const API = import.meta.env.VITE_API_URL || "";

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Borrador",  color: "bg-gray-500/20 text-gray-300" },
  sent:     { label: "Enviada",   color: "bg-blue-500/20 text-blue-300" },
  approved: { label: "Aprobada",  color: "bg-green-500/20 text-green-300" },
  rejected: { label: "Rechazada", color: "bg-red-500/20 text-red-300" },
  partial:  { label: "Parcial",   color: "bg-yellow-500/20 text-yellow-300" },
  expired:  { label: "Vencida",   color: "bg-orange-500/20 text-orange-300" },
};


const ACTIVITY_LABELS: Record<string, string> = {
  call: "Llamada", visit: "Visita", email: "Email",
  meeting: "Reunión", note: "Nota", task: "Tarea",
};

function getQuoteStatusBadge(q: any): { label: string; color: string } {
  if (q.quoteStatus === "FINALIZADA") return { label: "Finalizada",  color: "bg-green-500/20 text-green-300" };
  if (q.quoteStatus === "PERDIDA")    return { label: "Perdida",     color: "bg-red-500/20 text-red-300" };
  if (q.quoteStatus === "DESISTIDA")  return { label: "Desistida",   color: "bg-slate-500/20 text-slate-300" };
  return QUOTE_STATUS[q.status] || { label: q.status, color: "bg-gray-500/20 text-gray-300" };
}

export default function DashboardVendedor() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState<any>({});
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTarget, setMyTarget] = useState<any>(null);

  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    Promise.all([
      fetch(`${API}/api/quotes?limit=50`, { credentials: "include" })
        .then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/api/tasks/stats/summary?assignedTo=${user.id}`, { credentials: "include" })
        .then(r => r.json()).catch(() => ({})),
      fetch(`${API}/api/activities?limit=6`, { credentials: "include" })
        .then(r => r.json()).catch(() => []),
      fetch(`${API}/api/sales-targets/my-progress?year=${year}&month=${month}`, { credentials: "include" })
        .then(r => r.json()).catch(() => ({ data: null })),
    ]).then(([quotesData, stats, actsData, targetData]) => {
      setQuotes(quotesData.data || []);
      setTaskStats(stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {});
      setActivities(Array.isArray(actsData) ? actsData : (actsData.data || []));
      setMyTarget(targetData.data || null);
      setLoading(false);
    });
  }, [user?.id]);

  const quoteStats = {
    draft:    quotes.filter(q => q.status === "draft").length,
    sent:     quotes.filter(q => q.status === "sent").length,
    approved: quotes.filter(q => q.status === "approved").length,
  };

  const recentQuotes = quotes.slice(0, 8);

  const now = new Date();
  const mesLabel = format(now, "MMMM yyyy", { locale: es });

  return (
    <AppLayout>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">
            Bienvenido, {user?.fullName?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">Tu actividad comercial de hoy</p>
        </div>
      </div>

      {/* Mi meta del mes */}
      {myTarget && (
        (() => {
          const actual  = Number(myTarget.actual_amount  ?? 0);
          const target  = Number(myTarget.target_amount  ?? 0);
          const pct     = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
          const over    = target > 0 && actual > target;
          const cur     = myTarget.currency === "ARS" ? "$" : "u$s";
          const color   = over ? "bg-emerald-400" : pct >= 75 ? "bg-green-400" : pct >= 40 ? "bg-amber-400" : "bg-primary";
          return (
            <Card className="bg-card/50 border-white/5 mb-6">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Mi meta de {mesLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-3 flex-wrap mb-3">
                  <span className={`text-3xl font-bold font-mono ${over ? "text-emerald-400" : actual > 0 ? "text-green-300" : "text-muted-foreground"}`}>
                    {cur} {fmt(actual)}
                  </span>
                  <span className="text-muted-foreground text-lg">/</span>
                  <span className="text-xl font-mono text-amber-400">{cur} {fmt(target)}</span>
                  <span className={`text-sm font-semibold ml-auto ${over ? "text-emerald-400" : pct >= 75 ? "text-green-400" : pct >= 40 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {over ? `🎯 ${((actual / target) * 100).toFixed(0)}% — ¡Meta superada!` : `${pct.toFixed(0)}% completado`}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${Math.max(pct, actual > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Cotizaciones FINALIZADAS/APROBADAS este mes
                </p>
              </CardContent>
            </Card>
          );
        })()
      )}

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gray-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quoteStats.draft}</p>
              <p className="text-sm text-muted-foreground">En borrador</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quoteStats.sent}</p>
              <p className="text-sm text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quoteStats.approved}</p>
              <p className="text-sm text-muted-foreground">Aprobadas</p>
            </div>
          </CardContent>
        </Card>

        <Link href="/tasks">
          <Card className={`bg-card/50 border-white/5 cursor-pointer hover:bg-white/5 transition-all h-full ${(taskStats.overdue ?? 0) > 0 ? "border-red-500/30" : ""}`}>
            <CardContent className="p-5 flex items-center gap-4 h-full">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${(taskStats.overdue ?? 0) > 0 ? "bg-red-500/20" : "bg-primary/20"}`}>
                {(taskStats.overdue ?? 0) > 0
                  ? <AlertCircle className="w-5 h-5 text-red-400" />
                  : <ListTodo className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <p className={`text-2xl font-bold ${(taskStats.overdue ?? 0) > 0 ? "text-red-400" : ""}`}>
                  {taskStats.pending ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tareas pendientes
                  {(taskStats.overdue ?? 0) > 0 && (
                    <span className="block text-xs text-red-400">{taskStats.overdue} vencida{taskStats.overdue > 1 ? "s" : ""}</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cotizaciones recientes */}
        <div className="lg:col-span-2">
          <Card className="bg-card/50 border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Mis cotizaciones recientes
              </CardTitle>
              <Link href="/quotes/new">
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nueva</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
              ) : recentQuotes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay cotizaciones.{" "}
                  <Link href="/quotes/new" className="text-primary underline">Crear una</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/50">
                      <tr className="text-left text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-3">Número</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentQuotes.map(q => {
                        const s = getQuoteStatusBadge(q);
                        return (
                          <tr key={q.id} className="border-b border-border/30 hover:bg-white/5">
                            <td className="px-4 py-3">
                              <Link href={`/quotes/${q.id}`} className="font-mono text-primary hover:underline">
                                {q.number || `#${q.id}`}
                              </Link>
                            </td>
                            <td className="px-4 py-3 max-w-[140px] truncate">{q.clientName || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {q.date ? new Date(q.date).toLocaleDateString("es-AR") : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs">
                              {Number(q.netAmount || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {q.currency === "USD" ? "u$s" : q.currency}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={s.color}>{s.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          {/* Accesos rápidos */}
          <Card className="bg-card/50 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/quotes/new">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="w-4 h-4 text-primary" />Nueva cotización
                </Button>
              </Link>
              <Link href="/tasks">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <ListTodo className="w-4 h-4 text-primary" />
                  Mis tareas
                  {(taskStats.pending ?? 0) > 0 && (
                    <Badge className={`ml-auto text-xs ${(taskStats.overdue ?? 0) > 0 ? "bg-red-500/20 text-red-300" : "bg-primary/20 text-primary"}`}>
                      {taskStats.pending}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/clients">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="w-4 h-4 text-primary" />Ver clientes
                </Button>
              </Link>
              <Link href="/calendar">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />Calendario
                </Button>
              </Link>
              <Link href="/products">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Package className="w-4 h-4 text-primary" />Productos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actividad reciente */}
      <Card className="bg-card/50 border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Actividad reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : activities.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">Sin actividad registrada aún</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activities.slice(0, 6).map((act: any, i: number) => (
                <div key={act.id ?? i} className="flex gap-3 p-3 rounded-lg bg-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">{act.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {act.createdAt
                        ? format(new Date(act.createdAt), "dd MMM, HH:mm", { locale: es })
                        : "—"}
                      {" · "}{ACTIVITY_LABELS[act.type] ?? act.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
