import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["⌘/Ctrl", "K"], desc: "Abrir búsqueda global" },
  { keys: ["?"], desc: "Mostrar esta ayuda" },
  { keys: ["G", "D"], desc: "Ir al Dashboard" },
  { keys: ["G", "C"], desc: "Ir a Clientes" },
  { keys: ["G", "O"], desc: "Ir a Oportunidades" },
  { keys: ["G", "T"], desc: "Ir a Tareas" },
  { keys: ["G", "Q"], desc: "Ir a Cotizaciones" },
  { keys: ["G", "I"], desc: "Ir a Inbox Comercial" },
  { keys: ["G", "R"], desc: "Ir a Reportes" },
  { keys: ["G", "A"], desc: "Ir a Auditoría" },
  { keys: ["Esc"], desc: "Cerrar diálogos" },
];

const G_ROUTES: Record<string, string> = {
  d: "/dashboard", c: "/clients", o: "/opportunities", t: "/tasks",
  q: "/quotes", i: "/inbox", r: "/reports", a: "/audit",
};

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    let lastG = 0;
    function isTyping(t: EventTarget | null) {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      const now = Date.now();
      if (k === "g") { lastG = now; return; }
      if (now - lastG < 1500 && G_ROUTES[k]) {
        e.preventDefault();
        lastG = 0;
        setLocation(G_ROUTES[k]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setLocation]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Atajos de teclado</DialogTitle>
        <DialogDescription>Acelerá tu trabajo con estos shortcuts.</DialogDescription>
        <div className="mt-2 divide-y divide-border/50">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border/50">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Los shortcuts <kbd className="px-1 bg-muted rounded">G</kbd>+letra funcionan presionando G y luego la letra.</p>
      </DialogContent>
    </Dialog>
  );
}
