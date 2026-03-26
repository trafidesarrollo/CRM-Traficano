import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloud, FileType } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useImportClients } from "@workspace/api-client-react";
import Papa from "papaparse";

export default function Imports() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  
  const importClientsMut = useImportClients({
    mutation: {
      onSuccess: (res) => {
        toast({ title: "Importación completa", description: `${res.inserted} insertados, ${res.updated} actualizados, ${res.errors} errores.` });
        setFile(null);
      },
      onError: () => toast({ title: "Error en importación", variant: "destructive" })
    }
  });

  const handleUpload = () => {
    if (!file) return;
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsing(false);
        if (results.errors.length > 0) {
          toast({ title: "Error analizando CSV", variant: "destructive" });
          return;
        }
        // Assuming we are importing clients for this example
        importClientsMut.mutate({
          data: {
            data: results.data as any[],
            mode: "upsert"
          }
        });
      }
    });
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Importación de Datos</h1>
        <p className="text-muted-foreground mt-1">Carga masiva vía CSV.</p>
      </div>

      <Card className="bg-card border-dashed border-2 border-border/50 hover:border-primary/50 transition-colors">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
            {file ? <FileType className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
          </div>
          <h3 className="text-xl font-bold mb-2">{file ? file.name : 'Arrastra un archivo CSV'}</h3>
          <p className="text-muted-foreground mb-8 max-w-md">
            O selecciona un archivo desde tu computadora. Asegúrate de que las cabeceras coincidan con el formato esperado.
          </p>
          
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            id="file-upload"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          
          {!file ? (
             <label htmlFor="file-upload">
              <Button asChild className="bg-white text-black hover:bg-white/90">
                <span>Seleccionar Archivo</span>
              </Button>
            </label>
          ) : (
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setFile(null)}>Cancelar</Button>
              <Button 
                onClick={handleUpload} 
                disabled={parsing || importClientsMut.isPending}
                className="bg-primary"
              >
                {importClientsMut.isPending ? "Importando..." : "Iniciar Importación"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
