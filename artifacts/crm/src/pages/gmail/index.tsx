import { useGetGmailStatus, useGetGmailAuthUrl, useSyncGmail } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Gmail() {
  const { data: status, refetch } = useGetGmailStatus();
  const { data: authUrl } = useGetGmailAuthUrl({ query: { enabled: !status?.connected } });
  const { toast } = useToast();

  const syncMut = useSyncGmail({
    mutation: {
      onSuccess: (res) => toast({ title: "Sincronización completa", description: `${res.synced} emails sincronizados.` }),
      onError: () => toast({ title: "Error sincronizando", variant: "destructive" })
    }
  });

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Integración Gmail</h1>
        <p className="text-muted-foreground mt-1">Conecta tu cuenta corporativa para procesamiento IA.</p>
      </div>

      <Card className="bg-card border-border/50 max-w-2xl shadow-xl">
        <CardContent className="p-8 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${status?.connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
            <Mail className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">Estado de Conexión</h2>
          
          {status?.connected ? (
            <>
              <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full mb-6">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Conectado ({status.email})</span>
              </div>
              <Button 
                onClick={() => syncMut.mutate()} 
                disabled={syncMut.isPending}
                className="w-full sm:w-auto bg-primary text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncMut.isPending ? 'animate-spin' : ''}`} />
                Sincronizar Ahora
              </Button>
            </>
          ) : (
             <>
              <div className="flex items-center gap-2 text-zinc-400 bg-zinc-500/10 px-4 py-2 rounded-full mb-6">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Desconectado</span>
              </div>
              <Button 
                onClick={() => { if(authUrl) window.location.href = authUrl.authUrl; }}
                disabled={!authUrl}
                className="bg-white text-black hover:bg-zinc-200"
              >
                Conectar con Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
