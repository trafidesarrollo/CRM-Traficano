import { useState } from "react";
import { Link } from "wouter";
import { useGetEmails, EmailCategory } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { categoryLabels, getCategoryColor, getEmailStatusLabel } from "@/lib/translations";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Emails() {
  const [activeTab, setActiveTab] = useState<string>("all");
  
  const { data: response, isLoading } = useGetEmails({
    query: {
      queryKey: ['/api/emails', { category: activeTab !== "all" ? activeTab : undefined }]
    },
    request: {
       // Workaround for orval params mapping
      //@ts-ignore
      category: activeTab !== "all" ? activeTab : undefined
    }
  });

  const tabs = [
    { id: "all", label: "Todos" },
    { id: EmailCategory.quote_request, label: categoryLabels[EmailCategory.quote_request] },
    { id: EmailCategory.complaint, label: categoryLabels[EmailCategory.complaint] },
    { id: EmailCategory.inquiry, label: categoryLabels[EmailCategory.inquiry] },
    { id: EmailCategory.other, label: "Otros" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Bandeja de Entrada</h1>
          <p className="text-muted-foreground mt-1">Clasificación y procesamiento automático.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 mb-6 gap-2 no-scrollbar border-b border-border/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap
              ${activeTab === tab.id 
                ? 'border-primary text-primary bg-primary/5' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-lg shadow-black/20">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-border/50">
              <TableHead>Remitente</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead>Categoría IA</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </TableCell>
              </TableRow>
            ) : response?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No se encontraron emails en esta categoría.
                </TableCell>
              </TableRow>
            ) : (
              response?.data?.map((email) => (
                <TableRow key={email.id} className="border-border/50 hover:bg-white/5 transition-colors group">
                  <TableCell>
                    <div className="font-medium text-foreground truncate max-w-[200px]">{email.fromName || email.fromEmail.split('@')[0]}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{email.fromEmail}</div>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate font-medium">{email.subject}</div>
                    <div className="truncate text-xs text-muted-foreground mt-1">{email.body.substring(0, 80)}...</div>
                  </TableCell>
                  <TableCell>
                    {email.category ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${getCategoryColor(email.category)}`}>
                          {categoryLabels[email.category] || email.category}
                        </Badge>
                        {email.categoryConfidence && (
                          <span className="text-[10px] text-muted-foreground bg-black/20 px-1.5 py-0.5 rounded">
                            {Math.round(email.categoryConfidence * 100)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Sin clasificar</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-white/5">
                      {getEmailStatusLabel(email.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(email.receivedAt), "dd MMM, HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/emails/${email.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
