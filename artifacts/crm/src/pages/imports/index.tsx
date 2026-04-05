import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, FileType, Download, History, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "upload" | "preview" | "result";

export default function Imports() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState("clients");
  const [mode, setMode] = useState("upsert");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      const res = await fetch(`${BASE}/api/imports/upload`, { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Error al subir archivo");
      const data = await res.json();
      setPreview(data);
      setMapping(data.suggestedMapping || {});
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("mode", mode);
      formData.append("columnMapping", JSON.stringify(mapping));
      const res = await fetch(`${BASE}/api/imports/execute`, { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Error en la importación");
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const res = await fetch(`${BASE}/api/imports/logs`, { credentials: "include" });
      if (res.ok) setLogs(await res.json());
    } catch {}
    setShowLogs(true);
  };

  const downloadTemplate = () => {
    window.open(`${BASE}/api/imports/template/${entityType}`, "_blank");
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Importación de Datos</h1>
          <p className="text-muted-foreground mt-1">Carga masiva vía archivos CSV.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-2" />Plantilla CSV</Button>
          <Button variant="outline" onClick={loadLogs}><History className="w-4 h-4 mr-2" />Historial</Button>
        </div>
      </div>

      {step === "upload" && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Tipo de entidad</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clients">Clientes</SelectItem>
                  <SelectItem value="contacts">Contactos</SelectItem>
                  <SelectItem value="products">Productos</SelectItem>
                  <SelectItem value="salespeople">Vendedores</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Modo</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insert">Solo insertar (nuevos)</SelectItem>
                  <SelectItem value="update">Solo actualizar</SelectItem>
                  <SelectItem value="upsert">Insertar o actualizar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="bg-card border-dashed border-2 border-border/50 hover:border-primary/50 transition-colors">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                {file ? <FileType className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
              </div>
              <h3 className="text-xl font-bold mb-2">{file ? file.name : "Arrastra un archivo CSV"}</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Soporta CSV con coma, punto y coma o tab como separador. Máximo 10MB.
              </p>
              <input type="file" accept=".csv" className="hidden" id="file-upload" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {!file ? (
                <label htmlFor="file-upload"><Button asChild className="bg-white text-black hover:bg-white/90"><span>Seleccionar Archivo</span></Button></label>
              ) : (
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setFile(null)}>Cancelar</Button>
                  <Button onClick={handleUpload} disabled={loading}>{loading ? "Analizando..." : "Analizar Archivo"}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-6">
          <Card className="bg-card/50 border-white/5">
            <CardHeader><CardTitle>Vista Previa</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-6 mb-6 text-sm">
                <span>Archivo: <strong>{preview.fileName}</strong></span>
                <span>Filas: <strong>{preview.totalRows}</strong></span>
                <span>Delimitador: <strong>{preview.delimiter === "," ? "Coma" : preview.delimiter === ";" ? "Punto y coma" : "Tab"}</strong></span>
              </div>

              <h4 className="font-semibold mb-3">Mapeo de Columnas</h4>
              {preview.unmappedRequired?.length > 0 && (
                <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-yellow-500/10 text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Campos obligatorios sin mapear: {preview.unmappedRequired.join(", ")}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {preview.headers.map((header: string) => (
                  <div key={header} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <span className="text-sm font-mono flex-1">{header}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select value={mapping[header] || "__skip__"} onValueChange={(v) => setMapping({ ...mapping, [header]: v === "__skip__" ? "" : v })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">— Omitir —</SelectItem>
                        {preview.availableFields.map((f: string) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <h4 className="font-semibold mb-3">Primeras filas</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>{preview.headers.map((h: string) => <th key={h} className="text-left p-2 font-medium text-muted-foreground border-b border-white/10">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.preview?.slice(0, 5).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">{preview.headers.map((h: string) => <td key={h} className="p-2 border-b border-white/5">{row[h]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4 mt-6">
                <Button variant="outline" onClick={reset}>Volver</Button>
                <Button onClick={handleExecute} disabled={loading}>{loading ? "Importando..." : `Importar ${preview.totalRows} registros`}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-6">
          <Card className="bg-card/50 border-white/5">
            <CardHeader><CardTitle>Resultado de Importación</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-4 rounded-xl bg-white/5"><p className="text-2xl font-bold">{result.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
                <div className="text-center p-4 rounded-xl bg-green-500/10"><p className="text-2xl font-bold text-green-400">{result.inserted}</p><p className="text-xs text-muted-foreground">Insertados</p></div>
                <div className="text-center p-4 rounded-xl bg-blue-500/10"><p className="text-2xl font-bold text-blue-400">{result.updated}</p><p className="text-xs text-muted-foreground">Actualizados</p></div>
                <div className="text-center p-4 rounded-xl bg-red-500/10"><p className="text-2xl font-bold text-red-400">{result.errors}</p><p className="text-xs text-muted-foreground">Errores</p></div>
                <div className="text-center p-4 rounded-xl bg-yellow-500/10"><p className="text-2xl font-bold text-yellow-400">{result.skipped}</p><p className="text-xs text-muted-foreground">Omitidos</p></div>
              </div>
              {result.errorDetails?.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-2 text-red-400">Detalle de Errores</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.errorDetails.slice(0, 20).map((err: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-red-500/5 text-sm">
                        <span className="text-red-400">Fila {err.row}:</span> {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={reset}>Nueva Importación</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showLogs && (
        <Card className="bg-card/50 border-white/5 mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Historial de Importaciones</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowLogs(false)}>Cerrar</Button>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay importaciones previas</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{log.fileName}</span>
                        <Badge variant="outline">{log.entityType}</Badge>
                        {log.status === "completed" ? (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Completado</Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />{log.status}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.summary} — {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
