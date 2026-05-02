import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip, Upload, Trash2, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

export function DocumentUploader({ entityType, entityId }: { entityType: string; entityId: number }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const r = await fetch(`${API}/api/documents?entityType=${entityType}&entityId=${entityId}`, { credentials: "include" });
    const d = await r.json(); setDocs(d.data || []);
  };
  useEffect(() => { if (entityId) load(); }, [entityType, entityId]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const r = await fetch(`${API}/api/storage/uploads/request-url`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!r.ok) throw new Error("No se pudo solicitar URL");
      const { uploadURL, objectPath } = await r.json();
      const up = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!up.ok) throw new Error("Falló la subida");
      await fetch(`${API}/api/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ entityType, entityId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, storageKey: objectPath }),
      });
      toast({ title: "Archivo subido" });
      load();
    } catch (e: any) {
      toast({ title: e.message || "Error", variant: "destructive" });
    } finally { setUploading(false); }
  };

  const del = async (id: number) => { if (!confirm("¿Eliminar archivo?")) return; await fetch(`${API}/api/documents/${id}`, { method: "DELETE", credentials: "include" }); load(); };
  const download = (d: any) => { const path = d.storageKey.startsWith("/objects/") ? `/storage${d.storageKey}` : d.storageKey; window.open(`${API}/api${path}`, "_blank"); };

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium"><Paperclip className="h-4 w-4" />Documentos ({docs.length})</div>
          <label>
            <Input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} disabled={uploading} />
            <Button asChild size="sm" variant="outline" disabled={uploading}><span><Upload className="h-3 w-3 mr-1" />{uploading ? "Subiendo..." : "Subir"}</span></Button>
          </label>
        </div>
        <div className="space-y-1">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{d.fileName}</span>
              <span className="text-xs text-muted-foreground">{d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : ""}</span>
              <Button size="sm" variant="ghost" onClick={() => download(d)}><Download className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(d.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button>
            </div>
          ))}
          {!docs.length && <div className="text-xs text-muted-foreground py-2 text-center">Sin documentos</div>}
        </div>
      </CardContent>
    </Card>
  );
}
