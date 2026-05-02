import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Calendar, Download, Upload, Link as LinkIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

export default function CalendarSync() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>({ connected: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch(`${API}/api/gcal/status`, { credentials: "include" });
    setStatus(await r.json());
  };
  useEffect(() => { load(); }, []);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/gcal/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ enabled }) });
      if (!r.ok) { const e = await r.json(); toast({ title: e.error || "Error", variant: "destructive" }); }
      else { toast({ title: enabled ? "Sync activada" : "Sync pausada" }); load(); }
    } finally { setBusy(false); }
  };

  const push = async () => {
    setBusy(true);
    const r = await fetch(`${API}/api/gcal/push`, { method: "POST", credentials: "include" });
    const d = await r.json();
    if (r.ok) toast({ title: `Empujadas ${d.pushed}/${d.total} tareas a Google Calendar` });
    else toast({ title: d.error || "Error", variant: "destructive" });
    setBusy(false); load();
  };

  const pull = async () => {
    setBusy(true);
    const r = await fetch(`${API}/api/gcal/pull`, { method: "POST", credentials: "include" });
    const d = await r.json();
    if (r.ok) toast({ title: `Importadas ${d.imported}, actualizadas ${d.updated} desde Google Calendar` });
    else toast({ title: d.error || "Error", variant: "destructive" });
    setBusy(false); load();
  };

  const connectGmail = async () => {
    const r = await fetch(`${API}/api/gmail/connect`, { credentials: "include" });
    const d = await r.json();
    if (d.authUrl) window.location.href = d.authUrl;
    else toast({ title: d.error || "No se pudo iniciar OAuth", variant: "destructive" });
  };

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-2"><Calendar className="h-6 w-6" /><h1 className="text-2xl font-bold">Sincronización con Google Calendar</h1></div>
        <Card>
          <CardContent className="p-4 space-y-4">
            {!status.connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground"><AlertCircle className="h-5 w-5" />Aún no conectaste Google. Conectá Gmail (incluye Calendar).</div>
                <Button onClick={connectGmail}><LinkIcon className="h-4 w-4 mr-2" />Conectar Google</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><div><div className="font-medium">{status.email}</div><div className="text-xs text-muted-foreground">{status.lastSyncAt ? `Última sincronización: ${new Date(status.lastSyncAt).toLocaleString("es-AR")}` : "Sin sincronizaciones"}</div></div></div>
                  <div className="flex items-center gap-2"><Switch checked={!!status.syncEnabled} onCheckedChange={toggle} disabled={busy} /><span className="text-sm">{status.syncEnabled ? "Activa" : "Pausada"}</span></div>
                </div>
                <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
                  <p>Cuando la sync está activa, las tareas que crees en el CRM se publican como eventos en Google Calendar y los eventos de Calendar se traen como tareas (tipo reunión).</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={push} disabled={busy || !status.syncEnabled}><Upload className="h-4 w-4 mr-2" />Empujar tareas a Google</Button>
                  <Button variant="outline" onClick={pull} disabled={busy || !status.syncEnabled}><Download className="h-4 w-4 mr-2" />Traer eventos desde Google</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
