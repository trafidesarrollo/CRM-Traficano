import { useEffect, useState } from "react";
import { Building2, DollarSign, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { DuplicateWarning } from "@/components/duplicate-warning";

const API = import.meta.env.VITE_API_URL || "";

export const IMPORTANCE_CONFIG: Record<string, { label: string; badge: string }> = {
  alta:    { label: "ALTA",    badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  media:   { label: "MEDIA",   badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  baja:    { label: "BAJA",    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ninguna: { label: "NINGUNA", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

export const CLIENT_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  prospect:  { label: "Prospecto",         badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  potential: { label: "Cliente Potencial", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  inactive:  { label: "Inactivo",          badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  final:     { label: "Cliente Final",     badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const REQUIRED_FOR_POTENTIAL = ["companyName", "taxId", "industry", "city"] as const;
function isReadyForPotential(form: any): boolean {
  return REQUIRED_FOR_POTENTIAL.every(k => form[k]?.trim());
}
function isReadyForScale(form: any): boolean {
  return !!(form.companyName?.trim() && form.taxId?.trim() && form.city?.trim());
}

export function statusBadge(status: string) {
  const cfg = CLIENT_STATUS_CONFIG[status] || { label: status, badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
  return <Badge variant="outline" className={cfg.badge}>{cfg.label}</Badge>;
}

const BLANK_FORM = {
  companyName: "", taxId: "", industry: "", city: "", phone: "",
  notes: "", consumptionScale: "", importance: "ninguna", statusOverride: "",
};
type ClientForm = typeof BLANK_FORM;

export interface ClientDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editClient?: any;
  salespeople?: any[];
  onSaved: () => void;
}

export function ClientDialog({ open, onOpenChange, editClient, onSaved }: ClientDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "gerente" || (user as any)?.role === "gerente_comercial";

  const [form, setForm] = useState<ClientForm>({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    fetch(`${API}/api/industries`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setIndustries)
      .catch(() => {});
  }, []);

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", position: "" });
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    if (open) {
      if (editClient) {
        const c = editClient;
        setForm({
          companyName: c.company_name || c.companyName || "",
          taxId: c.tax_id || c.taxId || "",
          industry: c.industry || "",
          city: c.city || "",
          phone: c.phone || "",
          notes: c.notes || "",
          consumptionScale:
            c.consumption_scale != null ? String(c.consumption_scale)
            : c.consumptionScale != null ? String(c.consumptionScale)
            : "",
          importance: c.importance || "ninguna",
          statusOverride: c.status || "prospect",
        });
      } else {
        setForm({ ...BLANK_FORM });
      }
      setShowContactForm(false);
      setContactForm({ firstName: "", lastName: "", email: "", phone: "", position: "" });
    }
  }, [open, editClient]);

  const ready = isReadyForPotential(form);
  const scale = parseFloat(form.consumptionScale);
  const previewStatus = editClient
    ? (form.statusOverride || editClient.status || "prospect")
    : ready ? (isNaN(scale) ? "potential" : scale === 0 ? "inactive" : "potential") : "prospect";

  const f = (key: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast({ title: "El nombre de empresa es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        companyName: form.companyName.trim(),
        taxId: form.taxId.trim() || undefined,
        industry: form.industry.trim() || undefined,
        city: form.city.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        importance: form.importance || "ninguna",
      };
      if (form.consumptionScale.trim() !== "") payload.consumptionScale = form.consumptionScale.trim();
      if (editClient) {
        payload.status = isAdmin && form.statusOverride
          ? form.statusOverride
          : editClient.status || "prospect";
      }

      let savedId: number;
      if (editClient) {
        const r = await fetch(`${API}/api/clients/${editClient.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        savedId = editClient.id;
        toast({ title: "Cliente actualizado" });
      } else {
        const r = await fetch(`${API}/api/clients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        const created = await r.json();
        savedId = created.id;
        toast({ title: "Cliente creado" });
      }

      if (showContactForm && contactForm.firstName.trim() && savedId) {
        await saveContact(savedId, true);
      } else {
        onSaved();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast({ title: err.message || "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async (clientId: number, closeModal = false) => {
    if (!contactForm.firstName.trim()) return;
    setSavingContact(true);
    try {
      const r = await fetch(`${API}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId,
          firstName: contactForm.firstName.trim(),
          lastName: contactForm.lastName.trim(),
          email: contactForm.email.trim(),
          phone: contactForm.phone.trim(),
          position: contactForm.position.trim() || "Contacto",
        }),
      });
      if (!r.ok) throw new Error("Error al crear contacto");
      toast({ title: "Contacto creado" });
      setContactForm({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      setShowContactForm(false);
      onSaved();
      if (closeModal) onOpenChange(false);
    } catch {
      toast({ title: "Contacto no guardado — podés agregarlo luego desde la ficha", variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {editClient ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription className="sr-only">Formulario de cliente</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Estado:</span>
          {statusBadge(previewStatus)}
          {!editClient && (
            <span className="text-xs text-muted-foreground">
              {ready
                ? "— campos completos"
                : isReadyForScale(form)
                  ? "— agregá industria para pasar a Potencial"
                  : "— completá Nombre, CUIT y Ciudad para cargar escala"}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div>
            <Label>Empresa <span className="text-destructive">*</span></Label>
            <Input value={form.companyName} onChange={f("companyName")} placeholder="Razón social" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CUIT <span className="text-destructive">*</span></Label>
              <Input value={form.taxId} onChange={f("taxId")} placeholder="30-12345678-9" />
            </div>
            <div>
              <Label>Industria <span className="text-destructive">*</span></Label>
              <Select
                value={form.industry}
                onValueChange={v => setForm(prev => ({ ...prev, industry: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un rubro…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {industries.map(ind => (
                    <SelectItem key={ind.id} value={ind.name}>{ind.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DuplicateWarning entity="clients" params={{ taxId: form.taxId, companyName: form.companyName }} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ciudad <span className="text-destructive">*</span></Label>
              <Input value={form.city} onChange={f("city")} placeholder="Buenos Aires" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={f("phone")} placeholder="+54 9 11 1234-5678" />
            </div>
          </div>

          {/* ── Escala de consumo ── */}
          {(isReadyForScale(form) || (editClient && ["potential", "inactive", "final"].includes(editClient.status))) && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-amber-400">
                <DollarSign className="w-4 h-4" />Escala de Consumo (USD/año proyectado)
              </Label>
              <Input
                type="number" min="0" step="any"
                value={form.consumptionScale}
                onChange={f("consumptionScale")}
                placeholder="Ej: 50000"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Proyección del vendedor. Si es <strong>0</strong> el cliente pasa a <strong>Inactivo</strong>. Si es &gt; 0 queda como <strong>Potencial</strong>.
              </p>
              {!isNaN(parseFloat(form.consumptionScale)) && (
                <p className="text-xs font-medium">
                  Estado resultante: {statusBadge(parseFloat(form.consumptionScale) === 0 ? "inactive" : "potential")}
                </p>
              )}
            </div>
          )}

          {/* ── Override de estado (solo admin/gerente en modo edición) ── */}
          {isAdmin && editClient && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
              <Label className="text-sm text-muted-foreground">Estado (override manual)</Label>
              <Select
                value={form.statusOverride}
                onValueChange={v => setForm(prev => ({ ...prev, statusOverride: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_STATUS_CONFIG).map(([v, cfg]) => (
                    <SelectItem key={v} value={v}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El estado también se recalcula automáticamente según los campos completos y la Escala.
              </p>
            </div>
          )}

          {/* ── Importancia ── */}
          <div>
            <Label>Importancia del cliente</Label>
            <Select value={form.importance} onValueChange={v => setForm(prev => ({ ...prev, importance: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná importancia" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IMPORTANCE_CONFIG).map(([v, cfg]) => (
                  <SelectItem key={v} value={v}>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <span className={`w-2 h-2 rounded-full ${
                        cfg.badge.includes("red") ? "bg-red-400"
                        : cfg.badge.includes("amber") ? "bg-amber-400"
                        : cfg.badge.includes("blue") ? "bg-blue-400"
                        : "bg-zinc-400"
                      }`} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={f("notes")} placeholder="Observaciones..." rows={2} />
          </div>

          {/* ── Contacto inline ── */}
          {!showContactForm ? (
            <button
              type="button"
              onClick={() => setShowContactForm(true)}
              className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-lg px-3 py-2 hover:border-border transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {editClient ? "Agregar contacto a esta empresa" : "Agregar contacto (opcional)"}
            </button>
          ) : (
            <div className="rounded-lg border border-border/50 p-3 space-y-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" />Datos del Contacto
                </p>
                <button type="button" onClick={() => setShowContactForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {editClient
                ? <p className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1">El contacto se vincula a la empresa ya guardada.</p>
                : <p className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1">El contacto se creará al guardar el cliente.</p>
              }
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={contactForm.firstName} onChange={e => setContactForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Juan" />
                </div>
                <div>
                  <Label className="text-xs">Apellido</Label>
                  <Input value={contactForm.lastName} onChange={e => setContactForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Pérez" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@empresa.com" />
                </div>
                <div>
                  <Label className="text-xs">Teléfono</Label>
                  <Input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cargo / Puesto</Label>
                <Input value={contactForm.position} onChange={e => setContactForm(p => ({ ...p, position: e.target.value }))} placeholder="Gerente de compras, Encargado..." />
              </div>
              {editClient && (
                <Button
                  type="button" size="sm" className="w-full"
                  disabled={savingContact || !contactForm.firstName.trim()}
                  onClick={() => saveContact(editClient.id)}
                >
                  {savingContact ? "Guardando..." : "Guardar contacto"}
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : editClient ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
