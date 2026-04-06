import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, Inbox, Briefcase, Users, Contact2, UserSquare, 
  Package, UploadCloud, Mail, Bot, Settings, LogOut, Menu, Timer, 
  Target, Plus, PhoneCall, MessageSquare
} from "lucide-react";
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox Comercial", icon: MessageSquare },
  { href: "/emails", label: "Emails (legacy)", icon: Inbox },
  { href: "/opportunities", label: "Oportunidades", icon: Briefcase },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/contacts", label: "Contactos", icon: Contact2 },
  { href: "/salespeople", label: "Vendedores", icon: UserSquare },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/imports", label: "Importar CSV", icon: UploadCloud },
  { href: "/followups", label: "Seguimientos", icon: Timer },
  { href: "/goals", label: "Metas", icon: Target, roles: ["admin", "gerente"] },
  { href: "/gmail", label: "Gmail Sync", icon: Mail },
  { href: "/prompts", label: "Prompts IA", icon: Bot },
  { href: "/users", label: "Usuarios", icon: Settings, roles: ["admin"] },
];

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

      await fetch(`${API_BASE}/api/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(actBody),
      });

      if (form.generatesLead) {
        const oppBody: any = {
          title: `Lead - ${clients.find(c => c.id === parseInt(form.clientId))?.companyName || "Nuevo"}`,
          clientId: parseInt(form.clientId),
          status: "new",
          priority: "medium",
          farmerId: form.farmerId && form.farmerId !== "none" ? parseInt(form.farmerId) : undefined,
        };
        await fetch(`${API_BASE}/api/opportunities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(oppBody),
        });
      }

      toast({ title: form.generatesLead ? "Actividad registrada y lead creado" : "Actividad registrada" });
      setOpen(false);
      setForm({ type: "call", clientId: "", outcome: "contacted", generatesLead: false, farmerId: "", notes: "" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
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

  const NavLinks = () => (
    <nav className="space-y-1 mt-6">
      {navItems.map((item) => {
        if (item.roles && !item.roles.includes(user?.role || "")) return null;
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
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>

      <QuickActivityFAB />
    </div>
  );
}
