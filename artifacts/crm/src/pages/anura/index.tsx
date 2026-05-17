import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, RefreshCw, Clock, Play, PhoneIncoming, PhoneOutgoing,
  PhoneMissed, CheckCircle, XCircle, User, Users, Save
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface AnuraWebhook {
  id: number;
  event: string | null;
  externalCallId: string | null;
  phone: string | null;
  toNumber: string | null;
  direction: string | null;
  status: string | null;
  durationSeconds: number | null;
  agentId: string | null;
  recordingUrl: string | null;
  occurredAt: string | null;
  rawPayload: any;
  clientId: number | null;
  salespersonId: number | null;
  notes: string | null;
  receivedAt: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  answered: { label: "Contestada", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  missed: { label: "Perdida", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  busy: { label: "Ocupado", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  no_answer: { label: "Sin respuesta", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  failed: { label: "Fallida", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getCallDate(wh: AnuraWebhook): Date {
  const raw = wh.occurredAt || wh.receivedAt;
  try { return new Date(raw); } catch { return new Date(wh.receivedAt); }
}

function formatDateLabel(d: Date): string {
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "EEEE d 'de' MMMM, yyyy", { locale: es });
}

function formatTime(d: Date): string {
  return format(d, "HH:mm", { locale: es });
}

export default function AnuraPage() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<AnuraWebhook[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/anura/webhooks?limit=50`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchWebhooks();
    fetch(`${API_BASE}/api/clients`, { credentials: "include" }).then(r => r.json()).then(d => setClients(d.data || d || [])).catch(() => {});
    fetch(`${API_BASE}/api/salespeople`, { credentials: "include" }).then(r => r.json()).then(d => setSalespeople(Array.isArray(d) ? d : d.data || [])).catch(() => {});
  }, [fetchWebhooks]);

  const selected = webhooks.find(w => w.id === selectedId);

  const groupedByDate = useMemo(() => {
    const sorted = [...webhooks].sort((a, b) => {
      const da = getCallDate(a).getTime();
      const db = getCallDate(b).getTime();
      return db - da;
    });
    const groups: { label: string; dateKey: string; items: AnuraWebhook[] }[] = [];
    for (const wh of sorted) {
      const d = getCallDate(wh);
      const dateKey = format(d, "yyyy-MM-dd");
      const last = groups[groups.length - 1];
      if (last && last.dateKey === dateKey) {
        last.items.push(wh);
      } else {
        groups.push({ label: formatDateLabel(d), dateKey, items: [wh] });
      }
    }
    return groups;
  }, [webhooks]);

  const handleAssign = async (field: string, value: any) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/anura/webhooks/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [field]: value || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWebhooks(prev => prev.map(w => w.id === updated.id ? updated : w));
        toast({ title: "Asignación guardada" });
      }
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const getClientName = (id: number | null) => {
    if (!id) return null;
    const c = clients.find((c: any) => c.id === id);
    return c?.name || c?.companyName || `#${id}`;
  };

  const getSpName = (id: number | null) => {
    if (!id) return null;
    const s = salespeople.find((s: any) => s.id === id);
    return s?.name || `#${id}`;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Phone className="w-6 h-6" /> Anura — Llamadas
            </h1>
            <p className="text-sm text-muted-foreground">{total} webhooks recibidos</p>
          </div>
          <Button size="sm" variant="outline" onClick={fetchWebhooks}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
          </Button>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-[460px] shrink-0 flex flex-col border border-border/50 rounded-xl bg-card overflow-hidden">
            <div className="p-3 border-b border-border/30 text-sm font-medium text-muted-foreground">
              Últimas llamadas
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground px-4">
                  <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin webhooks recibidos</p>
                  <p className="text-xs mt-1">Cuando Anura envíe una llamada, aparece acá.</p>
                </div>
              ) : (
                <div>
                  {groupedByDate.map(group => (
                    <div key={group.dateKey}>
                      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-3 py-2 border-b border-border/30">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.label}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({group.items.length} {group.items.length === 1 ? "llamada" : "llamadas"})
                        </span>
                      </div>
                      <div className="divide-y divide-border/20">
                        {group.items.map(wh => {
                          const isSelected = selectedId === wh.id;
                          const statusInfo = STATUS_BADGE[wh.status || ""] || {
                            label: wh.status || wh.event || "Webhook",
                            color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                          };
                          const DirectionIcon = wh.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
                          const callDate = getCallDate(wh);

                          return (
                            <button
                              key={wh.id}
                              onClick={() => setSelectedId(wh.id)}
                              className={`w-full text-left p-3 transition-colors hover:bg-white/5 ${
                                isSelected ? "bg-white/10 border-l-2 border-l-primary" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${wh.direction === "inbound" ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                                  <DirectionIcon className={`w-4 h-4 ${wh.direction === "inbound" ? "text-green-400" : "text-blue-400"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium font-mono">{wh.phone || "Sin número"}</span>
                                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                                      {formatTime(callDate)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </Badge>
                                    {wh.durationSeconds && wh.durationSeconds > 0 && (
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                        <Clock className="w-3 h-3" /> {formatDuration(wh.durationSeconds)}
                                      </span>
                                    )}
                                    {wh.salespersonId && (
                                      <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                                        <User className="w-3 h-3" /> {getSpName(wh.salespersonId)}
                                      </span>
                                    )}
                                    {wh.clientId && (
                                      <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                                        <Users className="w-3 h-3" /> {getClientName(wh.clientId)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 border border-border/50 rounded-xl bg-card overflow-hidden flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Phone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Seleccioná una llamada</p>
                  <p className="text-sm mt-1">Elegí un webhook del panel izquierdo para ver los detalles.</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6 max-w-2xl">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      {selected.direction === "inbound" ? (
                        <PhoneIncoming className="w-5 h-5 text-green-400" />
                      ) : (
                        <PhoneOutgoing className="w-5 h-5 text-blue-400" />
                      )}
                      Llamada {selected.direction === "inbound" ? "entrante" : "saliente"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recibido {new Date(selected.receivedAt).toLocaleString("es-AR")}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InfoField label="Teléfono origen" value={selected.phone} />
                    <InfoField label="Teléfono destino" value={selected.toNumber} />
                    <InfoField label="Estado" value={STATUS_BADGE[selected.status || ""]?.label || selected.status} />
                    <InfoField label="Duración" value={formatDuration(selected.durationSeconds)} />
                    <InfoField label="Evento" value={selected.event} />
                    <InfoField label="ID llamada" value={selected.externalCallId} />
                    <InfoField label="Agente Anura" value={selected.agentId} />
                    <InfoField label="Ocurrió" value={selected.occurredAt} />
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-border/30 space-y-4">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Save className="w-4 h-4" /> Asignar a vendedor y cliente
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Vendedor</p>
                        <Select
                          value={selected.salespersonId?.toString() || "none"}
                          onValueChange={(v) => handleAssign("salespersonId", v === "none" ? null : parseInt(v))}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {salespeople.map((sp: any) => (
                              <SelectItem key={sp.id} value={sp.id.toString()}>{sp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                        <Select
                          value={selected.clientId?.toString() || "none"}
                          onValueChange={(v) => handleAssign("clientId", v === "none" ? null : parseInt(v))}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {clients.map((c: any) => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name || c.companyName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {selected.recordingUrl && (
                    <div className="bg-white/5 rounded-xl p-4 border border-border/30">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Play className="w-4 h-4" /> Grabación
                      </p>
                      <audio controls className="w-full" src={selected.recordingUrl}>
                        Tu navegador no soporta audio.
                      </audio>
                      <a href={selected.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-2 inline-block">
                        Abrir MP3 en nueva pestaña
                      </a>
                    </div>
                  )}

                  <div className="bg-white/5 rounded-xl p-4 border border-border/30">
                    <p className="text-sm font-medium mb-2">Payload completo (JSON)</p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all bg-black/20 rounded-lg p-3 max-h-80 overflow-auto">
                      {JSON.stringify(selected.rawPayload, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || "-"}</p>
    </div>
  );
}
