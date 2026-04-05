import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle, SkipForward, AlertTriangle, Play, Calendar, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}${url}`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

const STATUS_BADGE: Record<string, { label: string; class: string; icon: any }> = {
  pending: { label: "Pendiente", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock },
  sent: { label: "Enviado", class: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  skipped: { label: "Omitido", class: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: SkipForward },
  failed: { label: "Fallido", class: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  cancelled: { label: "Cancelado", class: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: XCircle },
};

export default function Followups() {
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [processing, setProcessing] = useState(false);

  const stats = useFetch<any>("/api/followups/stats");
  const rules = useFetch<any[]>("/api/followups/rules");
  const scheduled = useFetch<any[]>(`/api/followups/scheduled?status=${tab === "all" ? "" : tab}`);

  useEffect(() => { scheduled.refetch(); }, [tab]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${BASE}/api/followups/process`, { method: "POST", credentials: "include" });
      const result = await res.json();
      toast({ title: "Procesamiento completo", description: `Enviados: ${result.sent}, Omitidos: ${result.skipped}, Fallidos: ${result.failed}` });
      stats.refetch();
      scheduled.refetch();
    } catch { toast({ title: "Error al procesar", variant: "destructive" }); }
    setProcessing(false);
  };

  const handleCancel = async (id: number) => {
    try {
      await fetch(`${BASE}/api/followups/scheduled/${id}/cancel`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelado por usuario" }),
      });
      toast({ title: "Seguimiento cancelado" });
      scheduled.refetch();
      stats.refetch();
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Motor de Seguimiento</h1>
          <p className="text-muted-foreground mt-1">Seguimientos automáticos programados por reglas.</p>
        </div>
        <Button onClick={handleProcess} disabled={processing}>
          <Play className="w-4 h-4 mr-2" />
          {processing ? "Procesando..." : "Procesar Pendientes"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.data?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.data?.sent || 0}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.data?.dueToday || 0}</p>
            <p className="text-xs text-muted-foreground">Vencidos Hoy</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.data?.dueThisWeek || 0}</p>
            <p className="text-xs text-muted-foreground">Esta Semana</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 bg-card/50 border-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Seguimientos Programados</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => scheduled.refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending">Pendientes</TabsTrigger>
                <TabsTrigger value="sent">Enviados</TabsTrigger>
                <TabsTrigger value="skipped">Omitidos</TabsTrigger>
                <TabsTrigger value="all">Todos</TabsTrigger>
              </TabsList>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {scheduled.loading ? (
                  <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
                ) : (scheduled.data || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay seguimientos en esta categoría</p>
                ) : (
                  (scheduled.data || []).map((f: any) => {
                    const badge = STATUS_BADGE[f.status] || STATUS_BADGE.pending;
                    const StatusIcon = badge.icon;
                    return (
                      <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{f.ruleName || `Regla #${f.ruleId}`}</span>
                            <Badge variant="outline" className={badge.class}>
                              <StatusIcon className="w-3 h-3 mr-1" />{badge.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">#{f.attemptNumber}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {f.clientName && <span>{f.clientName}</span>}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(f.scheduledDate), "dd MMM yyyy HH:mm", { locale: es })}
                            </span>
                            {f.skipReason && <span className="text-yellow-400">{f.skipReason}</span>}
                            {f.errorMessage && <span className="text-red-400">{f.errorMessage}</span>}
                          </div>
                          {f.generatedSubject && <p className="text-xs mt-1 text-muted-foreground italic">{f.generatedSubject}</p>}
                        </div>
                        {f.status === "pending" && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleCancel(f.id)}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle>Reglas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(rules.data || []).map((rule: any) => (
                <div key={rule.id} className={`p-3 rounded-xl transition-colors ${rule.isActive ? "bg-white/5" : "bg-white/2 opacity-50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{rule.name}</span>
                    <Badge variant="outline" className={rule.isActive ? "bg-green-500/10 text-green-400 border-green-500/20" : ""}>
                      {rule.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Demora: {rule.delayDays}d</span>
                    <span>Máx: {rule.maxFollowups}x</span>
                  </div>
                </div>
              ))}
              {(rules.data || []).length === 0 && (
                <p className="text-center text-muted-foreground py-4">No hay reglas configuradas</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
