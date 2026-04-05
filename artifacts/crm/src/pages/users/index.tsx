import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGetUsers, useCreateUser, useDeleteUser } from "@workspace/api-client-react";
import { Plus, Trash2, Shield, ShieldCheck, User, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  operador: "Operador",
};

const ROLE_ICONS: Record<string, any> = {
  admin: ShieldCheck,
  gerente: Shield,
  vendedor: User,
  operador: UserCog,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  gerente: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  vendedor: "bg-green-500/10 text-green-400 border-green-500/20",
  operador: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

export default function Users() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", email: "", role: "vendedor" });

  const { data: users, isLoading, refetch } = useGetUsers();
  const createMut = useCreateUser({
    mutation: {
      onSuccess: () => { toast({ title: "Usuario creado" }); setOpen(false); refetch(); setForm({ username: "", password: "", fullName: "", email: "", role: "vendedor" }); },
      onError: (err: any) => toast({ title: "Error", description: err?.message || "No se pudo crear el usuario", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteUser({
    mutation: { onSuccess: () => { toast({ title: "Usuario eliminado" }); refetch(); } },
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground mt-1">{users?.length || 0} usuarios del sistema</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre completo</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
              <div><Label>Usuario</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Contraseña</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={createMut.isPending || !form.username || !form.password || !form.fullName} onClick={() => createMut.mutate({ data: form as any })}>
                {createMut.isPending ? "Creando..." : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(users || []).map((user: any) => {
            const RoleIcon = ROLE_ICONS[user.role] || User;
            return (
              <Card key={user.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                        {user.fullName?.charAt(0) || user.username.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{user.fullName || user.username}</h3>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: user.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_COLORS[user.role] || ""}>
                      <RoleIcon className="w-3.5 h-3.5 mr-1" />
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </div>
                  {user.email && <p className="text-sm text-muted-foreground mt-2">{user.email}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
