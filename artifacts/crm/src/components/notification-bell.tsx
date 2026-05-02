import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

const API = import.meta.env.VITE_API_URL || "";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/notifications?limit=20`, { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      setItems(j.data || []);
      setUnread(j.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  const markRead = async (id: number) => {
    await fetch(`${API}/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
    load();
  };
  const markAll = async () => {
    await fetch(`${API}/api/notifications/read-all`, { method: "POST", credentials: "include" });
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <h3 className="font-bold">Notificaciones</h3>
          {unread > 0 && <Button size="sm" variant="ghost" onClick={markAll}><Check className="w-3 h-3 mr-1" />Marcar todas</Button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No hay notificaciones</div>}
          {items.map(n => (
            <div key={n.id} className={`p-3 border-b border-border/30 hover:bg-white/5 ${n.isRead ? "" : "bg-primary/5"}`}>
              <div className="flex items-start gap-2">
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("es-AR")}</div>
                  {n.link && (
                    <Link href={n.link}>
                      <a className="text-xs text-primary hover:underline mt-1 inline-block" onClick={() => { markRead(n.id); setOpen(false); }}>Ver →</a>
                    </Link>
                  )}
                </div>
                {!n.isRead && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}><Check className="w-3 h-3" /></Button>}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
