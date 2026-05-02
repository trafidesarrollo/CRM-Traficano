import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

type Match = { id: number; companyName?: string; taxId?: string; firstName?: string; lastName?: string; email?: string };

export function DuplicateWarning({
  entity, params, excludeId,
}: { entity: "clients" | "contacts"; params: Record<string, string>; excludeId?: number }) {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const filled = Object.values(params).filter(v => v && v.trim().length >= 3);
    if (!filled.length) { setMatches([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams(params);
        if (excludeId) qs.set("excludeId", String(excludeId));
        const r = await fetch(`${API}/api/duplicates/${entity}?${qs}`, { credentials: "include", signal: ctrl.signal });
        const d = await r.json();
        setMatches(d.matches || []);
      } catch {}
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [entity, JSON.stringify(params), excludeId]);

  if (!matches.length) return null;

  return (
    <div className="flex gap-2 p-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 text-sm">
      <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-yellow-200">Posibles duplicados ({matches.length})</p>
        <ul className="mt-1 space-y-0.5 text-xs text-yellow-100/80">
          {matches.map(m => (
            <li key={m.id}>
              #{m.id} — {entity === "clients" ? `${m.companyName}${m.taxId ? ` (${m.taxId})` : ""}` : `${m.firstName} ${m.lastName}${m.email ? ` · ${m.email}` : ""}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
