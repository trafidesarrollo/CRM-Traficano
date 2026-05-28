import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGetSalespeople, useCreateSalesperson, useDeleteSalesperson, useUpdateSalesperson } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Mail, Phone, Eye, Activity, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle, PhoneMissed, Pencil, Save, X, Users, UserPlus, Loader2, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFunctionalRoleLabel, getFunctionalRoleColor, getOppStatusLabel } from "@/lib/translations";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Salespeople() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", userId: "", functionalRole: "" });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });
  const [panelSp, setPanelSp] = useState<any>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [panelActivities, setPanelActivities] = useState<any[]>([]);
  const [panelOpps, setPanelOpps] = useState<any[]>([]);
  const [panelCalls, setPanelCalls] = useState<any[]>([]);
  const [panelStats, setPanelStats] = useState<any>(null);
  const [panelTab, setPanelTab] = useState("metrics");

  // ── Metas ──
  const [targetsData, setTargetsData] = useState<any[]>([]);
  const [targetYear, setTargetYear] = useState(() => new Date().getFullYear());
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetForm, setTargetForm] = useState({
    amount: "", currency: "USD",
    periodType: "monthly" as "monthly" | "quarterly" | "semiannual" | "annual",
    period: new Date().getMonth() + 1,
    metricType: "amount_approved" as "amount_approved" | "count_quotes" | "count_approved" | "count_orders" | "amount_orders",
  });

  const { data: salespeople, isLoading, refetch } = useGetSalespeople();
  const createMut = useCreateSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor creado" }); setOpen(false); refetch(); setForm({ name: "", email: "", phone: "", userId: "", functionalRole: "" }); setSelectedUserId(""); },
      onError: () => toast({ title: "Error al crear vendedor", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor eliminado" }); refetch(); },
    },
  });
  const updateMut = useUpdateSalesperson({
    mutation: {
      onSuccess: () => { toast({ title: "Vendedor actualizado" }); setEditingId(null); refetch(); },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    },
  });

  // ── Equipos comerciales ──
  const [mainTab, setMainTab] = useState("vendedores");
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", description: "" });
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [addingMemberToTeam, setAddingMemberToTeam] = useState<number | null>(null);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("vendedor");
  const [teamUsers, setTeamUsers] = useState<any[]>([]);

  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const r = await fetch(`${API_BASE}/api/commercial-teams`, { credentials: "include" });
      const d = await r.json();
      setTeams(Array.isArray(d) ? d : []);
    } catch {} finally { setLoadingTeams(false); }
  };

  useEffect(() => {
    loadTeams();
    fetch(`${API_BASE}/api/users/assignable`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setTeamUsers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const createTeam = async () => {
    if (!teamForm.name.trim()) return;
    try {
      const r = await fetch(`${API_BASE}/api/commercial-teams`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Equipo creado" });
      setTeamOpen(false);
      setTeamForm({ name: "", description: "" });
      loadTeams();
    } catch { toast({ title: "Error al crear equipo", variant: "destructive" }); }
  };

  const saveTeamEdit = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/commercial-teams/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTeamName, description: editTeamDescription || null }),
      });
      toast({ title: "Equipo actualizado" });
      setEditingTeamId(null);
      loadTeams();
    } catch { toast({ title: "Error al actualizar", variant: "destructive" }); }
  };

  const deleteTeam = async (id: number) => {
    if (!window.confirm("¿Eliminar este equipo?")) return;
    try {
      await fetch(`${API_BASE}/api/commercial-teams/${id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Equipo eliminado" });
      loadTeams();
    } catch { toast({ title: "Error al eliminar", variant: "destructive" }); }
  };

  const addMember = async (teamId: number) => {
    if (!newMemberUserId) return;
    try {
      const r = await fetch(`${API_BASE}/api/commercial-teams/${teamId}/members`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: parseInt(newMemberUserId), role: newMemberRole }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Error"); }
      toast({ title: "Miembro agregado" });
      setAddingMemberToTeam(null);
      setNewMemberUserId("");
      loadTeams();
    } catch (e: any) { toast({ title: e.message || "Error al agregar miembro", variant: "destructive" }); }
  };

  const removeMember = async (teamId: number, memberId: number) => {
    try {
      await fetch(`${API_BASE}/api/commercial-teams/${teamId}/members/${memberId}`, { method: "DELETE", credentials: "include" });
      toast({ title: "Miembro quitado" });
      loadTeams();
    } catch { toast({ title: "Error al quitar miembro", variant: "destructive" }); }
  };

  const startEditSp = (sp: any) => {
    setEditingId(sp.id);
    setEditForm({ name: sp.name || "", email: sp.email || "", phone: sp.phone || "" });
  };

  const saveEditSp = (id: number) => {
    updateMut.mutate({ id, data: editForm as any });
  };

  const [activityCounts, setActivityCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (salespeople && salespeople.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      fetch(`${API_BASE}/api/activities`, { credentials: "include" })
        .then(r => r.json())
        .then((activities: any[]) => {
          const counts: Record<number, number> = {};
          activities.forEach(a => {
            if (a.salespersonId && a.completedAt && new Date(a.completedAt) >= new Date(sevenDaysAgo)) {
              counts[a.salespersonId] = (counts[a.salespersonId] || 0) + 1;
            }
          });
          setActivityCounts(counts);
        })
        .catch(() => {});
    }
  }, [salespeople]);

  const loadTargets = async (spId: number, year: number) => {
    try {
      const r = await fetch(`${API_BASE}/api/sales-targets/by-salesperson/${spId}?year=${year}`, { credentials: "include" });
      const d = await r.json();
      setTargetsData(Array.isArray(d.data) ? d.data : []);
    } catch {}
  };

  const saveTarget = async (spId: number) => {
    const amount = parseFloat(targetForm.amount);
    if (!amount || isNaN(amount)) return;
    setSavingTarget(true);
    try {
      const r = await fetch(`${API_BASE}/api/sales-targets`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salespersonId: spId,
          year: targetYear,
          periodType: targetForm.periodType,
          month: targetForm.period,
          metricType: targetForm.metricType,
          targetAmount: amount,
          currency: targetForm.currency,
        }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Meta guardada" });
      setTargetForm(f => ({ ...f, amount: "" }));
      await loadTargets(spId, targetYear);
    } catch { toast({ title: "Error al guardar meta", variant: "destructive" }); }
    finally { setSavingTarget(false); }
  };

  const openPanel = async (sp: any) => {
    setPanelSp(sp);
    setPanelTab("metrics");
    const year = new Date().getFullYear();
    setTargetYear(year);
    try {
      const [cpRes, actRes, oppsRes, profileRes] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/commercial-plan`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/activities?salespersonId=${sp.id}`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/opportunities?hunterId=${sp.id}&limit=50`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/salespeople/${sp.id}/profile`, { credentials: "include" }).then(r => r.json()),
      ]);
      setPanelData(cpRes);
      setPanelActivities(Array.isArray(actRes) ? actRes.slice(-15).reverse() : []);
      setPanelCalls(profileRes.calls || []);
      setPanelStats(profileRes.stats || null);
      const farmerOpps = await fetch(`${API_BASE}/api/opportunities?farmerId=${sp.id}&limit=50`, { credentials: "include" }).then(r => r.json());
      const allOpps = [...(oppsRes.data || []), ...(farmerOpps.data || [])];
      const uniqueOpps = Array.from(new Map(allOpps.map((o: any) => [o.id, o])).values());
      setPanelOpps(uniqueOpps.filter((o: any) => !["won", "lost", "closed"].includes(o.status)));
      loadTargets(sp.id, year);
    } catch {}
  };

  const handleUpdateRole = async (spId: number, role: string) => {
    try {
      await fetch(`${API_BASE}/api/salespeople/${spId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ functionalRole: role || null }),
      });
      refetch();
      toast({ title: "Rol actualizado" });
    } catch {
      toast({ title: "Error al actualizar rol", variant: "destructive" });
    }
  };

  const filtered = (salespeople || []).filter((s: any) =>
    `${s.name} ${s.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const getPanelMetrics = () => {
    if (!panelData || !panelSp) return null;
    const role = panelSp.functionalRole;
    if (role === "hunter") {
      return panelData.hunterMetrics?.find((m: any) => m.salespersonId === panelSp.id);
    } else if (role === "farmer") {
      return panelData.farmerMetrics?.find((m: any) => m.salespersonId === panelSp.id);
    } else if (role === "admin_ventas") {
      return panelData.adminMetrics?.find((m: any) => m.salespersonId === panelSp.id);
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Vendedores</h1>
          <p className="text-muted-foreground mt-1">
            {mainTab === "vendedores"
              ? `${salespeople?.length || 0} vendedores registrados`
              : `${teams.length} equipos comerciales`}
          </p>
        </div>
        {mainTab === "vendedores" ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Vendedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Vendedor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Usuario del sistema</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={(v) => {
                    setSelectedUserId(v);
                    const u = teamUsers.find((u: any) => String(u.id) === v);
                    if (u) setForm({ ...form, name: u.fullName || u.username || "", email: u.email || "", phone: u.phone || "", userId: String(u.id) });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar usuario..." /></SelectTrigger>
                  <SelectContent>
                    {teamUsers.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.fullName || u.username}
                        {u.email ? ` — ${u.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedUserId && (
                <>
                  <div><Label>Nombre en el CRM</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(opcional)" /></div>
                  <div>
                    <Label>Rol funcional</Label>
                    <Select value={form.functionalRole} onValueChange={(v) => setForm({ ...form, functionalRole: v })}>
                      <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        <SelectItem value="hunter">Hunter</SelectItem>
                        <SelectItem value="farmer">Farmer</SelectItem>
                        <SelectItem value="admin_ventas">Admin Ventas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button
                className="w-full"
                disabled={createMut.isPending || !form.name || !selectedUserId}
                onClick={() => createMut.mutate({ data: { ...form, userId: parseInt(form.userId), functionalRole: form.functionalRole && form.functionalRole !== "none" ? form.functionalRole : undefined } as any })}
              >
                {createMut.isPending ? "Creando..." : "Agregar Vendedor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : (
          <>
            <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nuevo Equipo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo Equipo Comercial</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Nombre del equipo</Label><Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></div>
                  <div><Label>Descripción (opcional)</Label><Input value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
                  <Button className="w-full" disabled={!teamForm.name.trim()} onClick={createTeam}>Crear Equipo</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="mt-0">
        <TabsList className="mb-6">
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="equipos">Equipos Comerciales</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar vendedores..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isLoading ? (
            <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No se encontraron vendedores</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((sp: any) => {
            const isEditing = editingId === sp.id;

            return (
              <Card key={sp.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div><Label className="text-xs">Nombre</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-9" /></div>
                      <div><Label className="text-xs">Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="h-9" /></div>
                      <div><Label className="text-xs">Teléfono</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="h-9" /></div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" disabled={updateMut.isPending || !editForm.name} onClick={() => saveEditSp(sp.id)}>
                          <Save className="w-4 h-4 mr-1" /> {updateMut.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {sp.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{sp.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={getFunctionalRoleColor(sp.functionalRole)}>
                                {getFunctionalRoleLabel(sp.functionalRole)}
                              </Badge>
                              {activityCounts[sp.id] ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Activity className="w-3 h-3" />{activityCounts[sp.id]} esta semana
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => openPanel(sp)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => startEditSp(sp)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: sp.id })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2 text-sm">
                        {sp.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" />{sp.email}</div>}
                        {sp.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" />{sp.phone}</div>}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <Select value={sp.functionalRole || "none"} onValueChange={(v) => handleUpdateRole(sp.id, v === "none" ? "" : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            <SelectItem value="hunter">Hunter</SelectItem>
                            <SelectItem value="farmer">Farmer</SelectItem>
                            <SelectItem value="admin_ventas">Admin Ventas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipos">
          {loadingTeams ? (
            <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : teams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay equipos comerciales aún.</p>
              <p className="text-sm mt-1">Usá "Nuevo Equipo" para crear uno.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team: any) => (
                <Card key={team.id} className="bg-card/50 backdrop-blur-sm border-white/5">
                  <CardContent className="p-5 space-y-4">
                    {/* Team header */}
                    {editingTeamId === team.id ? (
                      <div className="space-y-2">
                        <Input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} className="h-8 text-sm" placeholder="Nombre del equipo" autoFocus />
                        <Input value={editTeamDescription} onChange={(e) => setEditTeamDescription(e.target.value)} className="h-8 text-sm" placeholder="Descripción (opcional)" />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingTeamId(null)}><X className="w-4 h-4 mr-1" />Cancelar</Button>
                          <Button size="sm" onClick={() => saveTeamEdit(team.id)} disabled={!editTeamName.trim()}><Save className="w-4 h-4 mr-1" />Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{team.name}</h3>
                          {team.description && <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{team.members?.length || 0} miembros</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => { setEditingTeamId(team.id); setEditTeamName(team.name); setEditTeamDescription(team.description || ""); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTeam(team.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Members */}
                    {(team.members || []).length > 0 && (
                      <div className="space-y-2">
                        {(team.members || []).map((m: any) => (
                          <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                                {(m.fullName || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium leading-tight text-sm">{m.fullName}</p>
                                <p className="text-[11px] text-muted-foreground">{m.role === "vendedor" ? "Vendedor" : "Apoyo"}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeMember(team.id, m.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add member */}
                    {addingMemberToTeam === team.id ? (
                      <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Agregar miembro</p>
                        <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar usuario..." /></SelectTrigger>
                          <SelectContent>
                            {teamUsers.map((u: any) => (
                              <SelectItem key={u.id} value={String(u.id)}>{u.fullName || u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vendedor">Vendedor</SelectItem>
                            <SelectItem value="apoyo">Apoyo</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs flex-1" disabled={!newMemberUserId} onClick={() => addMember(team.id)}>Agregar</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingMemberToTeam(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => { setAddingMemberToTeam(team.id); setNewMemberUserId(""); setNewMemberRole("vendedor"); }}>
                        <UserPlus className="w-3.5 h-3.5" />Agregar miembro
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!panelSp} onOpenChange={(v) => { if (!v) setPanelSp(null); }}>
        <SheetContent className="w-[480px] sm:w-[600px] p-0 overflow-hidden flex flex-col">
          <div className="p-6 pb-4 border-b border-border/30 shrink-0">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {panelSp?.name?.charAt(0)}
                </div>
                <div>
                  <span>{panelSp?.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={getFunctionalRoleColor(panelSp?.functionalRole)}>
                      {getFunctionalRoleLabel(panelSp?.functionalRole)}
                    </Badge>
                    {panelSp?.email && <span className="text-xs text-muted-foreground font-normal">{panelSp.email}</span>}
                  </div>
                </div>
              </SheetTitle>
            </SheetHeader>

            {panelStats && (
              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="p-2.5 bg-white/5 rounded-lg text-center">
                  <p className="text-lg font-bold">{panelStats.totalCalls}</p>
                  <p className="text-[10px] text-muted-foreground">Llamadas</p>
                </div>
                <div className="p-2.5 bg-white/5 rounded-lg text-center">
                  <p className="text-lg font-bold">{panelStats.answeredCalls}</p>
                  <p className="text-[10px] text-muted-foreground">Contestadas</p>
                </div>
                <div className="p-2.5 bg-white/5 rounded-lg text-center">
                  <p className="text-lg font-bold">{panelStats.totalEmails}</p>
                  <p className="text-[10px] text-muted-foreground">Emails</p>
                </div>
                <div className="p-2.5 bg-white/5 rounded-lg text-center">
                  <p className="text-lg font-bold">{panelStats.totalActivities}</p>
                  <p className="text-[10px] text-muted-foreground">Actividades</p>
                </div>
              </div>
            )}
          </div>

          {panelSp && (
            <Tabs value={panelTab} onValueChange={setPanelTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-3 shrink-0">
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                <TabsTrigger value="calls">Llamadas</TabsTrigger>
                <TabsTrigger value="activities">Actividades</TabsTrigger>
                <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
                <TabsTrigger value="targets"><Target className="w-3.5 h-3.5 mr-1" />Metas</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6 pb-6">
                <TabsContent value="metrics" className="mt-4 space-y-4">
                  {(() => {
                    const metrics = getPanelMetrics();
                    if (!metrics) return <p className="text-sm text-muted-foreground">Asigná un rol funcional para ver métricas.</p>;
                    
                    if (panelSp.functionalRole === "hunter") return (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Llamadas esta semana</span>
                            <span>{metrics.callsThisWeek} / {metrics.callsWeekTarget}</span>
                          </div>
                          <Progress value={Math.min((metrics.callsThisWeek / metrics.callsWeekTarget) * 100, 100)} />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Reuniones este mes</span>
                            <span>{metrics.meetingsThisMonth} / {metrics.meetingsMonthTarget}</span>
                          </div>
                          <Progress value={Math.min((metrics.meetingsThisMonth / metrics.meetingsMonthTarget) * 100, 100)} />
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <p className="text-2xl font-bold">{metrics.leadsGeneratedThisMonth}</p>
                          <p className="text-xs text-muted-foreground">Leads generados este mes</p>
                        </div>
                      </div>
                    );

                    if (panelSp.functionalRole === "farmer") return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`p-3 rounded-lg ${metrics.leadsAwaitingResponse === 0 ? "bg-green-500/10" : metrics.leadsAwaitingResponse <= 2 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                            <p className="text-2xl font-bold">{metrics.leadsAwaitingResponse}</p>
                            <p className="text-xs text-muted-foreground">Leads sin responder (&gt;2h)</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold">{metrics.avgResponseTimeHours}h</p>
                            <p className="text-xs text-muted-foreground">Tiempo respuesta prom.</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold">{metrics.closeRate}%</p>
                            <p className="text-xs text-muted-foreground">Tasa de cierre</p>
                          </div>
                          <div className={`p-3 rounded-lg ${metrics.staleOpportunities > 0 ? "bg-red-500/10" : "bg-white/5"}`}>
                            <p className="text-2xl font-bold">{metrics.staleOpportunities}</p>
                            <p className="text-xs text-muted-foreground">Sin actividad 3+ días</p>
                          </div>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <p className="text-lg font-bold">{metrics.activeOpportunities}</p>
                          <p className="text-xs text-muted-foreground">Oportunidades activas</p>
                        </div>
                      </div>
                    );

                    if (panelSp.functionalRole === "admin_ventas") return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold">{metrics.pendingQuotes}</p>
                            <p className="text-xs text-muted-foreground">Cotizaciones pendientes</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-2xl font-bold">{metrics.avgQuoteTurnaroundHours}h</p>
                            <p className="text-xs text-muted-foreground">Tiempo prom. cotización</p>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Cotizadas en &lt;24h</span>
                            <span>{metrics.quotesOnTimeRate}%</span>
                          </div>
                          <Progress value={metrics.quotesOnTimeRate} />
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg">
                          <p className="text-lg font-bold">{metrics.quotesThisMonth}</p>
                          <p className="text-xs text-muted-foreground">Cotizaciones este mes</p>
                        </div>
                      </div>
                    );

                    return null;
                  })()}

                  {panelStats && panelStats.totalCalls > 0 && (
                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1"><Phone className="w-4 h-4" /> Resumen de llamadas</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-lg font-bold">{panelStats.totalCalls}</p>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-400">{panelStats.answeredCalls}</p>
                          <p className="text-[10px] text-muted-foreground">Contestadas</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">{Math.floor(panelStats.totalCallDuration / 60)}m</p>
                          <p className="text-[10px] text-muted-foreground">Duración total</p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="calls" className="mt-4">
                  {panelCalls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin llamadas asignadas a este vendedor</p>
                  ) : (
                    <div className="space-y-2">
                      {panelCalls.map((c: any) => {
                        const isInbound = c.direction === "inbound";
                        const statusColor = c.status === "answered" ? "text-green-400" : c.status === "missed" ? "text-red-400" : "text-yellow-400";
                        return (
                          <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-white/5 text-sm">
                            <div className={`p-1.5 rounded-lg ${isInbound ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                              {isInbound ? <PhoneIncoming className="w-4 h-4 text-green-400" /> : <PhoneOutgoing className="w-4 h-4 text-blue-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className="font-mono text-sm">{c.phone || "Sin número"}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {c.receivedAt ? format(new Date(c.receivedAt), "dd MMM, HH:mm", { locale: es }) : "-"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs ${statusColor}`}>
                                  {c.status === "answered" ? "Contestada" : c.status === "missed" ? "Perdida" : c.status || "-"}
                                </span>
                                {c.durationSeconds > 0 && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" /> {Math.floor(c.durationSeconds / 60)}m {c.durationSeconds % 60}s
                                  </span>
                                )}
                                {c.recordingUrl && (
                                  <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">MP3</a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activities" className="mt-4">
                  {panelActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin actividades recientes</p>
                  ) : (
                    <div className="space-y-2">
                      {panelActivities.map((a: any) => {
                        const typeColors: Record<string, string> = {
                          call: "bg-green-500/10 text-green-400",
                          email: "bg-blue-500/10 text-blue-400",
                          visit: "bg-violet-500/10 text-violet-400",
                          task: "bg-orange-500/10 text-orange-400",
                          note: "bg-zinc-500/10 text-zinc-400",
                          follow_up: "bg-yellow-500/10 text-yellow-400",
                        };
                        const typeLabels: Record<string, string> = {
                          call: "Llamada", email: "Email", visit: "Visita",
                          task: "Tarea", note: "Nota", follow_up: "Seguimiento",
                        };
                        return (
                          <div key={a.id} className="flex gap-3 p-3 rounded-lg bg-white/5 text-sm">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[a.type] || ""}`}>
                              {typeLabels[a.type] || a.type}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{a.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {a.completedAt ? format(new Date(a.completedAt), "dd MMM, HH:mm", { locale: es }) : "pendiente"}
                                {a.outcome && ` — ${a.outcome}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="opportunities" className="mt-4">
                  {panelOpps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin oportunidades activas</p>
                  ) : (
                    <div className="space-y-2">
                      {panelOpps.map((o: any) => (
                        <div key={o.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 text-sm">
                          <div>
                            <p className="font-medium">{o.title}</p>
                            <Badge variant="outline" className="text-xs mt-1">{getOppStatusLabel(o.status)}</Badge>
                          </div>
                          {o.estimatedValue && (
                            <span className="font-semibold">{o.currency || "ARS"} {Number(o.estimatedValue).toLocaleString()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Metas de ventas ── */}
                <TabsContent value="targets" className="mt-4 space-y-5">
                  {/* Formulario nueva meta */}
                  <div className="rounded-lg border border-white/10 bg-white/3 p-4 space-y-3">
                    {(() => {
                      const PERIOD_LABELS: Record<string, string> = {
                        monthly: "Mensual", quarterly: "Trimestral",
                        semiannual: "Semestral", annual: "Anual",
                      };
                      const METRIC_LABELS: Record<string, string> = {
                        amount_approved: "Monto aprobado (cot.)",
                        count_quotes:    "Cotizaciones generadas",
                        count_approved:  "Cotizaciones aprobadas",
                        count_orders:    "Pedidos generados",
                        amount_orders:   "Monto de pedidos",
                      };
                      const isAmountMetric = targetForm.metricType.startsWith("amount_");
                      const periodOptions: Record<string, { label: string; value: number }[]> = {
                        monthly: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
                          .map((m, i) => ({ label: m, value: i + 1 })),
                        quarterly: [
                          { label: "Q1 — Ene-Mar", value: 1 }, { label: "Q2 — Abr-Jun", value: 2 },
                          { label: "Q3 — Jul-Sep", value: 3 }, { label: "Q4 — Oct-Dic", value: 4 },
                        ],
                        semiannual: [
                          { label: "S1 — Ene-Jun", value: 1 }, { label: "S2 — Jul-Dic", value: 2 },
                        ],
                        annual: [{ label: String(targetYear), value: 1 }],
                      };
                      const opts = periodOptions[targetForm.periodType] || [];
                      return (
                        <>
                          <p className="text-sm font-medium">Establecer meta</p>

                          {/* Tipo de métrica — full width */}
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Tipo de métrica</Label>
                            <Select
                              value={targetForm.metricType}
                              onValueChange={v => setTargetForm(f => ({ ...f, metricType: v as any }))}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(METRIC_LABELS).map(([k, l]) => (
                                  <SelectItem key={k} value={k}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Año</Label>
                              <Input
                                type="number"
                                value={targetYear}
                                onChange={e => { const y = parseInt(e.target.value); setTargetYear(y); loadTargets(panelSp.id, y); }}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Tipo de período</Label>
                              <Select
                                value={targetForm.periodType}
                                onValueChange={v => setTargetForm(f => ({
                                  ...f,
                                  periodType: v as any,
                                  period: v === "annual" ? 1 : 1,
                                }))}
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(PERIOD_LABELS).map(([k, l]) => (
                                    <SelectItem key={k} value={k}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {targetForm.periodType !== "annual" && (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">
                                {targetForm.periodType === "monthly" ? "Mes" : targetForm.periodType === "quarterly" ? "Trimestre" : "Semestre"}
                              </Label>
                              <Select value={String(targetForm.period)} onValueChange={v => setTargetForm(f => ({ ...f, period: parseInt(v) }))}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {opts.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className={`grid gap-2 ${isAmountMetric ? "grid-cols-3" : "grid-cols-1"}`}>
                            <div className={isAmountMetric ? "col-span-2" : ""}>
                              <Label className="text-xs text-muted-foreground mb-1 block">
                                {isAmountMetric ? "Monto objetivo" : "Cantidad objetivo"}
                              </Label>
                              <Input
                                type="number"
                                placeholder={isAmountMetric ? "ej. 500000" : "ej. 20"}
                                value={targetForm.amount}
                                onChange={e => setTargetForm(f => ({ ...f, amount: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            {isAmountMetric && (
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Moneda</Label>
                                <Select value={targetForm.currency} onValueChange={v => setTargetForm(f => ({ ...f, currency: v }))}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm" className="w-full" disabled={savingTarget || !targetForm.amount}
                            onClick={() => saveTarget(panelSp.id)}
                          >
                            {savingTarget ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                            Guardar meta
                          </Button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Progreso del año */}
                  <div>
                    <p className="text-sm font-medium mb-3">Metas de {targetYear}</p>
                    {targetsData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Sin metas configuradas para {targetYear}</p>
                    ) : (
                      (() => {
                        const PTYPE_LABEL: Record<string, string> = {
                          monthly: "Mensual", quarterly: "Trimestral",
                          semiannual: "Semestral", annual: "Anual",
                        };
                        const METRIC_LABEL: Record<string, string> = {
                          amount_approved: "Monto aprobado",
                          count_quotes:    "Cotizaciones generadas",
                          count_approved:  "Cotizaciones aprobadas",
                          count_orders:    "Pedidos generados",
                          amount_orders:   "Monto de pedidos",
                        };
                        const PERIOD_NAME: Record<string, (m: number, y: number) => string> = {
                          monthly:   (m) => new Date(2000, m - 1).toLocaleString("es-AR", { month: "short" }),
                          quarterly: (m) => `Q${m}`,
                          semiannual:(m) => `S${m}`,
                          annual:    (_m, y) => String(y),
                        };
                        // group by "periodType|metricType"
                        const grouped: Record<string, any[]> = {};
                        for (const row of targetsData) {
                          const key = `${row.period_type || "monthly"}|${row.metric_type || "amount_approved"}`;
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(row);
                        }
                        const PERIOD_ORDER = ["annual","semiannual","quarterly","monthly"];
                        const METRIC_ORDER = ["amount_approved","amount_orders","count_quotes","count_approved","count_orders"];
                        const sortedKeys = Object.keys(grouped).sort((a, b) => {
                          const [pa, ma] = a.split("|");
                          const [pb, mb] = b.split("|");
                          const pdiff = PERIOD_ORDER.indexOf(pa) - PERIOD_ORDER.indexOf(pb);
                          return pdiff !== 0 ? pdiff : METRIC_ORDER.indexOf(ma) - METRIC_ORDER.indexOf(mb);
                        });
                        return (
                          <div className="space-y-5">
                            {sortedKeys.map(key => {
                              const [pt, mt] = key.split("|");
                              const isAmount = mt.startsWith("amount_");
                              return (
                                <div key={key}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      {PTYPE_LABEL[pt]}
                                    </p>
                                    <span className="text-xs text-primary/80 font-medium">· {METRIC_LABEL[mt]}</span>
                                  </div>
                                  <div className="space-y-3">
                                    {grouped[key].map((row: any) => {
                                      const actual  = Number(row.actual_amount ?? 0);
                                      const target  = Number(row.target_amount ?? 0);
                                      const pct     = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
                                      const over    = target > 0 && actual > target;
                                      const barCls  = over ? "bg-emerald-400" : pct >= 75 ? "bg-green-400" : pct >= 40 ? "bg-amber-400" : "bg-primary";
                                      const label   = PERIOD_NAME[pt]?.(row.month, row.year) ?? String(row.month);
                                      const fmt = (n: number) => isAmount
                                        ? `${row.currency === "ARS" ? "$" : "u$s"} ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                                        : n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
                                      return (
                                        <div key={`${pt}-${mt}-${row.month}`}>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium capitalize">{label}</span>
                                            <span className={over ? "text-emerald-400" : "text-muted-foreground"}>
                                              {fmt(actual)} / {fmt(target)}
                                              {" · "}<span className={over ? "font-semibold" : ""}>{over ? `${((actual/target)*100).toFixed(0)}% 🎯` : `${pct.toFixed(0)}%`}</span>
                                            </span>
                                          </div>
                                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.max(pct, actual > 0 ? 1 : 0)}%` }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
