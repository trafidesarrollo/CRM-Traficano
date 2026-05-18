import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGetProducts, useCreateProduct, useDeleteProduct, useUpdateProduct } from "@workspace/api-client-react";
import { Plus, Search, Trash2, Package, Ruler, ScrollText, Pencil, Save, X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Minimal robust CSV parser (handles quoted fields with commas/newlines)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize BOM and line endings
  const s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") {
        row.push(field); field = "";
        if (row.some(f => f !== "")) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  row.push(field);
  if (row.some(f => f !== "")) rows.push(row);
  return rows;
}

function csvToMedidas(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const idx = (name: string) => header.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
  const iCodigo = idx("Código");
  const iNombre = idx("Nombre");
  const iDiam = idx("Díametro Exterior");
  const iEsp = idx("Espesor Nominal");
  const iLMin = idx("Largo Mínimo");
  const iLMax = idx("Largo Máximo");
  const iCos = idx("Tipo Costura");
  const iAce = idx("Tipo de Acero");
  const iTerm = idx("Tratamiento Térmico");
  const iNorma = idx("Norma");
  const iForma = idx("Forma");
  const iRubro = idx("Rubro");
  const iMP = idx("Materia prima");
  return rows.slice(1).filter(r => r[iNombre]?.trim()).map(r => ({
    code: r[iCodigo]?.trim() || null,
    name: r[iNombre]?.trim() || "",
    outerDiameter: r[iDiam]?.trim() || null,
    nominalThickness: r[iEsp]?.trim() || null,
    minLength: r[iLMin]?.trim() || null,
    maxLength: r[iLMax]?.trim() || null,
    seamType: r[iCos]?.trim() || null,
    steelType: r[iAce]?.trim() || null,
    heatTreatment: r[iTerm]?.trim() || null,
    standard: r[iNorma]?.trim() || null,
    shape: r[iForma]?.trim() || null,
    category: r[iRubro]?.trim() || null,
    rawMaterial: r[iMP]?.trim() || null,
  }));
}

function csvToAccesorios(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const idx = (name: string) => header.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
  const iCodigo = idx("Código");
  const iNombre = idx("Nombre");
  const iTipo = idx("Tipo de accesorio");
  const iSubtipo = idx("Subtipo");
  const iUnidad = idx("Unidad de medida");
  const iV1 = idx("Valor 1");
  const iV2 = idx("Valor 2");
  const iV3 = idx("Valor 3");
  const iV4 = idx("Valor 4");
  const iV5 = idx("Valor 5");
  const iPeso = idx("Peso");
  const iNorma = idx("Norma");
  return rows.slice(1).filter(r => r[iNombre]?.trim()).map(r => ({
    code: r[iCodigo]?.trim() || null,
    name: r[iNombre]?.trim() || "",
    accessoryType: r[iTipo]?.trim() || null,
    subtype: r[iSubtipo]?.trim() || null,
    unit: r[iUnidad]?.trim() || null,
    value1: r[iV1]?.trim() || null,
    value2: r[iV2]?.trim() || null,
    value3: r[iV3]?.trim() || null,
    value4: r[iV4]?.trim() || null,
    value5: r[iV5]?.trim() || null,
    weight: r[iPeso]?.trim() || null,
    standard: r[iNorma]?.trim() || null,
  }));
}

type ImportState = "idle" | "preview" | "importing" | "done" | "error";

function CsvImportAccesoriosDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>("idle");
  const [parsed, setParsed] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultMsg, setResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState("idle"); setParsed([]); setFileName(""); setProgress(0);
    setResultMsg(""); setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const accesorios = csvToAccesorios(rows);
      if (accesorios.length === 0) {
        setErrorMsg("No se encontraron filas válidas. Verificá que sea el CSV de Accesorios.");
        setState("error");
        return;
      }
      setParsed(accesorios);
      setState("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!parsed.length) return;
    setState("importing");
    setProgress(0);
    const CHUNK = 200;
    let done = 0;
    try {
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const chunk = parsed.slice(i, i + CHUNK);
        const res = await fetch(`${API_BASE}/api/products/accesorios/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ rows: chunk }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Error del servidor");
        }
        done += chunk.length;
        setProgress(Math.round((done / parsed.length) * 100));
      }
      setResultMsg(`${done.toLocaleString("es-AR")} accesorios importados/actualizados correctamente.`);
      setState("done");
      toast({ title: "Importación completada", description: `${done.toLocaleString("es-AR")} accesorios procesados.` });
    } catch (err: any) {
      setErrorMsg(err.message || "Error desconocido al importar.");
      setState("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Importar Accesorios</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar Accesorios desde CSV</DialogTitle></DialogHeader>

        {state === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El CSV debe tener las columnas: <span className="font-medium text-foreground">Código, Nombre, Tipo de accesorio, Subtipo, Unidad de medida, Valor 1–5, Peso, Norma</span>.
              Si el código ya existe, el registro se actualiza.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/30 rounded-lg p-8 cursor-pointer hover:border-amber-500/60 hover:bg-amber-500/5 transition-colors gap-3">
              <FileSpreadsheet className="w-10 h-10 text-amber-500/60" />
              <span className="text-sm text-muted-foreground">Hacer clic para seleccionar archivo .csv de Accesorios</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}

        {state === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{parsed.length.toLocaleString("es-AR")} filas</Badge>
            </div>
            <div className="text-sm text-muted-foreground">Vista previa (primeras 5 filas):</div>
            <div className="overflow-x-auto rounded border border-border/40 text-xs">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Código</th>
                    <th className="px-2 py-1 text-left font-medium">Nombre</th>
                    <th className="px-2 py-1 text-left font-medium">Tipo</th>
                    <th className="px-2 py-1 text-left font-medium">Peso</th>
                    <th className="px-2 py-1 text-left font-medium">Norma</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border/20">
                      <td className="px-2 py-1 text-muted-foreground">{r.code}</td>
                      <td className="px-2 py-1 max-w-[180px] truncate">{r.name}</td>
                      <td className="px-2 py-1">{r.accessoryType}</td>
                      <td className="px-2 py-1">{r.weight}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{r.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport}>
                <Upload className="w-4 h-4 mr-2" />Importar {parsed.length.toLocaleString("es-AR")} accesorios
              </Button>
            </div>
          </div>
        )}

        {state === "importing" && (
          <div className="space-y-4 py-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">Importando accesorios...</p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{progress}% completado</p>
          </div>
        )}

        {state === "done" && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold">¡Importación completada!</p>
            <p className="text-sm text-muted-foreground">{resultMsg}</p>
            <Button onClick={() => { reset(); setOpen(false); }}>Cerrar</Button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4 py-4 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="font-semibold">Error en la importación</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={reset}>Intentar de nuevo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CsvImportDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>("idle");
  const [parsed, setParsed] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultMsg, setResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState("idle"); setParsed([]); setFileName(""); setProgress(0);
    setResultMsg(""); setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const medidas = csvToMedidas(rows);
      if (medidas.length === 0) {
        setErrorMsg("No se encontraron filas válidas en el archivo.");
        setState("error");
        return;
      }
      setParsed(medidas);
      setState("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!parsed.length) return;
    setState("importing");
    setProgress(0);
    const CHUNK = 200;
    let done = 0;
    try {
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const chunk = parsed.slice(i, i + CHUNK);
        const res = await fetch(`${API_BASE}/api/products/medidas/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Error del servidor");
        }
        done += chunk.length;
        setProgress(Math.round((done / parsed.length) * 100));
      }
      setResultMsg(`${done.toLocaleString("es-AR")} productos importados/actualizados correctamente.`);
      setState("done");
      toast({ title: "Importación completada", description: `${done.toLocaleString("es-AR")} productos procesados.` });
    } catch (err: any) {
      setErrorMsg(err.message || "Error desconocido al importar.");
      setState("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar productos desde CSV</DialogTitle></DialogHeader>

        {state === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El CSV debe tener las columnas: <span className="font-medium text-foreground">Código, Nombre, Díametro Exterior, Espesor Nominal, Largo Mínimo, Largo Máximo, Tipo Costura, Tipo de Acero, Tratamiento Térmico, Norma, Forma, Rubro, Materia prima</span>.
              Si el código ya existe, el registro se actualiza.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors gap-3">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Hacer clic para seleccionar archivo .csv</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}

        {state === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{parsed.length.toLocaleString("es-AR")} filas</Badge>
            </div>
            <div className="text-sm text-muted-foreground">Vista previa (primeras 5 filas):</div>
            <div className="overflow-x-auto rounded border border-border/40 text-xs">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Código</th>
                    <th className="px-2 py-1 text-left font-medium">Nombre</th>
                    <th className="px-2 py-1 text-left font-medium">Ø Ext</th>
                    <th className="px-2 py-1 text-left font-medium">Esp.</th>
                    <th className="px-2 py-1 text-left font-medium">Norma</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border/20">
                      <td className="px-2 py-1 text-muted-foreground">{r.code}</td>
                      <td className="px-2 py-1 max-w-[180px] truncate">{r.name}</td>
                      <td className="px-2 py-1">{r.outerDiameter}</td>
                      <td className="px-2 py-1">{r.nominalThickness}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{r.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport}>
                <Upload className="w-4 h-4 mr-2" />Importar {parsed.length.toLocaleString("es-AR")} productos
              </Button>
            </div>
          </div>
        )}

        {state === "importing" && (
          <div className="space-y-4 py-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Importando productos...</p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{progress}% completado</p>
          </div>
        )}

        {state === "done" && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold">¡Importación completada!</p>
            <p className="text-sm text-muted-foreground">{resultMsg}</p>
            <Button onClick={() => { reset(); setOpen(false); }}>Cerrar</Button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4 py-4 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="font-semibold">Error en la importación</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={reset}>Intentar de nuevo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const UNIT_GROUPS: { label: string; units: { value: string; label: string }[] }[] = [
  {
    label: "Longitud",
    units: [
      { value: "m", label: "m — Metro" },
      { value: "mm", label: "mm — Milímetro" },
      { value: "cm", label: "cm — Centímetro" },
      { value: "km", label: "km — Kilómetro" },
      { value: "pulg", label: "pulg — Pulgada" },
      { value: "pie", label: "pie — Pie" },
    ],
  },
  {
    label: "Masa / Peso",
    units: [
      { value: "kg", label: "kg — Kilogramo" },
      { value: "g", label: "g — Gramo" },
      { value: "tn", label: "tn — Tonelada métrica" },
      { value: "lb", label: "lb — Libra" },
    ],
  },
  {
    label: "Área",
    units: [
      { value: "m2", label: "m² — Metro cuadrado" },
      { value: "cm2", label: "cm² — Centímetro cuadrado" },
      { value: "mm2", label: "mm² — Milímetro cuadrado" },
    ],
  },
  {
    label: "Volumen / Capacidad",
    units: [
      { value: "m3", label: "m³ — Metro cúbico" },
      { value: "lt", label: "lt — Litro" },
      { value: "ml", label: "ml — Mililitro" },
      { value: "gl", label: "gl — Galón" },
    ],
  },
  {
    label: "Unidades / Piezas",
    units: [
      { value: "u", label: "u — Unidad" },
      { value: "pza", label: "pza — Pieza" },
      { value: "par", label: "par — Par" },
      { value: "jgo", label: "jgo — Juego" },
      { value: "set", label: "set — Set / Kit" },
      { value: "kit", label: "kit — Kit" },
      { value: "doc", label: "doc — Docena" },
      { value: "ciento", label: "ciento — Ciento" },
      { value: "millar", label: "millar — Millar" },
    ],
  },
  {
    label: "Formato industrial",
    units: [
      { value: "barra", label: "barra — Barra" },
      { value: "tubo", label: "tubo — Tubo" },
      { value: "caño", label: "caño — Caño" },
      { value: "rollo", label: "rollo — Rollo" },
      { value: "bobina", label: "bobina — Bobina" },
      { value: "plancha", label: "plancha — Plancha" },
      { value: "chapa", label: "chapa — Chapa" },
      { value: "varilla", label: "varilla — Varilla" },
      { value: "perfil", label: "perfil — Perfil" },
      { value: "viga", label: "viga — Viga" },
      { value: "codo", label: "codo — Codo" },
      { value: "te", label: "te — Te" },
      { value: "reduccion", label: "reducción — Reducción" },
      { value: "brida", label: "brida — Brida" },
      { value: "junta", label: "junta — Junta" },
      { value: "valvula", label: "válvula — Válvula" },
      { value: "filtro", label: "filtro — Filtro" },
      { value: "tapa", label: "tapa — Tapa" },
    ],
  },
  {
    label: "Envase / Contenedor",
    units: [
      { value: "caja", label: "caja — Caja" },
      { value: "bolsa", label: "bolsa — Bolsa" },
      { value: "saco", label: "saco — Saco" },
      { value: "balde", label: "balde — Balde" },
      { value: "lata", label: "lata — Lata" },
      { value: "tambor", label: "tambor — Tambor" },
      { value: "garrafa", label: "garrafa — Garrafa" },
      { value: "bidon", label: "bidón — Bidón" },
      { value: "pallet", label: "pallet — Pallet" },
    ],
  },
  {
    label: "Tiempo",
    units: [
      { value: "hr", label: "hr — Hora" },
      { value: "dia", label: "día — Día" },
      { value: "mes", label: "mes — Mes" },
    ],
  },
  {
    label: "Eléctrico / Electrónico",
    units: [
      { value: "w", label: "W — Watt" },
      { value: "kw", label: "kW — Kilowatt" },
      { value: "kwh", label: "kWh — Kilowatt·hora" },
      { value: "A", label: "A — Ampere" },
      { value: "v", label: "V — Volt" },
    ],
  },
];

const UNIT_OTHER = "__otro__";

function UnitSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const allValues = UNIT_GROUPS.flatMap((g) => g.units.map((u) => u.value));
  const isKnown = !value || allValues.includes(value);
  const [showCustom, setShowCustom] = useState(!isKnown);
  const [customVal, setCustomVal] = useState(isKnown ? "" : value);

  const handleSelect = (v: string) => {
    if (v === UNIT_OTHER) {
      setShowCustom(true);
      onChange(customVal);
    } else {
      setShowCustom(false);
      onChange(v);
    }
  };

  if (showCustom) {
    return (
      <div className="flex gap-1">
        <Input
          value={customVal}
          onChange={(e) => { setCustomVal(e.target.value); onChange(e.target.value); }}
          placeholder="ej: bobina"
          className={className}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => { setShowCustom(false); setCustomVal(""); onChange(""); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || ""} onValueChange={handleSelect}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Seleccionar..." />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {UNIT_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.units.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
        <SelectGroup>
          <SelectLabel>Personalizado</SelectLabel>
          <SelectItem value={UNIT_OTHER}>✏️ Escribir unidad...</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "ARS",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "",
  });

  const { data: products, isLoading, refetch } = useGetProducts();
  const createMut = useCreateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Producto creado" });
        setOpen(false);
        refetch();
        setForm({ name: "", code: "", description: "", unit: "", category: "", dimensions: "", standard: "", price: "", currency: "ARS" });
      },
      onError: () => toast({ title: "Error al crear producto", variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteProduct({
    mutation: { onSuccess: () => { toast({ title: "Producto eliminado" }); refetch(); } },
  });
  const updateMut = useUpdateProduct({
    mutation: {
      onSuccess: () => { toast({ title: "Producto actualizado" }); setEditingId(null); refetch(); },
      onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
    },
  });

  const filtered = (products || []).filter((p: any) =>
    `${p.name} ${p.code || ""} ${p.category || ""} ${p.standard || ""} ${p.dimensions || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name || "", code: p.code || "", description: p.description || "",
      unit: p.unit || "", category: p.category || "", dimensions: p.dimensions || "",
      standard: p.standard || "", price: p.price ? String(p.price) : "", currency: p.currency || "ARS",
    });
  };

  const saveEdit = (id: number) => {
    updateMut.mutate({ id, data: { ...editForm, price: editForm.price || undefined } as any });
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Productos</h1>
          <p className="text-muted-foreground mt-1">{products?.length || 0} productos en catálogo</p>
        </div>
        <div className="flex gap-2">
          <CsvImportAccesoriosDialog />
          <CsvImportDialog />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nuevo Producto</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="TUB-001" /></div>
                <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Tubería" /></div>
              </div>
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='Tubo sin costura 2" SCH40' /></div>
              <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Dimensiones</Label><Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="60.3mm x 3.91mm" /></div>
                <div><Label>Norma</Label><Input value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })} placeholder="ASTM A53" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Unidad</Label>
                  <UnitSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                </div>
                <div><Label>Precio</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Moneda</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              </div>
              <Button className="w-full" disabled={createMut.isPending || !form.name} onClick={() => createMut.mutate({ data: { ...form, price: form.price || undefined } as any })}>
                {createMut.isPending ? "Creando..." : "Crear Producto"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar productos por nombre, código, norma..." className="pl-10 bg-card border-border/50" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex h-[30vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No se encontraron productos</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product: any) => {
            const isEditing = editingId === product.id;

            return (
              <Card key={product.id} className="bg-card/50 backdrop-blur-sm border-white/5 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Código</Label><Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="h-9" /></div>
                        <div><Label className="text-xs">Categoría</Label><Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="h-9" /></div>
                      </div>
                      <div><Label className="text-xs">Nombre</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-9" /></div>
                      <div><Label className="text-xs">Descripción</Label><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="h-9" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Dimensiones</Label><Input value={editForm.dimensions} onChange={(e) => setEditForm({ ...editForm, dimensions: e.target.value })} className="h-9" /></div>
                        <div><Label className="text-xs">Norma</Label><Input value={editForm.standard} onChange={(e) => setEditForm({ ...editForm, standard: e.target.value })} className="h-9" /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Unidad</Label>
                          <UnitSelect value={editForm.unit} onChange={(v) => setEditForm({ ...editForm, unit: v })} className="h-9" />
                        </div>
                        <div><Label className="text-xs">Precio</Label><Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="h-9" /></div>
                        <div><Label className="text-xs">Moneda</Label><Input value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} className="h-9" /></div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" disabled={updateMut.isPending || !editForm.name} onClick={() => saveEdit(product.id)}>
                          <Save className="w-4 h-4 mr-1" /> {updateMut.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{product.name}</h3>
                          {product.code && <Badge variant="outline" className="text-xs">{product.code}</Badge>}
                          {product.unit && <Badge variant="secondary" className="text-xs">{product.unit}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          {product.category && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{product.category}</span>}
                          {product.dimensions && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{product.dimensions}</span>}
                          {product.standard && <span className="flex items-center gap-1"><ScrollText className="w-3.5 h-3.5" />{product.standard}</span>}
                          {product.price && <span className="font-medium text-foreground">{product.currency} {parseFloat(product.price).toLocaleString("es-AR")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => startEdit(product)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate({ id: product.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
