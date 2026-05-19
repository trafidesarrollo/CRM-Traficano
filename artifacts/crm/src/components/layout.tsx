import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, Inbox, Briefcase, Users, Contact2, UserSquare, 
  Package, UploadCloud, Mail, Bot, Settings, LogOut, Menu, Timer, 
  Target, Plus, PhoneCall, MessageSquare, FileText, ShoppingCart, Tag, ListTodo,
  CalendarDays, BarChart3, Workflow, Sliders, MailOpen, GitBranch, CalendarClock, ShieldCheck, Factory, Kanban, Upload,
  FileUp, CheckCircle2, AlertCircle, X
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "";

const PRIVILEGED_ROLES = ["admin", "gerente_comercial"];

const navItems = [
  { href: "/dashboard",        label: "Dashboard",             icon: LayoutDashboard, module: "dashboard" },
  { href: "/inbox",            label: "Inbox Comercial",       icon: MessageSquare,   module: "inbox",             hiddenFromRoles: ["vendedor"] },
  { href: "/emails",           label: "Emails (legacy)",       icon: Inbox,           module: "emails",            hiddenFromRoles: ["vendedor"] },
  { href: "/opportunities",    label: "Oportunidades",         icon: Briefcase,       module: "oportunidades",     hiddenFromRoles: ["vendedor"] },
  { href: "/quotes",           label: "Cotizaciones",          icon: FileText,        module: "cotizaciones" },
  { href: "/quotes/pipeline",  label: "Pipeline Visual",       icon: Kanban,          module: "cotizaciones" },
  { href: "/orders",           label: "Pedidos",               icon: ShoppingCart,    module: "pedidos",           hiddenFromRoles: ["vendedor"] },
  { href: "/tasks",            label: "Tareas",                icon: ListTodo,        module: "tareas" },
  { href: "/calendar",         label: "Calendario",            icon: CalendarDays,    module: "calendario" },
  { href: "/calendar/sync",    label: "Sync Google Calendar",  icon: CalendarClock,   module: "calendario",        hiddenFromRoles: ["vendedor"] },
  { href: "/pipelines",        label: "Pipelines",             icon: GitBranch,       module: "pipelines",         roles: ["admin", "gerente", "gerente_comercial"] },
  { href: "/reports",          label: "Reportes",              icon: BarChart3,       module: "reportes",          hiddenFromRoles: ["vendedor"] },
  { href: "/clients",          label: "Clientes",              icon: Users,           module: "clientes" },
  { href: "/contacts",         label: "Contactos",             icon: Contact2,        module: "contactos",         hiddenFromRoles: ["vendedor"] },
  { href: "/salespeople",      label: "Vendedores",            icon: UserSquare,      module: "vendedores",        hiddenFromRoles: ["vendedor"] },
  { href: "/products",         label: "Productos",             icon: Package,         module: "productos" },
  { href: "/price-lists",      label: "Listas de precios",     icon: Tag,             module: "listas_precios",    hiddenFromRoles: ["vendedor"] },
  { href: "/email-templates",  label: "Plantillas Email",      icon: MailOpen,        module: "plantillas_email",  hiddenFromRoles: ["vendedor"] },
  { href: "/automation",       label: "Automatizaciones",      icon: Workflow,        module: "automatizaciones",  roles: ["admin", "gerente", "gerente_comercial"] },
  { href: "/custom-fields",    label: "Campos personalizados", icon: Sliders,         module: "campos",            roles: ["admin", "gerente", "gerente_comercial"] },
  { href: "/imports",          label: "Importar CSV",          icon: UploadCloud,     module: "importaciones",     hiddenFromRoles: ["vendedor"] },
  { href: "/csv",              label: "Import/Export CSV",     icon: UploadCloud,     module: "csv",               roles: ["admin", "gerente", "gerente_comercial"] },
  { href: "/followups",        label: "Seguimientos",          icon: Timer,           module: "seguimientos",      hiddenFromRoles: ["vendedor"] },
  { href: "/goals",            label: "Metas",                 icon: Target,          module: "metas",             roles: ["admin", "gerente", "gerente_comercial"] },
  { href: "/gmail",            label: "Gmail Sync",            icon: Mail,            module: "gmail",             hiddenFromRoles: ["vendedor"] },
  { href: "/anura",            label: "Anura Llamadas",        icon: PhoneCall,       module: "anura",             hiddenFromRoles: ["vendedor"] },
  { href: "/prompts",          label: "Prompts IA",            icon: Bot,             module: "prompts",           hiddenFromRoles: ["vendedor"] },
  { href: "/audit",            label: "Auditoría",             icon: ShieldCheck,     module: "auditoria",         roles: ["admin", "gerente", "gerente_comercial"] },
  { href: "/production",       label: "Producción (MES)",      icon: Factory,         module: "produccion",        hiddenFromRoles: ["vendedor"] },
  { href: "/users",            label: "Usuarios",              icon: Settings,        module: "usuarios",          roles: ["admin", "gerente_comercial"] },
];

function BulkFollowupFAB() {
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
    const text = await file.text();
    setCsvText(text);
    e.target.value = "";
  }

  async function doImport() {
    if (!csvText.trim()) {
      toast({ title: "Pegá o subí un CSV primero", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/csv/import/client-followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ csv: csvText, separator }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error de importación");
      setResult(data);
      toast({
        title: "Carga masiva finalizada",
        description: `${data.createdTasks} tareas y ${data.createdFollowups} seguimientos creados`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-cyan-500 text-white shadow-lg hover:bg-cyan-400 transition-all flex items-center justify-center hover:scale-105"
        title="Carga masiva de novedades"
      >
        <FileUp className="w-6 h-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-cyan-400" />
              Carga masiva de novedades
            </DialogTitle>
          </DialogHeader>

          {!result ? (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Importá el resumen de lo hablado con cada cliente. Por cada fila se crea una tarea en el calendario y un seguimiento programado.
              </p>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Separador</Label>
                <div className="flex gap-2">
                  {([";", ","] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSeparator(s)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-mono border transition-colors ${separator === s ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "border-border/50 text-muted-foreground hover:border-border"}`}
                    >
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
                <Textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  rows={6}
                  placeholder={`nro_cliente${separator}customer_name${separator}fecha${separator}fecha_seguimiento${separator}urgencia${separator}titulo${separator}novedad${separator}accion\n10013${separator}OPS S.A.${separator}2026-03-20${separator}2026-03-23${separator}Media${separator}Reunión comercial${separator}Cliente evalúa precios${separator}Enviar cotización`}
                  className="font-mono text-xs"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-white/5 rounded-lg p-3 space-y-1">
                <p><span className="text-foreground font-medium">Obligatorios:</span> nro_cliente, novedad</p>
                <p><span className="text-foreground font-medium">Opcionales:</span> customer_name, fecha, fecha_seguimiento, urgencia, titulo, accion</p>
                <p className="text-cyan-400/80">Si no hay fecha_seguimiento, se programa automáticamente a 3 días.</p>
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
                  <p className="text-2xl font-bold text-green-400">{result.createdTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tareas / Calendario</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-400">{result.createdActivities}</p>
                  <p className="text-xs text-muted-foreground mt-1">Bitácoras</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-2xl font-bold text-purple-400">{result.createdFollowups}</p>
                  <p className="text-xs text-muted-foreground mt-1">Seguimientos</p>
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
                  <CheckCircle2 className="w-4 h-4" />
                  Todas las filas importadas correctamente
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>
                  Nueva importación
                </Button>
                <Button className="flex-1" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickActivityFAB() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [form, setForm] = useState({
    type: "call",
    clientId: "",
    outcome: "contacted",
    generatesLead: false,
    farmerId: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([
        fetch(`${API_BASE}/api/clients?limit=200`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/salespeople`, { credentials: "include" }).then(r => r.json()),
      ]).then(([clRes, spRes]) => {
        setClients(clRes.data || clRes || []);
        setFarmers((Array.isArray(spRes) ? spRes : []).filter((s: any) => s.functionalRole === "farmer"));
      }).catch(() => {});
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.clientId || form.clientId === "none") {
      toast({ title: "Seleccioná un cliente", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const typeLabels: Record<string, string> = { call: "Llamada", visit: "Visita", task: "Tarea" };
      const actBody: any = {
        type: form.type,
        title: `${typeLabels[form.type] || form.type} - ${clients.find(c => c.id === parseInt(form.clientId))?.companyName || "Cliente"}`,
        clientId: parseInt(form.clientId),
        outcome: form.outcome,
        description: form.notes || undefined,
        completedAt: new Date().toISOString(),
      };

      const actRes = await fetch(`${API_BASE}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(actBody),
      });
      if (!actRes.ok) {
        const err = await actRes.json().catch(() => ({}));
        throw new Error(err.error || `Error ${actRes.status}`);
      }

      if (form.generatesLead) {
        const oppBody: any = {
          title: `Lead - ${clients.find(c => c.id === parseInt(form.clientId))?.companyName || "Nuevo"}`,
          clientId: parseInt(form.clientId),
          status: "new",
          priority: "medium",
          farmerId: form.farmerId && form.farmerId !== "none" ? parseInt(form.farmerId) : undefined,
        };
        const oppRes = await fetch(`${API_BASE}/api/opportunities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(oppBody),
        });
        if (!oppRes.ok) {
          const err = await oppRes.json().catch(() => ({}));
          throw new Error(err.error || `Error ${oppRes.status}`);
        }
      }

      toast({ title: form.generatesLead ? "Actividad registrada y lead creado" : "Actividad registrada" });
      setOpen(false);
      setForm({ type: "call", clientId: "", outcome: "contacted", generatesLead: false, farmerId: "", notes: "" });
    } catch (err: any) {
      toast({ title: err?.message || "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center hover:scale-105"
      >
        <PhoneCall className="w-6 h-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Actividad Rápida</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Llamada</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                  <SelectItem value="task">Tarea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa / Cliente</Label>
              <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar...</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.companyName || c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resultado</Label>
              <Select value={form.outcome} onValueChange={v => setForm({ ...form, outcome: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacted">Contactado</SelectItem>
                  <SelectItem value="not_contacted">No contactado</SelectItem>
                  <SelectItem value="meeting_scheduled">Reunión agendada</SelectItem>
                  <SelectItem value="quote_requested">Cotización solicitada</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <Label className="cursor-pointer">¿Generó un lead?</Label>
              <Switch checked={form.generatesLead} onCheckedChange={v => setForm({ ...form, generatesLead: v })} />
            </div>
            {form.generatesLead && (
              <div>
                <Label>Asignar a Farmer</Label>
                <Select value={form.farmerId} onValueChange={v => setForm({ ...form, farmerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar farmer..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {farmers.map((f: any) => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Observaciones</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notas adicionales..." />
            </div>
            <Button className="w-full" disabled={saving} onClick={handleSave}>
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const NavLinks = () => {
    const role = user?.role || "";
    const isPrivileged = PRIVILEGED_ROLES.includes(role);
    const modulePerms: string[] | null = isPrivileged ? null : ((user as any)?.modulePermissions ?? null);

    const visible = navItems.filter((item) => {
      if (isPrivileged) return true;
      if (modulePerms !== null && item.module) return modulePerms.includes(item.module);
      if ((item as any).roles && !(item as any).roles.includes(role)) return false;
      if ((item as any).hiddenFromRoles?.includes(role)) return false;
      return true;
    });

    return (
      <nav className="space-y-1 mt-6">
        {visible.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }
              `}
            >
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="hidden md:flex w-72 flex-col bg-card border-r border-border/50 p-4 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-3 px-2 py-4">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">CRM</span>
        </div>
        <div className="flex-1"><NavLinks /></div>
        <div className="mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded-xl bg-white/5">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.fullName.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />Cerrar Sesión
          </Button>
        </div>
      </aside>

      <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border/50 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-lg">CRM</span>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="text-primary">
            <Link href="/csv" aria-label="Import/Export CSV">
              <UploadCloud className="w-5 h-5" />
            </Link>
          </Button>
          <NotificationBell />
          <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="w-6 h-6" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-card border-r-0 p-4">
            <NavLinks />
            <div className="absolute bottom-4 left-4 right-4">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />Cerrar Sesión
              </Button>
            </div>
          </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="hidden md:flex items-center justify-end gap-2 p-4 border-b border-border/50 sticky top-0 z-40 bg-background/80 backdrop-blur">
          <NotificationBell />
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>

      <BulkFollowupFAB />
      <QuickActivityFAB />
    </div>
  );
}
