import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Plus, Search, Eye, Trash2, Zap, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-500/20 text-gray-300" },
  confirmed: { label: "Confirmado", color: "bg-blue-500/20 text-blue-300" },
  in_production: { label: "En producción", color: "bg-purple-500/20 text-purple-300" },
  shipped: { label: "Despachado", color: "bg-cyan-500/20 text-cyan-300" },
  delivered: { label: "Entregado", color: "bg-green-500/20 text-green-300" },
  invoiced: { label: "Facturado", color: "bg-emerald-500/20 text-emerald-300" },
  cancelled: { label: "Cancelado", color: "bg-red-500/20 text-red-300" },
};

export default function Orders() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    const r = await fetch(`${API}/api/orders?${params}`, { credentials: "include" });
    const j = await r.json();
    setData(j.data || []);
  };
  useEffect(() => { load(); }, [statusFilter]);

  const del = async (id: number) => {
    if (!confirm("¿Eliminar pedido?")) return;
    await fetch(`${API}/api/orders/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Eliminado" });
    load();
  };

  const filtered = data.filter(o =>
    `${o.number || ""} ${o.clientName || ""} ${o.salespersonName || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3"><ShoppingCart className="w-8 h-8 text-primary" />Pedidos de cliente</h1>
          <p className="text-muted-foreground mt-1">{data.length} pedidos</p>
        </div>
        <Link href="/orders/new"><Button><Plus className="w-4 h-4 mr-2" />Nuevo Pedido</Button></Link>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
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
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Total Kg</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Vendedor</th>
                <th className="p-3">Urgente</th>
                <th className="p-3">Autorizado</th>
                <th className="p-3 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const s = STATUS_LABELS[o.status] || { label: o.status, color: "bg-gray-500/20" };
                return (
                  <tr key={o.id} className="border-b border-border/30 hover:bg-white/5">
                    <td className="p-3 font-mono">{o.number || `#${o.id}`}</td>
                    <td className="p-3 font-medium max-w-xs truncate">{o.clientName || "—"}</td>
                    <td className="p-3 text-muted-foreground">{o.date ? new Date(o.date).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="p-3 text-muted-foreground">{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="p-3 text-right font-mono">{Number(o.total || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {o.currency === "USD" ? "u$s" : o.currency}</td>
                    <td className="p-3 text-right font-mono">{Number(o.totalKg || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3"><Badge className={s.color}>{s.label}</Badge></td>
                    <td className="p-3 text-xs">{o.salespersonName || "—"}</td>
                    <td className="p-3">{o.isUrgent ? <Badge className="bg-red-500/20 text-red-300"><Zap className="w-3 h-3 mr-1" />SÍ</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3">{o.isAuthorized ? <Badge className="bg-green-500/20 text-green-300">SÍ</Badge> : <span className="text-muted-foreground">No</span>}</td>
                    <td className="p-3 flex gap-1">
                      <Link href={`/orders/${o.id}`}><Button size="sm" variant="ghost" aria-label="Ver pedido"><Eye className="w-4 h-4" /></Button></Link>
                      <a href={`${API}/api/orders/${o.id}/pdf`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" aria-label="Descargar PDF"><FileText className="w-4 h-4" /></Button></a>
                      <Button size="sm" variant="ghost" aria-label="Eliminar pedido" onClick={() => del(o.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (<tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No hay pedidos</td></tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
