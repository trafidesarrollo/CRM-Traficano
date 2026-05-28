import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Trash2, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

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
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!confirmTable || confirmText !== "CONFIRMAR") return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/admin/reset/${confirmTable}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al borrar");
      toast({ title: "Tabla vaciada", description: data.message });
      setConfirmTable(null);
      setConfirmText("");
      fetchCounts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

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
          Se requerirá confirmación explícita antes de cada acción.
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
                onClick={() => { setConfirmTable(key); setConfirmText(""); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Borrar
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirmTable} onOpenChange={(o) => { if (!o) { setConfirmTable(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Confirmar borrado
            </DialogTitle>
            <DialogDescription>
              Estás a punto de borrar <strong>todos los registros</strong> de la tabla{" "}
              <strong>{confirmTable ? (counts[confirmTable]?.label ?? confirmTable) : ""}</strong>.
              Esta acción eliminará{" "}
              <strong>{confirmTable ? (counts[confirmTable]?.count ?? 0) : 0} registro(s)</strong> de
              forma permanente, incluyendo todos los datos relacionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Para confirmar, escribí <span className="font-mono font-bold text-foreground">CONFIRMAR</span> en el campo:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRMAR"
              className="font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmTable(null); setConfirmText(""); }} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "CONFIRMAR" || deleting}
              onClick={handleDelete}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Borrar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
