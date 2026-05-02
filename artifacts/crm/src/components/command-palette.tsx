import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Building2, User, Package, Briefcase, FileText, ShoppingCart, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const ICONS: Record<string, any> = {
  client: Building2, contact: User, product: Package,
  opportunity: Briefcase, quote: FileText, order: ShoppingCart,
};

type Result = { kind: string; id: number; title: string; subtitle: string; url: string };

const RECENT_KEY = "crm:recentSearches";
function loadRecent(): Result[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecent(r: Result) {
  const list = loadRecent().filter(x => !(x.kind === r.kind && x.id === r.id));
  list.unshift(r);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [recent, setRecent] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [, setLocation] = useLocation();
  const tRef = useRef<any>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setRecent(loadRecent()); }
    else { setQ(""); setResults([]); setActive(0); }
  }, [open]);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    tRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
        const d = await r.json();
        setResults(d.results || []);
        setActive(0);
      } catch {} finally { setLoading(false); }
    }, 200);
  }, [q]);

  function go(r: Result) {
    setOpen(false);
    pushRecent(r);
    setLocation(r.url);
  }

  const visible = q.trim().length >= 2 ? results : recent;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, visible.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && visible[active]) { e.preventDefault(); go(visible[active]); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 top-[20%] translate-y-0">
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <DialogDescription className="sr-only">Buscá clientes, contactos, productos, oportunidades, cotizaciones y pedidos.</DialogDescription>
        <div className="flex items-center border-b border-border/50 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Buscar clientes, contactos, productos, cotizaciones…"
            className="border-0 focus-visible:ring-0 shadow-none text-base"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-[400px] overflow-y-auto p-1">
          {q.trim().length < 2 && recent.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Escribí al menos 2 caracteres. Usá <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd> y <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd>.
            </div>
          )}
          {q.trim().length < 2 && recent.length > 0 && (
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Recientes</div>
          )}
          {q.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin resultados</div>
          )}
          {visible.map((r, i) => {
            const Icon = ICONS[r.kind] || Search;
            return (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm ${i === active ? "bg-primary/10" : "hover:bg-muted/50"}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">{r.kind}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground flex justify-between">
          <span>Búsqueda global</span>
          <span><kbd className="px-1 bg-muted rounded">⌘K</kbd> para abrir/cerrar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
