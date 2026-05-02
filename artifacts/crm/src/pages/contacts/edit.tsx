import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, X, Linkedin, Mail, Phone, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentUploader } from "@/components/document-uploader";

const API = import.meta.env.VITE_API_URL || "";

export default function ContactEdit() {
  const { toast } = useToast();
  const [, params] = useRoute("/contacts/:id");
  const [, setLocation] = useLocation();
  const isNew = !params || params.id === "new";
  const id = isNew ? null : parseInt(params!.id);

  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    firstName: "", lastName: "", email: "", phone: "", position: "",
    clientId: "", linkedinUrl: "", photoUrl: "", notes: "",
    emails: [], phones: [], tags: [],
    leadScore: 0, source: "", status: "active",
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    fetch(`${API}/api/clients`, { credentials: "include" }).then(r => r.json()).then(d => setClients(d.data || d || []));
    if (!isNew) {
      fetch(`${API}/api/contacts/${id}`, { credentials: "include" }).then(r => r.json()).then(d => {
        setForm({
          firstName: d.firstName || "", lastName: d.lastName || "",
          email: d.email || "", phone: d.phone || "", position: d.position || "",
          clientId: d.clientId || "", linkedinUrl: d.linkedinUrl || "", photoUrl: d.photoUrl || "",
          notes: d.notes || "",
          emails: d.emails || [], phones: d.phones || [], tags: d.tags || [],
          leadScore: d.leadScore || 0, source: d.source || "", status: d.status || "active",
        });
      });
    }
  }, [id, isNew]);

  const save = async () => {
    if (!form.firstName || !form.lastName || !form.clientId) return toast({ title: "Nombre, apellido y cliente requeridos", variant: "destructive" });
    const body = {
      ...form,
      clientId: parseInt(form.clientId),
      leadScore: parseInt(form.leadScore) || 0,
      emails: form.emails.length ? form.emails : null,
      phones: form.phones.length ? form.phones : null,
      tags: form.tags.length ? form.tags : null,
    };
    const url = isNew ? `${API}/api/contacts` : `${API}/api/contacts/${id}`;
    const r = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (r.ok) {
      const d = await r.json();
      toast({ title: "Guardado" });
      if (isNew) setLocation(`/contacts/${d.id}`);
    } else {
      const e = await r.json();
      toast({ title: e.error || "Error al guardar", variant: "destructive" });
    }
  };

  const addEmail = () => { const v = prompt("Nuevo email:"); if (v) setForm({ ...form, emails: [...form.emails, v] }); };
  const addPhone = () => { const v = prompt("Nuevo teléfono:"); if (v) setForm({ ...form, phones: [...form.phones, v] }); };
  const addTag = () => { if (tagInput) { setForm({ ...form, tags: [...form.tags, tagInput] }); setTagInput(""); } };

  const initials = `${form.firstName[0] || ""}${form.lastName[0] || ""}`.toUpperCase();

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/contacts"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="text-2xl font-bold">{isNew ? "Nuevo contacto" : `${form.firstName} ${form.lastName}`}</h1>
          {form.leadScore > 0 && <Badge className="bg-amber-500">Score: {form.leadScore}</Badge>}
        </div>
        <Button onClick={save}><Save className="w-4 h-4 mr-2" />Guardar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-4 space-y-3 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {form.photoUrl ? <img src={form.photoUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div className="w-full"><Label>URL de foto</Label><Input value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://..." /></div>
            <div className="w-full"><Label className="flex items-center gap-1"><Linkedin className="h-3 w-3" />LinkedIn</Label><Input value={form.linkedinUrl} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
            <div className="w-full"><Label>Score (0-100)</Label><Input type="number" min="0" max="100" value={form.leadScore} onChange={e => setForm({ ...form, leadScore: e.target.value })} /></div>
            <div className="w-full"><Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="do_not_contact">No contactar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full"><Label>Origen</Label><Input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="feria, web, referido…" /></div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><Label>Apellido</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div><Label>Cargo</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
            <div><Label>Empresa</Label>
              <Select value={String(form.clientId)} onValueChange={v => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa…" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="flex items-center gap-1"><Mail className="h-3 w-3" />Email principal</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="flex items-center gap-1"><Phone className="h-3 w-3" />Teléfono principal</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between"><Label>Emails adicionales</Label><Button size="sm" variant="outline" onClick={addEmail}><Plus className="h-3 w-3" /></Button></div>
              <div className="flex flex-wrap gap-1 mt-1">{form.emails.map((e: string, i: number) => <Badge key={i} variant="outline" className="gap-1">{e}<X className="h-3 w-3 cursor-pointer" onClick={() => setForm({ ...form, emails: form.emails.filter((_: any, j: number) => j !== i) })} /></Badge>)}</div>
            </div>

            <div>
              <div className="flex items-center justify-between"><Label>Teléfonos adicionales</Label><Button size="sm" variant="outline" onClick={addPhone}><Plus className="h-3 w-3" /></Button></div>
              <div className="flex flex-wrap gap-1 mt-1">{form.phones.map((p: string, i: number) => <Badge key={i} variant="outline" className="gap-1">{p}<X className="h-3 w-3 cursor-pointer" onClick={() => setForm({ ...form, phones: form.phones.filter((_: any, j: number) => j !== i) })} /></Badge>)}</div>
            </div>

            <div>
              <Label>Etiquetas</Label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Escribir y Enter…" />
                <Button onClick={addTag}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">{form.tags.map((t: string, i: number) => <Badge key={i} className="gap-1">{t}<X className="h-3 w-3 cursor-pointer" onClick={() => setForm({ ...form, tags: form.tags.filter((_: any, j: number) => j !== i) })} /></Badge>)}</div>
            </div>

            <div><Label>Notas</Label><Textarea rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </CardContent>
        </Card>
      </div>

      {!isNew && id && <div className="mt-4"><DocumentUploader entityType="contact" entityId={id} /></div>}
    </AppLayout>
  );
}
