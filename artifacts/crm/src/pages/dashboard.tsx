import { useState, useEffect } from "react";
import { useGetDashboardMetrics } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { Users, TrendingUp, Target, ShoppingCart, UserPlus, AlertTriangle, Building2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getOppStatusLabel } from "@/lib/translations";

const API = import.meta.env.VITE_API_URL || "";

const OPP_COLORS: Record<string, string> = {
  new: "#6366f1",
  quote_requested: "#8b5cf6",
  quoted: "#a78bfa",
  negotiating: "#f59e0b",
  won: "#22c55e",
  lost: "#ef4444",
  closed: "#6b7280",
};

const ACTIVITY_LABELS: Record<string, string> = {
  call: "Llamada", visit: "Visita", email: "Email",
  meeting: "Reunión", note: "Nota", task: "Tarea",
};

const PERIOD_OPTIONS = [
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "180d", value: 180 },
];

export default function Dashboard() {
  const { data: metrics, isLoading: loadingMetrics } = useGetDashboardMetrics();
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [salespersonData, setSalespersonData] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [period, setPeriod] = useState(90);
  const [loading, setLoading] = useState(true);
  const [newClients, setNewClients] = useState<any[]>([]);
  const [dormantClients, setDormantClients] = useState<any[]>([]);
  const [dormantDays, setDormantDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/reports/sales-by-month?months=12`, { credentials: "include" }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/api/reports/sales-by-salesperson?days=${period}`, { credentials: "include" }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/api/reports/top-clients?days=365`, { credentials: "include" }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/api/reports/sales-summary?days=${period}`, { credentials: "include" }).then(r => r.json()).catch(() => null),
    ]).then(([monthly, byPerson, topC, summ]) => {
      setMonthlyData((monthly.data || []).map((r: any) => ({
        ...r,
        label: r.month ? format(new Date(r.month + "-01"), "MMM yy", { locale: es }) : r.month,
      })));
      setSalespersonData(byPerson.data || []);
      setTopClients((topC.data || []).slice(0, 8));
      setSummary(summ);
      setLoading(false);
    });
  }, [period]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/reports/new-clients?days=30`, { credentials: "include" }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/api/reports/dormant-clients?days=${dormantDays}`, { credentials: "include" }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([nc, dc]) => {
      setNewClients(nc.data || []);
      setDormantClients(dc.data || []);
    });
  }, [dormantDays]);

  const oppFunnelData = metrics
    ? Object.entries(metrics.opportunitiesByStatus || {})
        .map(([key, val]) => ({
          name: getOppStatusLabel(key),
          total: val as number,
          color: OPP_COLORS[key] || "#6b7280",
        }))
        .filter(d => d.total > 0)
    : [];

  const maxSalesperson = salespersonData[0]?.total ?? 1;

  return (
    <AppLayout>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard Comercial</h1>
          <p className="text-muted-foreground mt-1">Métricas y rendimiento del equipo</p>
        </div>
        <div className="flex gap-1.5 bg-white/5 rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === opt.value
                  ? "bg-primary text-white font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Clientes</p>
                <p className="text-3xl font-bold mt-1">{loadingMetrics ? "—" : (metrics?.totalClients ?? 0)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Oportunidades abiertas</p>
                <p className="text-3xl font-bold mt-1">{loadingMetrics ? "—" : (metrics?.openOpportunities ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{metrics?.totalOpportunities ?? 0} totales</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Tasa de cierre</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? "—" : summary ? `${Number(summary.opportunities?.winRate ?? 0).toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.opportunities?.won ?? 0} ganadas en {period}d
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pedidos ({period}d)</p>
                <p className="text-3xl font-bold mt-1">{loading ? "—" : (summary?.orders?.count ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.orders?.total
                    ? `$${Number(summary.orders.total).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                    : "Sin monto"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Funnel + Tendencia mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader><CardTitle className="text-base">Embudo de oportunidades</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {loadingMetrics ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : oppFunnelData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sin oportunidades</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oppFunnelData} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                  <XAxis type="number" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#555" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ backgroundColor: "#0f1523", border: "1px solid #1f2937", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#888" }}>
                    {oppFunnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader><CardTitle className="text-base">Pedidos por mes — últimos 12 meses</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : monthlyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sin datos de pedidos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="label" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f1523", border: "1px solid #1f2937", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Line
                    type="monotone" dataKey="orders" name="Pedidos"
                    stroke="#6366f1" strokeWidth={2.5}
                    dot={{ fill: "#6366f1", r: 3 }} activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Rendimiento vendedores + Top clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader>
            <CardTitle className="text-base">Rendimiento por vendedor — {period}d</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : salespersonData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Sin datos de vendedores</div>
            ) : (
              <div className="space-y-4">
                {salespersonData.slice(0, 7).map((sp: any) => (
                  <div key={sp.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                      {sp.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm truncate">{sp.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {sp.orders} ped. · {sp.quotes} cot.
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${maxSalesperson > 0 ? (sp.total / maxSalesperson) * 100 : 0}%` }}
                        />
                      </div>
                      {sp.total > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          ${Number(sp.total).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader><CardTitle className="text-base">Top clientes — último año</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : topClients.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Sin pedidos registrados</div>
            ) : (
              <div className="divide-y divide-border/30">
                {topClients.map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/3 transition-colors">
                    <span className="text-xs text-muted-foreground w-4 shrink-0 text-center">{i + 1}</span>
                    <span className="flex-1 text-sm truncate">{c.company_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{c.orders} ped.</span>
                    <span className="text-xs font-mono text-primary shrink-0">
                      ${Number(c.total).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Actividad reciente */}
      {!loadingMetrics && metrics?.recentActivities && metrics.recentActivities.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-white/5 mb-6">
          <CardHeader><CardTitle className="text-base">Actividad reciente</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.recentActivities.slice(0, 6).map((act: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{act.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(act.createdAt), "dd MMM, HH:mm", { locale: es })}
                      {" · "}{ACTIVITY_LABELS[act.type] ?? act.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 5: Clientes nuevos + Clientes sin actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Clientes nuevos (últimos 30 días) ── */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Clientes nuevos
              <span className="text-xs text-muted-foreground font-normal">— últimos 30 días</span>
            </CardTitle>
            <Link href="/clients">
              <span className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                Ver todos <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {newClients.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm px-5">
                No se agregaron clientes en los últimos 30 días
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {newClients.slice(0, 8).map((c: any) => (
                  <Link key={c.id} href={`/clients/${c.id}`}>
                    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/3 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.company_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.salesperson_name || "Sin vendedor asignado"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {c.created_at
                            ? formatDistanceToNow(new Date(c.created_at), { locale: es, addSuffix: true })
                            : "—"}
                        </p>
                        <Badge className={`text-[10px] mt-0.5 ${
                          c.status === "final" ? "bg-emerald-500/15 text-emerald-400" :
                          c.status === "potential" ? "bg-amber-500/15 text-amber-400" :
                          c.status === "prospect" ? "bg-blue-500/15 text-blue-400" :
                          "bg-zinc-500/15 text-zinc-400"
                        }`}>
                          {c.status === "final" ? "Final" :
                           c.status === "potential" ? "Potencial" :
                           c.status === "prospect" ? "Prospecto" : c.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Clientes sin actividad ── */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Clientes sin actividad
            </CardTitle>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              {[15, 30, 60].map(d => (
                <button
                  key={d}
                  onClick={() => setDormantDays(d)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    dormantDays === d
                      ? "bg-amber-500/20 text-amber-300 font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dormantClients.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm px-5">
                ✓ Todos los clientes tienen actividad reciente
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {dormantClients.slice(0, 8).map((c: any) => {
                  const lastTouchDate = c.last_touch && c.last_touch !== "1970-01-01T00:00:00.000Z"
                    ? new Date(c.last_touch)
                    : null;
                  return (
                    <Link key={c.id} href={`/clients/${c.id}`}>
                      <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/3 transition-colors cursor-pointer">
                        <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-amber-400/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.company_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.salesperson_name || "Sin vendedor"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {lastTouchDate ? (
                            <p className="text-xs text-amber-400/80">
                              Hace {formatDistanceToNow(lastTouchDate, { locale: es })}
                            </p>
                          ) : (
                            <p className="text-xs text-red-400/70">Sin contacto</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
