import { EmailCategory, EmailStatus, OpportunityStatus } from "@workspace/api-client-react";

export const categoryLabels: Record<string, string> = {
  [EmailCategory.quote_request]: "Pedido de Cotización",
  [EmailCategory.complaint]: "Reclamo",
  [EmailCategory.inquiry]: "Consulta",
  [EmailCategory.follow_up]: "Seguimiento",
  [EmailCategory.supplier]: "Proveedor",
  [EmailCategory.internal]: "Interno",
  [EmailCategory.spam]: "Spam/Publicidad",
  [EmailCategory.other]: "Otro",
};

export const emailStatusLabels: Record<string, string> = {
  [EmailStatus.pending]: "Pendiente",
  [EmailStatus.processing]: "Procesando",
  [EmailStatus.processed]: "Procesado",
  [EmailStatus.replied]: "Respondido",
  [EmailStatus.closed]: "Cerrado",
};

export const opportunityStatusLabels: Record<string, string> = {
  "new": "Lead Nuevo",
  "quote_requested": "Cotización Solicitada",
  "quoted": "Cotización Enviada",
  "negotiating": "En Negociación",
  "won": "Cerrado Ganado",
  "lost": "Cerrado Perdido",
  "closed": "Cerrado",
};

export const getCategoryLabel = (cat?: string | null) => cat ? categoryLabels[cat] || cat : "Desconocido";
export const getEmailStatusLabel = (status?: string) => status ? emailStatusLabels[status] || status : "Desconocido";
export const getOppStatusLabel = (status?: string) => status ? opportunityStatusLabels[status] || status : "Desconocido";

export const getCategoryColor = (cat?: string | null) => {
  switch (cat) {
    case EmailCategory.quote_request: return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case EmailCategory.complaint: return "bg-red-500/10 text-red-500 border-red-500/20";
    case EmailCategory.inquiry: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case EmailCategory.spam: return "bg-stone-500/10 text-stone-500 border-stone-500/20";
    default: return "bg-zinc-500/10 text-zinc-300 border-zinc-500/20";
  }
};

export const functionalRoleLabels: Record<string, string> = {
  hunter: "Hunter",
  farmer: "Farmer",
  admin_ventas: "Admin Ventas",
};

export const getFunctionalRoleLabel = (role?: string | null) => role ? functionalRoleLabels[role] || role : "Sin asignar";

export const getFunctionalRoleColor = (role?: string | null) => {
  switch (role) {
    case "hunter": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "farmer": return "bg-green-500/10 text-green-500 border-green-500/20";
    case "admin_ventas": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
};
