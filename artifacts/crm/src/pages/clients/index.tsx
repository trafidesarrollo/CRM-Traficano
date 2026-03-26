import { useGetClients } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Clients() {
  const { data: response, isLoading } = useGetClients();

  return (
    <AppLayout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-1">Directorio de empresas.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Industria</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : response?.data?.map(client => (
              <TableRow key={client.id} className="border-border/50 hover:bg-white/5">
                <TableCell>
                  <p className="font-medium">{client.companyName}</p>
                  <p className="text-xs text-muted-foreground">{client.website || client.taxId}</p>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{client.industry || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{client.city ? `${client.city}, ${client.country}` : '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={client.status === 'active' ? 'text-emerald-500 bg-emerald-500/10' : ''}>
                    {client.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
