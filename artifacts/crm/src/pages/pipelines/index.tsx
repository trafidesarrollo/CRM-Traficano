import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitBranch, Plus, Trash2, Star, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

export default function Pipelines() {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [pipeOpen, setPipeOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [editingPipe, setEditingPipe] = useState<any>(null);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [activePipelineId, setActivePipelineId] = useState<number | null>(null);
  const [pipeForm, setPipeForm] = useState<any>({ name: "", description: "" });
  const [stageForm, setStageForm] = useState<any>({ name: "", color: "#3b82f6", winProbability: 0, slaHours: "", isWon: false, isLost: false });

  const load = async () => {
    const r = await fetch(`${API}/api/pipelines`, { credentials: "include" });
    const d = await r.json();
    setPipelines(d.data || []);
  };
  useEffect(() => { load(); }, []);

  const savePipe = async () => {
    if (!pipeForm.name) return;
    const url = editingPipe ? `${API}/api/pipelines/${editingPipe.id}` : `${API}/api/pipelines`;
    const r = await fetch(url, { method: editingPipe ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(pipeForm) });
    if (r.ok) { setPipeOpen(false); setEditingPipe(null); setPipeForm({ name: "", description: "" }); load(); toast({ title: "Guardado" }); }
    else toast({ title: "Error", variant: "destructive" });
  };

  const delPipe = async (p: any) => {
    if (p.isDefault) return toast({ title: "No se puede eliminar el pipeline por defecto", variant: "destructive" });
    if (!confirm(`¿Eliminar pipeline "${p.name}"?`)) return;
    const r = await fetch(`${API}/api/pipelines/${p.id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) load();
  };

  const setDefault = async (p: any) => {
    await fetch(`${API}/api/pipelines/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isDefault: true }) });
    load();
  };

  const saveStage = async () => {
    if (!stageForm.name || !activePipelineId) return;
    const payload: any = { ...stageForm, slaHours: stageForm.slaHours ? parseInt(stageForm.slaHours) : null, winProbability: parseInt(stageForm.winProbability) || 0 };
    const url = editingStage ? `${API}/api/pipelines/stages/${editingStage.id}` : `${API}/api/pipelines/${activePipelineId}/stages`;
    const r = await fetch(url, { method: editingStage ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    if (r.ok) { setStageOpen(false); setEditingStage(null); load(); toast({ title: "Guardado" }); }
    else { const e = await r.json(); toast({ title: e.error || "Error", variant: "destructive" }); }
  };

  const delStage = async (s: any) => {
    if (!confirm(`¿Eliminar etapa "${s.name}"?`)) return;
    const r = await fetch(`${API}/api/pipelines/stages/${s.id}`, { method: "DELETE", credentials: "include" });
    if (!r.ok) { const e = await r.json(); toast({ title: e.error || "Error", variant: "destructive" }); }
    load();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><GitBranch className="h-6 w-6" /><h1 className="text-2xl font-bold">Pipelines</h1></div>
          <Button onClick={() => { setEditingPipe(null); setPipeForm({ name: "", description: "" }); setPipeOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nuevo pipeline</Button>
        </div>

        <div className="space-y-4">
          {pipelines.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    {p.isDefault && <Badge className="bg-amber-500"><Star className="h-3 w-3 mr-1" />Por defecto</Badge>}
                    {!p.isActive && <Badge variant="outline">Inactivo</Badge>}
                  </div>
                  <div className="flex gap-1">
                    {!p.isDefault && <Button size="sm" variant="outline" onClick={() => setDefault(p)}><Star className="h-3 w-3" /></Button>}
                    <Button size="sm" variant="outline" onClick={() => { setEditingPipe(p); setPipeForm({ name: p.name, description: p.description || "" }); setPipeOpen(true); }}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => delPipe(p)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                  </div>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mb-3">{p.description}</p>}
                <div className="flex flex-wrap gap-2 items-center">
                  {p.stages.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-1 border rounded-lg pl-2 pr-1 py-1" style={{ borderColor: s.color }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">({s.oppCount})</span>
                      {s.isWon && <Badge className="bg-emerald-600 text-[10px] h-4">WIN</Badge>}
                      {s.isLost && <Badge className="bg-red-600 text-[10px] h-4">LOSS</Badge>}
                      {s.slaHours && <span className="text-[10px] text-muted-foreground">SLA {s.slaHours}h</span>}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingStage(s); setActivePipelineId(p.id); setStageForm({ name: s.name, color: s.color, winProbability: s.winProbability, slaHours: s.slaHours || "", isWon: s.isWon, isLost: s.isLost }); setStageOpen(true); }}><Edit className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => delStage(s)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => { setActivePipelineId(p.id); setEditingStage(null); setStageForm({ name: "", color: "#3b82f6", winProbability: 0, slaHours: "", isWon: false, isLost: false }); setStageOpen(true); }}><Plus className="h-3 w-3 mr-1" />Etapa</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={pipeOpen} onOpenChange={setPipeOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingPipe ? "Editar" : "Nuevo"} pipeline</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={pipeForm.name} onChange={e => setPipeForm({ ...pipeForm, name: e.target.value })} /></div>
              <div><Label>Descripción</Label><Input value={pipeForm.description} onChange={e => setPipeForm({ ...pipeForm, description: e.target.value })} /></div>
              <Button onClick={savePipe} className="w-full">{editingPipe ? "Actualizar" : "Crear"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={stageOpen} onOpenChange={setStageOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingStage ? "Editar" : "Nueva"} etapa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={stageForm.name} onChange={e => setStageForm({ ...stageForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Color</Label><Input type="color" value={stageForm.color} onChange={e => setStageForm({ ...stageForm, color: e.target.value })} /></div>
                <div><Label>Probabilidad cierre %</Label><Input type="number" min="0" max="100" value={stageForm.winProbability} onChange={e => setStageForm({ ...stageForm, winProbability: e.target.value })} /></div>
              </div>
              <div><Label>SLA en horas (opcional)</Label><Input type="number" value={stageForm.slaHours} onChange={e => setStageForm({ ...stageForm, slaHours: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={stageForm.isWon} onCheckedChange={v => setStageForm({ ...stageForm, isWon: v, isLost: v ? false : stageForm.isLost })} /><Label>Etapa de ganancia</Label></div>
              <div className="flex items-center gap-2"><Switch checked={stageForm.isLost} onCheckedChange={v => setStageForm({ ...stageForm, isLost: v, isWon: v ? false : stageForm.isWon })} /><Label>Etapa de pérdida</Label></div>
              <Button onClick={saveStage} className="w-full">{editingStage ? "Actualizar" : "Crear"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
