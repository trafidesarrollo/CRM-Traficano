import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGetProducts, useCreateProduct, useDeleteProduct, useUpdateProduct } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Package, Ruler, ScrollText, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

const UNIT_GROUPS: { label: string; units: { value: string; label: string }[] }[] = [
  {
    label: "Longitud",
    units: [
      { value: "m", label: "m — Metro" },
      { value: "mm", label: "mm — Milímetro" },
      { value: "cm", label: "cm — Centímetro" },
      { value: "km", label: "km — Kilómetro" },
      { value: "pulg", label: "pulg — Pulgada" },
      { value: "pie", label: "pie — Pie" },
    ],
  },
  {
    label: "Masa / Peso",
    units: [
      { value: "kg", label: "kg — Kilogramo" },
      { value: "g", label: "g — Gramo" },
      { value: "tn", label: "tn — Tonelada métrica" },
      { value: "lb", label: "lb — Libra" },
    ],
  },
  {
    label: "Área",
    units: [
      { value: "m2", label: "m² — Metro cuadrado" },
      { value: "cm2", label: "cm² — Centímetro cuadrado" },
      { value: "mm2", label: "mm² — Milímetro cuadrado" },
    ],
  },
  {
    label: "Volumen / Capacidad",
    units: [
      { value: "m3", label: "m³ — Metro cúbico" },
      { value: "lt", label: "lt — Litro" },
      { value: "ml", label: "ml — Mililitro" },
      { value: "gl", label: "gl — Galón" },
    ],
  },
  {
    label: "Unidades / Piezas",
    units: [
      { value: "u", label: "u — Unidad" },
      { value: "pza", label: "pza — Pieza" },
      { value: "par", label: "par — Par" },
      { value: "jgo", label: "jgo — Juego" },
      { value: "set", label: "set — Set / Kit" },
      { value: "kit", label: "kit — Kit" },
      { value: "doc", label: "doc — Docena" },
      { value: "ciento", label: "ciento — Ciento" },
      { value: "millar", label: "millar — Millar" },
    ],
  },
  {
    label: "Formato industrial",
    units: [
      { value: "barra", label: "barra — Barra" },
      { value: "tubo", label: "tubo — Tubo" },
      { value: "caño", label: "caño — Caño" },
      { value: "rollo", label: "rollo — Rollo" },
      { value: "bobina", label: "bobina — Bobina" },
      { value: "plancha", label: "plancha — Plancha" },
      { value: "chapa", label: "chapa — Chapa" },
      { value: "varilla", label: "varilla — Varilla" },
      { value: "perfil", label: "perfil — Perfil" },
      { value: "viga", label: "viga — Viga" },
      { value: "codo", label: "codo — Codo" },
      { value: "te", label: "te — Te" },
      { value: "reduccion", label: "reducción — Reducción" },
      { value: "brida", label: "brida — Brida" },
      { value: "junta", label: "junta — Junta" },
      { value: "valvula", label: "válvula — Válvula" },
      { value: "filtro", label: "filtro — Filtro" },
      { value: "tapa", label: "tapa — Tapa" },
    ],
  },
  {
    label: "Envase / Contenedor",
    units: [
      { value: "caja", label: "caja — Caja" },
      { value: "bolsa", label: "bolsa — Bolsa" },
      { value: "saco", label: "saco — Saco" },
      { value: "balde", label: "balde — Balde" },
      { value: "lata", label: "lata — Lata" },
      { value: "tambor", label: "tambor — Tambor" },
      { value: "garrafa", label: "garrafa — Garrafa" },
      { value: "bidon", label: "bidón — Bidón" },
      { value: "pallet", label: "pallet — Pallet" },
    ],
  },
  {
    label: "Tiempo",
    units: [
      { value: "hr", label: "hr — Hora" },
      { value: "dia", label: "día — Día" },
      { value: "mes", label: "mes — Mes" },
    ],
  },
  {
    label: "Eléctrico / Electrónico",
    units: [
      { value: "w", label: "W — Watt" },
      { value: "kw", label: "kW — Kilowatt" },
      { value: "kwh", label: "kWh — Kilowatt·hora" },
      { value: "A", label: "A — Ampere" },
      { value: "v", label: "V — Volt" },
    ],
  },
];

const UNIT_OTHER = "__otro__";

function UnitSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const allValues = UNIT_GROUPS.flatMap((g) => g.units.map((u) => u.value));
  const isKnown = !value || allValues.includes(value);
  const [showCustom, setShowCustom] = useState(!isKnown);
  const [customVal, setCustomVal] = useState(isKnown ? "" : value);

  const handleSelect = (v: string) => {
    if (v === UNIT_OTHER) {
      setShowCustom(true);
      onChange(customVal);
    } else {
      setShowCustom(false);
      onChange(v);
    }
  };

  if (showCustom) {
    return (
      <div className="flex gap-1">
        <Input
          value={customVal}
          onChange={(e) => { setCustomVal(e.target.value); onChange(e.target.value); }}
          placeholder="ej: bobina"
          className={className}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => { setShowCustom(false); setCustomVal(""); onChange(""); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || ""} onValueChange={handleSelect}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Seleccionar..." />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {UNIT_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.units.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
        <SelectGroup>
          <SelectLabel>Personalizado</SelectLabel>
          <SelectItem value={UNIT_OTHER}>✏️ Escribir unidad...</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "ARS",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "",
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
  const updateMut = useUpdateProduct({
    mutation: {
      onSuccess: () => { toast({ title: "Producto actualizado" }); setEditingId(null); refetch(); },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    },
  });

  const filtered = (products || []).filter((p: any) =>
    `${p.name} ${p.code || ""} ${p.category || ""} ${p.standard || ""} ${p.dimensions || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name || "", code: p.code || "", description: p.description || "",
      unit: p.unit || "", category: p.category || "", dimensions: p.dimensions || "",
      standard: p.standard || "", price: p.price ? String(p.price) : "", currency: p.currency || "ARS",
    });
  };

  const saveEdit = (id: number) => {
    updateMut.mutate({ id, data: { ...editForm, price: editForm.price || undefined } as any });
  };

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
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Tubo sin costura 2" SCH40' /></div>
              <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Dimensiones</Label><Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="60.3mm x 3.91mm" /></div>
                <div><Label>Norma</Label><Input value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} placeholder="ASTM A53" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Unidad</Label>
                  <UnitSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                </div>
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
          {filtered.map((product: any) => {
            const isEditing = editingId === product.id;

            return (
              <Card key={product.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Código</Label><Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="h-9" /></div>
                        <div><Label className="text-xs">Categoría</Label><Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="h-9" /></div>
                      </div>
                      <div><Label className="text-xs">Nombre</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-9" /></div>
                      <div><Label className="text-xs">Descripción</Label><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="h-9" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Dimensiones</Label><Input value={editForm.dimensions} onChange={(e) => setEditForm({ ...editForm, dimensions: e.target.value })} className="h-9" /></div>
                        <div><Label className="text-xs">Norma</Label><Input value={editForm.standard} onChange={(e) => setEditForm({ ...editForm, standard: e.target.value })} className="h-9" /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Unidad</Label>
                          <UnitSelect value={editForm.unit} onChange={(v) => setEditForm({ ...editForm, unit: v })} className="h-9" />
                        </div>
                        <div><Label className="text-xs">Precio</Label><Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="h-9" /></div>
                        <div><Label className="text-xs">Moneda</Label><Input value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} className="h-9" /></div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" disabled={updateMut.isPending || !editForm.name} onClick={() => saveEdit(product.id)}>
                          <Save className="w-4 h-4 mr-1" /> {updateMut.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{product.name}</h3>
                          {product.code && <Badge variant="outline" className="text-xs">{product.code}</Badge>}
                          {product.unit && <Badge variant="secondary" className="text-xs">{product.unit}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          {product.category && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{product.category}</span>}
                          {product.dimensions && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{product.dimensions}</span>}
                          {product.standard && <span className="flex items-center gap-1"><ScrollText className="w-3.5 h-3.5" />{product.standard}</span>}
                          {product.price && <span className="font-medium text-foreground">{product.currency} {parseFloat(product.price).toLocaleString("es-AR")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => startEdit(product)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: product.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
