import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-500/20 text-gray-300" },
  sent: { label: "Enviada", color: "bg-blue-500/20 text-blue-300" },
  approved: { label: "Aprobada", color: "bg-green-500/20 text-green-300" },
  rejected: { label: "Rechazada", color: "bg-red-500/20 text-red-300" },
  partial: { label: "Parcial", color: "bg-yellow-500/20 text-yellow-300" },
  expired: { label: "Vencida", color: "bg-orange-500/20 text-orange-300" },
};

const getQuoteStatusBadge = (q: any): { label: string; color: string } => {
  if (q.quoteStatus === "APROBADA" || q.quoteStatus === "FINALIZADA") return { label: "APROBADA",  color: "bg-green-500/20 text-green-300" };
  if (q.quoteStatus === "PERDIDA")   return { label: "PERDIDA",    color: "bg-red-500/20 text-red-300" };
  if (q.quoteStatus === "DESISTIDA") return { label: "DESISTIDA",  color: "bg-slate-500/20 text-slate-300" };
  return STATUS_LABELS[q.status] || { label: q.status, color: "bg-gray-500/20 text-gray-300" };
};

const PRIORITY_COLORS: Record<string, string> = {
  ALTA: "bg-red-500/20 text-red-300",
  MEDIA: "bg-yellow-500/20 text-yellow-300",
  BAJA: "bg-blue-500/20 text-blue-300",
  NINGUNA: "bg-gray-500/20 text-gray-300",
};

export default function Quotes() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    const url = new URL(`${window.location.origin}${API}/api/quotes`);
    if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
    url.searchParams.set("limit", "200");
    const r = await fetch(url.toString().replace(window.location.origin, ""), { credentials: "include" });
    const j = await r.json();
    setData(j.data || []);
    setTotal(j.total || 0);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const del = async (id: number) => {
    if (!confirm("¿Eliminar cotización?")) return;
    await fetch(`${API}/api/quotes/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Eliminada" });
    load();
  };

  const filtered = data.filter(q =>
    `${q.number || ""} ${q.clientName || ""} ${q.reference || ""} ${q.salespersonName || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3"><FileText className="w-8 h-8 text-primary" />Cotizaciones de venta</h1>
          <p className="text-muted-foreground mt-1">{total} cotizaciones</p>
        </div>
        <Link href="/quotes/new"><Button><Plus className="w-4 h-4 mr-2" />Nueva Cotización</Button></Link>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, número, referencia, vendedor..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="approved">Aprobada</SelectItem>
            <SelectItem value="rejected">Rechazada</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="expired">Vencida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50">
              <tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="p-3">Número</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Entrega</th>
                <th className="p-3">Moneda</th>
                <th className="p-3 text-right">Monto neto</th>
                <th className="p-3 text-right">Total Kg</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Tipo orden</th>
                <th className="p-3">Vendedor</th>
                <th className="p-3">Prioridad</th>
                <th className="p-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const s = getQuoteStatusBadge(q);
                return (
                  <tr key={q.id} className="border-b border-border/30 hover:bg-white/5 cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                    <td className="p-3 font-mono">{q.number || `#${q.id}`}</td>
                    <td className="p-3 font-medium max-w-xs truncate">{q.clientName || "—"}</td>
                    <td className="p-3 text-muted-foreground">{q.date ? new Date(q.date).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="p-3 text-muted-foreground">{q.deliveryDate ? new Date(q.deliveryDate).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="p-3">{q.currency === "USD" ? "u$s" : q.currency}</td>
                    <td className="p-3 text-right font-mono">{Number(q.netAmount || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono">{Number(q.totalKg || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                    <td className="p-3 text-xs">{q.orderType || "—"}</td>
                    <td className="p-3 text-xs">{q.salespersonName || "—"}</td>
                    <td className="p-3"><Badge className={PRIORITY_COLORS[q.priority || "MEDIA"]}>{q.priority || "MEDIA"}</Badge></td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => del(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (<tr><td colSpan={12} className="p-8 text-center text-muted-foreground">No hay cotizaciones</td></tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
