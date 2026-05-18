import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { TodayTasks } from "@/components/today-tasks";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus, Users, CalendarDays, Package, Clock, CheckCircle2, Send } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-500/20 text-gray-300" },
  sent: { label: "Enviada", color: "bg-blue-500/20 text-blue-300" },
  approved: { label: "Aprobada", color: "bg-green-500/20 text-green-300" },
  rejected: { label: "Rechazada", color: "bg-red-500/20 text-red-300" },
  partial: { label: "Parcial", color: "bg-yellow-500/20 text-yellow-300" },
  expired: { label: "Vencida", color: "bg-orange-500/20 text-orange-300" },
};

export default function DashboardVendedor() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/quotes?limit=50`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setQuotes(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = {
    draft: quotes.filter(q => q.status === "draft").length,
    sent: quotes.filter(q => q.status === "sent").length,
    approved: quotes.filter(q => q.status === "approved").length,
  };

  const recent = quotes.slice(0, 10);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">
          Bienvenido, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">Resumen de tu actividad comercial.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.draft}</p>
              <p className="text-sm text-muted-foreground">En borrador</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Send className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.sent}</p>
              <p className="text-sm text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.approved}</p>
              <p className="text-sm text-muted-foreground">Aprobadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card className="bg-card/50 border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Mis cotizaciones recientes
              </CardTitle>
              <Link href="/quotes/new">
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nueva</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
              ) : recent.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay cotizaciones aún.{" "}
                  <Link href="/quotes/new" className="text-primary underline">Crear una</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/50">
                      <tr className="text-left text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-3">Número</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(q => {
                        const s = STATUS_LABELS[q.status] || { label: q.status, color: "bg-gray-500/20 text-gray-300" };
                        return (
                          <tr key={q.id} className="border-b border-border/30 hover:bg-white/5">
                            <td className="px-4 py-3">
                              <Link href={`/quotes/${q.id}`} className="font-mono text-primary hover:underline">
                                {q.number || `#${q.id}`}
                              </Link>
                            </td>
                            <td className="px-4 py-3 max-w-[160px] truncate">{q.clientName || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {q.date ? new Date(q.date).toLocaleDateString("es-AR") : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs">
                              {Number(q.netAmount || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })} {q.currency === "USD" ? "u$s" : q.currency}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={s.color}>{s.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <TodayTasks />

          <Card className="bg-card/50 border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/quotes/new">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="w-4 h-4 text-primary" />Nueva cotización
                </Button>
              </Link>
              <Link href="/clients">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="w-4 h-4 text-primary" />Ver clientes
                </Button>
              </Link>
              <Link href="/calendar">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />Calendario
                </Button>
              </Link>
              <Link href="/products">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Package className="w-4 h-4 text-primary" />Productos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
