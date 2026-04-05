import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetPrompts, useCreatePrompt, useActivatePrompt } from "@workspace/api-client-react";
import { Plus, CheckCircle2, Circle, Bot, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Prompts() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", promptType: "classification", content: "", description: "" });

  const { data: prompts, isLoading, refetch } = useGetPrompts();
  const createMut = useCreatePrompt({
    mutation: {
      onSuccess: () => { toast({ title: "Prompt creado" }); setOpen(false); refetch(); },
      onError: () => toast({ title: "Error al crear prompt", variant: "destructive" }),
    },
  });
  const activateMut = useActivatePrompt({
    mutation: {
      onSuccess: () => { toast({ title: "Prompt activado" }); refetch(); },
    },
  });

  const grouped = (prompts || []).reduce((acc: Record<string, any[]>, p: any) => {
    const key = p.promptType || "otro";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const TYPE_LABELS: Record<string, string> = {
    classification: "Clasificación de Emails",
    extraction: "Extracción de Datos",
    reply: "Generación de Respuestas",
    summary: "Resumen",
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Prompts IA</h1>
          <p className="text-muted-foreground mt-1">Gestión de prompts para clasificación y extracción con IA.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Prompt</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nuevo Prompt</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Clasificación v2" /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.promptType} onValueChange={(v) => setForm({ ...form, promptType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classification">Clasificación</SelectItem>
                      <SelectItem value="extraction">Extracción</SelectItem>
                      <SelectItem value="reply">Respuesta</SelectItem>
                      <SelectItem value="summary">Resumen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Contenido del Prompt</Label><Textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Eres un asistente que clasifica emails comerciales..." className="font-mono text-sm" /></div>
              <Button className="w-full" disabled={createMut.isPending || !form.name || !form.content} onClick={() => createMut.mutate({ data: form as any })}>
                {createMut.isPending ? "Creando..." : "Crear Prompt"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No hay prompts configurados</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, list]: [string, any[]]) => (
            <div key={type}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {TYPE_LABELS[type] || type}
              </h2>
              <div className="space-y-3">
                {list.map((prompt: any) => (
                  <Card key={prompt.id} className={`bg-card/50 backdrop-blur-sm transition-colors ${prompt.isActive ? "border-primary/30" : "border-white/5"}`}>
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold">{prompt.name}</h3>
                            {prompt.isActive ? (
                              <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Activo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground"><Circle className="w-3 h-3 mr-1" />Inactivo</Badge>
                            )}
                            <Badge variant="outline">v{prompt.version}</Badge>
                          </div>
                          {prompt.description && <p className="text-sm text-muted-foreground mt-1">{prompt.description}</p>}
                          <pre className="mt-3 text-xs text-muted-foreground bg-black/20 p-3 rounded-lg overflow-x-auto max-h-32">{prompt.content?.substring(0, 300)}{prompt.content?.length > 300 ? "..." : ""}</pre>
                        </div>
                        {!prompt.isActive && (
                          <Button variant="outline" size="sm" onClick={() => activateMut.mutate({ id: prompt.id })}>
                            Activar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
