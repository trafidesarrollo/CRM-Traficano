import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, DollarSign, Trophy, Users } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const API = import.meta.env.VITE_API_URL || "";
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function Reports() {
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<any>({ quotes: {}, orders: {}, opportunities: {} });
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [bySalesperson, setBySalesperson] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const headers = { credentials: "include" as const };
      const [a, b, c, d, e, f] = await Promise.all([
        fetch(`${API}/api/reports/sales-summary?days=${days}`, headers).then(r => r.json()),
        fetch(`${API}/api/reports/sales-by-month?months=12`, headers).then(r => r.json()),
        fetch(`${API}/api/reports/sales-by-salesperson?days=${days}`, headers).then(r => r.json()),
        fetch(`${API}/api/reports/pipeline-funnel`, headers).then(r => r.json()),
        fetch(`${API}/api/reports/top-clients?days=${days}`, headers).then(r => r.json()),
        fetch(`${API}/api/reports/activities-by-type?days=${days}`, headers).then(r => r.json()),
      ]);
      setSummary(a); setByMonth(b.data || []); setBySalesperson(c.data || []);
      setFunnel(d.data || []); setTopClients(e.data || []); setActivities(f.data || []);
    };
    fetchAll();
  }, [days]);

  const fmt = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n || 0);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><BarChart3 className="h-6 w-6" /><h1 className="text-2xl font-bold">Reportes</h1></div>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" />Ventas</div><div className="text-2xl font-bold mt-1">${fmt(summary.orders?.total)}</div><div className="text-xs text-muted-foreground">{summary.orders?.count} pedidos</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-4 w-4" />Cotizado</div><div className="text-2xl font-bold mt-1">${fmt(summary.quotes?.total)}</div><div className="text-xs text-muted-foreground">{summary.quotes?.count} cotizaciones</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Trophy className="h-4 w-4" />Win rate</div><div className="text-2xl font-bold mt-1">{(summary.opportunities?.winRate || 0).toFixed(1)}%</div><div className="text-xs text-muted-foreground">{summary.opportunities?.won}/{summary.opportunities?.count} oportunidades</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" />Vendedores activos</div><div className="text-2xl font-bold mt-1">{bySalesperson.filter(s => s.orders > 0).length}</div></CardContent></Card>
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
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} />
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
            <CardHeader><CardTitle className="text-sm">Ranking de vendedores</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bySalesperson.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" fontSize={10} angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                  <Bar dataKey="total" fill="#8b5cf6" />
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

        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 clientes</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground"><th className="text-left p-2">Cliente</th><th className="text-right p-2">Pedidos</th><th className="text-right p-2">Total</th></tr></thead>
              <tbody>
                {topClients.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">{c.company_name}</td>
                    <td className="p-2 text-right">{c.orders}</td>
                    <td className="p-2 text-right font-mono">${fmt(c.total)}</td>
                  </tr>
                ))}
                {!topClients.length && <tr><td colSpan={3} className="text-center p-4 text-muted-foreground">Sin datos</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
