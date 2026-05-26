import { useState } from "react";
import { useGetDashboardMetrics } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { StatCard } from "@/components/stat-card";
import { Users, AlertCircle, LayoutDashboard, ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getOppStatusLabel } from "@/lib/translations";
import { ManagerTasksTab } from "@/components/manager-tasks-tab";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: metrics, isLoading } = useGetDashboardMetrics();
  const [activeTab, setActiveTab] = useState<"overview" | "tasks">("overview");
  const isManager = user?.role === "gerente" || user?.role === "admin" || user?.role === "gerente_comercial";

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!metrics) return (
    <AppLayout>
      <div className="flex flex-col h-[50vh] items-center justify-center gap-4">
        <p className="text-muted-foreground">No se pudieron cargar las métricas.</p>
        <button className="text-primary text-sm underline" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    </AppLayout>
  );

  const oppData = Object.entries(metrics.opportunitiesByStatus || {}).map(([key, value]) => ({
    name: getOppStatusLabel(key),
    total: value as number,
  }));

  return (
    <AppLayout>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard Comercial</h1>
          <p className="text-muted-foreground mt-1">Resumen de actividad y métricas clave.</p>
        </div>
        {isManager && (
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutDashboard className="w-4 h-4" />Resumen
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "tasks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListTodo className="w-4 h-4" />Tareas de vendedores
            </button>
          </div>
        )}
      </div>

      {isManager && activeTab === "tasks" && (
        <ManagerTasksTab />
      )}

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <StatCard title="Total Clientes" value={metrics.totalClients} icon={<Users className="w-6 h-6" />} delay={0.1} />
            <StatCard title="Pedidos de Cotización" value={metrics.quoteRequests} icon={<AlertCircle className="w-6 h-6" />} delay={0.2} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-white/5">
              <CardHeader><CardTitle>Oportunidades por Estado</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={oppData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ backgroundColor: "#0f1523", border: "1px solid #1f2937", borderRadius: "8px" }} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {oppData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === oppData.length - 1 ? "#5c60f5" : "#374151"} />
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
        </>
      )}
    </AppLayout>
  );
}
