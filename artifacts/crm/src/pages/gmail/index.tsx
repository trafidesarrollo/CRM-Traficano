import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, RefreshCw, CheckCircle2, XCircle, Save, Trash2, Key, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SettingEntry {
  configured: boolean;
  masked: string;
  updatedAt: string;
}

function CredentialField({
  label,
  settingKey,
  settings,
  onSave,
  onDelete,
  placeholder,
  helpText,
}: {
  label: string;
  settingKey: string;
  settings: Record<string, SettingEntry>;
  onSave: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  placeholder?: string;
  helpText?: string;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const existing = settings[settingKey];

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(settingKey, value.trim());
    setValue("");
    setSaving(false);
  };

  return (
    <div className="space-y-2 p-4 bg-white/5 rounded-xl">
      <div className="flex items-center justify-between">
        <Label className="font-medium">{label}</Label>
        {existing && (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
            Configurado
          </Badge>
        )}
      </div>
      {existing && (
        <p className="font-mono text-xs text-muted-foreground">{existing.masked}</p>
      )}
      <div className="flex gap-2">
        <Input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={existing ? "Nuevo valor para reemplazar..." : (placeholder || "Pegar valor...")}
          className="font-mono text-sm"
        />
        <Button size="sm" onClick={handleSave} disabled={!value.trim() || saving}>
          <Save className="w-4 h-4 mr-1" />{saving ? "..." : "Guardar"}
        </Button>
        {existing && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(settingKey)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

export default function Gmail() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, SettingEntry>>({});
  const [syncing, setSyncing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const isAdmin = user?.role === "admin";

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gmail/status`, { credentials: "include" });
      const data = await res.json();
      setStatus(data);
      if (!data.connected) {
        const urlRes = await fetch(`${API_BASE}/api/gmail/connect`, { credentials: "include" });
        if (urlRes.ok) {
          const urlData = await urlRes.json();
          setAuthUrl(urlData.authUrl);
        }
      }
    } catch {} finally { setLoadingStatus(false); }
  };

  const fetchSettings = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings`, { credentials: "include" });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch {}
  };

  useEffect(() => { fetchStatus(); }, []);
  useEffect(() => { if (isAdmin) fetchSettings(); }, [isAdmin]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/gmail/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Sincronización completa", description: `${data.synced} emails sincronizados.` });
      } else {
        toast({ title: data.error || "Error sincronizando", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    } finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gmail/disconnect`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Gmail desconectado" });
        setStatus({ connected: false });
        fetchStatus();
      } else {
        toast({ title: "Error al desconectar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al desconectar", variant: "destructive" });
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        toast({ title: `${key} guardado` });
        fetchSettings();
        if (key.startsWith("GMAIL_")) fetchStatus();
      } else {
        const data = await res.json();
        toast({ title: data.error || "Error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const handleDeleteSetting = async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/${key}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: `${key} eliminado` });
        fetchSettings();
      } else {
        const data = await res.json();
        toast({ title: data.error || "Error al eliminar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  const gmailConfigured = !!settings["GMAIL_CLIENT_ID"] && !!settings["GMAIL_CLIENT_SECRET"];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Integración Gmail</h1>
        <p className="text-muted-foreground mt-1">Conectá tu cuenta corporativa para procesamiento IA.</p>
      </div>

      <Tabs defaultValue={isAdmin && !gmailConfigured ? "config" : "connection"} className="max-w-3xl">
        <TabsList className="mb-6">
          <TabsTrigger value="connection"><Mail className="w-4 h-4 mr-2" />Conexión</TabsTrigger>
          {isAdmin && <TabsTrigger value="config"><Settings2 className="w-4 h-4 mr-2" />Configuración</TabsTrigger>}
        </TabsList>

        <TabsContent value="connection">
          <Card className="bg-card border-border/50 shadow-xl">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${status?.connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                <Mail className="w-10 h-10" />
              </div>

              <h2 className="text-2xl font-bold mb-2">Estado de Conexión</h2>

              {loadingStatus ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mt-4"></div>
              ) : status?.connected ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full mb-6">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Conectado ({status.email})</span>
                  </div>
                  {status.lastSyncAt && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Última sincronización: {new Date(status.lastSyncAt).toLocaleString("es-AR")}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={handleSync} disabled={syncing}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                      Sincronizar Ahora
                    </Button>
                    <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleDisconnect}>
                      Desconectar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-zinc-400 bg-zinc-500/10 px-4 py-2 rounded-full mb-4">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Desconectado</span>
                  </div>

                  {!gmailConfigured && isAdmin ? (
                    <div className="text-sm text-muted-foreground mb-4">
                      <p>Primero configurá las credenciales de Google OAuth en la pestaña <strong>Configuración</strong>.</p>
                    </div>
                  ) : !gmailConfigured ? (
                    <div className="text-sm text-muted-foreground mb-4">
                      <p>Las credenciales de Gmail no están configuradas. Pedile al administrador que las configure.</p>
                    </div>
                  ) : null}

                  <Button
                    onClick={() => { if (authUrl) window.location.href = authUrl; }}
                    disabled={!authUrl || !gmailConfigured}
                    className="bg-white text-black hover:bg-zinc-200"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Conectar con Google
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="config">
            <Card className="bg-card border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Credenciales de Integración
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm space-y-2">
                  <p className="font-medium text-blue-400">Cómo obtener las credenciales de Gmail:</p>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                    <li>Ir a <a href="https://console.cloud.google.com" target="_blank" className="text-blue-400 underline">Google Cloud Console</a></li>
                    <li>Crear un proyecto y habilitar la <strong>Gmail API</strong></li>
                    <li>Ir a Credentials → Create OAuth 2.0 Client ID (tipo Web)</li>
                    <li>Agregar como Redirect URI: <code className="bg-white/10 px-1 rounded text-xs">{`${window.location.origin}/api/gmail/callback`}</code></li>
                    <li>Configurar OAuth Consent Screen y agregar tu email como usuario de prueba</li>
                    <li>Copiar Client ID y Client Secret y pegarlos abajo</li>
                  </ol>
                </div>

                <h3 className="text-sm font-semibold pt-2">Gmail OAuth</h3>

                <CredentialField
                  label="Gmail Client ID"
                  settingKey="GMAIL_CLIENT_ID"
                  settings={settings}
                  onSave={handleSaveSetting}
                  onDelete={handleDeleteSetting}
                  placeholder="xxxx.apps.googleusercontent.com"
                  helpText="El Client ID de tu aplicación OAuth en Google Cloud."
                />

                <CredentialField
                  label="Gmail Client Secret"
                  settingKey="GMAIL_CLIENT_SECRET"
                  settings={settings}
                  onSave={handleSaveSetting}
                  onDelete={handleDeleteSetting}
                  placeholder="GOCSPX-xxxx"
                  helpText="El Client Secret de tu aplicación OAuth en Google Cloud."
                />

                <CredentialField
                  label="Gmail Redirect URI (opcional)"
                  settingKey="GMAIL_REDIRECT_URI"
                  settings={settings}
                  onSave={handleSaveSetting}
                  onDelete={handleDeleteSetting}
                  placeholder={`${window.location.origin}/api/gmail/callback`}
                  helpText={`Se autocompleta si lo dejás vacío. Valor por defecto: ${window.location.origin}/api/gmail/callback`}
                />

                <div className="border-t border-border/30 pt-4">
                  <h3 className="text-sm font-semibold mb-3">OpenAI (IA)</h3>
                  <CredentialField
                    label="OpenAI API Key"
                    settingKey="OPENAI_API_KEY"
                    settings={settings}
                    onSave={handleSaveSetting}
                    onDelete={handleDeleteSetting}
                    placeholder="sk-xxxx"
                    helpText="Para clasificación de emails y extracción de medidas con GPT-4o-mini."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
