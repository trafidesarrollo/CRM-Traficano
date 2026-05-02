import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetContacts, useCreateContact, useDeleteContact } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Phone, Mail, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const API = import.meta.env.VITE_API_URL || "";

export default function Contacts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", position: "", clientId: "" });

  const { data: contacts, isLoading, refetch } = useGetContacts();
  const createMut = useCreateContact({
    mutation: {
      onSuccess: () => { toast({ title: "Contacto creado" }); setOpen(false); refetch(); setForm({ firstName: "", lastName: "", email: "", phone: "", position: "", clientId: "" }); },
      onError: () => toast({ title: "Error al crear contacto", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteContact({
    mutation: { onSuccess: () => { toast({ title: "Contacto eliminado" }); refetch(); } },
  });

  const filtered = (contacts || []).filter((c: any) =>
    `${c.firstName} ${c.lastName} ${c.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Contactos</h1>
          <p className="text-muted-foreground mt-1">{contacts?.length || 0} contactos registrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Contacto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Contacto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nombre</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label>Apellido</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Cargo</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
              <div><Label>ID Cliente</Label><Input type="number" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} /></div>
              <Button className="w-full" disabled={createMut.isPending || !form.firstName || !form.lastName} onClick={() => createMut.mutate({ data: { ...form, clientId: form.clientId ? parseInt(form.clientId) : undefined } as any })}>
                {createMut.isPending ? "Creando..." : "Crear Contacto"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar contactos..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <div className="text-center py-12 text-muted-foreground">No se encontraron contactos</div>
      ) : (
        <>
          <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
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
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg truncate">{contact.firstName} {contact.lastName}</h3>
                        {contact.position && <p className="text-sm text-muted-foreground truncate">{contact.position}</p>}
                      </div>
                    </div>
                    <Button aria-label="Eliminar contacto" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMut.mutate({ id: contact.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {contact.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" />{contact.email}</div>}
                    {contact.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" />{contact.phone}</div>}
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
