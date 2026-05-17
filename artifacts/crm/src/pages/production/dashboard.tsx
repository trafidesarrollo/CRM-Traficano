import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Factory, TrendingUp, Activity, CheckCircle2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

export default function ProductionDashboard() {
  const [data, setData] = useState<any>(null);

  async function load() {
    try {
      const r = await fetch(`${API}/api/production/dashboard`, { credentials: "include" });
      if (r.ok) setData(await r.json());
    } catch { /* silenciar errores de red */ }
  }
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  if (!data) return <AppLayout><div className="p-8 text-muted-foreground">Cargando…</div></AppLayout>;

  const { counts, totals, kpi, byLocation } = data;

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/production"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <Factory className="w-7 h-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-display font-bold">KPIs de Producción</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendientes</div><div className="text-3xl font-bold font-mono">{counts.pending}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">En proceso</div><div className="text-3xl font-bold font-mono text-blue-400">{counts.inProgress}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Completadas</div><div className="text-3xl font-bold font-mono text-green-400">{counts.completed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Canceladas</div><div className="text-3xl font-bold font-mono text-red-400">{counts.cancelled}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><TrendingUp className="w-4 h-4" />% Avance global</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono">{kpi.progressPct.toFixed(1)}%</div>
            <div className="h-2 bg-white/5 rounded overflow-hidden mt-2"><div className="h-full bg-primary" style={{ width: `${Math.min(100, kpi.progressPct)}%` }} /></div>
            <div className="text-xs text-muted-foreground mt-2">{totals.produced.toFixed(0)} / {totals.planned.toFixed(0)} unidades</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Activity className="w-4 h-4" />Unidades por hora</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono text-blue-400">{kpi.unitsPerHour.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-2">según tiempo total registrado</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-4 h-4" />Eficiencia (calidad)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono text-green-400">{kpi.efficiency.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-2">producido / (producido + rechazado)</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Producción por ubicación</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-muted-foreground text-left">
              <tr>
                <th className="p-3">Ubicación</th>
                <th className="p-3 text-right">Órdenes</th>
                <th className="p-3 text-right">Plan</th>
                <th className="p-3 text-right">Producido</th>
                <th className="p-3 text-right">Rechazado</th>
                <th className="p-3">Avance</th>
              </tr>
            </thead>
            <tbody>
              {byLocation.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin datos</td></tr>}
              {byLocation.map((b: any) => {
                const pct = b.planned > 0 ? Math.min(100, (b.produced / b.planned) * 100) : 0;
                return (
                  <tr key={b.locationId || "none"} className="border-b border-border/30">
                    <td className="p-3 font-medium">{b.locationName}</td>
                    <td className="p-3 text-right font-mono">{b.orders}</td>
                    <td className="p-3 text-right font-mono">{b.planned.toFixed(0)}</td>
                    <td className="p-3 text-right font-mono text-green-400">{b.produced.toFixed(0)}</td>
                    <td className="p-3 text-right font-mono text-red-400">{b.rejected.toFixed(0)}</td>
                    <td className="p-3 min-w-[140px]"><div className="h-2 bg-white/5 rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div><div className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(0)}%</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
