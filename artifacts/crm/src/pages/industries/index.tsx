import { useState, useEffect } from "react";
import { AppLayout as Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Factory } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface Industry {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

const BLANK = { name: "", description: "" };

export default function IndustriesPage() {
  const { toast } = useToast();
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Industry | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Industry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/industries`, { credentials: "include" });
      if (r.ok) setIndustries(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(BLANK);
    setDialogOpen(true);
  };

  const openEdit = (ind: Industry) => {
    setEditing(ind);
    setForm({ name: ind.name, description: ind.description || "" });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `${API}/api/industries/${editing.id}` : `${API}/api/industries`;
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null }),
      });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: err.error || "Error al guardar", variant: "destructive" });
        return;
      }
      toast({ title: editing ? "Industria actualizada" : "Industria creada" });
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ind: Industry) => {
    setDeleting(ind.id);
    try {
      const r = await fetch(`${API}/api/industries/${ind.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        toast({ title: "Error al eliminar", variant: "destructive" });
        return;
      }
      toast({ title: "Industria eliminada" });
      setConfirmDelete(null);
      load();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Factory className="w-6 h-6 text-violet-400" />
              Rubros / Industrias
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Administrá los rubros disponibles para clasificar clientes.
            </p>
          </div>
          <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-500">
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva industria
          </Button>
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30">
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : industries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                    No hay industrias cargadas todavía.
                  </TableCell>
                </TableRow>
              ) : (
                industries.map(ind => (
                  <TableRow key={ind.id} className="border-border/30 hover:bg-muted/20">
                    <TableCell className="font-medium">{ind.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{ind.description || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(ind)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:text-red-300"
                          onClick={() => setConfirmDelete(ind)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {industries.length} {industries.length === 1 ? "industria registrada" : "industrias registradas"}
        </p>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-4 h-4" />
              {editing ? "Editar industria" : "Nueva industria"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-1">
            <div>
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Metalúrgica, Alimenticia, Automotriz…"
              />
            </div>
            <div>
              <Label>Descripción <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Breve descripción del rubro…"
                className="resize-none text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500">
                {saving ? "Guardando…" : (editing ? "Guardar cambios" : "Crear industria")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar industria?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará <strong className="text-foreground">{confirmDelete?.name}</strong>. Los clientes con este rubro asignado no se verán afectados.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleting === confirmDelete?.id}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              {deleting === confirmDelete?.id ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
