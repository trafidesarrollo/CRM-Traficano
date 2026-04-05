import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGetSalespeople, useCreateSalesperson, useDeleteSalesperson } from "@workspace/api-client-react";
import { Plus, Search, Trash2, UserSquare, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Salespeople() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", userId: "" });

  const { data: salespeople, isLoading, refetch } = useGetSalespeople();
  const createMut = useCreateSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor creado" }); setOpen(false); refetch(); setForm({ name: "", email: "", phone: "", userId: "" }); },
      onError: () => toast({ title: "Error al crear vendedor", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor eliminado" }); refetch(); },
    },
  });

  const filtered = (salespeople || []).filter((s: any) =>
    `${s.name} ${s.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Vendedores</h1>
          <p className="text-muted-foreground mt-1">{salespeople?.length || 0} vendedores activos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Vendedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Vendedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre completo</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>ID Usuario (opcional)</Label><Input type="number" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} /></div>
              <Button className="w-full" disabled={createMut.isPending || !form.name} onClick={() => createMut.mutate({ data: { ...form, userId: form.userId ? parseInt(form.userId) : undefined } as any })}>
                {createMut.isPending ? "Creando..." : "Crear Vendedor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar vendedores..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No se encontraron vendedores</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sp: any) => (
            <Card key={sp.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {sp.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{sp.name}</h3>
                      <p className="text-xs text-muted-foreground">{sp.isActive ? "Activo" : "Inactivo"}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: sp.id })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {sp.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" />{sp.email}</div>}
                  {sp.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" />{sp.phone}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
