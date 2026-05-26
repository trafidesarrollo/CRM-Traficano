import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload, FileUp, CheckCircle2, AlertCircle, AlertTriangle,
  ChevronRight, RotateCcw, X, Loader2, ListTodo, CalendarCheck2,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

type ConflictRow = {
  clientId: number;
  clientName: string;
  fecha: string;
  fechaSeguimiento: string | null;
  urgencia: string | null;
  titulo: string | null;
  novedad: string;
  accion: string | null;
  tareasPendientes: Array<{ id: number; title: string; status: string; dueDate: string | null }>;
};

type FollowupTask = {
  title: string;
  tipo: string;
  dueDate: string;
  priority: string;
  status: string;
  assignedTo: string;
  description: string;
};

type Resolution = {
  tareasACerrar: number[];
  accion: "asociar_y_cerrar" | "solo_bitacora" | null;
  followup: FollowupTask | null; // null = sin agendar, defined = agendar
};

function defaultFollowup(c: ConflictRow, currentUserId?: string): FollowupTask {
  return {
    title: c.titulo ? `Seguimiento: ${c.titulo}` : `Seguimiento - ${c.clientName}`,
    tipo: "Seguimiento",
    dueDate: c.fechaSeguimiento || "",
    priority: c.urgencia?.toLowerCase() === "alta" ? "high" : c.urgencia?.toLowerCase() === "baja" ? "low" : "medium",
    status: "pending",
    assignedTo: currentUserId || "",
    description: "",
  };
}

export default function CargaMasivaPage() {
  const { toast } = useToast();
  const [csvText, setCsvText] = useState("");
  const [separator, setSeparator] = useState<";" | ",">(";" );
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [step, setStep] = useState<"upload" | "conflicts" | "done">("upload");
  const [savedDirect, setSavedDirect] = useState(0);
  const [createdTasksDirect, setCreatedTasksDirect] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [errors, setErrors] = useState<{ line: number; error: string }[]>([]);
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({});
  const [savedResolved, setSavedResolved] = useState(0);
  const [createdTasksResolved, setCreatedTasksResolved] = useState(0);

  // Assignable users for the schedule modal
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Schedule modal
  const [scheduleModal, setScheduleModal] = useState<{ open: boolean; conflictIdx: number } | null>(null);
  const [scheduleForm, setScheduleForm] = useState<FollowupTask>({
    title: "", tipo: "Seguimiento", dueDate: "", priority: "medium", status: "pending", assignedTo: "", description: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/users/assignable`, { credentials: "include" }).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/auth/me`, { credentials: "include" }).then(r => r.json()).catch(() => null),
    ]).then(([users, me]) => {
      const userList = Array.isArray(users) ? users : [];
      setAssignableUsers(userList);
      if (me?.id) setCurrentUserId(String(me.id));
    });
  }, []);

  function toggleTask(conflictIdx: number, taskId: number) {
    setResolutions(prev => {
      const cur = prev[conflictIdx] ?? { tareasACerrar: [], accion: null, followup: null };
      const already = cur.tareasACerrar.includes(taskId);
      const tareasACerrar = already
        ? cur.tareasACerrar.filter(id => id !== taskId)
        : [...cur.tareasACerrar, taskId];
      const accion = tareasACerrar.length > 0 ? cur.accion : (cur.accion === "asociar_y_cerrar" ? null : cur.accion);
      return { ...prev, [conflictIdx]: { ...cur, tareasACerrar, accion } };
    });
  }

  function openScheduleModal(conflictIdx: number) {
    const c = conflicts[conflictIdx];
    setScheduleForm(defaultFollowup(c, currentUserId));
    setScheduleModal({ open: true, conflictIdx });
  }

  function handleScheduleConfirm() {
    if (!scheduleModal) return;
    const idx = scheduleModal.conflictIdx;
    setResolutions(prev => {
      const cur = prev[idx] ?? { tareasACerrar: [], accion: null, followup: null };
      return { ...prev, [idx]: { ...cur, accion: "asociar_y_cerrar", followup: { ...scheduleForm } } };
    });
    setScheduleModal(null);
  }

  function handleScheduleSkip() {
    if (!scheduleModal) return;
    const idx = scheduleModal.conflictIdx;
    setResolutions(prev => {
      const cur = prev[idx] ?? { tareasACerrar: [], accion: null, followup: null };
      return { ...prev, [idx]: { ...cur, accion: "asociar_y_cerrar", followup: null } };
    });
    setScheduleModal(null);
  }

  function setAccionSoloBitacora(conflictIdx: number) {
    setResolutions(prev => {
      const cur = prev[conflictIdx] ?? { tareasACerrar: [], accion: null, followup: null };
      return { ...prev, [conflictIdx]: { tareasACerrar: [], accion: "solo_bitacora", followup: null } };
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    e.target.value = "";
  }

  async function processCSV() {
    if (!csvText.trim()) {
      toast({ title: "Cargá un CSV primero", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/bulk-activities/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ csv: csvText, separator }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al procesar");

      setSavedDirect(data.savedDirect);
      setCreatedTasksDirect(data.createdTasks || 0);
      setConflicts(data.conflicts || []);
      setErrors(data.errors || []);

      if ((data.conflicts || []).length === 0) {
        setStep("done");
      } else {
        const init: Record<number, Resolution> = {};
        (data.conflicts as ConflictRow[]).forEach((_, i) => {
          init[i] = { tareasACerrar: [], accion: null, followup: null };
        });
        setResolutions(init);
        setStep("conflicts");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function resolveAll() {
    const unresolved = conflicts.filter((_, i) => resolutions[i]?.accion === null);
    if (unresolved.length > 0) {
      toast({ title: `Hay ${unresolved.length} fila(s) sin resolución`, variant: "destructive" });
      return;
    }
    setResolving(true);
    try {
      const rows = conflicts.map((c, i) => {
        const res = resolutions[i];
        return {
          clientId: c.clientId,
          clientName: c.clientName,
          fecha: c.fecha,
          fechaSeguimiento: c.fechaSeguimiento,
          urgencia: c.urgencia,
          titulo: c.titulo,
          novedad: c.novedad,
          accion: c.accion,
          tareasACerrar: res.accion === "asociar_y_cerrar" ? res.tareasACerrar : [] as number[],
          accion_vendedor: res.accion as "asociar_y_cerrar" | "solo_bitacora",
          followupTask: res.followup ?? null,
        };
      });

      const r = await fetch(`${API}/api/bulk-activities/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al resolver");
      setSavedResolved(data.saved);
      setCreatedTasksResolved(data.createdTasks || 0);
      setStep("done");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }

  function reset() {
    setCsvText("");
    setStep("upload");
    setSavedDirect(0);
    setCreatedTasksDirect(0);
    setConflicts([]);
    setErrors([]);
    setResolutions({});
    setSavedResolved(0);
    setCreatedTasksResolved(0);
  }

  const allResolved = conflicts.length > 0 && conflicts.every((_, i) => resolutions[i]?.accion !== null);
  const pendingCount = conflicts.filter((_, i) => !resolutions[i]?.accion).length;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileUp className="w-6 h-6 text-cyan-400" />
            Carga Masiva de Novedades
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Importá el resumen de actividades diarias desde un archivo CSV. Las filas sin conflictos se guardan
            automáticamente en la bitácora. Las que tienen tareas pendientes requieren tu acción.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {[
            { key: "upload", label: "1. Subir CSV" },
            { key: "conflicts", label: "2. Resolver conflictos" },
            { key: "done", label: "3. Completado" },
          ].map((s, idx, arr) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full font-medium transition-colors ${step === s.key ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : step === "done" || (step === "conflicts" && idx === 0) ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                {s.label}
              </span>
              {idx < arr.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Separador de columnas</Label>
              <div className="flex gap-2">
                {([";", ","] as const).map(s => (
                  <button key={s} onClick={() => setSeparator(s)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-mono border transition-colors ${separator === s ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                    {s === ";" ? 'Punto y coma  ";"' : 'Coma  ","'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Subir archivo CSV</Label>
              <label className="flex items-center gap-3 cursor-pointer border border-dashed border-border/60 rounded-xl px-5 py-4 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors text-sm text-muted-foreground">
                <Upload className="w-5 h-5 flex-shrink-0" />
                {csvText ? "Archivo cargado — clic para reemplazar" : "Seleccioná un archivo .csv"}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              </label>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">O pegá el contenido del CSV aquí</Label>
              <Textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={7}
                placeholder={`nro_cliente${separator}nombre_cliente${separator}fecha${separator}fecha_seguimiento${separator}urgencia${separator}titulo${separator}novedad${separator}accion\n10013${separator}OPS S.A.${separator}2026-05-20${separator}2026-05-23${separator}Media${separator}Reunión comercial${separator}Cliente evalúa precios${separator}Enviar cotización`}
                className="font-mono text-xs"
              />
            </div>

            <div className="text-xs text-muted-foreground bg-white/5 rounded-lg p-3 space-y-1">
              <p><span className="text-foreground font-medium">Obligatorios:</span> nro_cliente, novedad</p>
              <p><span className="text-foreground font-medium">Opcionales:</span> nombre_cliente, fecha, fecha_seguimiento, urgencia, titulo, accion</p>
              <p className="text-cyan-400/80">El nro_cliente debe coincidir con el ID del cliente en el sistema.</p>
            </div>

            <Button
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-white"
              disabled={loading || !csvText.trim()}
              onClick={processCSV}
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : "Procesar CSV"}
            </Button>
          </div>
        )}

        {/* ── STEP 2: Conflicts ── */}
        {step === "conflicts" && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-400">{savedDirect}</p>
                <p className="text-xs text-muted-foreground mt-1">Guardados directamente</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                <p className="text-2xl font-bold text-yellow-400">{conflicts.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Con conflicto</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-2xl font-bold text-red-400">{errors.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Errores</p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-red-400 flex items-center gap-1 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" /> Filas con error (no procesadas)
                </p>
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">Línea {e.line}: {e.error}</p>
                ))}
              </div>
            )}

            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-sm font-medium text-yellow-300 flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" />
                Estos clientes tienen tareas pendientes — decidí qué hacer con cada uno
              </p>
              <p className="text-xs text-muted-foreground">
                Para cada fila, marcá las tareas a cerrar y luego especificá el próximo seguimiento, o elegí solo guardar en bitácora.
              </p>
            </div>

            {/* Conflict cards */}
            <div className="space-y-3">
              {conflicts.map((c, i) => {
                const res = resolutions[i] ?? { tareasACerrar: [], accion: null, followup: null };
                const isSoloBitacora = res.accion === "solo_bitacora";
                const hasSelection = res.tareasACerrar.length > 0;
                const isResolved = res.accion !== null;
                return (
                  <div key={i} className={`bg-card border rounded-xl p-4 transition-colors ${isResolved ? "border-green-500/30" : "border-yellow-500/30"}`}>
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.clientName}</span>
                      <span className="text-xs text-muted-foreground font-mono">#{c.clientId}</span>
                      {c.urgencia && <Badge variant="outline" className="text-xs">{c.urgencia}</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">{c.fecha}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1 line-clamp-2">{c.novedad}</p>
                    {c.accion && <p className="text-xs text-cyan-400/80 mb-3">Acción registrada: {c.accion}</p>}

                    {/* Tasks with checkboxes */}
                    <div className="mt-3 mb-4 space-y-2">
                      <p className="text-xs font-medium text-yellow-400 flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5" />
                        Tareas pendientes — marcá las que cierra este evento:
                      </p>
                      {c.tareasPendientes.map(t => {
                        const checked = res.tareasACerrar.includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${checked ? "bg-green-500/10 border-green-500/40 text-green-300" : "bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40"}`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={isSoloBitacora}
                              onCheckedChange={() => toggleTask(i, t.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">{t.status.replace("_", " ")}</p>
                            </div>
                            {t.dueDate && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(t.dueDate).toLocaleDateString("es-AR")}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Resolution status banner */}
                    {isResolved && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs ${res.accion === "asociar_y_cerrar" ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-blue-500/10 border border-blue-500/30 text-blue-300"}`}>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {res.accion === "asociar_y_cerrar" ? (
                          <>
                            Cerrando {res.tareasACerrar.length} tarea{res.tareasACerrar.length !== 1 ? "s" : ""} y registrando.
                            {res.followup ? (
                              <span className="ml-1">Seguimiento agendado: <strong>{res.followup.dueDate || "sin fecha"}</strong></span>
                            ) : (
                              <span className="ml-1 opacity-70">Sin próximo seguimiento.</span>
                            )}
                          </>
                        ) : "Solo bitácora, sin cerrar tareas."}
                        <button
                          className="ml-auto underline underline-offset-2 opacity-70 hover:opacity-100"
                          onClick={() => {
                            setResolutions(prev => ({ ...prev, [i]: { tareasACerrar: res.tareasACerrar, accion: null, followup: null } }));
                          }}
                        >
                          Cambiar
                        </button>
                      </div>
                    )}

                    {/* Action buttons — only shown when not yet resolved */}
                    {!isResolved && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => openScheduleModal(i)}
                          disabled={!hasSelection}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed border-border/50 text-muted-foreground hover:border-green-500/40 hover:bg-green-500/5`}
                        >
                          <CalendarCheck2 className="w-3.5 h-3.5 inline mr-1.5" />
                          Cerrar tarea{res.tareasACerrar.length > 1 ? "s" : ""} seleccionada{res.tareasACerrar.length > 1 ? "s" : ""} y agendar seguimiento
                          {res.tareasACerrar.length > 0 && <span className="ml-1 text-green-400">({res.tareasACerrar.length})</span>}
                        </button>
                        <button
                          onClick={() => setAccionSoloBitacora(i)}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-border/50 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
                        >
                          <X className="w-3.5 h-3.5 inline mr-1.5" />
                          Solo guardar en bitácora (sin cerrar tareas)
                        </button>
                      </div>
                    )}
                    {!isResolved && !hasSelection && (
                      <p className="text-xs text-yellow-500/70 mt-2">
                        Marcá al menos una tarea para cerrarla, o elegí "Solo bitácora".
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {pendingCount > 0 ? `${pendingCount} fila(s) sin resolver` : "Todas resueltas — listo para guardar"}
              </span>
              <Button
                className="bg-cyan-500 hover:bg-cyan-400 text-white"
                disabled={!allResolved || resolving}
                onClick={resolveAll}
              >
                {resolving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : "Confirmar y guardar todo"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done ── */}
        {step === "done" && (
          <div className="bg-card border border-green-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold">¡Carga completada!</h2>

            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-center">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-400">{savedDirect + savedResolved}</p>
                <p className="text-xs text-muted-foreground mt-1">Novedades en bitácora</p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3">
                <p className="text-2xl font-bold text-cyan-400">{createdTasksDirect + createdTasksResolved}</p>
                <p className="text-xs text-muted-foreground mt-1">Tareas de seguimiento</p>
              </div>
            </div>

            {(createdTasksDirect + createdTasksResolved) > 0 && (
              <p className="text-xs text-cyan-400/80 bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2 max-w-xs mx-auto">
                Las tareas quedaron asignadas con la fecha y detalles especificados.
              </p>
            )}

            {errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-left space-y-1 max-w-sm mx-auto">
                <p className="text-xs font-semibold text-red-400">Filas no procesadas ({errors.length}):</p>
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">Línea {e.line}: {e.error}</p>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Todas las novedades fueron guardadas en la bitácora de cada cliente.
            </p>

            <Button variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Nueva carga
            </Button>
          </div>
        )}
      </div>

      {/* ── Agendar seguimiento modal ── */}
      <Dialog open={!!scheduleModal?.open} onOpenChange={(open) => { if (!open) setScheduleModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogDescription className="sr-only">Agendar próximo seguimiento</DialogDescription>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                <CalendarCheck2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <DialogTitle>Agendar seguimiento</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Completá los datos del próximo seguimiento antes de cerrar la tarea.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm">Título</Label>
              <Input
                className="mt-1"
                value={scheduleForm.title}
                onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Seguimiento - Cliente OPS"
              />
            </div>

            <div>
              <Label className="text-sm">Tipo</Label>
              <Select value={scheduleForm.tipo} onValueChange={v => setScheduleForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Seguimiento", "Llamada", "Reunión", "Email", "Visita", "Cotización", "Otro"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Fecha de seguimiento</Label>
              <Input
                type="date"
                className="mt-1"
                value={scheduleForm.dueDate}
                onChange={e => setScheduleForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Prioridad</Label>
                <Select value={scheduleForm.priority} onValueChange={v => setScheduleForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Estado</Label>
                <Select value={scheduleForm.status} onValueChange={v => setScheduleForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Abierta</SelectItem>
                    <SelectItem value="in_progress">En progreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm">Asignar a</Label>
              <Select value={scheduleForm.assignedTo} onValueChange={v => setScheduleForm(f => ({ ...f, assignedTo: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                className="mt-1 text-sm"
                rows={3}
                value={scheduleForm.description}
                onChange={e => setScheduleForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Confirmar disponibilidad para reunión..."
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={handleScheduleSkip}>
                Cerrar sin agendar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleScheduleConfirm}
              >
                <CalendarCheck2 className="w-4 h-4 mr-2" />
                Completar y agendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
