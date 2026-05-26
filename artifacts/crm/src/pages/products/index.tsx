import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Search, Package, Ruler, Upload, FileSpreadsheet, CheckCircle2,
  AlertCircle, X, ChevronLeft, ChevronRight, DollarSign, Wrench, Pencil, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

const API = import.meta.env.VITE_API_URL || "";

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") {
        row.push(field); field = "";
        if (row.some(f => f !== "")) rows.push(row);
        row = [];
      } else { field += c; }
    }
  }
  row.push(field);
  if (row.some(f => f !== "")) rows.push(row);
  return rows;
}

function csvToMedidas(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const h = rows[0];
  const idx = (n: string) => h.findIndex(x => x.trim().toLowerCase() === n.toLowerCase());
  const [iC, iN, iD, iE, iLMin, iLMax, iCos, iAce, iT, iNo, iF, iR, iMP] = [
    idx("Código"), idx("Nombre"), idx("Díametro Exterior"), idx("Espesor Nominal"),
    idx("Largo Mínimo"), idx("Largo Máximo"), idx("Tipo Costura"), idx("Tipo de Acero"),
    idx("Tratamiento Térmico"), idx("Norma"), idx("Forma"), idx("Rubro"), idx("Materia prima"),
  ];
  return rows.slice(1).filter(r => r[iN]?.trim()).map(r => ({
    code: r[iC]?.trim() || null, name: r[iN]?.trim() || "",
    outerDiameter: r[iD]?.trim() || null, nominalThickness: r[iE]?.trim() || null,
    minLength: r[iLMin]?.trim() || null, maxLength: r[iLMax]?.trim() || null,
    seamType: r[iCos]?.trim() || null, steelType: r[iAce]?.trim() || null,
    heatTreatment: r[iT]?.trim() || null, standard: r[iNo]?.trim() || null,
    shape: r[iF]?.trim() || null, category: r[iR]?.trim() || null,
    rawMaterial: r[iMP]?.trim() || null,
  }));
}

function csvToAccesorios(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const h = rows[0];
  const idx = (n: string) => h.findIndex(x => x.trim().toLowerCase() === n.toLowerCase());
  const [iC, iN, iT, iS, iU, iV1, iV2, iV3, iV4, iV5, iP, iNo] = [
    idx("Código"), idx("Nombre"), idx("Tipo de accesorio"), idx("Subtipo"),
    idx("Unidad de medida"), idx("Valor 1"), idx("Valor 2"), idx("Valor 3"),
    idx("Valor 4"), idx("Valor 5"), idx("Peso"), idx("Norma"),
  ];
  return rows.slice(1).filter(r => r[iN]?.trim()).map(r => ({
    code: r[iC]?.trim() || null, name: r[iN]?.trim() || "",
    accessoryType: r[iT]?.trim() || null, subtype: r[iS]?.trim() || null,
    unit: r[iU]?.trim() || null,
    value1: r[iV1]?.trim() || null, value2: r[iV2]?.trim() || null,
    value3: r[iV3]?.trim() || null, value4: r[iV4]?.trim() || null,
    value5: r[iV5]?.trim() || null,
    weight: r[iP]?.trim() || null, standard: r[iNo]?.trim() || null,
  }));
}

// Parser for price list CSV: "Lista de precios","Producto","UOM","Proveedor","Precio"
function csvToPrecios(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const h = rows[0];
  const idx = (n: string) => h.findIndex(x => x.trim().toLowerCase() === n.toLowerCase());
  const iL = idx("Lista de precios");
  const iP = idx("Producto");
  const iU = idx("UOM");
  const iProv = idx("Proveedor");
  const iPr = idx("Precio");
  if (iP === -1 || iPr === -1) return [];
  return rows.slice(1)
    .filter(r => r[iP]?.trim() && r[iPr]?.trim())
    .map(r => ({
      listName: iL >= 0 ? (r[iL]?.trim() || "") : "",
      product: r[iP]?.trim() || "",
      uom: iU >= 0 ? (r[iU]?.trim() || "") : "",
      supplier: iProv >= 0 ? (r[iProv]?.trim() || "") : "",
      price: r[iPr]?.trim() || "",
    }));
}

// ─── Price import dialog (specialized for price list CSV) ─────────────────────
function PriceImportDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "preview" | "importing" | "done" | "error">("idle");
  const [parsed, setParsed] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setState("idle"); setParsed([]); setFileName(""); setResult(null); setErr(""); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string);
      const data = csvToPrecios(rows);
      if (!data.length) { setErr("No se encontraron filas válidas. Verificá que el CSV tenga columnas: Lista de precios, Producto, Precio"); setState("error"); return; }
      setParsed(data); setState("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    setState("importing");
    try {
      const r = await fetch(`${API}/api/products/prices/import`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error del servidor");
      setResult(data);
      setState("done");
      onDone();
    } catch (e: any) { setErr(e.message); setState("error"); }
  };

  // Group by list name for preview
  const listNames = [...new Set(parsed.map(r => r.listName || "(sin nombre)"))];

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-green-400 border-green-500/30 hover:bg-green-500/10">
          <DollarSign className="w-4 h-4 mr-2" />Importar Precios
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar Lista de Precios</DialogTitle></DialogHeader>

        {state === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Columnas requeridas: <span className="font-mono text-xs bg-muted px-1 rounded">Lista de precios, Producto, Precio</span>
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-lg p-8 cursor-pointer hover:border-green-500/50 transition-colors gap-3">
              <DollarSign className="w-10 h-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Seleccioná el archivo CSV de precios</span>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}

        {state === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <FileSpreadsheet className="w-4 h-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">{parsed.length.toLocaleString()} filas</Badge>
              {listNames.map(l => <Badge key={l} className="text-xs bg-green-500/20 text-green-300 border-green-500/30">{l}</Badge>)}
            </div>
            <div className="overflow-x-auto rounded border border-border/40 text-xs">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">Lista</th>
                    <th className="px-2 py-1 text-left">Producto</th>
                    <th className="px-2 py-1 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-border/20">
                      <td className="px-2 py-1 text-muted-foreground">{r.listName || "—"}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate" title={r.product}>{r.product}</td>
                      <td className="px-2 py-1 text-right font-mono">{r.price}</td>
                    </tr>
                  ))}
                  {parsed.length > 6 && <tr><td colSpan={3} className="px-2 py-1 text-muted-foreground text-center">... y {parsed.length - 6} más</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">La coincidencia se hace por nombre exacto del producto (sin distinguir mayúsculas). Los que no coincidan quedarán sin actualizar.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                <DollarSign className="w-4 h-4 mr-2" />Importar {parsed.length.toLocaleString()} precios
              </Button>
            </div>
          </div>
        )}

        {state === "importing" && (
          <div className="py-8 text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto" />
            <p className="text-sm text-muted-foreground">Actualizando precios...</p>
          </div>
        )}

        {state === "done" && result && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
              <div>
                <p className="font-semibold">Importación completada</p>
                <p className="text-sm text-muted-foreground">Se procesaron {result.total.toLocaleString()} filas del CSV</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.matched}</p>
                <p className="text-muted-foreground text-xs mt-0.5">Precios actualizados</p>
                <p className="text-xs text-muted-foreground">{result.matchedMedidas} caños · {result.matchedAccesorios} accesorios</p>
              </div>
              <div className={`border rounded-lg p-3 text-center ${result.unmatched > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/20 border-border/20"}`}>
                <p className={`text-2xl font-bold ${result.unmatched > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{result.unmatched}</p>
                <p className="text-muted-foreground text-xs mt-0.5">Sin coincidencia</p>
              </div>
            </div>
            {result.unmatchedSample?.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-amber-400">Productos no encontrados (muestra):</p>
                {result.unmatchedSample.map((n: string, i: number) => <p key={i} className="truncate pl-2 border-l border-amber-500/30">· {n}</p>)}
              </div>
            )}
            <Button className="w-full" onClick={() => { reset(); setOpen(false); }}>Cerrar</Button>
          </div>
        )}

        {state === "error" && (
          <div className="py-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="font-semibold">Error</p>
            <p className="text-sm text-muted-foreground">{err}</p>
            <Button variant="outline" onClick={reset}>Reintentar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Import dialogs ────────────────────────────────────────────────────────────
type ImportState = "idle" | "preview" | "importing" | "done" | "error";

function CsvImportDialog({ label, color, onImport, validate, previewCols }: {
  label: string; color: string;
  onImport: (rows: any[], setProgress: (p: number) => void) => Promise<void>;
  validate: (rows: string[][]) => any[];
  previewCols: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>("idle");
  const [parsed, setParsed] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const reset = () => { setState("idle"); setParsed([]); setFileName(""); setProgress(0); setMsg(""); setErr(""); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string);
      const data = validate(rows);
      if (!data.length) { setErr("No se encontraron filas válidas."); setState("error"); return; }
      setParsed(data); setState("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    setState("importing");
    try {
      await onImport(parsed, setProgress);
      setMsg(`${parsed.length.toLocaleString("es-AR")} registros importados.`);
      setState("done");
    } catch (e: any) { setErr(e.message); setState("error"); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className={color}><Upload className="w-4 h-4 mr-2" />{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        {state === "idle" && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors gap-3">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Seleccioná el archivo CSV</span>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
        )}
        {state === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm"><FileSpreadsheet className="w-4 h-4" /><span>{fileName}</span><Badge variant="secondary">{parsed.length.toLocaleString()} filas</Badge></div>
            <div className="overflow-x-auto rounded border border-border/40 text-xs">
              <table className="w-full"><thead className="bg-muted/40"><tr>{previewCols.map(c => <th key={c.key} className="px-2 py-1 text-left font-medium">{c.label}</th>)}</tr></thead>
                <tbody>{parsed.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-border/20">{previewCols.map(c => <td key={c.key} className="px-2 py-1 max-w-[160px] truncate">{r[c.key]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end"><Button variant="ghost" onClick={reset}>Cancelar</Button><Button onClick={handleImport}><Upload className="w-4 h-4 mr-2" />Importar {parsed.length.toLocaleString()} registros</Button></div>
          </div>
        )}
        {state === "importing" && (
          <div className="space-y-4 py-6 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
            <div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="text-sm text-muted-foreground">{progress}% completado</p>
          </div>
        )}
        {state === "done" && <div className="py-6 text-center space-y-3"><CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" /><p className="font-semibold">¡Listo!</p><p className="text-sm text-muted-foreground">{msg}</p><Button onClick={() => { reset(); setOpen(false); }}>Cerrar</Button></div>}
        {state === "error" && <div className="py-6 text-center space-y-3"><AlertCircle className="w-12 h-12 text-destructive mx-auto" /><p className="font-semibold">Error</p><p className="text-sm text-muted-foreground">{err}</p><Button variant="outline" onClick={reset}>Reintentar</Button></div>}
      </DialogContent>
    </Dialog>
  );
}

// ─── Type pill helpers ─────────────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  accesorios: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  medidas: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const fmt = (n: any) => n != null ? `u$s ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

type PriceListType = "venta" | "revendedor" | "compra";

const PRICE_FIELD: Record<PriceListType, string> = {
  venta: "sale_price",
  revendedor: "reseller_price",
  compra: "purchase_price",
};

const PRICE_BODY_KEY: Record<PriceListType, string> = {
  venta: "salePrice",
  revendedor: "resellerPrice",
  compra: "purchasePrice",
};

const PRICE_COLORS: Record<PriceListType, string> = {
  venta: "text-green-400",
  revendedor: "text-sky-400",
  compra: "text-amber-400",
};

// ─── Inline price editor cell ──────────────────────────────────────────────────
function PriceCell({ item, priceList, onSaved }: {
  item: any;
  priceList: PriceListType;
  onSaved: (id: number, source: string, field: string, newPrice: string | null) => void;
}) {
  const field = PRICE_FIELD[priceList];
  const bodyKey = PRICE_BODY_KEY[priceList];
  const colorClass = PRICE_COLORS[priceList];
  const currentPrice = item[field];

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startEdit = () => {
    setValue(currentPrice ? String(Number(currentPrice).toFixed(2)) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };
  const cancel = () => setEditing(false);

  const save = async () => {
    const parsed = value.trim() === "" ? null : parseFloat(value.replace(",", "."));
    if (value.trim() !== "" && (isNaN(parsed as number) || (parsed as number) < 0)) {
      toast({ title: "Precio inválido", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const url = `${API}/api/products/${item.source}/${item.id}`;
      const r = await fetch(url, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [bodyKey]: parsed }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      onSaved(item.id, item.source, field, parsed !== null ? String(parsed) : null);
      toast({ title: "Precio actualizado" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="text-muted-foreground text-xs">u$s</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-24 text-right bg-background border border-primary/50 rounded px-1.5 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={save} disabled={saving} className="text-green-400 hover:text-green-300 p-0.5"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      {currentPrice ? (
        <span className={`${colorClass} font-mono text-sm font-semibold`}>{fmt(currentPrice)}</span>
      ) : (
        <span className="text-muted-foreground text-xs italic">Sin precio</span>
      )}
      <button
        onClick={startEdit}
        title="Editar precio"
        className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded p-0.5 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Products() {
  const { toast } = useToast();

  // Catalog state
  const [type, setType] = useState<"all" | "accesorios" | "medidas">("all");
  const [search, setSearch] = useState("");
  const [accessoryType, setAccessoryType] = useState("all");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "with" | "without">("all");
  const [priceList, setPriceList] = useState<PriceListType>("venta");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<any>({ data: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ accessoryTypes: string[]; categories: string[] }>({ accessoryTypes: [], categories: [] });

  const debouncedSearch = useDebounce(search, 350);

  const loadFilters = useCallback(async () => {
    const r = await fetch(`${API}/api/products/catalog/filters`, { credentials: "include" });
    if (r.ok) setFilters(await r.json());
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (accessoryType && accessoryType !== "all") params.set("accessoryType", accessoryType);
    if (category && category !== "all") params.set("category", category);
    if (priceFilter === "with") params.set("hasPrice", "true");
    if (priceFilter === "without") params.set("noPrice", "true");
    params.set("priceList", priceList);
    params.set("page", String(page));
    params.set("limit", "50");
    try {
      const r = await fetch(`${API}/api/products/catalog?${params}`, { credentials: "include" });
      if (r.ok) setCatalog(await r.json());
    } finally { setLoading(false); }
  }, [type, debouncedSearch, accessoryType, category, priceFilter, priceList, page]);

  useEffect(() => { loadFilters(); }, [loadFilters]);
  useEffect(() => { setPage(1); }, [type, debouncedSearch, accessoryType, category, priceFilter, priceList]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const resetFilters = () => { setSearch(""); setAccessoryType("all"); setCategory("all"); setPriceFilter("all"); setPage(1); };
  const hasActiveFilters = search || (accessoryType && accessoryType !== "all") || (category && category !== "all") || priceFilter !== "all";

  const handlePriceSaved = (id: number, source: string, field: string, newPrice: string | null) => {
    setCatalog((prev: any) => ({
      ...prev,
      data: prev.data.map((item: any) =>
        item.id === id && item.source === source ? { ...item, [field]: newPrice } : item
      ),
    }));
  };

  // Import handlers
  const importMedidas = async (rows: any[], setProgress: (p: number) => void) => {
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const r = await fetch(`${API}/api/products/medidas/import`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: rows.slice(i, i + CHUNK) }) });
      if (!r.ok) throw new Error((await r.json()).error || "Error del servidor");
      setProgress(Math.round(((i + CHUNK) / rows.length) * 100));
    }
    loadCatalog();
  };

  const importAccesorios = async (rows: any[], setProgress: (p: number) => void) => {
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const r = await fetch(`${API}/api/products/accesorios/import`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: rows.slice(i, i + CHUNK) }) });
      if (!r.ok) throw new Error((await r.json()).error || "Error del servidor");
      setProgress(Math.round(((i + CHUNK) / rows.length) * 100));
    }
    loadCatalog();
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {catalog.total.toLocaleString("es-AR")} productos
              {hasActiveFilters ? " (filtrado)" : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <PriceImportDialog onDone={loadCatalog} />
            <CsvImportDialog
              label="Importar Accesorios"
              color="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              validate={csvToAccesorios}
              onImport={importAccesorios}
              previewCols={[{ key: "code", label: "Código" }, { key: "name", label: "Nombre" }, { key: "accessoryType", label: "Tipo" }, { key: "weight", label: "Peso" }]}
            />
            <CsvImportDialog
              label="Importar Caños/Medidas"
              color="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              validate={csvToMedidas}
              onImport={importMedidas}
              previewCols={[{ key: "code", label: "Código" }, { key: "name", label: "Nombre" }, { key: "outerDiameter", label: "Ø Ext" }, { key: "standard", label: "Norma" }]}
            />
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
          {([["all", "Todos", Package], ["accesorios", "Accesorios", Wrench], ["medidas", "Caños / Medidas", Ruler]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => { setType(v); setAccessoryType("all"); setCategory("all"); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${type === v ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código, norma..."
              className="pl-9 bg-card border-border/50"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {(type === "all" || type === "accesorios") && (
            <Select value={accessoryType} onValueChange={setAccessoryType}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Tipo accesorio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {filters.accessoryTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {(type === "all" || type === "medidas") && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {filters.categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Price list tabs */}
          <div className="flex gap-0.5 p-0.5 bg-muted/40 rounded-lg border border-border/30">
            {([["venta", "Venta", "text-green-400"], ["revendedor", "Revendedor", "text-sky-400"], ["compra", "Compra", "text-amber-400"]] as const).map(([v, label, color]) => (
              <button
                key={v}
                onClick={() => setPriceList(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${priceList === v ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <DollarSign className={`w-3 h-3 ${priceList === v ? color : ""}`} />{label}
              </button>
            ))}
          </div>

          <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as "all" | "with" | "without")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Precio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with">Con precio</SelectItem>
              <SelectItem value="without">Sin precio</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X className="w-3.5 h-3.5 mr-1" />Limpiar
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : catalog.data.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No se encontraron productos</p>
                {hasActiveFilters && <button className="text-primary text-sm mt-2" onClick={resetFilters}>Limpiar filtros</button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50">
                    <tr className="text-xs text-muted-foreground uppercase text-left">
                      <th className="p-3 w-8"></th>
                      <th className="p-3">Código</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Tipo / Categoría</th>
                      <th className="p-3">Norma</th>
                      <th className="p-3 text-right">
                        <span className={PRICE_COLORS[priceList]}>
                          {priceList === "venta" ? "Precio Venta" : priceList === "revendedor" ? "Precio Revendedor" : "Precio Compra"}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.data.map((item: any, i: number) => (
                      <tr key={`${item.source}-${item.id}-${i}`} className="border-b border-border/20 hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs ${SOURCE_COLORS[item.source]}`}>
                            {item.source === "accesorios" ? <Wrench className="w-3 h-3" /> : <Ruler className="w-3 h-3" />}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{item.code || "—"}</td>
                        <td className="p-3 max-w-xs">
                          <p className="truncate font-medium" title={item.name}>{item.name}</p>
                          {item.source === "medidas" && item.outer_diameter && (
                            <p className="text-xs text-muted-foreground">Ø {item.outer_diameter} mm · {item.nominal_thickness} mm esp.</p>
                          )}
                          {item.source === "accesorios" && item.weight && (
                            <p className="text-xs text-muted-foreground">Peso: {item.weight} kg</p>
                          )}
                        </td>
                        <td className="p-3">
                          {item.source === "accesorios" ? (
                            <div>
                              {item.sub_type && <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">{item.sub_type}</Badge>}
                              {item.sub_type2 && <p className="text-xs text-muted-foreground mt-0.5">{item.sub_type2}</p>}
                            </div>
                          ) : (
                            <div>
                              {item.category && <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">{item.category}</Badge>}
                              {item.seam_type && <p className="text-xs text-muted-foreground mt-0.5">{item.seam_type}</p>}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[140px] truncate" title={item.standard || ""}>{item.standard || "—"}</td>
                        <td className="p-3 text-right">
                          <PriceCell item={item} priceList={priceList} onSaved={handlePriceSaved} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {catalog.pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {catalog.page} de {catalog.pages} · {catalog.total.toLocaleString("es-AR")} resultados
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, catalog.pages) }, (_, i) => {
                const p = Math.max(1, Math.min(catalog.pages - 4, page - 2)) + i;
                return (
                  <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)}>
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page >= catalog.pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
