import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGetProducts, useCreateProduct, useDeleteProduct } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Package, Ruler, ScrollText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "ARS",
  });

  const { data: products, isLoading, refetch } = useGetProducts();
  const createMut = useCreateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Producto creado" });
        setOpen(false);
        refetch();
        setForm({ name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "ARS" });
      },
      onError: () => toast({ title: "Error al crear producto", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteProduct({
    mutation: { onSuccess: () => { toast({ title: "Producto eliminado" }); refetch(); } },
  });

  const filtered = (products || []).filter((p: any) =>
    `${p.name} ${p.code || ""} ${p.category || ""} ${p.standard || ""} ${p.dimensions || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Productos</h1>
          <p className="text-muted-foreground mt-1">{products?.length || 0} productos en catálogo</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Producto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="TUB-001" /></div>
                <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Tubería" /></div>
              </div>
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tubo sin costura 2&quot; SCH40" /></div>
              <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Dimensiones</Label><Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder='60.3mm x 3.91mm' /></div>
                <div><Label>Norma</Label><Input value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} placeholder="ASTM A53" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Unidad</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="metro" /></div>
                <div><Label>Precio</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Moneda</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              </div>
              <Button className="w-full" disabled={createMut.isPending || !form.name} onClick={() => createMut.mutate({ data: { ...form, price: form.price || undefined } as any })}>
                {createMut.isPending ? "Creando..." : "Crear Producto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar productos por nombre, código, norma..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No se encontraron productos</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product: any) => (
            <Card key={product.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      {product.code && <Badge variant="outline" className="text-xs">{product.code}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                      {product.category && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{product.category}</span>}
                      {product.dimensions && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{product.dimensions}</span>}
                      {product.standard && <span className="flex items-center gap-1"><ScrollText className="w-3.5 h-3.5" />{product.standard}</span>}
                      {product.price && <span className="font-medium text-foreground">{product.currency} {parseFloat(product.price).toLocaleString("es-AR")}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: product.id })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
