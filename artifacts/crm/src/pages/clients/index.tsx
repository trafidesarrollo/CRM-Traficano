import { useState } from "react";
import { useGetClients, useCreateClient, useGetSalespeople } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Search } from "lucide-react";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: response, isLoading, refetch } = useGetClients({ search: search || undefined });
  const { data: salespeopleRes } = useGetSalespeople();
  const createClient = useCreateClient();

  const [form, setForm] = useState({
    companyName: "",
    taxId: "",
    industry: "",
    website: "",
    phone: "",
    address: "",
    city: "",
    country: "Argentina",
    status: "prospect" as "prospect" | "active" | "inactive",
    assignedSalespersonId: undefined as number | undefined,
    notes: "",
  });

  const resetForm = () => {
    setForm({
      companyName: "",
      taxId: "",
      industry: "",
      website: "",
      phone: "",
      address: "",
      city: "",
      country: "Argentina",
      status: "prospect",
      assignedSalespersonId: undefined,
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast({ title: "El nombre de empresa es obligatorio", variant: "destructive" });
      return;
    }
    try {
      const payload: any = { companyName: form.companyName.trim() };
      if (form.taxId.trim()) payload.taxId = form.taxId.trim();
      if (form.industry.trim()) payload.industry = form.industry.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.country.trim()) payload.country = form.country.trim();
      if (form.status) payload.status = form.status;
      if (form.assignedSalespersonId) payload.assignedSalespersonId = form.assignedSalespersonId;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      await createClient.mutateAsync({ data: payload });
      toast({ title: "Cliente creado exitosamente" });
      setOpen(false);
      resetForm();
      refetch();
    } catch {
      toast({ title: "Error al crear cliente", variant: "destructive" });
    }
  };

  const salespeople = salespeopleRes?.data || [];

  return (
    <AppLayout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-1">Directorio de empresas.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />Nuevo Cliente
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label>Empresa *</Label>
                <Input
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CUIT / Tax ID</Label>
                  <Input
                    value={form.taxId}
                    onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))}
                    placeholder="30-12345678-9"
                  />
                </div>
                <div>
                  <Label>Industria</Label>
                  <Input
                    value={form.industry}
                    onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    placeholder="Ej: Metalúrgica"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+54 11 1234-5678"
                  />
                </div>
                <div>
                  <Label>Sitio Web</Label>
                  <Input
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="www.empresa.com"
                  />
                </div>
              </div>
              <div>
                <Label>Dirección</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Av. Industrial 1234"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ciudad</Label>
                  <Input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Buenos Aires"
                  />
                </div>
                <div>
                  <Label>País</Label>
                  <Input
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    placeholder="Argentina"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estado</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospecto</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vendedor Asignado</Label>
                  <Select
                    value={form.assignedSalespersonId?.toString() || "none"}
                    onValueChange={v => setForm(f => ({ ...f, assignedSalespersonId: v === "none" ? undefined : parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {salespeople.map((sp: any) => (
                        <SelectItem key={sp.id} value={sp.id.toString()}>{sp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observaciones sobre el cliente..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? "Creando..." : "Crear Cliente"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Industria</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : !response?.data?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay clientes todavía.</p>
                  <p className="text-sm mt-1">Hacé clic en "Nuevo Cliente" para crear el primero.</p>
                </TableCell>
              </TableRow>
            ) : response.data.map((client: any) => (
              <TableRow key={client.id} className="border-border/50 hover:bg-white/5">
                <TableCell>
                  <p className="font-medium">{client.companyName}</p>
                  <p className="text-xs text-muted-foreground">{client.taxId || client.website || ''}</p>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{client.industry || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{client.phone || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{client.city ? `${client.city}, ${client.country}` : '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    client.status === 'active' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                    client.status === 'prospect' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                    'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
                  }>
                    {client.status === 'active' ? 'Activo' : client.status === 'prospect' ? 'Prospecto' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
