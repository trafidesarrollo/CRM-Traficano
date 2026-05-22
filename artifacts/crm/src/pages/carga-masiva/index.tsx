import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileUp, CheckCircle2, AlertCircle, AlertTriangle,
  ChevronRight, RotateCcw, X, Loader2, ListTodo
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

// Per-conflict resolution: which task IDs to close, plus the main action
type Resolution = {
  // IDs of tasks the user checked to close
  tareasACerrar: number[];
  // "asociar_y_cerrar" = close selected tasks + log; "solo_bitacora" = just log; null = undecided
  accion: "asociar_y_cerrar" | "solo_bitacora" | null;
};

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

  function toggleTask(conflictIdx: number, taskId: number) {
    setResolutions(prev => {
      const cur = prev[conflictIdx] ?? { tareasACerrar: [], accion: null };
      const already = cur.tareasACerrar.includes(taskId);
      const tareasACerrar = already
        ? cur.tareasACerrar.filter(id => id !== taskId)
        : [...cur.tareasACerrar, taskId];
      // If at least one task selected → force "asociar_y_cerrar"; otherwise reset action
      const accion = tareasACerrar.length > 0 ? "asociar_y_cerrar" : cur.accion === "asociar_y_cerrar" ? null : cur.accion;
      return { ...prev, [conflictIdx]: { tareasACerrar, accion } };
    });
  }

  function setAccion(conflictIdx: number, accion: "asociar_y_cerrar" | "solo_bitacora") {
    setResolutions(prev => {
      const cur = prev[conflictIdx] ?? { tareasACerrar: [], accion: null };
      // If choosing "solo_bitacora", clear selected tasks
      const tareasACerrar = accion === "solo_bitacora" ? [] : cur.tareasACerrar;
      return { ...prev, [conflictIdx]: { tareasACerrar, accion } };
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
          init[i] = { tareasACerrar: [], accion: null };
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
      // Expand: one row per task-to-close, or one row with solo_bitacora
      const rows = conflicts.flatMap((c, i) => {
        const res = resolutions[i];
        if (res.accion === "asociar_y_cerrar" && res.tareasACerrar.length > 0) {
          // One entry per selected task
          return res.tareasACerrar.map(tareaId => ({
            clientId: c.clientId,
            clientName: c.clientName,
            fecha: c.fecha,
            fechaSeguimiento: c.fechaSeguimiento,
            urgencia: c.urgencia,
            titulo: c.titulo,
            novedad: c.novedad,
            accion: c.accion,
            tareaId,
            accion_vendedor: "asociar_y_cerrar" as const,
          }));
        }
        return [{
          clientId: c.clientId,
          clientName: c.clientName,
          fecha: c.fecha,
          fechaSeguimiento: c.fechaSeguimiento,
          urgencia: c.urgencia,
          titulo: c.titulo,
          novedad: c.novedad,
          accion: c.accion,
          tareaId: c.tareasPendientes[0]?.id ?? 0,
          accion_vendedor: "solo_bitacora" as const,
        }];
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
                Para cada fila, elegí si querés cerrar la tarea vinculada o solo guardar la novedad sin tocar la tarea.
              </p>
            </div>

            {/* Conflict cards */}
            <div className="space-y-3">
              {conflicts.map((c, i) => {
                const res = resolutions[i] ?? { tareasACerrar: [], accion: null };
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

                    {/* Action selector */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setAccion(i, "asociar_y_cerrar")}
                        disabled={!hasSelection}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${res.accion === "asociar_y_cerrar" ? "bg-green-500/20 border-green-500/50 text-green-300" : "border-border/50 text-muted-foreground hover:border-green-500/40 hover:bg-green-500/5"}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
                        Cerrar tarea{res.tareasACerrar.length > 1 ? "s" : ""} seleccionada{res.tareasACerrar.length > 1 ? "s" : ""} y registrar
                        {res.tareasACerrar.length > 0 && <span className="ml-1 text-green-400">({res.tareasACerrar.length})</span>}
                      </button>
                      <button
                        onClick={() => setAccion(i, "solo_bitacora")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${res.accion === "solo_bitacora" ? "bg-blue-500/20 border-blue-500/50 text-blue-300" : "border-border/50 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/5"}`}
                      >
                        <X className="w-3.5 h-3.5 inline mr-1.5" />
                        Solo guardar en bitácora (sin cerrar tareas)
                      </button>
                    </div>
                    {!isResolved && (
                      <p className="text-xs text-yellow-500/70 mt-2">
                        Seleccioná las tareas a cerrar y confirmá, o elegí "Solo bitácora".
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
                Las tareas quedaron asignadas a tu usuario con la fecha de seguimiento del CSV.
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
    </AppLayout>
  );
}
