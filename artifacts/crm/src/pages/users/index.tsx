import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Shield, ShieldCheck, User, UserCog, Pencil,
  Search, Star, Lock, LayoutDashboard, CheckSquare, Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetUsers, useDeleteUser } from "@workspace/api-client-react";

const API = import.meta.env.VITE_API_URL || "";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gerente_comercial: "Gerente Comercial",
  gerente: "Gerente",
  vendedor: "Vendedor",
  operador: "Operador",
};

const ROLE_DESC: Record<string, string> = {
  admin: "Acceso total. Gestiona usuarios, configuración y todos los módulos.",
  gerente_comercial: "Mismo acceso que Administrador. Puede gestionar usuarios y permisos.",
  gerente: "Gestión avanzada: reportes, automatizaciones, CSV y campos personalizados.",
  vendedor: "Cotizaciones, clientes, tareas y calendario.",
  operador: "Acceso básico para carga de datos e importaciones.",
};

const ROLE_ICONS: Record<string, any> = {
  admin: ShieldCheck,
  gerente_comercial: Star,
  gerente: Shield,
  vendedor: User,
  operador: UserCog,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  gerente_comercial: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  gerente: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  vendedor: "bg-green-500/10 text-green-400 border-green-500/20",
  operador: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const ALL_MODULES = [
  { key: "dashboard",        label: "Dashboard" },
  { key: "inbox",            label: "Inbox Comercial" },
  { key: "emails",           label: "Emails" },
  { key: "oportunidades",    label: "Oportunidades" },
  { key: "cotizaciones",     label: "Cotizaciones" },
  { key: "pedidos",          label: "Pedidos" },
  { key: "tareas",           label: "Tareas" },
  { key: "calendario",       label: "Calendario" },
  { key: "pipelines",        label: "Pipelines" },
  { key: "reportes",         label: "Reportes" },
  { key: "clientes",         label: "Clientes" },
  { key: "contactos",        label: "Contactos" },
  { key: "vendedores",       label: "Vendedores" },
  { key: "productos",        label: "Productos" },
  { key: "listas_precios",   label: "Listas de precios" },
  { key: "plantillas_email", label: "Plantillas Email" },
  { key: "automatizaciones", label: "Automatizaciones" },
  { key: "campos",           label: "Campos personalizados" },
  { key: "importaciones",    label: "Importar CSV" },
  { key: "csv",              label: "CSV/Export" },
  { key: "seguimientos",     label: "Seguimientos" },
  { key: "metas",            label: "Metas" },
  { key: "gmail",            label: "Gmail Sync" },
  { key: "anura",            label: "Anura Llamadas" },
  { key: "prompts",          label: "Prompts IA" },
  { key: "auditoria",        label: "Auditoría" },
  { key: "produccion",       label: "Producción (MES)" },
];

// Every individual nav item — used for GLOBAL visibility panel (by href, fully independent)
const GLOBAL_NAV_ITEMS = [
  { href: "/dashboard",        label: "Dashboard" },
  { href: "/inbox",            label: "Inbox Comercial" },
  { href: "/emails",           label: "Emails (legacy)" },
  { href: "/opportunities",    label: "Oportunidades" },
  { href: "/quotes",           label: "Cotizaciones" },
  { href: "/quotes/pipeline",  label: "Pipeline Visual" },
  { href: "/orders",           label: "Pedidos" },
  { href: "/tasks",            label: "Tareas" },
  { href: "/carga-masiva",     label: "Carga Masiva" },
  { href: "/calendar",         label: "Calendario" },
  { href: "/calendar/sync",    label: "Sync Google Calendar" },
  { href: "/pipelines",        label: "Pipelines" },
  { href: "/reports",          label: "Reportes" },
  { href: "/clients",          label: "Clientes" },
  { href: "/contacts",         label: "Contactos" },
  { href: "/salespeople",      label: "Vendedores" },
  { href: "/products",         label: "Productos" },
  { href: "/price-lists",      label: "Listas de precios" },
  { href: "/email-templates",  label: "Plantillas Email" },
  { href: "/automation",       label: "Automatizaciones" },
  { href: "/custom-fields",    label: "Campos personalizados" },
  { href: "/imports",          label: "Importar CSV" },
  { href: "/csv",              label: "Import/Export CSV" },
  { href: "/followups",        label: "Seguimientos" },
  { href: "/goals",            label: "Metas" },
  { href: "/gmail",            label: "Gmail Sync" },
  { href: "/anura",            label: "Anura Llamadas" },
  { href: "/prompts",          label: "Prompts IA" },
  { href: "/audit",            label: "Auditoría" },
  { href: "/production",       label: "Producción (MES)" },
  { href: "/users",            label: "Usuarios" },
];

const PRIVILEGED = ["admin", "gerente_comercial"];

const emptyCreate = { username: "", password: "", fullName: "", email: "", role: "vendedor" };

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<any>(null);
  const [editTab, setEditTab] = useState<"info" | "rol" | "modulos">("info");
  const [editForm, setEditForm] = useState({ fullName: "", email: "", isActive: true, password: "", role: "" });
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editModulesDefault, setEditModulesDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const [globalDisabled, setGlobalDisabled] = useState<string[]>([]);
  const [showGlobalModules, setShowGlobalModules] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);

  const { data: users = [], isLoading, refetch } = useGetUsers() as any;
  const deleteMut = useDeleteUser({
    mutation: { onSuccess: () => { toast({ title: "Usuario eliminado" }); refetch(); } },
  });

  useEffect(() => {
    fetch(`${API}/api/settings/modules`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { disabled: [] })
      .then(d => setGlobalDisabled(d.disabled || []));
  }, []);

  function toggleGlobal(key: string) {
    setGlobalDisabled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function saveGlobalModules() {
    setSavingGlobal(true);
    try {
      const r = await fetch(`${API}/api/settings/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ disabled: globalDisabled }),
      });
      if (!r.ok) throw new Error("Error al guardar");
      // Refresh auth so sidebar updates immediately for current user
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Módulos del sistema actualizados" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingGlobal(false); }
  }

  const filtered = (users as any[]).filter((u: any) =>
    !search || u.fullName?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Error"); }
      toast({ title: "Usuario creado" });
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  }

  async function openEdit(u: any) {
    setEditUser(u);
    setEditTab("info");
    setEditForm({ fullName: u.fullName || "", email: u.email || "", isActive: u.isActive, password: "", role: u.role });
    const r = await fetch(`${API}/api/users/${u.id}/permissions`, { credentials: "include" });
    if (r.ok) {
      const data = await r.json();
      if (data.modules.length === 0) { setEditModules([]); setEditModulesDefault(true); }
      else { setEditModules(data.modules); setEditModulesDefault(false); }
    }
  }

  function toggleModule(key: string) {
    setEditModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function handleSave() {
    if (!editUser) return;
    setSaving(true);
    try {
      const patchBody: any = {
        fullName: editForm.fullName,
        email: editForm.email || null,
        role: editForm.role,
        isActive: editForm.isActive,
      };
      if (editForm.password) patchBody.password = editForm.password;
      const r = await fetch(`${API}/api/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patchBody),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Error al guardar"); }

      // Save module permissions for ALL users (including privileged roles)
      // Empty array = use role defaults (show all for privileged, role rules for others)
      const modules = editModulesDefault ? [] : editModules;
      await fetch(`${API}/api/users/${editUser.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ modules }),
      });

      // Refresh auth so sidebar updates immediately (handles own-user module changes)
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Usuario actualizado" });
      setEditUser(null);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground mt-1">{(users as any[]).length} usuarios</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre completo</Label><Input value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} /></div>
              <div><Label>Usuario</Label><Input value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} /></div>
              <div><Label>Email (opcional)</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
              <div><Label>Contraseña</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} /></div>
              <div>
                <Label>Rol</Label>
                <Select value={createForm.role} onValueChange={v => setCreateForm({ ...createForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={creating || !createForm.username || !createForm.password || !createForm.fullName} onClick={handleCreate}>
                {creating ? "Creando..." : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Global Module Visibility Panel */}
      <div className="mb-6 border border-border/50 rounded-xl overflow-hidden bg-card/50">
        <button
          onClick={() => setShowGlobalModules(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Módulos del sistema</p>
              <p className="text-xs text-muted-foreground">
                {globalDisabled.length === 0
                  ? "Todos los módulos están activos"
                  : `${globalDisabled.length} módulo${globalDisabled.length > 1 ? "s" : ""} desactivado${globalDisabled.length > 1 ? "s" : ""} para todos`}
              </p>
            </div>
          </div>
          {showGlobalModules ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showGlobalModules && (
          <div className="border-t border-border/50">
            <div className="px-5 pt-4 pb-2">
              <p className="text-sm text-muted-foreground">
                Cada ítem se puede activar o desactivar de forma independiente. Los desactivados desaparecen del menú para <strong>todos los usuarios</strong>.
              </p>
            </div>
            <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
              {GLOBAL_NAV_ITEMS.map(item => {
                const isDisabled = globalDisabled.includes(item.href);
                return (
                  <div key={item.href} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors">
                    <span className={`text-sm ${isDisabled ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.label}
                    </span>
                    <Switch
                      checked={!isDisabled}
                      onCheckedChange={() => toggleGlobal(item.href)}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center px-5 py-3 border-t border-border/50">
              <Button variant="ghost" size="sm" onClick={() => setGlobalDisabled([])}>Activar todos</Button>
              <Button size="sm" disabled={savingGlobal} onClick={saveGlobalModules}>
                {savingGlobal ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u: any) => {
            const RoleIcon = ROLE_ICONS[u.role] || User;
            return (
              <Card key={u.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                          {(u.fullName || u.username)?.charAt(0).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${u.isActive ? "bg-green-500" : "bg-red-500"}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold leading-tight">{u.fullName || u.username}</h3>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => openEdit(u)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: u.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={ROLE_COLORS[u.role] || ""}>
                      <RoleIcon className="w-3.5 h-3.5 mr-1" />
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                    {!u.isActive && <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Inactivo</Badge>}
                  </div>
                  {u.email && <p className="text-xs text-muted-foreground mt-2 truncate">{u.email}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuario — {editUser?.fullName}</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b border-border/50 mb-4 gap-1">
            {(["info", "rol", "modulos"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setEditTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${editTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === "info" ? "Información" : tab === "rol" ? "Rol" : "Módulos"}
              </button>
            ))}
          </div>

          {editTab === "info" && (
            <div className="space-y-4">
              <div><Label>Nombre completo</Label><Input value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div><Label>Nueva contraseña (dejar vacío para no cambiar)</Label><Input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" /></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <Label className="cursor-pointer">Usuario activo</Label>
                  <p className="text-xs text-muted-foreground">Los usuarios inactivos no pueden iniciar sesión</p>
                </div>
                <Switch checked={editForm.isActive} onCheckedChange={v => setEditForm({ ...editForm, isActive: v })} />
              </div>
            </div>
          )}

          {editTab === "rol" && (
            <div className="space-y-3">
              {Object.entries(ROLE_LABELS).map(([k, label]) => (
                <div
                  key={k}
                  onClick={() => setEditForm({ ...editForm, role: k })}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${editForm.role === k ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}
                >
                  {(() => {
                    const Icon = ROLE_ICONS[k] || User;
                    return <Icon className="w-5 h-5 mt-0.5 shrink-0" />;
                  })()}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ROLE_DESC[k]}</div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${editForm.role === k ? "border-primary" : "border-muted-foreground/40"}`}>
                    {editForm.role === k && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {editTab === "modulos" && (
            <div className="space-y-3">
              {PRIVILEGED.includes(editForm.role) && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm text-primary">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Rol privilegiado — por defecto ve todos los módulos. Podés restringirlos igual.</span>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <Label className="cursor-pointer">Usar permisos por defecto del rol</Label>
                  <p className="text-xs text-muted-foreground">Si está activo, usa las reglas estándar del rol seleccionado</p>
                </div>
                <Switch checked={editModulesDefault} onCheckedChange={v => { setEditModulesDefault(v); if (v) setEditModules([]); }} />
              </div>

              {!editModulesDefault && (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-muted-foreground">Módulos visibles para este usuario:</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditModules(ALL_MODULES.map(m => m.key))}>Todos</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditModules([])}>Ninguno</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {ALL_MODULES.map(mod => (
                      <div
                        key={mod.key}
                        onClick={() => toggleModule(mod.key)}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${editModules.includes(mod.key) ? "border-primary bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-border"}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${editModules.includes(mod.key) ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {editModules.includes(mod.key) && <CheckSquare className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        {mod.label}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{editModules.length} de {ALL_MODULES.length} módulos habilitados</p>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
            <Button variant="ghost" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={handleSave}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
