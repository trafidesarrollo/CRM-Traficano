import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Plus, Upload, ChevronLeft, ChevronRight, Check, Clock, AlertTriangle,
  User, Building2, RefreshCw, Trash2, X
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL || "";

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgente", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  high:   { label: "Alta",    color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  medium: { label: "Media",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  low:    { label: "Baja",    color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tarea", call: "Llamada", meeting: "Reunión",
  email: "Email", followup: "Seguimiento", reminder: "Recordatorio",
};

const CSV_TEMPLATE = `title,type,priority,dueDate,assignedToName,description,clientName\nLlamar cliente,call,high,2025-06-02,Juan García,Consultar estado del pedido,\nEnviar propuesta,task,medium,2025-06-03,Juan García,Enviar propuesta actualizada,Aceros del Sur`;

export function ManagerTasksTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [deferring, setDeferring] = useState(false);

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskDay, setNewTaskDay] = useState<Date | null>(null);
  const [newTask, setNewTask] = useState({
    title: "", type: "task", priority: "medium", description: "",
    assignedTo: "", clientId: "", quoteId: "", time: "09:00",
  });
  const [savingTask, setSavingTask] = useState(false);

  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/salespeople`, { credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/clients?limit=500`, { credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/quotes?limit=200`, { credentials: "include" }).then(r => r.json()).catch(() => []),
    ]).then(([sp, cl, qt]) => {
      setSalespeople(Array.isArray(sp) ? sp : []);
      setClients(Array.isArray(cl) ? cl : (cl.data || []));
      setQuotes(Array.isArray(qt) ? qt : (qt.data || []));
    });
  }, []);

  useEffect(() => {
    loadWeek();
  }, [weekStart, filterAssignee]);

  async function loadWeek() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ weekStart: weekStart.toISOString() });
      if (filterAssignee !== "all") params.set("assignedTo", filterAssignee);
      const data = await fetch(`${API}/api/tasks/weekly?${params}`, { credentials: "include" }).then(r => r.json());
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la semana", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function tasksForDay(day: Date) {
    return tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), day));
  }

  async function toggleComplete(task: any) {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await fetch(`${API}/api/tasks/${task.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  }

  async function deleteTask(id: number) {
    await fetch(`${API}/api/tasks/${id}`, { method: "DELETE", credentials: "include" });
    setTasks(ts => ts.filter(t => t.id !== id));
  }

  async function deferOverdue() {
    setDeferring(true);
    try {
      const r = await fetch(`${API}/api/tasks/defer-overdue`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const d = await r.json();
      toast({ title: "Tareas diferidas", description: `${d.deferred} tarea(s) movidas al próximo día hábil con prioridad urgente.` });
      loadWeek();
    } catch {
      toast({ title: "Error", description: "No se pudo diferir", variant: "destructive" });
    } finally {
      setDeferring(false);
    }
  }

  function openNewTask(day: Date) {
    setNewTaskDay(day);
    setNewTask({ title: "", type: "task", priority: "medium", description: "", assignedTo: "", clientId: "", quoteId: "", time: "09:00" });
    setShowNewTask(true);
  }

  async function saveNewTask() {
    if (!newTask.title || !newTask.assignedTo) {
      toast({ title: "Completá título y asignado", variant: "destructive" }); return;
    }
    setSavingTask(true);
    try {
      const dueDate = newTaskDay ? (() => {
        const d = new Date(newTaskDay);
        const [h, m] = newTask.time.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      })() : undefined;

      const body: any = {
        title: newTask.title, type: newTask.type, priority: newTask.priority,
        description: newTask.description || undefined, assignedTo: parseInt(newTask.assignedTo),
        dueDate,
      };
      if (newTask.clientId) body.clientId = parseInt(newTask.clientId);
      if (newTask.quoteId) body.quoteId = parseInt(newTask.quoteId);

      await fetch(`${API}/api/tasks`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowNewTask(false);
      toast({ title: "Tarea creada" });
      loadWeek();
    } catch {
      toast({ title: "Error al crear tarea", variant: "destructive" });
    } finally {
      setSavingTask(false);
    }
  }

  function parseCsvText(text: string) {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
    });
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setCsvPreview(parseCsvText(text));
    };
    reader.readAsText(file);
  }

  function handleCsvTextChange(text: string) {
    setCsvText(text);
    setCsvPreview(parseCsvText(text));
  }

  async function importCsv() {
    if (csvPreview.length === 0) return;
    setImportingCsv(true);
    try {
      const spMap = Object.fromEntries(salespeople.map((s: any) => [s.name?.toLowerCase(), s.userId || s.id]));
      const clMap = Object.fromEntries(clients.map((c: any) => [c.companyName?.toLowerCase(), c.id]));

      const tasks = csvPreview.map(row => {
        const assignedToName = (row.assignedToName || "").toLowerCase();
        const clientNameKey = (row.clientName || "").toLowerCase();
        const t: any = {
          title: row.title,
          type: row.type || "task",
          priority: row.priority || "medium",
          description: row.description || undefined,
          assignedTo: spMap[assignedToName] || undefined,
          clientId: clMap[clientNameKey] || undefined,
        };
        if (row.dueDate) {
          const d = new Date(row.dueDate);
          if (!isNaN(d.getTime())) { d.setHours(9, 0, 0, 0); t.dueDate = d.toISOString(); }
        }
        return t;
      }).filter(t => t.title);

      const r = await fetch(`${API}/api/tasks/bulk`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const d = await r.json();
      toast({ title: "Importación exitosa", description: `${d.created} tarea(s) creadas` });
      setShowCsvDialog(false);
      setCsvText(""); setCsvPreview([]);
      loadWeek();
    } catch {
      toast({ title: "Error al importar", variant: "destructive" });
    } finally {
      setImportingCsv(false);
    }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[200px] text-center">
            {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 4), "d MMM yyyy", { locale: es })}
          </span>
          <Button size="sm" variant="outline" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => {
            const d = new Date(); d.setHours(0,0,0,0);
            d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            setWeekStart(d);
          }} className="text-xs text-muted-foreground">Hoy</Button>
        </div>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Todos los vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vendedores</SelectItem>
            {salespeople.map((s: any) => (
              <SelectItem key={s.userId || s.id} value={String(s.userId || s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCsvDialog(true)} className="text-xs">
            <Upload className="w-3 h-3 mr-1" />CSV
          </Button>
          <Button size="sm" variant="outline" onClick={deferOverdue} disabled={deferring} className="text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10">
            <RefreshCw className={`w-3 h-3 mr-1 ${deferring ? "animate-spin" : ""}`} />
            Diferir vencidas
          </Button>
          <Button size="sm" onClick={() => openNewTask(today)} className="text-xs">
            <Plus className="w-3 h-3 mr-1" />Nueva tarea
          </Button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-5 gap-3">
        {weekDays.map(day => {
          const dayTasks = tasksForDay(day);
          const isToday = isSameDay(day, new Date());
          const isPast = day < today;
          const pending = dayTasks.filter(t => t.status !== "completed").length;
          const done = dayTasks.filter(t => t.status === "completed").length;

          return (
            <div key={day.toISOString()} className={`rounded-xl border flex flex-col min-h-[240px] ${isToday ? "border-primary/50 bg-primary/5" : "border-border/40 bg-card/30"}`}>
              {/* Day header */}
              <div className={`flex items-center justify-between p-3 border-b border-border/30 ${isToday ? "bg-primary/10" : ""}`}>
                <div>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "EEE", { locale: es })}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? "text-primary" : isPast ? "text-muted-foreground" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>
                <div className="text-right">
                  {dayTasks.length > 0 && (
                    <div className="text-xs text-muted-foreground">{done}/{dayTasks.length}</div>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 mt-1" onClick={() => openNewTask(day)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Tasks list */}
              <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-80">
                {loading && <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>}
                {!loading && dayTasks.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6 opacity-50">Sin tareas</div>
                )}
                {!loading && dayTasks.map(task => (
                  <TaskCard key={task.id} task={task} onToggle={toggleComplete} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deferred alert legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
        <span>Las tareas vencidas y pendientes se mueven automáticamente al siguiente día hábil con prioridad urgente. Después de 2 diferimientos, el gerente recibe una alerta.</span>
      </div>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva tarea — {newTaskDay ? format(newTaskDay, "EEEE d MMM", { locale: es }) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Título *</Label>
              <Input placeholder="Ej: Llamar a cliente..." value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={newTask.type} onValueChange={v => setNewTask(t => ({ ...t, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={newTask.priority} onValueChange={v => setNewTask(t => ({ ...t, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hora</Label>
                <Input type="time" value={newTask.time} onChange={e => setNewTask(t => ({ ...t, time: e.target.value }))} />
              </div>
              <div>
                <Label>Asignar a *</Label>
                <Select value={newTask.assignedTo} onValueChange={v => setNewTask(t => ({ ...t, assignedTo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vendedor..." /></SelectTrigger>
                  <SelectContent>
                    {salespeople.map((s: any) => (
                      <SelectItem key={s.userId || s.id} value={String(s.userId || s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={newTask.clientId} onValueChange={v => setNewTask(t => ({ ...t, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cliente</SelectItem>
                  {clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cotización (opcional)</Label>
              <Select value={newTask.quoteId} onValueChange={v => setNewTask(t => ({ ...t, quoteId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sin cotización" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cotización</SelectItem>
                  {quotes.map((q: any) => <SelectItem key={q.id} value={String(q.id)}>{q.number} — {q.clientName || ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea rows={2} value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} placeholder="Detalle de la tarea..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancelar</Button>
              <Button onClick={saveNewTask} disabled={savingTask}>{savingTask ? "Guardando..." : "Crear tarea"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar tareas desde CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-white/5 rounded-lg p-3 text-xs text-muted-foreground font-mono leading-relaxed">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">Formato requerido:</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = "plantilla_tareas.csv"; a.click();
                }}>
                  Descargar plantilla
                </Button>
              </div>
              <code className="block whitespace-pre-wrap break-all">{CSV_TEMPLATE}</code>
            </div>

            <div>
              <Label>Subir archivo CSV</Label>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvFile} />
              <Button variant="outline" className="w-full mt-1" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />Seleccionar archivo
              </Button>
            </div>

            <div>
              <Label>O pegar contenido CSV</Label>
              <Textarea
                rows={5}
                value={csvText}
                onChange={e => handleCsvTextChange(e.target.value)}
                placeholder="title,type,priority,dueDate,assignedToName..."
                className="font-mono text-xs mt-1"
              />
            </div>

            {csvPreview.length > 0 && (
              <div>
                <Label>Vista previa ({csvPreview.length} filas)</Label>
                <div className="overflow-x-auto mt-1 rounded-lg border border-border/40">
                  <table className="w-full text-xs">
                    <thead className="bg-white/5">
                      <tr>{Object.keys(csvPreview[0]).map(k => <th key={k} className="p-2 text-left text-muted-foreground">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border/20">
                          {Object.values(row).map((v: any, j) => <td key={j} className="p-2 truncate max-w-[120px]">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 5 && <div className="p-2 text-center text-xs text-muted-foreground">... y {csvPreview.length - 5} más</div>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCsvDialog(false); setCsvText(""); setCsvPreview([]); }}>Cancelar</Button>
              <Button onClick={importCsv} disabled={importingCsv || csvPreview.length === 0}>
                {importingCsv ? "Importando..." : `Importar ${csvPreview.length} tarea(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete }: { task: any; onToggle: (t: any) => void; onDelete: (id: number) => void }) {
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isDone = task.status === "completed";
  const isDeferred = (task.deferCount ?? 0) > 0;

  return (
    <div className={`group relative rounded-lg p-2 border text-xs transition-all ${isDone ? "opacity-50 bg-white/3 border-border/20" : isDeferred ? "bg-orange-500/5 border-orange-500/30" : "bg-white/5 border-border/20 hover:bg-white/8"}`}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => onToggle(task)}
          className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isDone ? "bg-green-500 border-green-500" : "border-border hover:border-primary"}`}
        >
          {isDone && <Check className="w-2.5 h-2.5 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
          {task.assigneeName && (
            <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
              <User className="w-2.5 h-2.5" /><span className="truncate">{task.assigneeName}</span>
            </div>
          )}
          {task.clientName && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Building2 className="w-2.5 h-2.5" /><span className="truncate">{task.clientName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${pc.color}`}>{pc.label}</Badge>
            {TYPE_LABELS[task.type] && <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[task.type]}</span>}
            {isDeferred && (
              <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                <RefreshCw className="w-2.5 h-2.5" />{task.deferCount}x
              </span>
            )}
            {task.dueDate && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />{format(parseISO(task.dueDate), "HH:mm")}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
