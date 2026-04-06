import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, Search, RefreshCw, Clock, ArrowDownLeft, ArrowUpRight,
  Circle, AlertCircle, ChevronRight, Mail, User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Conversation {
  id: number;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  type: string;
  status: string;
  priority: string;
  clientId: number | null;
  fromEmail: string | null;
  fromName: string | null;
  messageCount: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  assignedToId: number | null;
}

interface ConvMessage {
  id: number;
  direction: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  hasAttachments: boolean;
  receivedAt: string;
}

interface ConversationDetail extends Conversation {
  messages: ConvMessage[];
  events: any[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  nuevo: { label: "Nuevo", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  sin_asignar: { label: "Sin asignar", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  en_gestion: { label: "En gestión", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  esperando_cliente: { label: "Esperando cliente", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  esperando_interno: { label: "Esperando interno", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  resuelto: { label: "Resuelto", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  archivado: { label: "Archivado", color: "bg-zinc-600/10 text-zinc-500 border-zinc-600/20" },
};

const PRIORITY_DOT: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-orange-500",
  normal: "bg-blue-500",
  baja: "bg-zinc-500",
};

const STATUS_TABS = [
  { value: "", label: "Todos" },
  { value: "nuevo", label: "Nuevos" },
  { value: "en_gestion", label: "En gestión" },
  { value: "esperando_cliente", label: "Esperando" },
  { value: "resuelto", label: "Resueltos" },
  { value: "archivado", label: "Archivados" },
];

function timeAgo(date: string | null) {
  if (!date) return "-";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  } catch {
    return "-";
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function InboxComercial() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await fetch(`${API_BASE}/api/conversations?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data);
        setTotal(data.total);
        if (data.statusCounts) setStatusCounts(data.statusCounts);
      }
    } catch {} finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const fetchDetail = async (id: number) => {
    setLoadingDetail(true);
    setSelectedId(id);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${id}`, { credentials: "include" });
      if (res.ok) setDetail(await res.json());
    } catch {} finally { setLoadingDetail(false); }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" /> Inbox Comercial
            </h1>
            <p className="text-sm text-muted-foreground">{total} conversaciones</p>
          </div>
          <Button size="sm" variant="outline" onClick={fetchConversations}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
          </Button>
        </div>

        <div className="flex gap-1.5 mb-3 shrink-0 flex-wrap">
          {STATUS_TABS.map(tab => {
            const count = tab.value ? (statusCounts[tab.value] || 0) : total;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {tab.label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-[420px] shrink-0 flex flex-col border border-border/50 rounded-xl bg-card overflow-hidden">
            <div className="p-3 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por asunto o email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground px-4">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin conversaciones</p>
                  <p className="text-xs mt-1">Sincronizá Gmail para ver las conversaciones acá.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {conversations.map(conv => {
                    const isSelected = selectedId === conv.id;
                    const statusInfo = STATUS_LABELS[conv.status] || STATUS_LABELS.nuevo;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => fetchDetail(conv.id)}
                        className={`w-full text-left p-3 transition-colors hover:bg-white/5 ${
                          isSelected ? "bg-white/10 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${PRIORITY_DOT[conv.priority] || PRIORITY_DOT.normal}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {conv.fromName || conv.fromEmail || "Desconocido"}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {timeAgo(conv.lastMessageAt)}
                              </span>
                            </div>
                            <p className="text-sm truncate mt-0.5">{conv.subject}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.snippet}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusInfo.color}`}>
                                {statusInfo.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <MessageSquare className="w-3 h-3" /> {conv.messageCount}
                              </span>
                              {conv.unreadCount > 0 && (
                                <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 min-w-[18px] text-center font-medium">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 border border-border/50 rounded-xl bg-card overflow-hidden flex flex-col">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Seleccioná una conversación</p>
                  <p className="text-sm mt-1">Elegí un thread del panel izquierdo para ver los mensajes.</p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : detail ? (
              <>
                <div className="p-4 border-b border-border/30 shrink-0">
                  <h2 className="font-semibold text-lg">{detail.subject}</h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className={STATUS_LABELS[detail.status]?.color}>
                      {STATUS_LABELS[detail.status]?.label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Circle className={`w-2.5 h-2.5 ${PRIORITY_DOT[detail.priority]}`} />
                      {detail.priority}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {detail.messageCount} mensajes
                    </span>
                    {detail.fromEmail && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> {detail.fromEmail}
                      </span>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4 max-w-3xl">
                    {detail.messages.map(msg => {
                      const isInbound = msg.direction === "inbound";
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-xl p-4 ${
                            isInbound
                              ? "bg-white/5 border border-border/30"
                              : "bg-blue-500/5 border border-blue-500/20 ml-8"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {isInbound ? (
                                <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                              )}
                              <span className="text-sm font-medium">
                                {msg.fromName || msg.fromEmail}
                              </span>
                              {msg.fromName && (
                                <span className="text-xs text-muted-foreground font-mono">&lt;{msg.fromEmail}&gt;</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(msg.receivedAt).toLocaleString("es-AR", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>

                          {msg.toEmails?.length > 0 && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Para: {msg.toEmails.join(", ")}
                              {msg.ccEmails?.length > 0 && ` | CC: ${msg.ccEmails.join(", ")}`}
                            </p>
                          )}

                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.bodyText || (msg.bodyHtml ? stripHtml(msg.bodyHtml) : "(Sin contenido)")}
                          </div>

                          {msg.hasAttachments && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <AlertCircle className="w-3 h-3" /> Tiene adjuntos
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
