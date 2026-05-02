import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, isToday, isPast } from "date-fns";
import { es } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL || "";

type Task = { id: number; title: string; status: string; priority: string; dueDate: string | null; type: string };

const PRIO: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function TodayTasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<number>>(new Set());

  async function load(uid: number) {
    try {
      const r = await fetch(`${API}/api/tasks?status=pending&assignedTo=${uid}&limit=100`, { credentials: "include" });
      const d = await r.json();
      const list: Task[] = Array.isArray(d) ? d : (d.data || []);
      const today = list.filter(t => t.dueDate && (isToday(new Date(t.dueDate)) || isPast(new Date(t.dueDate))));
      today.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
      setTasks(today.slice(0, 8));
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { if ((user as any)?.id) load((user as any).id); else setLoading(false); }, [(user as any)?.id]);

  async function complete(t: Task) {
    setCompleting(prev => new Set(prev).add(t.id));
    try {
      const r = await fetch(`${API}/api/tasks/${t.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", completedAt: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Tarea completada" });
      setTasks(prev => prev.filter(x => x.id !== t.id));
    } catch {
      toast({ title: "Error al completar", variant: "destructive" });
    } finally {
      setCompleting(prev => { const n = new Set(prev); n.delete(t.id); return n; });
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mis tareas de hoy</CardTitle>
        <Link href="/tasks"><Button variant="ghost" size="sm">Ver todas</Button></Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin tareas pendientes para hoy 🎉</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => {
              const overdue = t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate));
              return (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <Checkbox
                    aria-label={`Completar ${t.title}`}
                    checked={false}
                    disabled={completing.has(t.id)}
                    onCheckedChange={() => complete(t)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.dueDate && format(new Date(t.dueDate), "HH:mm", { locale: es })} · {t.type}
                    </p>
                  </div>
                  <Badge variant="outline" className={PRIO[t.priority] || PRIO.medium}>{t.priority}</Badge>
                  {overdue && <Badge variant="destructive" className="text-[10px]">vencida</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
