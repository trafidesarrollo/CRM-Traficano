import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, ChevronRight, Building2, Phone, Mail, MapPin, Fingerprint, Factory } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const REQUIRED_FIELDS: { key: string; label: string; icon: any }[] = [
  { key: "taxId",        label: "CUIT",       icon: Fingerprint },
  { key: "industry",     label: "Industria",  icon: Factory },
  { key: "phone",        label: "Teléfono",   icon: Phone },
  { key: "clientEmails", label: "Email",      icon: Mail },
  { key: "city",         label: "Ciudad",     icon: MapPin },
];

function getMissingFields(client: any): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_FIELDS) {
    if (f.key === "clientEmails") {
      if (!Array.isArray(client.clientEmails) || client.clientEmails.length === 0) missing.push(f.label);
    } else {
      if (!client[f.key]?.trim()) missing.push(f.label);
    }
  }
  return missing;
}

interface Props {
  /** If set, only show prospects assigned to this salesperson id */
  salespersonId?: number;
  maxItems?: number;
}

export function ProspectsNearPotential({ salespersonId, maxItems = 8 }: Props) {
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/clients?status=prospect&limit=500`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const all: any[] = data.data || [];
        // Filter by salesperson if needed
        const filtered = salespersonId
          ? all.filter(c => c.assignedSalespersonId === salespersonId)
          : all;

        // Compute missing fields and keep only those with 1 missing field
        const withMissing = filtered
          .map(c => ({ ...c, missing: getMissingFields(c) }))
          .filter(c => c.missing.length === 1)
          .slice(0, maxItems);

        setProspects(withMissing);
      })
      .catch(() => setProspects([]))
      .finally(() => setLoading(false));
  }, [salespersonId]);

  if (!loading && prospects.length === 0) return null;

  return (
    <Card className="bg-card/50 border-amber-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Prospectos a un paso de ser Potenciales
          {!loading && (
            <Badge className="ml-1 bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
              {prospects.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-4 pb-4 text-sm text-muted-foreground">Cargando...</div>
        ) : (
          <div className="divide-y divide-border/30">
            {prospects.map(c => {
              const missingLabel = c.missing[0];
              const fieldMeta = REQUIRED_FIELDS.find(f => f.label === missingLabel);
              const Icon = fieldMeta?.icon || Mail;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.companyName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.industry || c.city || c.taxId || "Sin datos adicionales"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5">
                      <Icon className="w-3 h-3" />
                      Falta {missingLabel}
                    </div>
                  </div>
                  <Link href={`/clients/${c.id}`}>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        {!loading && prospects.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30">
            <Link href="/clients?status=prospect">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full">
                Ver todos los prospectos
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
