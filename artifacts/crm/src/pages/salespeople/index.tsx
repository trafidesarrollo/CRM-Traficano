import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGetSalespeople, useCreateSalesperson, useDeleteSalesperson } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Mail, Phone, Eye, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { getFunctionalRoleLabel, getFunctionalRoleColor, getOppStatusLabel } from "@/lib/translations";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Salespeople() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", userId: "", functionalRole: "" });
  const [panelSp, setPanelSp] = useState<any>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [panelActivities, setPanelActivities] = useState<any[]>([]);
  const [panelOpps, setPanelOpps] = useState<any[]>([]);

  const { data: salespeople, isLoading, refetch } = useGetSalespeople();
  const createMut = useCreateSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor creado" }); setOpen(false); refetch(); setForm({ name: "", email: "", phone: "", userId: "", functionalRole: "" }); },
      onError: () => toast({ title: "Error al crear vendedor", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor eliminado" }); refetch(); },
    },
  });

  const [activityCounts, setActivityCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (salespeople && salespeople.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      fetch(`${API_BASE}/api/activities`, { credentials: "include" })
        .then(r => r.json())
        .then((activities: any[]) => {
          const counts: Record<number, number> = {};
          activities.forEach(a => {
            if (a.salespersonId && a.completedAt && new Date(a.completedAt) >= new Date(sevenDaysAgo)) {
              counts[a.salespersonId] = (counts[a.salespersonId] || 0) + 1;
            }
          });
          setActivityCounts(counts);
        })
        .catch(() => {});
    }
  }, [salespeople]);

  const openPanel = async (sp: any) => {
    setPanelSp(sp);
    try {
      const [cpRes, actRes, oppsRes] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/commercial-plan`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/activities?salespersonId=${sp.id}`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/opportunities?hunterId=${sp.id}&limit=50`, { credentials: "include" }).then(r => r.json()),
      ]);
      setPanelData(cpRes);
      setPanelActivities(Array.isArray(actRes) ? actRes.slice(-10).reverse() : []);
      const farmerOpps = await fetch(`${API_BASE}/api/opportunities?farmerId=${sp.id}&limit=50`, { credentials: "include" }).then(r => r.json());
      const allOpps = [...(oppsRes.data || []), ...(farmerOpps.data || [])];
      const uniqueOpps = Array.from(new Map(allOpps.map((o: any) => [o.id, o])).values());
      setPanelOpps(uniqueOpps.filter((o: any) => !["won", "lost", "closed"].includes(o.status)));
    } catch {}
  };

  const handleUpdateRole = async (spId: number, role: string) => {
    try {
      await fetch(`${API_BASE}/api/salespeople/${spId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ functionalRole: role || null }),
      });
      refetch();
      toast({ title: "Rol actualizado" });
    } catch {
      toast({ title: "Error al actualizar rol", variant: "destructive" });
    }
  };

  const filtered = (salespeople || []).filter((s: any) =>
    `${s.name} ${s.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const getPanelMetrics = () => {
    if (!panelData || !panelSp) return null;
    const role = panelSp.functionalRole;
    if (role === "hunter") {
      return panelData.hunterMetrics?.find((m: any) => m.salespersonId === panelSp.id);
    } else if (role === "farmer") {
      return panelData.farmerMetrics?.find((m: any) => m.salespersonId === panelSp.id);
    } else if (role === "admin_ventas") {
      return panelData.adminMetrics?.find((m: any) => m.salespersonId === panelSp.id);
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Vendedores</h1>
          <p className="text-muted-foreground mt-1">{salespeople?.length || 0} vendedores registrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Vendedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Vendedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre completo</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div>
                <Label>Rol funcional</Label>
                <Select value={form.functionalRole} onValueChange={(v) => setForm({ ...form, functionalRole: v })}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    <SelectItem value="hunter">Hunter</SelectItem>
                    <SelectItem value="farmer">Farmer</SelectItem>
                    <SelectItem value="admin_ventas">Admin Ventas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>ID Usuario (opcional)</Label><Input type="number" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} /></div>
              <Button className="w-full" disabled={createMut.isPending || !form.name} onClick={() => createMut.mutate({ data: { ...form, userId: form.userId ? parseInt(form.userId) : undefined, functionalRole: form.functionalRole && form.functionalRole !== "none" ? form.functionalRole : undefined } as any })}>
                {createMut.isPending ? "Creando..." : "Crear Vendedor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar vendedores..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No se encontraron vendedores</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sp: any) => (
            <Card key={sp.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {sp.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{sp.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getFunctionalRoleColor(sp.functionalRole)}>
                          {getFunctionalRoleLabel(sp.functionalRole)}
                        </Badge>
                        {activityCounts[sp.id] ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Activity className="w-3 h-3" />{activityCounts[sp.id]} esta semana
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => openPanel(sp)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: sp.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {sp.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" />{sp.email}</div>}
                  {sp.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" />{sp.phone}</div>}
                </div>
                <div className="mt-3 pt-3 border-t border-border/30">
                  <Select value={sp.functionalRole || "none"} onValueChange={(v) => handleUpdateRole(sp.id, v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      <SelectItem value="hunter">Hunter</SelectItem>
                      <SelectItem value="farmer">Farmer</SelectItem>
                      <SelectItem value="admin_ventas">Admin Ventas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!panelSp} onOpenChange={(v) => { if (!v) setPanelSp(null); }}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{panelSp?.name}</SheetTitle>
          </SheetHeader>
          {panelSp && (
            <div className="mt-6 space-y-6">
              <div>
                <Badge variant="outline" className={getFunctionalRoleColor(panelSp.functionalRole)}>
                  {getFunctionalRoleLabel(panelSp.functionalRole)}
                </Badge>
              </div>

              {(() => {
                const metrics = getPanelMetrics();
                if (!metrics) return <p className="text-sm text-muted-foreground">Asigná un rol funcional para ver métricas.</p>;
                
                if (panelSp.functionalRole === "hunter") return (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Métricas Hunter</h4>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Llamadas esta semana</span>
                        <span>{metrics.callsThisWeek} / {metrics.callsWeekTarget}</span>
                      </div>
                      <Progress value={Math.min((metrics.callsThisWeek / metrics.callsWeekTarget) * 100, 100)} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Reuniones este mes</span>
                        <span>{metrics.meetingsThisMonth} / {metrics.meetingsMonthTarget}</span>
                      </div>
                      <Progress value={Math.min((metrics.meetingsThisMonth / metrics.meetingsMonthTarget) * 100, 100)} />
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold">{metrics.leadsGeneratedThisMonth}</p>
                      <p className="text-xs text-muted-foreground">Leads generados este mes</p>
                    </div>
                  </div>
                );

                if (panelSp.functionalRole === "farmer") return (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Métricas Farmer</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-3 rounded-lg ${metrics.leadsAwaitingResponse === 0 ? "bg-green-500/10" : metrics.leadsAwaitingResponse <= 2 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                        <p className="text-2xl font-bold">{metrics.leadsAwaitingResponse}</p>
                        <p className="text-xs text-muted-foreground">Leads sin responder (&gt;2h)</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-2xl font-bold">{metrics.avgResponseTimeHours}h</p>
                        <p className="text-xs text-muted-foreground">Tiempo respuesta prom.</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-2xl font-bold">{metrics.closeRate}%</p>
                        <p className="text-xs text-muted-foreground">Tasa de cierre</p>
                      </div>
                      <div className={`p-3 rounded-lg ${metrics.staleOpportunities > 0 ? "bg-red-500/10" : "bg-white/5"}`}>
                        <p className="text-2xl font-bold">{metrics.staleOpportunities}</p>
                        <p className="text-xs text-muted-foreground">Sin actividad 3+ días</p>
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-lg font-bold">{metrics.activeOpportunities}</p>
                      <p className="text-xs text-muted-foreground">Oportunidades activas</p>
                    </div>
                  </div>
                );

                if (panelSp.functionalRole === "admin_ventas") return (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Métricas Admin Ventas</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-2xl font-bold">{metrics.pendingQuotes}</p>
                        <p className="text-xs text-muted-foreground">Cotizaciones pendientes</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-2xl font-bold">{metrics.avgQuoteTurnaroundHours}h</p>
                        <p className="text-xs text-muted-foreground">Tiempo prom. cotización</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Cotizadas en &lt;24h</span>
                        <span>{metrics.quotesOnTimeRate}%</span>
                      </div>
                      <Progress value={metrics.quotesOnTimeRate} />
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-lg font-bold">{metrics.quotesThisMonth}</p>
                      <p className="text-xs text-muted-foreground">Cotizaciones este mes</p>
                    </div>
                  </div>
                );

                return null;
              })()}

              <div>
                <h4 className="text-sm font-semibold mb-3">Actividades recientes</h4>
                {panelActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividades recientes</p>
                ) : (
                  <div className="space-y-2">
                    {panelActivities.map((a: any) => (
                      <div key={a.id} className="flex gap-3 p-2 rounded-lg bg-white/5 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                        <div>
                          <p className="font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.type} - {a.completedAt ? format(new Date(a.completedAt), "dd MMM, HH:mm", { locale: es }) : "pendiente"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Oportunidades activas</h4>
                {panelOpps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin oportunidades activas</p>
                ) : (
                  <div className="space-y-2">
                    {panelOpps.map((o: any) => (
                      <div key={o.id} className="flex justify-between items-center p-2 rounded-lg bg-white/5 text-sm">
                        <div>
                          <p className="font-medium">{o.title}</p>
                          <Badge variant="outline" className="text-xs mt-1">{getOppStatusLabel(o.status)}</Badge>
                        </div>
                        {o.estimatedValue && (
                          <span className="font-semibold">{o.currency || "ARS"} {Number(o.estimatedValue).toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
