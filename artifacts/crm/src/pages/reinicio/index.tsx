import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Trash2, AlertTriangle, RotateCcw, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

const WORD_POOL = [
  "ALAGRANDELEPUSEKUKKA",
  "BORRANDOTODOAHORA",
  "SINVUELTAATRAS",
  "ELIMINACIONTOTAL",
  "DESTRUCTIONFINAL",
  "TABLAENVACIADERO",
  "RESETCOMPLETADO",
  "CONFIRMOBORRARDATOS",
  "NOHAYRECUPERACION",
  "OPERACIONIRREVERSIBLE",
];

function generateChallenge(): string {
  return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
}

const TABLE_ORDER = [
  "clients",
  "contacts",
  "opportunities",
  "quotes",
  "orders",
  "tasks",
  "activities",
  "followups",
  "products",
  "salespeople",
];

const TABLE_DESCRIPTIONS: Record<string, string> = {
  clients: "Todos los clientes y sus datos de empresa.",
  contacts: "Contactos vinculados a clientes.",
  opportunities: "Oportunidades comerciales abiertas y cerradas.",
  quotes: "Cotizaciones generadas.",
  orders: "Pedidos registrados.",
  tasks: "Tareas y bitácora de actividades.",
  activities: "Historial de llamadas, visitas y notas.",
  followups: "Seguimientos programados.",
  products: "Catálogo de productos.",
  salespeople: "Vendedores registrados en el sistema.",
};

type TableCounts = Record<string, { label: string; count: number }>;

export default function ReinicioPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [counts, setCounts] = useState<TableCounts>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  const [confirmTable, setConfirmTable] = useState<string | null>(null);
  const [challenge, setChallenge] = useState("");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user]);

  const fetchCounts = async () => {
    setLoadingCounts(true);
    try {
      const r = await fetch(`${API}/api/admin/reset/counts`, { credentials: "include" });
      if (r.ok) setCounts(await r.json());
    } finally {
      setLoadingCounts(false);
    }
  };

  useEffect(() => { fetchCounts(); }, []);

  const openConfirm = (key: string) => {
    setConfirmTable(key);
    setChallenge(generateChallenge());
    setTyped("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmTable(null);
    setChallenge("");
    setTyped("");
  };

  const handleDelete = async () => {
    if (!confirmTable || typed !== challenge) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/admin/reset/${confirmTable}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al borrar");
      toast({ title: "Tabla vaciada", description: data.message });
      closeConfirm();
      fetchCounts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const blockPaste = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toast({
      title: "No permitido",
      description: "Tenés que escribir el texto manualmente.",
      variant: "destructive",
    });
  };

  const isMatch = typed === challenge;
  const typedChars = typed.split("");

  if (!user || user.role !== "admin") return null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-destructive/10">
          <RotateCcw className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Reinicio de datos</h1>
          <p className="text-sm text-muted-foreground">
            Borra el contenido de tablas individuales. Esta acción es irreversible.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Cada borrado es permanente. Los datos eliminados no se pueden recuperar.
          Se requerirá confirmación manual antes de cada acción.
        </p>
      </div>

      <div className="grid gap-3">
        {TABLE_ORDER.map((key) => {
          const info = counts[key];
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border bg-card p-4"
            >
              <div className="space-y-0.5">
                <p className="font-medium text-sm">
                  {info?.label ?? key}
                  {loadingCounts ? (
                    <span className="ml-2 text-xs text-muted-foreground">cargando...</span>
                  ) : (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {info?.count ?? 0} {(info?.count ?? 0) === 1 ? "registro" : "registros"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {TABLE_DESCRIPTIONS[key]}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={loadingCounts || (info?.count ?? 0) === 0}
                onClick={() => openConfirm(key)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Borrar
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirmTable} onOpenChange={(o) => { if (!o) closeConfirm(); }}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive text-base">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              Confirmar borrado — {confirmTable ? (counts[confirmTable]?.label ?? confirmTable) : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive">Estás a punto de eliminar permanentemente:</p>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{confirmTable ? (counts[confirmTable]?.count ?? 0) : 0} registro(s)</strong>{" "}
                de la tabla <strong className="text-foreground">{confirmTable ? (counts[confirmTable]?.label ?? confirmTable) : ""}</strong>,
                incluyendo todos los datos relacionados en cascada.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Para confirmar, escribí <strong>a mano</strong> el siguiente texto
                (copiar y pegar está deshabilitado):
              </p>

              <div className="rounded-md bg-muted px-3 py-2 select-none">
                <p className="font-mono text-sm font-bold tracking-widest text-center text-foreground select-none">
                  {challenge}
                </p>
              </div>

              <div className="relative">
                <Input
                  ref={inputRef}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onPaste={blockPaste}
                  onDrop={blockPaste}
                  onContextMenu={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="Escribí el texto aquí..."
                  className="font-mono tracking-widest pr-10"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>

              {typed.length > 0 && (
                <div className="flex gap-0.5 flex-wrap">
                  {challenge.split("").map((char, i) => {
                    const t = typedChars[i];
                    const correct = t === char;
                    const pending = t === undefined;
                    return (
                      <span
                        key={i}
                        className={`font-mono text-xs px-0.5 rounded ${
                          pending
                            ? "text-muted-foreground"
                            : correct
                            ? "text-green-500"
                            : "text-destructive bg-destructive/10"
                        }`}
                      >
                        {char}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!isMatch || deleting}
              onClick={handleDelete}
            >
              {deleting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Borrando...</>
                : <><Trash2 className="w-4 h-4 mr-2" />Borrar definitivamente</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
