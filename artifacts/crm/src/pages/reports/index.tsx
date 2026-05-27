import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, DollarSign, Trophy, Users, FileSpreadsheet, X, FileText, ShoppingCart } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";

const API = import.meta.env.VITE_API_URL || "";
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador", sent: "Enviada", approved: "Aprobada",
  rejected: "Rechazada", partial: "Parcial", expired: "Vencida",
};

const getQuoteStatusBadge = (q: any): { label: string; color: string } => {
  if (q.quoteStatus === "FINALIZADA") return { label: "Finalizada",  color: "bg-green-500/20 text-green-300" };
  if (q.quoteStatus === "PERDIDA")    return { label: "Perdida",     color: "bg-red-500/20 text-red-300" };
  if (q.quoteStatus === "DESISTIDA")  return { label: "Desistida",   color: "bg-slate-500/20 text-slate-300" };
  const colors: Record<string, string> = {
    approved: "bg-green-500/20 text-green-300",
    sent:     "bg-blue-500/20 text-blue-300",
    rejected: "bg-red-500/20 text-red-300",
  };
  return { label: STATUS_LABELS[q.status] || q.status, color: colors[q.status] || "bg-gray-500/20 text-gray-300" };
};

export default function Reports() {
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<any>({ quotes: {}, orders: {}, opportunities: {} });
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [bySalesperson, setBySalesperson] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [drillSalesperson, setDrillSalesperson] = useState<any>(null);
  const [drillQuotes, setDrillQuotes] = useState<any[]>([]);
  const [drillOrders, setDrillOrders] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const fmt = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n || 0);

  useEffect(() => {
    const fetchAll = async () => {
      const opts = { credentials: "include" as const };
      const [a, b, c, d, e, f] = await Promise.all([
        fetch(`${API}/api/reports/sales-summary?days=${days}`, opts).then(r => r.json()),
        fetch(`${API}/api/reports/sales-by-month?months=12`, opts).then(r => r.json()),
        fetch(`${API}/api/reports/sales-by-salesperson?days=${days}`, opts).then(r => r.json()),
        fetch(`${API}/api/reports/pipeline-funnel`, opts).then(r => r.json()),
        fetch(`${API}/api/reports/top-clients?days=${days}`, opts).then(r => r.json()),
        fetch(`${API}/api/reports/activities-by-type?days=${days}`, opts).then(r => r.json()),
      ]);
      setSummary(a);
      setByMonth(b.data || []);
      setBySalesperson(c.data || []);
      setFunnel(d.data || []);
      setTopClients(e.data || []);
      setActivities(f.data || []);
      setDrillSalesperson(null);
    };
    fetchAll();
  }, [days]);

  const handleBarClick = async (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const sp = data.activePayload[0].payload;
    if (!sp?.id) return;
    setDrillSalesperson(sp);
    setDrillLoading(true);
    try {
      const opts = { credentials: "include" as const };
      const [qRes, oRes] = await Promise.all([
        fetch(`${API}/api/quotes?salespersonId=${sp.id}&limit=50`, opts).then(r => r.json()),
        fetch(`${API}/api/orders?salespersonId=${sp.id}&limit=50`, opts).then(r => r.json()),
      ]);
      setDrillQuotes(qRes.data || []);
      setDrillOrders(oRes.data || []);
    } finally {
      setDrillLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Reportes</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/api/reports/export/sales.xlsx?days=${days}`, "_blank")}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Ventas
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/api/reports/export/quotes.xlsx?days=${days}`, "_blank")}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Cotizaciones
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`${API}/api/reports/export/pipeline.xlsx`, "_blank")}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Pipeline
            </Button>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="365">Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" />Ventas</div>
            <div className="text-2xl font-bold mt-1">${fmt(summary.orders?.total)}</div>
            <div className="text-xs text-muted-foreground">{summary.orders?.count} pedidos</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-4 w-4" />Cotizado</div>
            <div className="text-2xl font-bold mt-1">${fmt(summary.quotes?.total)}</div>
            <div className="text-xs text-muted-foreground">{summary.quotes?.count} cotizaciones</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Trophy className="h-4 w-4" />Win rate</div>
            <div className="text-2xl font-bold mt-1">{(summary.opportunities?.winRate || 0).toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{summary.opportunities?.won}/{summary.opportunities?.count} oportunidades</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" />Vendedores activos</div>
            <div className="text-2xl font-bold mt-1">{bySalesperson.filter(s => s.orders > 0).length}</div>
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Ventas por mes</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Embudo de oportunidades</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={funnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#888" fontSize={11} />
                  <YAxis type="category" dataKey="status" stroke="#888" fontSize={11} width={100} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Ranking de vendedores</CardTitle>
                <span className="text-xs text-muted-foreground">Clic para ver detalle</span>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={bySalesperson.slice(0, 10)}
                  onClick={handleBarClick}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" fontSize={10} angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                  <Bar
                    dataKey="total"
                    radius={[4, 4, 0, 0]}
                  >
                    {bySalesperson.slice(0, 10).map((entry, i) => (
                      <Cell
                        key={i}
                        fill={drillSalesperson?.id === entry.id ? "#f59e0b" : "#8b5cf6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Actividades por tipo</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={activities} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label>
                    {activities.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {drillSalesperson && (
          <Card className="border-yellow-500/40 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-yellow-400" />
                  <CardTitle className="text-sm">Detalle: {drillSalesperson.name}</CardTitle>
                  <Badge variant="outline" className="text-yellow-300 border-yellow-500/40 text-xs">
                    {drillSalesperson.quotes} cotizaciones · {drillSalesperson.orders} pedidos · ${fmt(drillSalesperson.total)}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDrillSalesperson(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {drillLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <FileText className="h-3 w-3" />Últimas cotizaciones
                    </p>
                    <div className="space-y-1">
                      {drillQuotes.slice(0, 8).map((q: any) => (
                        <Link key={q.id} href={`/quotes/${q.id}`}>
                          <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 cursor-pointer text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{q.number || `#${q.id}`}</span>
                              <span className="truncate max-w-[140px]">{q.clientName || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={getQuoteStatusBadge(q).color} style={{ fontSize: "10px" }}>
                                {getQuoteStatusBadge(q).label}
                              </Badge>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {drillQuotes.length === 0 && <p className="text-xs text-muted-foreground py-2">Sin cotizaciones en el período</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" />Últimos pedidos
                    </p>
                    <div className="space-y-1">
                      {drillOrders.slice(0, 8).map((o: any) => (
                        <Link key={o.id} href={`/orders/${o.id}`}>
                          <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 cursor-pointer text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{o.number || `#${o.id}`}</span>
                              <span className="truncate max-w-[140px]">{o.clientName || "—"}</span>
                            </div>
                            <span className="font-mono text-xs text-primary shrink-0">${fmt(Number(o.total || 0))}</span>
                          </div>
                        </Link>
                      ))}
                      {drillOrders.length === 0 && <p className="text-xs text-muted-foreground py-2">Sin pedidos en el período</p>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 clientes</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-right p-2">Pedidos</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {topClients.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => window.location.href = `/clients/${c.id}`}>
                    <td className="p-2">{c.company_name}</td>
                    <td className="p-2 text-right">{c.orders}</td>
                    <td className="p-2 text-right font-mono">${fmt(c.total)}</td>
                  </tr>
                ))}
                {!topClients.length && (
                  <tr><td colSpan={3} className="text-center p-4 text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
