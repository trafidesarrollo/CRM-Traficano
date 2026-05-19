import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Download, Upload, FileText, FileSpreadsheet, DownloadCloud } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const LABELS: Record<string, string> = {
  clients: "Clientes",
  contacts: "Contactos",
  products: "Productos",
  opportunities: "Oportunidades",
  salespeople: "Vendedores",
  tasks: "Tareas",
  pipelines: "Pipelines",
  pipeline_stages: "Etapas de pipeline",
  quotes: "Cotizaciones",
  orders: "Pedidos",
};

export default function CsvPage() {
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [entities, setEntities] = useState<{ key: string; fields: string[]; required: string[] }[]>([]);
  const [entity, setEntity] = useState("clients");
  const [mode, setMode] = useState<"upsert" | "insert">("upsert");
  const [massiveText, setMassiveText] = useState("");
  const [massiveLoading, setMassiveLoading] = useState(false);
  const [massiveResult, setMassiveResult] = useState<any>(null);
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [separator, setSeparator] = useState<"," | ";">(",");

  useEffect(() => {
    if (!user && !isLoading) return;
    fetch(`${API}/api/csv/entities`, { credentials: "include" })
      .then(r => r.json()).then(d => setEntities(d.entities || [])).catch(() => {});
  }, [user, isLoading]);

  const def = entities.find(e => e.key === entity);

  function download(url: string) { window.open(url, "_blank"); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function doImport() {
    if (!csvText.trim()) { toast({ title: "Pegá o subí un CSV primero", variant: "destructive" }); return; }
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API}/api/csv/import/${entity}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, mode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error de importación");
      setResult(data);
      toast({ title: "Importación finalizada", description: `${data.inserted} nuevos, ${data.updated} actualizados, ${data.skipped} omitidos` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function importMassiveCsv() {
    if (!massiveText.trim()) {
      toast({ title: "Pegá o subí un CSV primero", variant: "destructive" });
      return;
    }
    setMassiveLoading(true);
    setMassiveResult(null);
    try {
      const r = await fetch(`${API}/api/csv/import/client-followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ csv: massiveText, separator }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error de importación");
      setMassiveResult(data);
      toast({ title: "Carga masiva finalizada", description: `${data.createdTasks} tareas, ${data.createdActivities} bitácoras y ${data.createdFollowups} seguimientos` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setMassiveLoading(false);
    }
  }

  return (
    <AppLayout>
      {!user && !isLoading ? null : null}
      <div className="space-y-6 p-4 md:p-6 max-w-5xl">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Importar / Exportar CSV</h1>
        </div>

        <Card className="border-cyan-500/20 bg-cyan-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadCloud className="h-5 w-5 text-cyan-400" />
              Carga masiva de novedades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pegá o subí un CSV con el resumen de lo hablado con cada cliente. Por cada fila se crea una tarea, un seguimiento y la bitácora del cliente.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Separador</Label>
                <Select value={separator} onValueChange={v => setSeparator(v as "," | ";")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Coma (,)</SelectItem>
                    <SelectItem value=";">Punto y coma (;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subir archivo CSV</Label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setMassiveText(await file.text());
                  }}
                  className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-white"
                />
              </div>
            </div>
            <Textarea
              value={massiveText}
              onChange={e => setMassiveText(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder="nro_cliente,customer_name,fecha,fecha_seguimiento,urgencia,titulo,novedad,accion"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Obligatorios: nro_cliente, description/novedad.</p>
              <p>Si fecha_seguimiento viene vacía, se completa con +3 días.</p>
              <p>Campos soportados: customer_name/cliente, movementdate/fecha, tracingdate/fecha_seguimiento, urgencia/prioritytype_id, title/titulo, action/accion.</p>
            </div>
            <Button onClick={importMassiveCsv} disabled={massiveLoading}>
              <Upload className="h-4 w-4 mr-2" />
              {massiveLoading ? "Importando..." : "Importar carga masiva"}
            </Button>
            {massiveResult && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div>Procesadas: <b>{massiveResult.total}</b> · Tareas: <b>{massiveResult.createdTasks}</b> · Seguimientos: <b>{massiveResult.createdFollowups}</b> · Bitácoras: <b>{massiveResult.createdActivities}</b></div>
                {massiveResult.errors?.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-400">{massiveResult.errors.length} errores</summary>
                    <ul className="mt-1 space-y-0.5">
                      {massiveResult.errors.map((e: any, i: number) => <li key={i}>Línea {e.line}: {e.error}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>1. Seleccioná la entidad</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="w-full md:w-80"><SelectValue /></SelectTrigger>
              <SelectContent>
                {entities.map(e => <SelectItem key={e.key} value={e.key}>{LABELS[e.key] || e.key}</SelectItem>)}
              </SelectContent>
            </Select>
            {def && (
              <div className="text-xs text-muted-foreground">
                <div><b>Campos:</b> {def.fields.join(", ")}</div>
                {def.required.length > 0 && <div><b>Obligatorios:</b> {def.required.join(", ")}</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Exportar</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => download(`${API}/api/csv/export/${entity}`)}>
              <Download className="h-4 w-4 mr-2" />Descargar CSV completo
            </Button>
            <Button variant="outline" onClick={() => download(`${API}/api/csv/template/${entity}`)}>
              <FileText className="h-4 w-4 mr-2" />Descargar plantilla vacía
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>3. Importar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <Label className="text-xs">Modo</Label>
                <Select value={mode} onValueChange={v => setMode(v as any)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upsert">Upsert (id existente actualiza)</SelectItem>
                    <SelectItem value="insert">Solo insertar (omite id)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Subir archivo CSV</Label>
                <input type="file" accept=".csv,text/csv" onChange={onFile}
                  className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground" />
              </div>
            </div>
            <div>
              <Label className="text-xs">…o pegá el contenido directamente</Label>
              <Textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8}
                placeholder="header1,header2,..." className="font-mono text-xs" />
            </div>
            <Button onClick={doImport} disabled={loading}>
              <Upload className="h-4 w-4 mr-2" />{loading ? "Importando..." : "Importar"}
            </Button>
            {result && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div>Total filas: <b>{result.total}</b> · Insertadas: <b className="text-green-500">{result.inserted}</b> · Actualizadas: <b className="text-blue-500">{result.updated}</b> · Omitidas: <b className="text-yellow-500">{result.skipped}</b></div>
                {result.unknownColumns?.length > 0 && (
                  <div className="text-yellow-500 text-xs">Columnas ignoradas: {result.unknownColumns.join(", ")}</div>
                )}
                {result.errors?.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-400">{result.errors.length} errores</summary>
                    <ul className="mt-1 space-y-0.5">
                      {result.errors.map((e: any, i: number) => <li key={i}>Línea {e.line}: {e.error}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
