import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kanban, RefreshCw, DollarSign, FileText, Plus } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const COLUMNS: { key: string; label: string; color: string; border: string; bg: string }[] = [
  { key: "draft",    label: "Borrador",   color: "text-gray-300",   border: "border-gray-500/40",  bg: "bg-gray-500/10" },
  { key: "sent",     label: "Enviada",    color: "text-blue-300",   border: "border-blue-500/40",  bg: "bg-blue-500/10" },
  { key: "approved", label: "Aprobada",   color: "text-green-300",  border: "border-green-500/40", bg: "bg-green-500/10" },
  { key: "partial",  label: "Parcial",    color: "text-yellow-300", border: "border-yellow-500/40",bg: "bg-yellow-500/10" },
  { key: "rejected", label: "Rechazada",  color: "text-red-300",    border: "border-red-500/40",   bg: "bg-red-500/10" },
  { key: "expired",  label: "Vencida",    color: "text-orange-300", border: "border-orange-500/40",bg: "bg-orange-500/10" },
];

function fmt(n: number, currency = "USD") {
  const sym = currency === "ARS" ? "$" : "u$s";
  return `${sym} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n || 0)}`;
}

function QuoteCard({ q }: { q: any }) {
  const dateStr = q.date ? new Date(q.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
  const amount = Number(q.netAmount || q.total || 0);
  return (
    <Link href={`/quotes/${q.id}`}>
      <div className="bg-card border border-border/40 rounded-lg p-3 mb-2 hover:border-primary/50 hover:bg-white/5 transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-mono text-xs text-muted-foreground">{q.number || `#${q.id}`}</span>
          <span className="text-xs font-semibold text-primary">{fmt(amount, q.currency)}</span>
        </div>
        <p className="text-sm font-medium truncate mb-1">{q.clientName || "Sin cliente"}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{q.salespersonName || "—"}</span>
          <span>{dateStr}</span>
        </div>
        {q.reference && (
          <p className="text-xs text-muted-foreground truncate mt-1 italic">{q.reference}</p>
        )}
      </div>
    </Link>
  );
}

export default function QuotePipeline() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/quotes?limit=500`, { credentials: "include" });
      const j = await r.json();
      setQuotes(j.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const byStatus = (status: string) => quotes.filter(q => q.status === status);

  const colTotal = (status: string) => {
    const qs = byStatus(status);
    const usd = qs.filter(q => q.currency !== "ARS").reduce((s, q) => s + Number(q.netAmount || q.total || 0), 0);
    const ars = qs.filter(q => q.currency === "ARS").reduce((s, q) => s + Number(q.netAmount || q.total || 0), 0);
    return { usd, ars, count: qs.length };
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Kanban className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Pipeline de Cotizaciones</h1>
            <Badge variant="outline" className="text-xs">{quotes.length} cotizaciones</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Link href="/quotes/new">
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nueva</Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 180px)" }}>
          {COLUMNS.map(col => {
            const qs = byStatus(col.key);
            const { usd, ars, count } = colTotal(col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-72">
                <div className={`rounded-lg border ${col.border} ${col.bg} p-1`}>
                  <div className="px-2 py-2 mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold text-sm ${col.color}`}>{col.label}</span>
                      <Badge variant="outline" className={`text-xs ${col.color} border-current/40`}>{count}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {usd > 0 && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-mono">{fmt(usd, "USD")}</span>
                        </div>
                      )}
                      {ars > 0 && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-mono">{fmt(ars, "ARS")}</span>
                        </div>
                      )}
                      {usd === 0 && ars === 0 && (
                        <span className="italic">Sin monto</span>
                      )}
                    </div>
                  </div>
                  <div className="px-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
                    {qs.length === 0 && !loading && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                        <FileText className="h-8 w-8 mb-2" />
                        <span className="text-xs">Sin cotizaciones</span>
                      </div>
                    )}
                    {qs.map(q => <QuoteCard key={q.id} q={q} />)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
