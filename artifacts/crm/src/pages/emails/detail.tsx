import { useRoute } from "wouter";
import { 
  useGetEmail, 
  useProcessEmail, 
  useGenerateReplyDraft,
  useClassifyEmail,
  EmailCategory
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, FileText, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { categoryLabels, getCategoryColor, getEmailStatusLabel } from "@/lib/translations";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EmailDetail() {
  const [, params] = useRoute("/emails/:id");
  const id = parseInt(params?.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: email, isLoading } = useGetEmail(id);
  const processMut = useProcessEmail({
    mutation: {
      onSuccess: () => {
        toast({ title: "Email procesado con éxito" });
        queryClient.invalidateQueries({ queryKey: [`/api/emails/${id}`] });
      },
      onError: () => toast({ title: "Error al procesar", variant: "destructive" })
    }
  });

  const draftMut = useGenerateReplyDraft({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Borrador generado" });
        setDraft(data.body);
      },
      onError: () => toast({ title: "Error al generar borrador", variant: "destructive" })
    }
  });

  const classifyMut = useClassifyEmail({
    mutation: {
      onSuccess: () => {
        toast({ title: "Clasificación actualizada" });
        queryClient.invalidateQueries({ queryKey: [`/api/emails/${id}`] });
      }
    }
  });

  const [draft, setDraft] = useState<string | null>(null);

  if (isLoading) return <AppLayout><div className="p-8 text-center">Cargando...</div></AppLayout>;
  if (!email) return <AppLayout><div className="p-8 text-center text-destructive">Email no encontrado</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href="/emails" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a Inbox
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-bold leading-tight">{email.subject}</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="bg-card border-border hover:bg-white/5"
              onClick={() => draftMut.mutate({ id })}
              disabled={draftMut.isPending}
            >
              <FileText className="w-4 h-4 mr-2 text-blue-400" />
              {draftMut.isPending ? "Generando..." : "Generar Borrador IA"}
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
              onClick={() => processMut.mutate({ id })}
              disabled={processMut.isPending || email.status === 'processed'}
            >
              <Bot className="w-4 h-4 mr-2" />
              {processMut.isPending ? "Procesando..." : email.status === 'processed' ? "Procesado" : "Procesar con IA"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border/50 shadow-xl overflow-hidden">
            <div className="bg-white/5 px-6 py-4 border-b border-border/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <p className="font-medium text-foreground">{email.fromName || email.fromEmail}</p>
                <p className="text-sm text-muted-foreground">&lt;{email.fromEmail}&gt; para {email.toEmail}</p>
              </div>
              <div className="text-sm text-muted-foreground text-right">
                {format(new Date(email.receivedAt), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
              </div>
            </div>
            <CardContent className="p-6 text-foreground/90 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {email.body}
            </CardContent>
          </Card>

          {draft && (
            <Card className="bg-blue-900/10 border-blue-500/20 shadow-xl">
              <CardHeader className="pb-3 border-b border-blue-500/10">
                <CardTitle className="text-lg flex items-center text-blue-400">
                  <Bot className="w-5 h-5 mr-2" />
                  Borrador Sugerido
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <textarea 
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm min-h-[200px] focus:outline-none focus:border-blue-500/50"
                  defaultValue={draft}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDraft(null)}>Descartar</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">Enviar Respuesta</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="bg-card border-border/50 shadow-xl">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Metadatos</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Estado</p>
                <Badge variant="outline" className="text-sm px-3 py-1 bg-white/5">{getEmailStatusLabel(email.status)}</Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Clasificación IA</p>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={`text-sm px-3 py-1 ${getCategoryColor(email.category)}`}>
                    {email.category ? categoryLabels[email.category] : "Pendiente"}
                  </Badge>
                  {email.categoryConfidence && (
                    <span className="text-xs text-muted-foreground flex items-center">
                      {email.categoryConfidence > 0.8 ? <CheckCircle2 className="w-3 h-3 text-emerald-500 mr-1" /> : <AlertTriangle className="w-3 h-3 text-amber-500 mr-1" />}
                      {Math.round(email.categoryConfidence * 100)}%
                    </span>
                  )}
                </div>
                
                {/* Manual Correction */}
                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs text-muted-foreground mb-2">Corregir clasificación:</p>
                  <Select 
                    value={email.category || undefined} 
                    onValueChange={(val) => classifyMut.mutate({ id, data: { category: val as any } })}
                  >
                    <SelectTrigger className="w-full bg-black/20 border-white/10">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-white/10">
                      {Object.entries(categoryLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {email.extractedData && Object.keys(email.extractedData).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Datos Extraídos</p>
                  <div className="bg-black/30 rounded-xl p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                    <pre>{JSON.stringify(email.extractedData, null, 2)}</pre>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
