import { useState } from "react";
import { useGetClients, useCreateClient, useUpdateClient, useGetSalespeople } from "@workspace/api-client-react";
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
import { Plus, Building2, Search, Mail, X, Pencil } from "lucide-react";

function EmailManager({ emails, onChange }: { emails: string[]; onChange: (emails: string[]) => void }) {
  const [input, setInput] = useState("");

  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (emails.includes(email)) return;
    onChange([...emails, email]);
    setInput("");
  };

  const removeEmail = (idx: number) => {
    onChange(emails.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5" />Emails de la empresa
      </Label>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2.5 py-0.5 text-xs font-mono">
              {email}
              <button type="button" onClick={() => removeEmail(idx)} className="hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="ventas@empresa.com"
          className="text-sm"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addEmail} disabled={!input.trim()}>
          <Plus className="w-3.5 h-3.5 mr-1" />Agregar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Podés agregar varios emails corporativos (ej: ventas@, compras@, gerencia@).</p>
    </div>
  );
}

const INITIAL_FORM = {
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
  clientEmails: [] as string[],
  notes: "",
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const { toast } = useToast();

  const { data: response, isLoading, refetch } = useGetClients({ search: search || undefined });
  const { data: salespeopleRes } = useGetSalespeople();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [form, setForm] = useState({ ...INITIAL_FORM });

  const resetForm = () => {
    setForm({ ...INITIAL_FORM });
    setEditClient(null);
  };

  const openEdit = (client: any) => {
    setForm({
      companyName: client.companyName || "",
      taxId: client.taxId || "",
      industry: client.industry || "",
      website: client.website || "",
      phone: client.phone || "",
      address: client.address || "",
      city: client.city || "",
      country: client.country || "Argentina",
      status: client.status || "prospect",
      assignedSalespersonId: client.assignedSalespersonId || undefined,
      clientEmails: Array.isArray(client.clientEmails) ? client.clientEmails : [],
      notes: client.notes || "",
    });
    setEditClient(client);
    setOpen(true);
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
      payload.clientEmails = form.clientEmails;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (editClient) {
        await updateClient.mutateAsync({ id: editClient.id, data: payload });
        toast({ title: "Cliente actualizado" });
      } else {
        await createClient.mutateAsync({ data: payload });
        toast({ title: "Cliente creado exitosamente" });
      }
      setOpen(false);
      resetForm();
      refetch();
    } catch {
      toast({ title: editClient ? "Error al actualizar" : "Error al crear cliente", variant: "destructive" });
    }
  };

  const salespeople = salespeopleRes?.data || [];
  const isSubmitting = createClient.isPending || updateClient.isPending;

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
                <Building2 className="w-5 h-5" />{editClient ? "Editar Cliente" : "Nuevo Cliente"}
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

              <EmailManager
                emails={form.clientEmails}
                onChange={emails => setForm(f => ({ ...f, clientEmails: emails }))}
              />

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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : editClient ? "Guardar Cambios" : "Crear Cliente"}
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
              <TableHead>Emails</TableHead>
              <TableHead>Industria</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : !response?.data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay clientes todavía.</p>
                  <p className="text-sm mt-1">Hacé clic en "Nuevo Cliente" para crear el primero.</p>
                </TableCell>
              </TableRow>
            ) : response.data.map((client: any) => {
              const emails: string[] = Array.isArray(client.clientEmails) ? client.clientEmails : [];
              return (
                <TableRow key={client.id} className="border-border/50 hover:bg-white/5">
                  <TableCell>
                    <p className="font-medium">{client.companyName}</p>
                    <p className="text-xs text-muted-foreground">{client.taxId || client.website || ''}</p>
                  </TableCell>
                  <TableCell>
                    {emails.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {emails.map((em, i) => (
                          <span key={i} className="text-xs font-mono text-blue-400">{em}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{client.industry || '-'}</TableCell>
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
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(client)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
