import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetContacts, useCreateContact, useDeleteContact, useGetClients } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Phone, Mail, X, Contact2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

const API = import.meta.env.VITE_API_URL || "";

export default function Contacts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", position: "", clientId: "", isPrimary: false });
  const [clientSearch, setClientSearch] = useState("");

  const { data: clientsRes } = useGetClients({} as any);
  const allClients: any[] = (clientsRes as any)?.data || [];
  const filteredClients = clientSearch.trim()
    ? allClients.filter((c: any) => (c.companyName || c.company_name || "").toLowerCase().includes(clientSearch.toLowerCase()))
    : allClients.slice(0, 20);

  const { data: contacts, isLoading, refetch } = useGetContacts();
  const createMut = useCreateContact({
    mutation: {
      onSuccess: () => { toast({ title: "Contacto creado" }); setOpen(false); refetch(); setForm({ firstName: "", lastName: "", email: "", phone: "", position: "", clientId: "", isPrimary: false }); setClientSearch(""); },
      onError: () => toast({ title: "Error al crear contacto", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteContact({
    mutation: { onSuccess: () => { toast({ title: "Contacto eliminado" }); refetch(); } },
  });

  const filtered = (contacts || []).filter((c: any) => {
    const matchesSearch = `${c.firstName} ${c.lastName} ${c.email || ""} ${c.companyName || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesClient = clientFilter === "all" || String(c.clientId) === clientFilter;
    return matchesSearch && matchesClient;
  });

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c: any) => c.id)));
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`¿Eliminar ${selected.size} contactos?`)) return;
    try {
      const r = await fetch(`${API}/api/bulk/delete`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "contacts", ids: Array.from(selected) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: `${d.deleted} contactos eliminados` });
      setSelected(new Set());
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function bulkUpdateStatus(status: string) {
    if (!selected.size) return;
    try {
      const r = await fetch(`${API}/api/bulk/update`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "contacts", ids: Array.from(selected), patch: { status } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: `${d.updated} contactos actualizados` });
      setSelected(new Set());
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const clientsWithContacts = allClients.filter(c =>
    (contacts || []).some((ct: any) => ct.clientId === c.id)
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Contactos</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} de {contacts?.length || 0} contactos</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setClientSearch(""); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Contacto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Contact2 className="w-4 h-4" />Nuevo Contacto
              </DialogTitle>
              <DialogDescription className="sr-only">Formulario de nuevo contacto</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-1">
              <div>
                <Label>Empresa</Label>
                <Input
                  placeholder="Buscar empresa..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setForm(f => ({ ...f, clientId: "" })); }}
                  className="mb-1"
                />
                {!form.clientId && clientSearch && (
                  <div className="border border-border/50 rounded-md max-h-36 overflow-y-auto">
                    {filteredClients.length === 0
                      ? <p className="text-xs text-muted-foreground p-2">Sin resultados</p>
                      : filteredClients.map((c: any) => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                          onClick={() => { setForm(f => ({ ...f, clientId: String(c.id) })); setClientSearch(c.companyName || c.company_name || ""); }}>
                          {c.companyName || c.company_name}
                        </button>
                      ))}
                  </div>
                )}
                {form.clientId && <p className="text-xs text-green-400 mt-0.5">✓ {clientSearch}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nombre <span className="text-destructive">*</span></Label><Input value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Juan" /></div>
                <div><Label>Apellido</Label><Input value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="García" /></div>
              </div>
              <div><Label>Cargo / Puesto</Label><Input value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Comprador, Gerente de Planta..." /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@empresa.com" /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+54 9 11 1234-5678" /></div>
              <div className="flex items-center gap-2">
                <Checkbox id="ct-primary" checked={form.isPrimary} onCheckedChange={(v) => setForm(f => ({ ...f, isPrimary: !!v }))} />
                <Label htmlFor="ct-primary" className="cursor-pointer">Contacto principal</Label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4 mr-1" />Cancelar
                </Button>
                <Button size="sm" disabled={createMut.isPending || !form.firstName.trim()} onClick={() => createMut.mutate({ data: { ...form, clientId: form.clientId ? parseInt(form.clientId) : undefined } as any })}>
                  {createMut.isPending ? "Creando..." : "Guardar contacto"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, email o empresa..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={v => { setClientFilter(v); setSelected(new Set()); }}>
          <SelectTrigger className="w-full sm:w-64 bg-card border-border/50">
            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {clientsWithContacts.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.companyName || c.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clientFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setClientFilter("all")} className="shrink-0">
            <X className="w-4 h-4 mr-1" />Limpiar filtro
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} seleccionados</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("active")}>Marcar activos</Button>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("inactive")}>Marcar inactivos</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar</Button>
          <Button aria-label="Limpiar selección" size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="w-3.5 h-3.5" /></Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Contact2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No se encontraron contactos{clientFilter !== "all" ? " para esta empresa" : ""}.</p>
        </div>
      ) : (
        <>
          <label className="mb-3 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
            <Checkbox aria-label="Seleccionar todos los contactos" checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
            <span>Seleccionar todos</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((contact: any) => (
              <Card key={contact.id} className={`bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors ${selected.has(contact.id) ? "ring-2 ring-primary/50" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox aria-label={`Seleccionar ${contact.firstName} ${contact.lastName}`} checked={selected.has(contact.id)} onCheckedChange={() => toggle(contact.id)} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base truncate">{contact.firstName} {contact.lastName}</h3>
                        {contact.position && <p className="text-sm text-muted-foreground truncate">{contact.position}</p>}
                        {contact.companyName && (
                          <Link href={contact.clientId ? `/clients/${contact.clientId}` : "#"}>
                            <Badge variant="outline" className="mt-1.5 text-xs gap-1 cursor-pointer hover:border-primary/50 transition-colors bg-white/5">
                              <Building2 className="w-3 h-3" />
                              {contact.companyName}
                            </Badge>
                          </Link>
                        )}
                      </div>
                    </div>
                    <Button aria-label="Eliminar contacto" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMut.mutate({ id: contact.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{contact.email}</span>
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <Phone className="w-3.5 h-3.5 shrink-0" />{contact.phone}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
