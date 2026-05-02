import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Plus } from "lucide-react";
import { Link } from "wouter";

const API = import.meta.env.VITE_API_URL || "";

const PRIORITY: Record<string, string> = {
  urgent: "bg-red-500/30 border-red-500 text-red-200",
  high: "bg-orange-500/30 border-orange-500 text-orange-200",
  medium: "bg-yellow-500/20 border-yellow-500 text-yellow-200",
  low: "bg-blue-500/20 border-blue-500 text-blue-200",
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function CalendarPage() {
  const [items, setItems] = useState<any[]>([]);
  const [anchor, setAnchor] = useState<Date>(startOfWeek(new Date()));

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(anchor); d.setDate(d.getDate() + i); return d;
    });
  }, [anchor]);

  useEffect(() => {
    const from = anchor.toISOString();
    const to = new Date(anchor.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    fetch(`${API}/api/tasks?from=${from}&to=${to}&limit=500`, { credentials: "include" })
      .then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : (d.data || [])));
  }, [anchor]);

  const tasksFor = (d: Date) =>
    items.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === d.toDateString());

  const move = (n: number) => {
    const x = new Date(anchor); x.setDate(x.getDate() + n * 7); setAnchor(x);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Calendario</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>Hoy</Button>
            <Button variant="outline" size="icon" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-medium min-w-[200px] text-center">
              {anchor.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} - {days[6].toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <Button variant="outline" size="icon" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Link href="/tasks"><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva</Button></Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const dayTasks = tasksFor(d);
            return (
              <Card key={i} className={isToday ? "border-primary" : ""}>
                <CardContent className="p-2 min-h-[200px]">
                  <div className="text-xs uppercase text-muted-foreground">
                    {d.toLocaleDateString("es-AR", { weekday: "short" })}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
                  <div className="space-y-1 mt-2">
                    {dayTasks.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                    {dayTasks.map(t => (
                      <div key={t.id} className={`text-xs p-1.5 rounded border ${PRIORITY[t.priority] || "bg-muted"} ${t.status === "completed" ? "opacity-50 line-through" : ""}`}>
                        <div className="font-medium truncate">{t.title}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
