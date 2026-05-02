import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Mail, Plus, Edit, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtml } from "@/lib/sanitize";

const API = import.meta.env.VITE_API_URL || "";
const CATEGORIES = ["general", "cliente", "cotizacion", "pedido", "cobranza", "seguimiento"];

export default function EmailTemplates() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", category: "general", subject: "", bodyHtml: "", isActive: true });

  const load = async () => {
    const r = await fetch(`${API}/api/email-templates`, { credentials: "include" });
    const d = await r.json(); setItems(d.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.subject) { toast({ title: "Nombre y asunto requeridos", variant: "destructive" }); return; }
    const url = editing ? `${API}/api/email-templates/${editing.id}` : `${API}/api/email-templates`;
    const r = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
    if (r.ok) { toast({ title: editing ? "Actualizada" : "Creada" }); setOpen(false); setEditing(null); setForm({ name: "", category: "general", subject: "", bodyHtml: "", isActive: true }); load(); }
    else toast({ title: "Error", variant: "destructive" });
  };

  const edit = (t: any) => { setEditing(t); setForm({ name: t.name, category: t.category, subject: t.subject, bodyHtml: t.bodyHtml, isActive: t.isActive }); setOpen(true); };
  const del = async (id: number) => { if (!confirm("¿Eliminar plantilla?")) return; await fetch(`${API}/api/email-templates/${id}`, { method: "DELETE", credentials: "include" }); load(); };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Mail className="h-6 w-6" /><h1 className="text-2xl font-bold">Plantillas de email</h1></div>
          <Button onClick={() => { setEditing(null); setForm({ name: "", category: "general", subject: "", bodyHtml: "", isActive: true }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nueva</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t.name}</h3>
                  <Badge variant="outline">{t.category}</Badge>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1">{t.subject}</div>
                <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.bodyHtml) }} />
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setPreview(t)}><Eye className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => edit(t)}><Edit className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => del(t.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} plantilla</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Categoría</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Asunto</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div><Label>Cuerpo (HTML, usa {`{{variable}}`} para variables)</Label><Textarea rows={10} value={form.bodyHtml} onChange={e => setForm({ ...form, bodyHtml: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} /><Label>Activa</Label></div>
              <Button onClick={save} className="w-full">{editing ? "Actualizar" : "Crear"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Vista previa: {preview?.name}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <div className="text-sm"><b>Asunto:</b> {preview?.subject}</div>
              <div className="border rounded p-4 bg-white text-black" dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview?.bodyHtml || "") }} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
