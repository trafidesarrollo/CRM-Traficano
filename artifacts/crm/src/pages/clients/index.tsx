import { useState } from "react";
import { useGetClients, useCreateClient, useUpdateClient, useGetSalespeople } from "@workspace/api-client-react";
import { useLocation } from "wouter";
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
import { Plus, Building2, Search, Mail, X, Pencil, FileUp, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { DuplicateWarning } from "@/components/duplicate-warning";

const API = import.meta.env.VITE_API_URL || "";

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

function ImportClientsDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [separator, setSeparator] = useState<"," | ";">(";");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const reset = () => { setCsvText(""); setResult(null); };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
    e.target.value = "";
  }

  async function doImport() {
    if (!csvText.trim()) { toast({ title: "Pegá o subí un CSV primero", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/csv/import/clients-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ csv: csvText, separator }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error de importación");
      setResult(data);
      toast({ title: "Importación finalizada", description: `${data.inserted} nuevos, ${data.updated} actualizados` });
      onDone();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20">
          <FileUp className="w-4 h-4 mr-2" />Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-cyan-400" />
            Importar Clientes desde CSV
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              El CSV debe tener columnas como <span className="font-mono text-xs text-foreground/80">Número de cliente, Razón social, Número de documento, Telefono, Correo, Localidad, Provincia, Rubro, Responsable 1</span>. Se hace upsert por número de cliente.
            </p>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Separador</Label>
              <div className="flex gap-2">
                {([";", ","] as const).map(s => (
                  <button key={s} onClick={() => setSeparator(s)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-mono border transition-colors ${separator === s ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                    {s === ";" ? 'Punto y coma  ";"' : 'Coma  ","'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Subir archivo CSV</Label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border/60 rounded-lg px-4 py-3 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                {csvText ? "Archivo cargado — clic para reemplazar" : "Seleccioná un archivo .csv"}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              </label>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">O pegá el CSV aquí</Label>
              <Textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={5} className="font-mono text-xs"
                placeholder={`"Número de cliente"${separator}"Razón social"${separator}"Número de documento"${separator}"Correo"\n"10039"${separator}"Empresa SA"${separator}"30566613766"${separator}"ventas@empresa.com"`} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-white" disabled={loading || !csvText.trim()} onClick={doImport}>
                {loading ? "Importando..." : "Importar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-400">{result.inserted}</p>
                <p className="text-xs text-muted-foreground mt-1">Nuevos</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-400">{result.updated}</p>
                <p className="text-xs text-muted-foreground mt-1">Actualizados</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-1">Omitidos</p>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {result.errors.length} fila(s) con error
                </p>
                {result.errors.map((e: any, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">Línea {e.line}: {e.error}</p>
                ))}
              </div>
            )}

            {result.errors?.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />Todas las filas procesadas sin errores
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>Nueva importación</Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Clients() {
  const [, setLocation] = useLocation();
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
        <div className="flex items-center gap-2">
          <ImportClientsDialog onDone={refetch} />
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
              <DuplicateWarning entity="clients" params={{ taxId: form.taxId, companyName: form.companyName }} />

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
              <TableHead className="w-24">Nro.</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : !response?.data?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay clientes todavía.</p>
                  <p className="text-sm mt-1">Hacé clic en "Nuevo Cliente" para crear el primero.</p>
                </TableCell>
              </TableRow>
            ) : response.data.map((client: any) => {
              const emails: string[] = Array.isArray(client.clientEmails) ? client.clientEmails : [];
              return (
                <TableRow key={client.id} className="border-border/50 hover:bg-white/5 cursor-pointer" onClick={() => setLocation(`/clients/${client.id}`)}>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold text-primary/80">{client.externalId || client.id}</span>
                  </TableCell>
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
