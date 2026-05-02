import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL || "";

const ENTITIES = ["", "client", "contact", "opportunity", "quote", "order", "product", "user", "auth"];
const ACTIONS = ["", "create", "update", "delete", "login", "login_failed", "logout"];

export default function AuditLogPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const limit = 50;

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (entityType) qs.set("entityType", entityType);
      if (action) qs.set("action", action);
      if (userId) qs.set("userId", userId);
      const r = await fetch(`${API}/api/audit?${qs}`, { credentials: "include" });
      const d = await r.json();
      setData(d.data || []);
      setTotal(d.total || 0);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, entityType, action, userId]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold">Auditoría</h1>
        <p className="text-muted-foreground mt-1">{total.toLocaleString("es-AR")} eventos registrados</p>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-white/5 mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Entidad</label>
            <Select value={entityType || "_all"} onValueChange={(v) => { setEntityType(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {ENTITIES.filter(Boolean).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Acción</label>
            <Select value={action || "_all"} onValueChange={(v) => { setAction(v === "_all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {ACTIONS.filter(Boolean).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">User ID</label>
            <Input type="number" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} placeholder="ej. 1" />
          </div>
          <Button variant="outline" onClick={() => { setEntityType(""); setAction(""); setUserId(""); setPage(1); }}>Limpiar</Button>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-white/5">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando…</div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Sin resultados</div>
          ) : (
            <div className="divide-y divide-border/50">
              {data.map((r) => (
                <div key={r.id} className="p-3 hover:bg-white/5 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    <Badge variant={r.action === "delete" ? "destructive" : r.action.includes("failed") ? "destructive" : "secondary"}>{r.action}</Badge>
                    <span className="font-medium">{r.entityType}{r.entityId ? ` #${r.entityId}` : ""}</span>
                    <span className="text-muted-foreground text-xs">user {r.userId ?? "—"}</span>
                    {r.ipAddress && <span className="text-muted-foreground text-xs">{r.ipAddress}</span>}
                    <div className="flex-1" />
                    <span className="text-muted-foreground text-xs">{format(new Date(r.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}</span>
                  </div>
                  {expanded === r.id && (r.details || r.oldValue || r.newValue) && (
                    <pre className="mt-2 text-xs bg-black/40 p-3 rounded overflow-x-auto">
{JSON.stringify({ details: r.details, oldValue: r.oldValue, newValue: r.newValue }, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Página {page} de {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </AppLayout>
  );
}
