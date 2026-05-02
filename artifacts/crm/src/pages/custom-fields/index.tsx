import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Sliders, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const ENTITIES = ["client", "contact", "opportunity", "quote", "order", "product"];
const FIELD_TYPES = ["text", "number", "date", "boolean", "select", "textarea", "url", "email"];

export default function CustomFields() {
  const { toast } = useToast();
  const [entityType, setEntityType] = useState("client");
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ entityType: "client", fieldKey: "", label: "", fieldType: "text", isRequired: false, options: "" });

  const load = async () => {
    const r = await fetch(`${API}/api/custom-fields/defs?entityType=${entityType}`, { credentials: "include" });
    const d = await r.json(); setItems(d.data || []);
  };
  useEffect(() => { load(); }, [entityType]);

  const save = async () => {
    if (!form.fieldKey || !form.label) { toast({ title: "Clave y etiqueta requeridos", variant: "destructive" }); return; }
    const body: any = { ...form, entityType };
    if (form.fieldType === "select" && form.options) body.options = form.options.split(",").map((s: string) => s.trim()).filter(Boolean);
    const r = await fetch(`${API}/api/custom-fields/defs`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (r.ok) { toast({ title: "Campo creado" }); setOpen(false); setForm({ entityType, fieldKey: "", label: "", fieldType: "text", isRequired: false, options: "" }); load(); }
    else toast({ title: "Error - clave duplicada?", variant: "destructive" });
  };

  const del = async (id: number) => { if (!confirm("¿Eliminar campo? Se eliminarán todos sus valores.")) return; await fetch(`${API}/api/custom-fields/defs/${id}`, { method: "DELETE", credentials: "include" }); load(); };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Sliders className="h-6 w-6" /><h1 className="text-2xl font-bold">Campos personalizados</h1></div>
          <div className="flex gap-2">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{ENTITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground"><th className="text-left p-2">Clave</th><th className="text-left p-2">Etiqueta</th><th className="text-left p-2">Tipo</th><th className="text-left p-2">Requerido</th><th className="text-right p-2"></th></tr></thead>
              <tbody>
                {items.map(f => (
                  <tr key={f.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono text-xs">{f.fieldKey}</td>
                    <td className="p-2">{f.label}</td>
                    <td className="p-2"><Badge variant="outline">{f.fieldType}</Badge></td>
                    <td className="p-2">{f.isRequired ? "Sí" : "No"}</td>
                    <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => del(f.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button></td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">No hay campos personalizados</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo campo personalizado</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Clave (sin espacios, ej: cuit_facturacion)</Label><Input value={form.fieldKey} onChange={e => setForm({ ...form, fieldKey: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })} /></div>
              <div><Label>Etiqueta</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.fieldType} onValueChange={v => setForm({ ...form, fieldType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.fieldType === "select" && (
                <div><Label>Opciones (separadas por coma)</Label><Input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} placeholder="Opción 1, Opción 2, Opción 3" /></div>
              )}
              <div className="flex items-center gap-2"><Switch checked={form.isRequired} onCheckedChange={v => setForm({ ...form, isRequired: v })} /><Label>Requerido</Label></div>
              <Button onClick={save} className="w-full">Crear</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
