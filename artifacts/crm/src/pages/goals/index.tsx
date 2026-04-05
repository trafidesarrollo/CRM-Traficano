import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFunctionalRoleLabel, getFunctionalRoleColor } from "@/lib/translations";

const API_BASE = import.meta.env.VITE_API_URL || "";

const metricLabels: Record<string, string> = {
  calls: "Llamadas",
  meetings: "Reuniones",
  quotes: "Cotizaciones",
  close_rate: "Tasa de cierre (%)",
};

const periodLabels: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
};

export default function Goals() {
  const { toast } = useToast();
  const [goals, setGoals] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [cpData, setCpData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    salespersonId: "",
    period: "weekly",
    metricType: "calls",
    targetValue: "",
    startDate: "",
    endDate: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [goalsRes, spRes, cpRes] = await Promise.all([
        fetch(`${API_BASE}/api/goals`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/salespeople`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/dashboard/commercial-plan`, { credentials: "include" }).then(r => r.json()),
      ]);
      setGoals(Array.isArray(goalsRes) ? goalsRes : []);
      setSalespeople(Array.isArray(spRes) ? spRes : []);
      setCpData(cpRes);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getSpName = (id: number) => salespeople.find(s => s.id === id)?.name || "Desconocido";
  const getSp = (id: number) => salespeople.find(s => s.id === id);

  const getCurrentValue = (salespersonId: number, metricType: string): number => {
    if (!cpData) return 0;
    const allMetrics = [...(cpData.hunterMetrics || []), ...(cpData.farmerMetrics || []), ...(cpData.adminMetrics || [])];
    const m = allMetrics.find((x: any) => x.salespersonId === salespersonId);
    if (!m) return 0;

    switch (metricType) {
      case "calls": return m.callsThisWeek || 0;
      case "meetings": return m.meetingsThisMonth || 0;
      case "quotes": return m.quotesThisMonth || 0;
      case "close_rate": return m.closeRate || 0;
      default: return 0;
    }
  };

  const handleCreate = async () => {
    if (!form.salespersonId || form.salespersonId === "none" || !form.targetValue || !form.startDate || !form.endDate) {
      toast({ title: "Completá todos los campos", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          salespersonId: parseInt(form.salespersonId),
          period: form.period,
          metricType: form.metricType,
          targetValue: form.targetValue,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Meta creada" });
      setDialogOpen(false);
      setForm({ salespersonId: "", period: "weekly", metricType: "calls", targetValue: "", startDate: "", endDate: "" });
      fetchData();
    } catch {
      toast({ title: "Error al crear meta", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/goals/${id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Meta eliminada" });
      fetchData();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Target className="w-8 h-8 text-primary" />Metas
          </h1>
          <p className="text-muted-foreground mt-1">Configuración de objetivos por vendedor</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Nueva Meta
        </Button>
      </div>

      {loading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No hay metas configuradas todavía</p>
          <p className="text-sm mt-1">Creá la primera meta para empezar a trackear objetivos</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="py-3 px-3 font-medium">Vendedor</th>
                <th className="py-3 px-3 font-medium">Rol</th>
                <th className="py-3 px-3 font-medium">Período</th>
                <th className="py-3 px-3 font-medium">Métrica</th>
                <th className="py-3 px-3 font-medium">Meta</th>
                <th className="py-3 px-3 font-medium w-48">Progreso</th>
                <th className="py-3 px-3 font-medium">Fechas</th>
                <th className="py-3 px-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g: any) => {
                const current = getCurrentValue(g.salespersonId, g.metricType);
                const target = Number(g.targetValue);
                const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
                const sp = getSp(g.salespersonId);
                return (
                  <tr key={g.id} className="border-b border-border/20 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-medium">{getSpName(g.salespersonId)}</td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className={getFunctionalRoleColor(sp?.functionalRole)}>
                        {getFunctionalRoleLabel(sp?.functionalRole)}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">{periodLabels[g.period] || g.period}</td>
                    <td className="py-3 px-3">{metricLabels[g.metricType] || g.metricType}</td>
                    <td className="py-3 px-3 font-semibold">{target}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="flex-1" />
                        <span className="text-xs font-medium w-16 text-right">{current} / {target}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{g.startDate} a {g.endDate}</td>
                    <td className="py-3 px-3">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(g.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Meta</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Vendedor</Label>
              <Select value={form.salespersonId} onValueChange={v => setForm({ ...form, salespersonId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar...</SelectItem>
                  {salespeople.filter(s => s.functionalRole).map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({getFunctionalRoleLabel(s.functionalRole)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período</Label>
                <Select value={form.period} onValueChange={v => setForm({ ...form, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de métrica</Label>
                <Select value={form.metricType} onValueChange={v => setForm({ ...form, metricType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calls">Llamadas</SelectItem>
                    <SelectItem value="meetings">Reuniones</SelectItem>
                    <SelectItem value="quotes">Cotizaciones</SelectItem>
                    <SelectItem value="close_rate">Tasa de cierre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Valor objetivo</Label>
              <Input type="number" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} placeholder="100" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" disabled={!form.salespersonId || !form.targetValue} onClick={handleCreate}>
              Crear Meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
