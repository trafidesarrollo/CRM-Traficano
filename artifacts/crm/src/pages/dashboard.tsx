import { useState, useEffect } from "react";
import { useGetDashboardMetrics } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { StatCard } from "@/components/stat-card";
import { Users, Briefcase, Inbox, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getOppStatusLabel } from "@/lib/translations";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Dashboard() {
  const { data: metrics, isLoading } = useGetDashboardMetrics();
  const [cpData, setCpData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard/commercial-plan`, { credentials: "include" })
      .then(r => r.json())
      .then(setCpData)
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!metrics) return null;

  const oppData = Object.entries(metrics.opportunitiesByStatus || {}).map(([key, value]) => ({
    name: getOppStatusLabel(key),
    total: value as number,
  }));

  const funnelData = cpData?.pipelineFunnel;
  const funnelStages = funnelData ? [
    { name: "Leads", value: funnelData.leadsNew, color: "#6366f1" },
    { name: "Cotiz. Solic.", value: funnelData.quoteRequested, color: "#8b5cf6" },
    { name: "Cotizado", value: funnelData.quoted, color: "#a78bfa" },
    { name: "Negociando", value: funnelData.negotiating, color: "#c4b5fd" },
    { name: "Ganado", value: funnelData.won, color: "#22c55e" },
  ] : [];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Dashboard Comercial</h1>
        <p className="text-muted-foreground mt-1">Resumen de actividad y métricas clave.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Clientes" value={metrics.totalClients} icon={<Users className="w-6 h-6" />} delay={0.1} />
        <StatCard title="Oportunidades Abiertas" value={metrics.openOpportunities} icon={<Briefcase className="w-6 h-6" />} delay={0.2} description={`${metrics.wonOpportunities} ganadas históricamente`} />
        <StatCard title="Emails Pendientes" value={metrics.pendingEmails} icon={<Inbox className="w-6 h-6" />} delay={0.3} description={`De un total de ${metrics.totalEmails}`} />
        <StatCard title="Pedidos de Cotización" value={metrics.quoteRequests} icon={<AlertCircle className="w-6 h-6" />} delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader><CardTitle>Oportunidades por Estado</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oppData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#0f1523', border: '1px solid #1f2937', borderRadius: '8px' }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {oppData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === oppData.length - 1 ? '#5c60f5' : '#374151'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5 flex flex-col">
          <CardHeader><CardTitle>Actividad Reciente</CardTitle></CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {metrics.recentActivities?.slice(0, 5).map((act: any, i: number) => (
                <div key={i} className="flex gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">{act.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(act.createdAt), "dd MMM, HH:mm", { locale: es })} - {act.type}</p>
                  </div>
                </div>
              ))}
              {(!metrics.recentActivities || metrics.recentActivities.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No hay actividad reciente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {cpData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-display font-bold">Plan Comercial</h2>

          {cpData.hunterMetrics?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Hunters</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cpData.hunterMetrics.map((h: any) => (
                  <Card key={h.salespersonId} className="bg-card/50 backdrop-blur-sm border-white/5">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="font-semibold">{h.name}</h4>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Llamadas semana</span>
                          <span className="font-medium">{h.callsThisWeek} / {h.callsWeekTarget}</span>
                        </div>
                        <Progress value={Math.min((h.callsThisWeek / h.callsWeekTarget) * 100, 100)} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Reuniones mes</span>
                          <span className="font-medium">{h.meetingsThisMonth} / {h.meetingsMonthTarget}</span>
                        </div>
                        <Progress value={Math.min((h.meetingsThisMonth / h.meetingsMonthTarget) * 100, 100)} />
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <p className="text-2xl font-bold">{h.leadsGeneratedThisMonth}</p>
                        <p className="text-xs text-muted-foreground">Leads generados este mes</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {cpData.farmerMetrics?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Farmers</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cpData.farmerMetrics.map((f: any) => (
                  <Card key={f.salespersonId} className="bg-card/50 backdrop-blur-sm border-white/5">
                    <CardContent className="p-5 space-y-3">
                      <h4 className="font-semibold">{f.name}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`p-3 rounded-lg text-center ${f.leadsAwaitingResponse === 0 ? "bg-green-500/10" : f.leadsAwaitingResponse <= 2 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                          <p className="text-2xl font-bold">{f.leadsAwaitingResponse}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">Leads sin respuesta &gt;2h</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg text-center">
                          <p className="text-2xl font-bold">{f.avgResponseTimeHours}h</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">Tiempo respuesta prom.</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg text-center">
                          <p className="text-2xl font-bold">{f.closeRate}%</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">Tasa de cierre</p>
                        </div>
                        <div className={`p-3 rounded-lg text-center ${f.staleOpportunities > 0 ? "bg-red-500/10" : "bg-white/5"}`}>
                          <p className="text-2xl font-bold">{f.staleOpportunities}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">Sin actividad 3+ días</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {cpData.adminMetrics?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Admin Ventas</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cpData.adminMetrics.map((a: any) => (
                  <Card key={a.salespersonId} className="bg-card/50 backdrop-blur-sm border-white/5">
                    <CardContent className="p-5 space-y-3">
                      <h4 className="font-semibold">{a.name}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white/5 rounded-lg text-center">
                          <p className="text-2xl font-bold">{a.pendingQuotes}</p>
                          <p className="text-[10px] text-muted-foreground">Cotiz. pendientes</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg text-center">
                          <p className="text-2xl font-bold">{a.avgQuoteTurnaroundHours}h</p>
                          <p className="text-[10px] text-muted-foreground">Tiempo prom.</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Cotizadas en &lt;24h</span>
                          <span className="font-medium">{a.quotesOnTimeRate}%</span>
                        </div>
                        <Progress value={a.quotesOnTimeRate} />
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <p className="text-lg font-bold">{a.quotesThisMonth}</p>
                        <p className="text-xs text-muted-foreground">Cotizaciones este mes</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {funnelStages.length > 0 && (
            <Card className="bg-card/50 backdrop-blur-sm border-white/5">
              <CardHeader><CardTitle>Embudo de Conversión</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {funnelStages.map((stage, i) => {
                    const maxVal = Math.max(...funnelStages.map(s => s.value), 1);
                    const width = Math.max((stage.value / maxVal) * 100, 8);
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm w-28 text-right text-muted-foreground shrink-0">{stage.name}</span>
                        <div className="flex-1">
                          <div className="h-8 rounded-lg flex items-center px-3 text-sm font-medium text-white" style={{ width: `${width}%`, backgroundColor: stage.color, minWidth: "60px" }}>
                            {stage.value}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
