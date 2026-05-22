import { useEffect, useMemo, useState } from "react";
import { useGetClients, useGetSalespeople } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { ProspectsNearPotential } from "@/components/prospects-near-potential";
import { AppLayout } from "@/components/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Building2, Search, Mail, X, Pencil, FileUp, Upload, CheckCircle2, AlertCircle, UserPlus, DollarSign, Filter, Contact2, ListTodo } from "lucide-react";
import { DuplicateWarning } from "@/components/duplicate-warning";

const API = import.meta.env.VITE_API_URL || "";

// ─── Status config ──────────────────────────────────────────────────────────
const CLIENT_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  prospect:  { label: "Prospecto",         badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  potential: { label: "Cliente Potencial", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  inactive:  { label: "Inactivo",          badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  final:     { label: "Cliente Final",     badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const REQUIRED_FOR_POTENTIAL = ["companyName", "taxId", "industry", "phone", "city"] as const;

function isReadyForPotential(form: any): boolean {
  return REQUIRED_FOR_POTENTIAL.every(f => form[f]?.trim()) && (form.clientEmails?.length > 0);
}

function isReadyForScale(form: any): boolean {
  return !!(form.companyName?.trim() && form.taxId?.trim() && form.city?.trim());
}

// ─── Email manager ────────────────────────────────────────────────────────────
function EmailManager({ emails, onChange }: { emails: string[]; onChange: (emails: string[]) => void }) {
  const [input, setInput] = useState("");
  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.includes(email)) return;
    onChange([...emails, email]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-sm">
        <Mail className="w-3.5 h-3.5" />Email(s) corporativo(s) <span className="text-destructive">*</span>
      </Label>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2.5 py-0.5 text-xs font-mono">
              {email}
              <button type="button" onClick={() => onChange(emails.filter((_, i) => i !== idx))} className="hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input type="email" value={input} onChange={e => setInput(e.target.value)} placeholder="ventas@empresa.com" className="text-sm"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} />
        <Button type="button" size="sm" variant="outline" onClick={addEmail} disabled={!input.trim()}><Plus className="w-3.5 h-3.5 mr-1" />Agregar</Button>
      </div>
    </div>
  );
}

// ─── Import CSV ───────────────────────────────────────────────────────────────
function ImportClientsDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [separator, setSeparator] = useState<"," | ";">(";");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const reset = () => { setCsvText(""); setResult(null); };
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvText(await file.text()); e.target.value = "";
  }
  async function doImport() {
    if (!csvText.trim()) { toast({ title: "Pegá o subí un CSV primero", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/csv/import/clients-bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ csv: csvText, separator }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error de importación");
      setResult(data); toast({ title: "Importación finalizada", description: `${data.inserted} nuevos, ${data.updated} actualizados` }); onDone();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }
  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <Button variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20" onClick={() => setOpen(true)}>
        <FileUp className="w-4 h-4 mr-2" />Importar Nuevos Clientes
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="w-5 h-5 text-cyan-400" />Importar Nuevos Clientes desde CSV</DialogTitle></DialogHeader>
        {!result ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Columnas: <span className="font-mono text-xs">Número de cliente, Razón social, Número de documento, Telefono, Correo, Localidad, Rubro, Responsable 1</span></p>
            <div className="flex gap-2">
              {([";", ","] as const).map(s => (
                <button key={s} onClick={() => setSeparator(s)} className={`px-4 py-1.5 rounded-lg text-sm font-mono border transition-colors ${separator === s ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                  {s === ";" ? 'Punto y coma ";"' : 'Coma ","'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border/60 rounded-lg px-4 py-3 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors text-sm text-muted-foreground">
              <Upload className="w-4 h-4" />{csvText ? "Archivo cargado — clic para reemplazar" : "Seleccioná un archivo .csv"}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
            <Textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={4} className="font-mono text-xs" placeholder={`Razón social${separator}Número de documento${separator}Correo`} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-white" disabled={loading || !csvText.trim()} onClick={doImport}>{loading ? "Importando..." : "Importar"}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3"><p className="text-2xl font-bold text-green-400">{result.inserted}</p><p className="text-xs text-muted-foreground mt-1">Nuevos</p></div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3"><p className="text-2xl font-bold text-blue-400">{result.updated}</p><p className="text-xs text-muted-foreground mt-1">Actualizados</p></div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3"><p className="text-2xl font-bold text-yellow-400">{result.skipped}</p><p className="text-xs text-muted-foreground mt-1">Omitidos</p></div>
            </div>
            {result.errors?.length === 0 && <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" />Sin errores</div>}
            {result.errors?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                <p className="text-xs font-medium text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{result.errors.length} error(es)</p>
                {result.errors.map((e: any, i: number) => <p key={i} className="text-xs text-muted-foreground">L{e.line}: {e.error}</p>)}
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

// ─── Importador de Prospectos con Tareas Condicionales ───────────────────────
const PROSPECTS_TEMPLATE = `empresa,cuit,industria,telefono,ciudad,emails,escala_consumo,notas,tarea_nombre,tarea_prioridad,tarea_fecha_limite,tarea_asignar_a
"Maderera Alfa","30-12345678-9","Metalúrgica","+54 11 1234-5678","Buenos Aires","ventas@alfa.com",50000,"Interesado en catálogo","Llamar para seguimiento","Media","2026-06-10","Juan Pérez"
"Talleres Beta","30-87654321-9","Automotriz","+54 11 9876-5432","Rosario","contacto@beta.com",0,"Sin presupuesto actual",,,
"Distribuidora Gamma","30-11111111-9","Logística","+54 11 5555-5555","Córdoba","info@gamma.com",,"Falta contactar",,,
`;

function ProspectsImportDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => { setCsvText(""); setResult(null); };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvText(await file.text()); e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      file.text().then(setCsvText);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([PROSPECTS_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "plantilla-prospectos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport() {
    if (!csvText.trim()) { toast({ title: "Cargá un CSV primero", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/csv/import/prospects`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ csv: csvText }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error de importación");
      setResult(data);
      toast({ title: "Importación finalizada", description: `${data.created} prospectos creados, ${data.tasksCreated} tareas asignadas` });
      onDone();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <Button variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />Importar Prospectos
      </Button>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-violet-400" />Carga Masiva de Prospectos
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Creá clientes y tareas en bulk desde un CSV. Columnas requeridas: <span className="font-mono">empresa, cuit</span>. El estado se asigna automáticamente según <span className="font-mono">escala_consumo</span>.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 mt-1">
            {/* Reglas de negocio */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Lógica de estados:</p>
              <p><span className="text-blue-400 font-medium">escala_consumo vacía</span> → Prospecto</p>
              <p><span className="text-zinc-400 font-medium">escala_consumo = 0</span> → Cliente Inactivo</p>
              <p><span className="text-amber-400 font-medium">escala_consumo &gt; 0</span> → Cliente Potencial</p>
              <p className="pt-1 border-t border-border/30"><span className="text-violet-400 font-medium">tarea_nombre</span> relleno + usuario exacto encontrado → tarea creada y asignada</p>
            </div>

            {/* Zona de drag & drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors cursor-pointer ${dragging ? "border-violet-500/60 bg-violet-500/10" : "border-border/50 hover:border-violet-500/40 hover:bg-violet-500/5"}`}
            >
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {csvText ? "Archivo cargado — clic o arrastrá para reemplazar" : "Arrastrá un .csv o hacé clic para seleccionar"}
                </span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              </label>
            </div>

            <Textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="O pegá el contenido del CSV directamente aquí..."
            />

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={downloadTemplate}>
                <FileUp className="w-3.5 h-3.5 mr-1.5" />Descargar plantilla
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-500 text-white"
                disabled={loading || !csvText.trim()}
                onClick={doImport}
              >
                {loading ? "Procesando..." : "Importar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-1">
            {/* Resultados */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.created}</p>
                <p className="text-xs text-muted-foreground mt-1">Prospectos creados</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{result.skippedDuplicates}</p>
                <p className="text-xs text-muted-foreground mt-1">Duplicados (CUIT)</p>
              </div>
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-violet-400">{result.tasksCreated}</p>
                <p className="text-xs text-muted-foreground mt-1">Tareas asignadas</p>
              </div>
              <div className="bg-zinc-500/10 border border-zinc-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-zinc-400">{result.tasksSkipped}</p>
                <p className="text-xs text-muted-foreground mt-1">Tareas sin usuario</p>
              </div>
            </div>

            {result.duplicates?.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 max-h-28 overflow-y-auto space-y-1">
                <p className="text-xs font-medium text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />CUITs duplicados omitidos</p>
                {result.duplicates.map((d: string, i: number) => <p key={i} className="text-xs text-muted-foreground">{d}</p>)}
              </div>
            )}

            {result.errors?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 max-h-28 overflow-y-auto space-y-1">
                <p className="text-xs font-medium text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{result.errors.length} error(es)</p>
                {result.errors.map((e: any, i: number) => <p key={i} className="text-xs text-muted-foreground">L{e.line}: {e.error}</p>)}
              </div>
            )}

            {result.errors?.length === 0 && result.skippedDuplicates === 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" />Sin errores ni duplicados</div>
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

// ─── Client form (create/edit) ────────────────────────────────────────────────
const BLANK_FORM = {
  companyName: "", taxId: "", industry: "", phone: "", city: "",
  clientEmails: [] as string[], notes: "", consumptionScale: "",
  assignedSalespersonId: undefined as number | undefined,
  assignedUserId: undefined as number | undefined,
};

type ClientForm = typeof BLANK_FORM;

function statusBadge(status: string) {
  const cfg = CLIENT_STATUS_CONFIG[status] || { label: status, badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
  return <Badge variant="outline" className={cfg.badge}>{cfg.label}</Badge>;
}

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editClient?: any;
  salespeople: any[];
  onSaved: () => void;
}

function ClientDialog({ open, onOpenChange, editClient, salespeople, onSaved }: ClientDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "gerente" || (user as any)?.role === "gerente_comercial";
  const [form, setForm] = useState<ClientForm>({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  // Buyer inline creation
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [buyerForm, setBuyerForm] = useState({ firstName: "", lastName: "", email: "", phone: "", position: "" });
  const [savingBuyer, setSavingBuyer] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<number | null>(null);

  // Task inline creation
  const BLANK_TASK = { title: "", type: "task", priority: "medium", dueDate: "", assignedToUserId: "" };
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState(BLANK_TASK);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/api/users/assignable`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      if (editClient) {
        setForm({
          companyName: editClient.companyName || "",
          taxId: editClient.taxId || "",
          industry: editClient.industry || "",
          phone: editClient.phone || "",
          city: editClient.city || "",
          clientEmails: Array.isArray(editClient.clientEmails) ? editClient.clientEmails : [],
          notes: editClient.notes || "",
          consumptionScale: editClient.consumptionScale != null ? String(editClient.consumptionScale) : "",
          assignedSalespersonId: editClient.assignedSalespersonId || undefined,
          assignedUserId: editClient.assignedUserId || undefined,
        });
      } else {
        setForm({ ...BLANK_FORM });
      }
      setShowBuyerForm(false);
      setCreatedClientId(null);
      setShowTaskForm(false);
      setTaskForm(BLANK_TASK);
    }
  }, [open, editClient]);

  const ready = isReadyForPotential(form);
  const scale = parseFloat(form.consumptionScale);
  let previewStatus = "prospect";
  if (editClient?.status === "final") {
    previewStatus = "final";
  } else if (ready) {
    previewStatus = isNaN(scale) ? "potential" : scale === 0 ? "inactive" : "potential";
  }

  const f = (key: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) { toast({ title: "El nombre de empresa es obligatorio", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        companyName: form.companyName.trim(),
        taxId: form.taxId.trim() || undefined,
        industry: form.industry.trim() || undefined,
        phone: form.phone.trim() || undefined,
        city: form.city.trim() || undefined,
        clientEmails: form.clientEmails,
        notes: form.notes.trim() || undefined,
        assignedSalespersonId: form.assignedSalespersonId || undefined,
        assignedUserId: form.assignedUserId || undefined,
      };
      if (form.consumptionScale.trim() !== "") payload.consumptionScale = form.consumptionScale.trim();
      // Preserve existing status on edit; only override if explicitly "final"
      if (editClient) {
        payload.status = editClient.status || "prospect";
      }

      let savedId: number;
      if (editClient) {
        const r = await fetch(`${API}/api/clients/${editClient.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        savedId = editClient.id;
        toast({ title: "Cliente actualizado" });
      } else {
        const r = await fetch(`${API}/api/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        const created = await r.json();
        savedId = created.id;
        setCreatedClientId(savedId);
        toast({ title: "Cliente creado" });
      }

      // Create linked task if requested
      if (showTaskForm && taskForm.title.trim() && savedId) {
        try {
          await fetch(`${API}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: taskForm.title.trim(),
              type: taskForm.type,
              priority: taskForm.priority,
              status: "pending",
              clientId: savedId,
              assignedTo: taskForm.assignedToUserId ? Number(taskForm.assignedToUserId) : undefined,
              dueDate: taskForm.dueDate || undefined,
            }),
          });
          toast({ title: "Tarea asignada correctamente" });
        } catch {
          toast({ title: "Cliente guardado, pero no se pudo crear la tarea", variant: "destructive" });
        }
      }

      if (showBuyerForm && buyerForm.firstName.trim() && savedId) {
        await saveBuyer(savedId);
      } else {
        onSaved();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: e.message || "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveBuyer = async (clientId: number) => {
    if (!buyerForm.firstName.trim()) return;
    setSavingBuyer(true);
    try {
      const r = await fetch(`${API}/api/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ clientId, firstName: buyerForm.firstName.trim(), lastName: buyerForm.lastName.trim(), email: buyerForm.email.trim(), phone: buyerForm.phone.trim(), position: buyerForm.position.trim() || "Comprador" }) });
      if (!r.ok) throw new Error("Error al crear comprador");
      toast({ title: "Comprador creado" });
    } catch { toast({ title: "Comprador no guardado — podés agregarlo luego desde la ficha", variant: "destructive" }); }
    finally { setSavingBuyer(false); onSaved(); onOpenChange(false); }
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
              {ready ? "— campos completos" : isReadyForScale(form) ? "— agregá industria, teléfono y email para pasar a Potencial" : "— completá Nombre, CUIT y Ciudad para cargar escala"}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* ── Datos empresa ── */}
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
              <Input value={form.industry} onChange={f("industry")} placeholder="Ej: Metalúrgica" />
            </div>
          </div>

          <DuplicateWarning entity="clients" params={{ taxId: form.taxId, companyName: form.companyName }} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono <span className="text-destructive">*</span></Label>
              <Input value={form.phone} onChange={f("phone")} placeholder="+54 11 1234-5678" />
            </div>
            <div>
              <Label>Ciudad <span className="text-destructive">*</span></Label>
              <Input value={form.city} onChange={f("city")} placeholder="Buenos Aires" />
            </div>
          </div>

          <EmailManager emails={form.clientEmails} onChange={emails => setForm(p => ({ ...p, clientEmails: emails }))} />

          {/* ── Escala de consumo (visible con Nombre + CUIT + Ciudad) ── */}
          {(isReadyForScale(form) || (editClient && ["potential", "inactive", "final"].includes(editClient.status))) && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-amber-400">
                <DollarSign className="w-4 h-4" />Escala de Consumo (USD/año proyectado)
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.consumptionScale}
                onChange={f("consumptionScale")}
                placeholder="Ej: 50000"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Proyección del vendedor. Si es <strong>0</strong> el cliente pasa a <strong>Inactivo</strong>. Si es {">"} 0 queda como <strong>Potencial</strong>.
              </p>
              {!isNaN(parseFloat(form.consumptionScale)) && (
                <p className="text-xs font-medium">
                  Estado resultante: {statusBadge(parseFloat(form.consumptionScale) === 0 ? "inactive" : "potential")}
                </p>
              )}
            </div>
          )}

          {/* ── Admin override for final ── */}
          {isAdmin && editClient?.status === "final" && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
              <Label className="text-sm text-muted-foreground">Cambio manual de estado (Admin)</Label>
              <Select value={editClient.status} onValueChange={() => {}}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_STATUS_CONFIG).map(([v, cfg]) => <SelectItem key={v} value={v}>{cfg.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={f("notes")} placeholder="Observaciones..." rows={2} />
          </div>

          {/* ── Usuario a cargo (solo lectura, se llena desde "Asignar a" en la tarea) ── */}
          {isAdmin && (
            <div>
              <Label>Usuario a cargo</Label>
              <div className="flex items-center h-9 rounded-md border border-border/50 bg-muted/30 px-3 text-sm">
                {form.assignedUserId
                  ? <span className="text-foreground">{users.find((u: any) => u.id === form.assignedUserId)?.fullName || "—"}</span>
                  : <span className="text-muted-foreground">Se asigna desde "Asignar a" en la tarea</span>
                }
              </div>
            </div>
          )}

          {/* ── Comprador inline ── */}
          {!showBuyerForm ? (
            <button type="button" onClick={() => setShowBuyerForm(true)}
              className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-lg px-3 py-2 hover:border-border transition-colors">
              <UserPlus className="w-4 h-4" />
              {editClient ? "Agregar comprador a esta empresa" : "Agregar comprador (opcional)"}
            </button>
          ) : (
            <div className="rounded-lg border border-border/50 p-3 space-y-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5"><UserPlus className="w-4 h-4" />Datos del Comprador</p>
                <button type="button" onClick={() => setShowBuyerForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              {editClient && (
                <p className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1">El comprador se vincula a la empresa ya guardada.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nombre *</Label><Input value={buyerForm.firstName} onChange={e => setBuyerForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Juan" /></div>
                <div><Label className="text-xs">Apellido</Label><Input value={buyerForm.lastName} onChange={e => setBuyerForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Pérez" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Email</Label><Input type="email" value={buyerForm.email} onChange={e => setBuyerForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@empresa.com" /></div>
                <div><Label className="text-xs">Teléfono</Label><Input value={buyerForm.phone} onChange={e => setBuyerForm(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Rol / Puesto</Label><Input value={buyerForm.position} onChange={e => setBuyerForm(p => ({ ...p, position: e.target.value }))} placeholder="Comprador, Gerente de compras..." /></div>
              {editClient && (
                <Button type="button" size="sm" className="w-full" disabled={savingBuyer || !buyerForm.firstName.trim()}
                  onClick={async () => { await saveBuyer(editClient.id); onSaved(); onOpenChange(false); }}>
                  {savingBuyer ? "Guardando..." : "Guardar comprador"}
                </Button>
              )}
            </div>
          )}

          {/* ── Tarea inline ── */}
          {!showTaskForm ? (
            <button type="button" onClick={() => setShowTaskForm(true)}
              className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-lg px-3 py-2 hover:border-border transition-colors">
              <ListTodo className="w-4 h-4" />
              Asignar tarea a un vendedor (opcional)
            </button>
          ) : (
            <div className="rounded-lg border border-border/50 p-3 space-y-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5"><ListTodo className="w-4 h-4" />Nueva Tarea</p>
                <button type="button" onClick={() => setShowTaskForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <Label className="text-xs">Descripción de la tarea *</Label>
                <Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej: Llamar para seguimiento inicial" />
              </div>
              <div>
                <Label className="text-xs">Prioridad</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Asignar a</Label>
                  <Select
                    value={taskForm.assignedToUserId || "none"}
                    onValueChange={v => {
                      const uid = v === "none" ? "" : v;
                      setTaskForm(p => ({ ...p, assignedToUserId: uid }));
                      setForm(p => ({ ...p, assignedUserId: uid ? Number(uid) : undefined }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {users.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fecha límite</Label>
                  <Input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
              </div>
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

// ─── Main page ────────────────────────────────────────────────────────────────
const ALL_STATUSES = ["prospect", "potential", "inactive", "final"] as const;

export default function Clients() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);

  const statusQuery = statusFilter.length ? statusFilter.join(",") : undefined;
  const { data: response, isLoading, refetch } = useGetClients({ search: search || undefined, status: statusQuery } as any);
  const { data: salespeopleRes } = useGetSalespeople();
  const salespeople = (salespeopleRes as any) || [];

  const { toast } = useToast();
  const { user } = useAuth();
  const canBulkImport = ["admin", "gerente", "gerente_comercial"].includes((user as any)?.role);

  const toggleStatus = (s: string) =>
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const openNew = () => { setEditClient(null); setOpen(true); };
  const openEdit = (e: React.MouseEvent, client: any) => { e.stopPropagation(); setEditClient(client); setOpen(true); };

  // ── Nuevo Contacto standalone ──
  const BLANK_CONTACT = { clientId: "", firstName: "", lastName: "", position: "", email: "", phone: "", isPrimary: false };
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [savingContact, setSavingContact] = useState(false);
  const [contactClientSearch, setContactClientSearch] = useState("");

  const allClients: any[] = (response as any)?.data || [];
  const filteredForPicker = contactClientSearch.trim()
    ? allClients.filter((c: any) =>
        (c.company_name || c.companyName || "").toLowerCase().includes(contactClientSearch.toLowerCase())
      )
    : allClients.slice(0, 20);

  const saveNewContact = async () => {
    if (!contactForm.firstName.trim() || !contactForm.clientId) return;
    setSavingContact(true);
    try {
      const r = await fetch(`${API}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...contactForm, clientId: Number(contactForm.clientId) }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Contacto creado" });
      setContactOpen(false);
      setContactForm(BLANK_CONTACT);
      setContactClientSearch("");
    } catch {
      toast({ title: "Error al crear contacto", variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-1">Directorio de empresas.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportClientsDialog onDone={refetch} />
          <ProspectsImportDialog onDone={refetch} />
          <Button variant="outline" onClick={() => { setContactForm(BLANK_CONTACT); setContactClientSearch(""); setContactOpen(true); }}>
            <Contact2 className="w-4 h-4 mr-2" />Nuevo Contacto
          </Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nuevo Cliente</Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {ALL_STATUSES.map(s => {
            const cfg = CLIENT_STATUS_CONFIG[s];
            const active = statusFilter.includes(s);
            return (
              <button key={s} onClick={() => toggleStatus(s)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all font-medium ${active ? cfg.badge : "border-border/40 text-muted-foreground hover:border-border/70"}`}>
                {cfg.label}
              </button>
            );
          })}
          {statusFilter.length > 0 && (
            <button onClick={() => setStatusFilter([])} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3 inline" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Prospectos a un paso de ser Potenciales ── */}
      <ProspectsNearPotential maxItems={6} />

      {/* ── Tabla ── */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow>
              <TableHead className="w-24">Nro.</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Industria</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Escala USD</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : !response?.data?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No hay clientes{statusFilter.length ? " con ese filtro" : " todavía"}.</p>
                </TableCell>
              </TableRow>
            ) : response.data.map((client: any) => {
              const emails: string[] = Array.isArray(client.clientEmails) ? client.clientEmails : [];
              const cfg = CLIENT_STATUS_CONFIG[client.status] || CLIENT_STATUS_CONFIG.prospect;
              return (
                <TableRow key={client.id} className="border-border/50 hover:bg-white/5 cursor-pointer" onClick={() => setLocation(`/clients/${client.id}`)}>
                  <TableCell><span className="font-mono text-sm font-semibold text-primary/80">{client.externalId || client.id}</span></TableCell>
                  <TableCell>
                    <p className="font-medium">{client.companyName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{client.taxId || ""}</p>
                  </TableCell>
                  <TableCell>
                    {emails.length > 0 ? (
                      <div className="flex flex-col gap-0.5">{emails.slice(0, 2).map((em, i) => <span key={i} className="text-xs font-mono text-blue-400">{em}</span>)}</div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{client.industry || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{client.city || "—"}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {client.consumptionScale != null ? (
                      <span className="text-amber-400">u$s {Number(client.consumptionScale).toLocaleString("es-AR")}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cfg.badge}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => openEdit(e, client)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ClientDialog
        open={open}
        onOpenChange={setOpen}
        editClient={editClient}
        salespeople={salespeople}
        onSaved={refetch}
      />

      {/* ── Dialog: Nuevo Contacto ── */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Contact2 className="w-4 h-4" />Nuevo Contacto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {/* Selector de empresa */}
            <div>
              <Label>Empresa <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Buscar empresa..."
                value={contactClientSearch}
                onChange={e => { setContactClientSearch(e.target.value); setContactForm(f => ({ ...f, clientId: "" })); }}
                className="mb-1"
              />
              {!contactForm.clientId && (
                <div className="border rounded-md max-h-36 overflow-y-auto">
                  {filteredForPicker.length === 0
                    ? <p className="text-xs text-muted-foreground p-2">Sin resultados</p>
                    : filteredForPicker.map((c: any) => (
                      <button key={c.id} type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                        onClick={() => { setContactForm(f => ({ ...f, clientId: String(c.id) })); setContactClientSearch(c.company_name || c.companyName || ""); }}>
                        {c.company_name || c.companyName}
                      </button>
                    ))
                  }
                </div>
              )}
              {contactForm.clientId && (
                <p className="text-xs text-green-400 mt-0.5">✓ {contactClientSearch}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={contactForm.firstName} onChange={e => setContactForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Juan" />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input value={contactForm.lastName} onChange={e => setContactForm(f => ({ ...f, lastName: e.target.value }))} placeholder="García" />
              </div>
            </div>
            <div>
              <Label>Cargo / Puesto</Label>
              <Input value={contactForm.position} onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))} placeholder="Comprador, Gerente de Planta..." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@empresa.com" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+54 9 11 1234-5678" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cp-primary"
                checked={contactForm.isPrimary}
                onCheckedChange={v => setContactForm(f => ({ ...f, isPrimary: !!v }))}
              />
              <Label htmlFor="cp-primary" className="cursor-pointer">Contacto principal</Label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setContactOpen(false)}>
                <X className="h-4 w-4 mr-1" />Cancelar
              </Button>
              <Button size="sm" onClick={saveNewContact}
                disabled={savingContact || !contactForm.firstName.trim() || !contactForm.clientId}>
                {savingContact ? "Guardando..." : "Guardar contacto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
