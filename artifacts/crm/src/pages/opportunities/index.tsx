import { useGetOpportunities } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { getOppStatusLabel } from "@/lib/translations";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Opportunities() {
  const { data: response, isLoading } = useGetOpportunities();

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Oportunidades</h1>
        <p className="text-muted-foreground mt-1">Gestión de cotizaciones y ventas en curso.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {response?.data?.map(opp => (
            <div key={opp.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg hover:border-primary/30 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline" className="bg-white/5">{getOppStatusLabel(opp.status)}</Badge>
                <Badge variant="outline" className={getPriorityColor(opp.priority)}>{opp.priority}</Badge>
              </div>
              <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{opp.title}</h3>
              {opp.estimatedValue && (
                <p className="text-2xl font-display font-bold text-foreground mb-4">
                  {opp.currency || 'USD'} {opp.estimatedValue.toLocaleString()}
                </p>
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Creado: {format(new Date(opp.createdAt), "dd MMM, yyyy", { locale: es })}</p>
                {opp.nextFollowUpAt && <p className="text-primary/80">Seguimiento: {format(new Date(opp.nextFollowUpAt), "dd MMM", { locale: es })}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
