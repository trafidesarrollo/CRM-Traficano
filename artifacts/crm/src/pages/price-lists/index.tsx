import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Save, X, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

export default function PriceLists() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ name: "", currency: "USD", isPurchase: false, isSale: true, isDefault: false });

  const load = () => fetch(`${API}/api/price-lists`, { credentials: "include" }).then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : (d.data || [])));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const url = editingId ? `${API}/api/price-lists/${editingId}` : `${API}/api/price-lists`;
    const r = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
    if (r.ok) { toast({ title: editingId ? "Lista actualizada" : "Lista creada" }); setOpen(false); setEditingId(null); setForm({ name: "", currency: "USD", isPurchase: false, isSale: true, isDefault: false }); load(); }
    else toast({ title: "Error", variant: "destructive" });
  };

  const del = async (id: number) => {
    if (!confirm("¿Eliminar lista de precios?")) return;
    await fetch(`${API}/api/price-lists/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Eliminada" });
    load();
  };

  const startEdit = (it: any) => {
    setEditingId(it.id);
    setForm({ name: it.name, currency: it.currency, isPurchase: it.isPurchase, isSale: it.isSale, isDefault: it.isDefault });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3"><Tag className="w-8 h-8 text-primary" />Listas de precios</h1>
          <p className="text-muted-foreground mt-1">{items.length} listas configuradas</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm({ name: "", currency: "USD", isPurchase: false, isSale: true, isDefault: false }); } }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nueva Lista</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Editar lista" : "Nueva lista de precios"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VENTA / REVENDEDOR / COMPRA" /></div>
              <div>
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">Dólar - u$s</SelectItem>
                    <SelectItem value="ARS">Pesos - $</SelectItem>
                    <SelectItem value="EUR">Euro - €</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg"><Label>Compra</Label><Switch checked={form.isPurchase} onCheckedChange={v => setForm({ ...form, isPurchase: v })} /></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg"><Label>Venta</Label><Switch checked={form.isSale} onCheckedChange={v => setForm({ ...form, isSale: v })} /></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg"><Label>Predeterminada</Label><Switch checked={form.isDefault} onCheckedChange={v => setForm({ ...form, isDefault: v })} /></div>
              <Button className="w-full" onClick={save}><Save className="w-4 h-4 mr-2" />Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b border-border/50">
              <tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="p-4">Lista</th>
                <th className="p-4">Moneda</th>
                <th className="p-4">Compra</th>
                <th className="p-4">Venta</th>
                <th className="p-4">Predeterminada</th>
                <th className="p-4 w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border/30 hover:bg-white/5">
                  <td className="p-4 font-medium">{it.name}</td>
                  <td className="p-4">{it.currency === "USD" ? "Dólar - u$s" : it.currency === "ARS" ? "Pesos - $" : it.currency}</td>
                  <td className="p-4">{it.isPurchase ? <Badge>Sí</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-4">{it.isSale ? <Badge>Sí</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-4">{it.isDefault ? <Badge variant="default">Default</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-4 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(it)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del(it.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (<tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No hay listas. Creá la primera.</td></tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
