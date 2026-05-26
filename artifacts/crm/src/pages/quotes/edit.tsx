import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { DocumentUploader } from "@/components/document-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  ShoppingCart,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
  User,
  UserCheck,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Building2,
  X,
  MapPin,
  ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const API = import.meta.env.VITE_API_URL || "";

interface Line {
  id?: number;
  productType?: string;
  catalogType?: string; // "medidas" | "accesorios" | "" (libre)
  productId?: number | null;
  productName?: string;
  productCode?: string;
  unit?: string;
  quantity: string;
  quantityKg: string;
  unitPrice: string;
  unitPriceUm: string;
  netTotal: string;
  deliveryTime?: string;
  clientCode?: string;
  notes?: string;
}

const CATALOG_PAGE_SIZE = 50;

const blankFilters = () => ({
  category: "", seamType: "", shape: "",
  accessoryType: "", standard: "", hasPrice: false,
});

const blankLine = (): Line => ({
  productType: "REVENTA",
  catalogType: "",
  productName: "",
  unit: "UN",
  quantity: "1",
  quantityKg: "0",
  unitPrice: "0",
  unitPriceUm: "0",
  netTotal: "0",
});

export default function QuoteEdit() {
  const [, params] = useRoute("/quotes/:id");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userRef = useRef<any>(undefined);
  useEffect(() => { userRef.current = user; });
  const isNew = !params || params.id === "new";
  const id = isNew ? null : parseInt(params!.id);

  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const urlOpportunityId = urlParams.get("opportunityId");
  const urlClientId = urlParams.get("clientId");

  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);

  // ── Client picker modal ──────────────────────────────────────────────────
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientPickerSearch, setClientPickerSearch] = useState("");
  const [clientPickerStatus, setClientPickerStatus] = useState("all");
  const [clientPickerCity, setClientPickerCity] = useState("");
  const [clientPickerResults, setClientPickerResults] = useState<any[]>([]);
  const [clientPickerTotal, setClientPickerTotal] = useState(0);
  const [clientPickerLoading, setClientPickerLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    clientId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    position: "",
  });
  const [creatingContact, setCreatingContact] = useState(false);
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const isPrivilegedUser = user?.role === "admin" || user?.role === "gerente_comercial";

  const computeQuoteStatus = (status: string, purchaseOrder: string, closeReason: string) => {
    if (status === "approved" && purchaseOrder) return { label: "Finalizada", color: "bg-green-500/20 text-green-300 border-green-500/30" };
    if (status === "approved" && closeReason) return { label: "Perdida", color: "bg-red-500/20 text-red-300 border-red-500/30" };
    if (status === "approved") return { label: "Finalizada", color: "bg-green-500/20 text-green-300 border-green-500/30" };
    if (status === "sent") return { label: "Enviada", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
    return { label: "En proceso", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
  };
  const currentSalesperson =
    salespeople.find(
      (s: any) => user?.id && Number(s.userId) === Number(user.id),
    ) || null;
  const [products, setProducts] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [saleConditions, setSaleConditions] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const dueDefault = new Date(Date.now() + 5 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState<any>({
    clientId: "",
    contactId: "",
    opportunityId: "",
    salespersonId: "",
    priceListId: "",
    saleConditionId: "",
    cuit: "",
    date: today,
    deliveryDate: "",
    dueDate: dueDefault,
    followupDate: "",
    currency: "USD",
    exchangeRate: "0",
    exchangeRateType: "DIVISA VENTA BNA",
    quoteStatus: "EN PROCESO",
    priority: "",
    quoteType: "",
    orderType: "",
    reference: "",
    status: "draft",
    purchaseOrder: "",
    closeReason: "",
  });
  const isLocked = !isNew && form.status === "approved";
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeLostReason, setCloseLostReason] = useState("");
  const [closeLostDetail, setCloseLostDetail] = useState("");
  const [closingQuote, setClosingQuote] = useState(false);
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const [savedQuote, setSavedQuote] = useState<{ id: number; number: string; clientId: number | null } | null>(null);
  const [showFollowup, setShowFollowup] = useState(false);
  const [followupForm, setFollowupForm] = useState({ date: "", time: "09:00", type: "call", notes: "" });
  const [savingFollowup, setSavingFollowup] = useState(false);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({ purchaseOrder: "", ocFile: null as File | null });
  const [converting, setConverting] = useState(false);
  const [usdRate, setUsdRate] = useState<{ sell: number | null; date: string | null; stale: boolean } | null>(null);

  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const loadLinkedTasks = () => {
    if (!id) return;
    fetch(`${API}/api/tasks?quoteId=${id}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setLinkedTasks(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  // Completion modal
  const [taskToComplete, setTaskToComplete] = useState<any>(null);
  const [completeNote, setCompleteNote] = useState("");
  const [savingComplete, setSavingComplete] = useState(false);

  const confirmCompleteTask = async () => {
    if (!taskToComplete) return;
    setSavingComplete(true);
    try {
      await fetch(`${API}/api/tasks/${taskToComplete.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed", completedAt: new Date().toISOString() }),
      });
      const clientId = taskToComplete.clientId || (form.clientId ? parseInt(form.clientId) : null);
      if (clientId) {
        const TASK_TO_ACT: Record<string, string> = {
          call: "call", meeting: "visit", email: "email",
          followup: "follow_up", task: "task", reminder: "task", visit: "visit",
        };
        const quoteRef = `COT-${String(id).padStart(5, "0")}`;
        await fetch(`${API}/api/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: TASK_TO_ACT[taskToComplete.type] || "task",
            title: taskToComplete.title,
            description: completeNote.trim() || `Tarea completada — ${quoteRef}`,
            clientId,
            outcome: completeNote.trim() || null,
            completedAt: new Date().toISOString(),
          }),
        });
      }
      setTaskToComplete(null);
      setCompleteNote("");
      loadLinkedTasks();
      toast({ title: "Tarea completada", description: clientId ? "Actividad registrada en la ficha del cliente" : undefined });
    } catch {
      toast({ title: "Error al completar", variant: "destructive" });
    } finally {
      setSavingComplete(false);
    }
  };

  // New linked task modal
  const [showNewLinkedTask, setShowNewLinkedTask] = useState(false);
  const [newLinkedTaskForm, setNewLinkedTaskForm] = useState({ type: "followup", dueDate: "", notes: "" });
  const [savingLinkedTask, setSavingLinkedTask] = useState(false);

  const saveNewLinkedTask = async () => {
    if (!newLinkedTaskForm.dueDate) {
      toast({ title: "La fecha es requerida", variant: "destructive" }); return;
    }
    setSavingLinkedTask(true);
    const TYPE_LABELS: Record<string, string> = {
      followup: "Seguimiento", call: "Llamada", meeting: "Reunión", visit: "Visita", task: "Tarea",
    };
    const clientName = clients.find((c: any) => String(c.id) === form.clientId)?.companyName || "";
    const quoteRef = `COT-${String(id).padStart(5, "0")}`;
    try {
      await fetch(`${API}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: `${TYPE_LABELS[newLinkedTaskForm.type] || "Tarea"} — ${quoteRef}${clientName ? ` (${clientName})` : ""}`,
          type: newLinkedTaskForm.type,
          description: newLinkedTaskForm.notes || null,
          dueDate: new Date(`${newLinkedTaskForm.dueDate}T09:00:00`).toISOString(),
          clientId: form.clientId ? parseInt(form.clientId) : null,
          quoteId: id,
          status: "pending",
          priority: "high",
          assignedTo: user?.id || null,
        }),
      });
      setShowNewLinkedTask(false);
      setNewLinkedTaskForm({ type: "followup", dueDate: "", notes: "" });
      loadLinkedTasks();
      toast({ title: "Tarea creada y vinculada a la cotización" });
    } catch {
      toast({ title: "Error al crear la tarea", variant: "destructive" });
    } finally {
      setSavingLinkedTask(false);
    }
  };

  const followupDateDefault = new Date(Date.now() + 3 * 86400000)
    .toISOString()
    .slice(0, 10);
  // ── Catalog modal state ──────────────────────────────────────────────────
  const [catalogModal, setCatalogModal] = useState<{
    open: boolean;
    type: "medidas" | "accesorios";
    lineIdx: number;
  } | null>(null);
  const [catalogModalSearch, setCatalogModalSearch] = useState("");
  const [catalogModalResults, setCatalogModalResults] = useState<any[]>([]);
  const [catalogModalTotal, setCatalogModalTotal] = useState(0);
  const [catalogModalPage, setCatalogModalPage] = useState(1);
  const [catalogModalLoading, setCatalogModalLoading] = useState(false);
  const catalogModalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [catalogFilters, setCatalogFilters] = useState(blankFilters);
  const [catalogFilterOpts, setCatalogFilterOpts] = useState<{
    categories: string[]; seamTypes: string[]; shapes: string[];
    accessoryTypes: string[]; accStandards: string[];
  }>({ categories: [], seamTypes: [], shapes: [], accessoryTypes: [], accStandards: [] });

  const fetchCatalogModal = useCallback(
    async (type: string, query: string, page: number, filters: typeof catalogFilters) => {
      setCatalogModalLoading(true);
      try {
        const p = new URLSearchParams({
          type,
          search: query.trim(),
          page: String(page),
          limit: String(CATALOG_PAGE_SIZE),
        });
        if (filters.category) p.set("category", filters.category);
        if (filters.seamType) p.set("seamType", filters.seamType);
        if (filters.shape) p.set("shape", filters.shape);
        if (filters.accessoryType) p.set("accessoryType", filters.accessoryType);
        if (filters.standard) p.set("standard", filters.standard);
        if (filters.hasPrice) p.set("hasPrice", "true");
        const r = await fetch(`${API}/api/products/catalog?${p}`, { credentials: "include" });
        const data = await r.json();
        setCatalogModalResults(data.data || []);
        setCatalogModalTotal(data.total || 0);
      } catch {
        setCatalogModalResults([]);
        setCatalogModalTotal(0);
      } finally {
        setCatalogModalLoading(false);
      }
    },
    [],
  );

  const openCatalogModal = (type: "medidas" | "accesorios", lineIdx: number) => {
    const fresh = blankFilters();
    setCatalogModal({ open: true, type, lineIdx });
    setCatalogModalSearch("");
    setCatalogModalPage(1);
    setCatalogModalResults([]);
    setCatalogModalTotal(0);
    setCatalogFilters(fresh);
    fetchCatalogModal(type, "", 1, fresh);
    fetch(`${API}/api/products/catalog/filters`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setCatalogFilterOpts(d))
      .catch(() => {});
  };

  const closeCatalogModal = () => {
    setCatalogModal(null);
    setCatalogModalSearch("");
    setCatalogModalResults([]);
    setCatalogFilters(blankFilters());
  };

  const selectCatalogItem = (p: any) => {
    if (!catalogModal) return;
    const price = p.sale_price ?? p.price ?? null;
    updateLine(catalogModal.lineIdx, {
      catalogType: catalogModal.type,
      productId: p.id,
      productName: p.name,
      productCode: p.code || "",
      unit: p.unit || "UN",
      unitPrice: price != null ? String(price) : "0",
    });
    closeCatalogModal();
  };

  useEffect(() => {
    fetch(`${API}/api/exchange-rate`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setUsdRate(d);
        if (isNew && d?.sell) {
          setForm((prev: any) => ({
            ...prev,
            exchangeRate: String(d.sell),
          }));
        }
      })
      .catch(() => {});
  }, [isNew]);

  useEffect(() => {
    const safe = (p: Promise<any>, fallback: any = []) =>
      p.catch(() => fallback);
    Promise.all([
      safe(
        fetch(`${API}/api/clients?limit=500`, { credentials: "include" }).then(
          (r) => r.json(),
        ),
        { data: [] },
      ),
      safe(
        fetch(`${API}/api/salespeople`, { credentials: "include", cache: "no-store" }).then((r) =>
          r.json(),
        ),
        [],
      ),
      safe(
        fetch(`${API}/api/products`, { credentials: "include" }).then((r) =>
          r.json(),
        ),
        [],
      ),
      safe(
        fetch(`${API}/api/price-lists`, { credentials: "include" }).then((r) =>
          r.json(),
        ),
        [],
      ),
      safe(
        fetch(`${API}/api/sale-conditions`, { credentials: "include" }).then(
          (r) => r.json(),
        ),
        [],
      ),
      safe(
        fetch(`${API}/api/opportunities`, { credentials: "include" }).then(
          (r) => r.json(),
        ),
        { data: [] },
      ),
    ]).then(([cl, sp, pr, pl, sc, op]) => {
      const spData: any[] = Array.isArray(sp) ? sp : [];
      setClients(cl.data || cl || []);
      setSalespeople(spData);
      setProducts(Array.isArray(pr) ? pr : pr.data || []);
      setPriceLists(pl || []);
      setSaleConditions(sc || []);
      setOpportunities(op.data || op || []);
      const def = (pl || []).find((x: any) => x.isDefault);
      if (def && isNew)
        setForm((f: any) => ({ ...f, priceListId: String(def.id) }));
      // Auto-asignación: usar ref para tener siempre el valor más actual del usuario
      if (isNew) {
        const latestUser = userRef.current;
        if (latestUser?.id) {
          const mySp = spData.find((s: any) => Number(s.userId) === Number(latestUser.id));
          if (mySp) {
            setForm((prev: any) =>
              prev.salespersonId ? prev : { ...prev, salespersonId: String(mySp.id) }
            );
          }
        }
      }
    });
  }, []);

  useEffect(() => {
    const term = clientSearch.trim();
    if (!term) {
      setClientSearchResults(clients.slice(0, 20));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/clients?search=${encodeURIComponent(term)}&limit=20`, { credentials: "include" });
        const res = await r.json();
        setClientSearchResults(res.data || res || []);
      } catch {
        const lower = term.toLowerCase();
        setClientSearchResults(
          clients.filter((c: any) =>
            String(c.companyName || "").toLowerCase().includes(lower) ||
            String(c.taxId || "").toLowerCase().includes(lower)
          ).slice(0, 20)
        );
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [clientSearch, clients]);

  // Client picker modal search
  useEffect(() => {
    if (!clientPickerOpen) return;
    setClientPickerLoading(true);
    const timer = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ limit: "500" });
        if (clientPickerSearch.trim()) p.set("search", clientPickerSearch.trim());
        if (clientPickerStatus !== "all") p.set("status", clientPickerStatus);
        const r = await fetch(`${API}/api/clients?${p}`, { credentials: "include" });
        const res = await r.json();
        const data: any[] = res.data || res || [];
        const filtered = clientPickerCity.trim()
          ? data.filter((c: any) => String(c.city || "").toLowerCase().includes(clientPickerCity.toLowerCase()))
          : data;
        setClientPickerResults(filtered);
        setClientPickerTotal(res.total ?? filtered.length);
      } catch {
        setClientPickerResults([]);
        setClientPickerTotal(0);
      } finally {
        setClientPickerLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [clientPickerOpen, clientPickerSearch, clientPickerStatus, clientPickerCity]);

  // Auto-fill CUIT only for NEW quotes (editing preserves the saved value)
  useEffect(() => {
    if (!isNew) return;
    const client = clients.find((c: any) => String(c.id) === form.clientId);
    if (client?.taxId)
      setForm((prev: any) => ({ ...prev, cuit: client.taxId || "" }));
  }, [form.clientId, clients]);

  // Initialize client search text when editing an existing quote
  useEffect(() => {
    if (isNew || !form.clientId || clientSearch || clients.length === 0) return;
    const client = clients.find((c: any) => String(c.id) === form.clientId);
    if (client) setClientSearch(client.companyName || "");
  }, [form.clientId, clients]);

  useEffect(() => {
    if (!isNew || !user?.id || salespeople.length === 0) return;
    const sp = salespeople.find(
      (s: any) => Number(s.userId) === Number(user.id),
    );
    if (!sp) return;
    setForm((prev: any) =>
      prev.salespersonId ? prev : { ...prev, salespersonId: String(sp.id) },
    );
  }, [isNew, user, salespeople]);

  useEffect(() => {
    if (!form.clientId) {
      setContacts([]);
      return;
    }
    fetch(`${API}/api/contacts?clientId=${form.clientId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setContacts(Array.isArray(d) ? d : d.data || []));
  }, [form.clientId]);

  const createContact = async () => {
    if (
      !form.clientId ||
      !newContactForm.firstName.trim() ||
      !newContactForm.lastName.trim() ||
      !newContactForm.email.trim() ||
      !newContactForm.phone.trim() ||
      !newContactForm.address.trim() ||
      !newContactForm.city.trim() ||
      !newContactForm.position.trim()
    ) {
      toast({
        title: "Completa todos los campos del contacto",
        variant: "destructive",
      });
      return;
    }
    setCreatingContact(true);
    try {
      const r = await fetch(`${API}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...newContactForm,
          clientId: parseInt(form.clientId),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al crear contacto");
      setContacts((prev) => [...prev, data]);
      setForm((prev) => ({ ...prev, contactId: String(data.id) }));
      setNewContactOpen(false);
      setNewContactForm({
        clientId: form.clientId,
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        position: "",
      });
      toast({ title: "Contacto creado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreatingContact(false);
    }
  };

  useEffect(() => { if (!isNew && id) loadLinkedTasks(); }, [id, isNew]);

  // Auto-assign salesperson when creating new quote (vendor pre-fills themselves)
  useEffect(() => {
    if (isNew && currentSalesperson && !form.salespersonId) {
      setForm((prev: any) => ({ ...prev, salespersonId: String(currentSalesperson.id) }));
    }
  }, [isNew, currentSalesperson?.id]);

  // Pre-fill from URL params when creating from an opportunity
  useEffect(() => {
    if (!isNew) return;
    const updates: any = {};
    if (urlOpportunityId) updates.opportunityId = urlOpportunityId;
    if (urlClientId) updates.clientId = urlClientId;
    if (Object.keys(updates).length > 0) {
      setForm((prev: any) => ({ ...prev, ...updates }));
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew || !id) return;
    fetch(`${API}/api/quotes/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((q) => {
        setForm({
          clientId: q.clientId ? String(q.clientId) : "",
          contactId: q.contactId ? String(q.contactId) : "",
          opportunityId: q.opportunityId ? String(q.opportunityId) : "",
          salespersonId: q.salespersonId ? String(q.salespersonId) : "",
          priceListId: q.priceListId ? String(q.priceListId) : "",
          saleConditionId: q.saleConditionId ? String(q.saleConditionId) : "",
          cuit: q.cuit || "",
          date: q.date ? q.date.slice(0, 10) : today,
          deliveryDate: q.deliveryDate ? q.deliveryDate.slice(0, 10) : "",
          dueDate: q.dueDate ? q.dueDate.slice(0, 10) : "",
          followupDate: q.followupDate ? q.followupDate.slice(0, 10) : "",
          currency: q.currency || "USD",
          exchangeRate: q.exchangeRate || "0",
          exchangeRateType: q.exchangeRateType || "DIVISA VENTA BNA",
          quoteStatus: q.quoteStatus || "EN PROCESO",
          priority: q.priority || "",
          quoteType: q.quoteType || "",
          orderType: q.orderType || "",
          reference: q.reference || "",
          status: q.status || "draft",
          purchaseOrder: q.purchaseOrder || "",
          closeReason: q.closeReason || "",
          createdBy: q.createdBy ?? null,
          createdByName: q.createdByName || "",
        });
        setLines(
          (q.lines || []).map((l: any) => ({
            id: l.id,
            productType: l.productType || "REVENTA",
            productId: l.productId,
            productName: l.productName || "",
            productCode: l.productCode || "",
            unit: l.unit || "UN",
            quantity: String(l.quantity ?? 1),
            quantityKg: String(l.quantityKg ?? 0),
            unitPrice: String(l.unitPrice ?? 0),
            unitPriceUm: String(l.unitPriceUm ?? 0),
            netTotal: String(l.netTotal ?? 0),
            deliveryTime: l.deliveryTime || "",
            clientCode: l.clientCode || "",
            notes: l.notes || "",
          })),
        );
      });
  }, [id]);

  const totals = lines.reduce(
    (acc, l) => {
      const q = parseFloat(l.quantity) || 0;
      const p = parseFloat(l.unitPrice) || 0;
      const kg = parseFloat(l.quantityKg) || 0;
      const net = q * p;
      acc.net += net;
      acc.kg += kg;
      return acc;
    },
    { net: 0, kg: 0 },
  );
  const avgKg = totals.kg > 0 ? totals.net / totals.kg : 0;

  const addLine = () => setLines([...lines, blankLine()]);
  const updateLine = (i: number, patch: Partial<Line>) => {
    const newLines = [...lines];
    newLines[i] = { ...newLines[i], ...patch };
    const q = parseFloat(newLines[i].quantity) || 0;
    const p = parseFloat(newLines[i].unitPrice) || 0;
    newLines[i].netTotal = String((q * p).toFixed(2));
    setLines(newLines);
  };
  const removeLine = (i: number) =>
    setLines(lines.filter((_, idx) => idx !== i));
  const setProductInLine = (i: number, productId: string) => {
    const p = products.find((x: any) => x.id === parseInt(productId));
    if (!p) return;
    updateLine(i, {
      productId: p.id,
      productName: p.name,
      productCode: p.code || "",
      unit: p.unit || "UN",
      unitPrice: String(
        p.price ?? p.unitPrice ?? p.salePrice ?? p.priceUm ?? p.sale_price ?? 0,
      ),
    });
  };

  const save = async () => {
    // Block prospect clients
    const selectedClient = clients.find((c: any) => String(c.id) === String(form.clientId));
    if (selectedClient?.status === "prospect") {
      toast({
        title: "Cliente prospecto — no se puede cotizar",
        description: "Actualizá el estado del cliente a Potencial o Final antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    const required = [
      ["clientId", "Cliente"],
      ["cuit", "CUIT"],
      ["saleConditionId", "Condición de venta"],
      ["date", "Fecha"],
      ["exchangeRate", "Tasa de cambio"],
      ["status", "Estado"],
      ["priority", "Prioridad"],
      ["quoteType", "Tipo de cotización"],
      ["salespersonId", "Vendedor"],
      ["orderType", "Tipo de orden"],
    ] as const;
    const missing = required.find(([key]) => !String(form[key] || "").trim());
    if (missing) {
      toast({ title: `${missing[1]} es requerido`, variant: "destructive" });
      return;
    }
    const body: any = {
      clientId: parseInt(form.clientId),
      contactId: form.contactId ? parseInt(form.contactId) : null,
      opportunityId: form.opportunityId ? parseInt(form.opportunityId) : null,
      salespersonId: form.salespersonId ? parseInt(form.salespersonId) : null,
      priceListId: form.priceListId ? parseInt(form.priceListId) : null,
      saleConditionId: form.saleConditionId ? parseInt(form.saleConditionId) : null,
      cuit: form.cuit,
      date: form.date,
      deliveryDate: form.deliveryDate || null,
      dueDate: form.dueDate || null,
      followupDate: form.followupDate || null,
      currency: form.currency,
      exchangeRate: form.exchangeRate,
      exchangeRateType: form.exchangeRateType,
      quoteStatus: form.quoteStatus,
      status: form.status,
      priority: form.priority,
      quoteType: form.quoteType,
      orderType: form.orderType,
      reference: form.reference || null,
      lines: lines
        .filter((l) => l.productName)
        .map((l, idx) => ({
          lineNumber: idx + 1,
          productType: l.productType || null,
          productId: l.productId || null,
          productName: l.productName,
          productCode: l.productCode || null,
          unit: l.unit || null,
          quantity: l.quantity,
          quantityKg: l.quantityKg,
          unitPrice: l.unitPrice,
          unitPriceUm: l.unitPriceUm,
          netTotal: l.netTotal,
          deliveryTime: l.deliveryTime || null,
          notes: l.notes || null,
        })),
    };
    const url = isNew ? `${API}/api/quotes` : `${API}/api/quotes/${id}`;
    const r = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const data = await r.json();
      if (isNew) {
        setSavedQuote({ id: data.id, number: data.number || `#${data.id}`, clientId: data.clientId });
        if (data.taskCreated) {
          const spName = salespeople.find((s: any) => String(s.id) === form.salespersonId)?.name;
          toast({
            title: "Cotización creada",
            description: `Tarea de seguimiento asignada a ${spName || "el vendedor responsable"}`,
          });
          setLocation(`/quotes/${data.id}`);
        } else {
          toast({ title: "Cotización guardada" });
          setShowFollowup(true);
        }
      } else {
        toast({ title: "Cotización guardada" });
      }
    } else {
      let errMsg = "Error al guardar";
      try {
        const errData = await r.json();
        if (errData?.error) errMsg = errData.error;
      } catch {}
      toast({ title: errMsg, variant: "destructive" });
    }
  };

  const scheduleFollowup = async () => {
    if (!followupForm.date) {
      toast({ title: "La fecha es requerida", variant: "destructive" });
      return;
    }
    setSavingFollowup(true);
    try {
      const dueDate = new Date(
        `${followupForm.date}T${followupForm.time || "09:00"}:00`,
      );
      const clientName =
        clients.find((c) => c.id === savedQuote?.clientId)?.companyName || "";
      const typeLabel: Record<string, string> = {
        call: "Llamada",
        visit: "Visita",
        meeting: "Reunión",
      };
      const title =
        `${typeLabel[followupForm.type] || "Seguimiento"} - ${savedQuote?.number} ${clientName ? `(${clientName})` : ""}`.trim();
      await fetch(`${API}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          type: followupForm.type,
          description: followupForm.notes || null,
          dueDate: dueDate.toISOString(),
          clientId: savedQuote?.clientId || null,
          quoteId: savedQuote?.id || null,
          status: "pending",
          priority: "high",
        }),
      });
      toast({ title: "Seguimiento agendado en el calendario" });
      setShowFollowup(false);
      if (savedQuote) setLocation(`/quotes/${savedQuote.id}`);
    } catch {
      toast({
        title: "Error al agendar el seguimiento",
        variant: "destructive",
      });
    } finally {
      setSavingFollowup(false);
    }
  };

  const skipFollowup = () => {
    setShowFollowup(false);
    if (savedQuote) setLocation(`/quotes/${savedQuote.id}`);
  };

  const convertToOrder = () => {
    setConvertForm({ purchaseOrder: "", ocFile: null });
    setShowConvertModal(true);
  };

  const handleCloseQuote = async () => {
    if (!closeLostReason) {
      toast({ title: "Seleccioná el motivo de pérdida", variant: "destructive" });
      return;
    }
    const closeReason = closeLostDetail.trim()
      ? `${closeLostReason}: ${closeLostDetail.trim()}`
      : closeLostReason;
    setClosingQuote(true);
    try {
      const r = await fetch(`${API}/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "approved", closeReason }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Error al cerrar");
      }
      const updated = await r.json();
      setForm((prev: any) => ({ ...prev, status: updated.status, quoteStatus: updated.quoteStatus || "PERDIDA", closeReason: updated.closeReason || closeReason }));
      setShowCloseModal(false);
      setCloseLostReason("");
      setCloseLostDetail("");
      toast({ title: "Cotización marcada como perdida" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setClosingQuote(false);
    }
  };

  const doConvertToOrder = async () => {
    if (!convertForm.purchaseOrder.trim()) {
      toast({ title: "El número de OC es obligatorio", variant: "destructive" });
      return;
    }
    if (!convertForm.ocFile) {
      toast({ title: "El PDF de la OC es obligatorio", variant: "destructive" });
      return;
    }
    setConverting(true);
    try {
      // 1. Convert the quote to order
      const r = await fetch(`${API}/api/quotes/${id}/convert-to-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ purchaseOrder: convertForm.purchaseOrder.trim() }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Error al convertir");
      }
      const j = await r.json();

      // 2. Upload the OC PDF and link it to the new order
      try {
        const file = convertForm.ocFile;
        const urlReq = await fetch(`${API}/api/storage/uploads/request-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (urlReq.ok) {
          const { uploadURL, objectPath } = await urlReq.json();
          await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          await fetch(`${API}/api/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              entityType: "order", entityId: j.orderId,
              fileName: file.name, mimeType: file.type,
              sizeBytes: file.size, storageKey: objectPath,
            }),
          });
        }
      } catch {
        // PDF upload failed but order was created — inform the user
        toast({ title: `Pedido ${j.orderNumber} creado (el PDF no se pudo subir)`, variant: "destructive" });
        setShowConvertModal(false);
        setLocation(`/orders/${j.orderId}`);
        return;
      }

      toast({ title: `Pedido ${j.orderNumber} creado con OC adjunta` });
      setShowConvertModal(false);
      setLocation(`/orders/${j.orderId}`);
    } catch (e: any) {
      toast({ title: e.message || "Error al convertir", variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Cotización de venta / {isNew ? "Nuevo" : `#${id}`}
            </h1>
            {usdRate?.sell && (
              <div className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${usdRate.stale ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                <span className="font-semibold">USD BNA venta:</span>
                <span>${usdRate.sell.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                {usdRate.date && <span className="opacity-60">· {usdRate.date}</span>}
                {usdRate.stale && <span className="opacity-70">(desactualizado)</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  `${import.meta.env.VITE_API_URL || ""}/api/quotes/${params!.id}/pdf`,
                  "_blank",
                )
              }
            >
              <FileText className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          )}
          {!isNew && !isLocked && (
            <Button variant="outline" onClick={convertToOrder}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Confirmar pedido
            </Button>
          )}
          {!isNew && !isLocked && (
            <Button variant="outline" className="text-amber-400 border-amber-500/40 hover:bg-amber-500/10" onClick={() => { setCloseLostReason(""); setCloseLostDetail(""); setShowCloseModal(true); }}>
              <AlertCircle className="w-4 h-4 mr-2" />
              Cerrar cotización
            </Button>
          )}
          {!isLocked && (
            <Button onClick={save}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            {form.purchaseOrder ? (
              <>
                <p className="font-medium text-sm">Cotización confirmada con OC — solo lectura</p>
                <p className="text-xs opacity-80 mt-0.5">Confirmada con la OC <strong>{form.purchaseOrder}</strong>. No puede modificarse.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-sm">Cotización cerrada — solo lectura</p>
                {form.closeReason && <p className="text-xs opacity-80 mt-0.5">Motivo: {form.closeReason}</p>}
              </>
            )}
          </div>
        </div>
      )}

      <div className={isLocked ? "pointer-events-none opacity-70 select-none" : ""}>
      <Card className="mb-4">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cliente *</Label>
              {/* ── Client picker trigger ── */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setClientPickerOpen(true);
                  setClientPickerSearch("");
                  setClientPickerStatus("all");
                  setClientPickerCity("");
                }}
                className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm hover:border-primary/60 transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {form.clientId ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate font-medium">
                      {clients.find((c: any) => String(c.id) === form.clientId)?.companyName || clientSearch || "—"}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>Seleccionar cliente...</span>
                  </span>
                )}
                <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              {form.clientId && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive mt-1 flex items-center gap-1 transition-colors"
                  onClick={() => { setForm((p: any) => ({ ...p, clientId: "", cuit: "", contactId: "" })); setClientSearch(""); }}
                >
                  <X className="w-3 h-3" /> Quitar cliente
                </button>
              )}
              {/* Prospect warning banner */}
              {(() => {
                const sel = clients.find((c: any) => String(c.id) === String(form.clientId));
                if (!sel || sel.status !== "prospect") return null;
                return (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-400">Cliente prospecto — no se puede cotizar</p>
                      <p className="text-xs text-orange-300/80 mt-0.5">
                        Actualizá el estado del cliente a <strong>Potencial</strong> o <strong>Final</strong> antes de crear una cotización.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <Label>CUIT *</Label>
              <Input
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
              />
            </div>

            <div>
              <Label>Condición de venta *</Label>
              <Select
                value={form.saleConditionId}
                onValueChange={(v) => setForm({ ...form, saleConditionId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {saleConditions.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label>Contacto Asignado</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewContactOpen(true)}
                  disabled={!form.clientId}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nuevo contacto
                </Button>
              </div>
              <Select
                value={form.contactId}
                onValueChange={(v) => setForm({ ...form, contactId: v })}
                disabled={!form.clientId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      form.clientId
                        ? "Seleccionar contacto..."
                        : "Primero elegí cliente"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.fullName || c.name}{c.position ? ` (${c.position})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha de entrega</Label>
              <Input
                type="date"
                value={form.deliveryDate}
                onChange={(e) =>
                  setForm({ ...form, deliveryDate: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Lista de precios *</Label>
              <Select
                value={form.priceListId}
                onValueChange={(v) => setForm({ ...form, priceListId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {priceLists.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de vencimiento</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            <div>
              <Label>Moneda *</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm({ ...form, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">Dólar - u$s</SelectItem>
                  <SelectItem value="ARS">Pesos - $</SelectItem>
                  <SelectItem value="EUR">Euro - €</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tasa de cambio *</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.exchangeRate}
                onChange={(e) =>
                  setForm({ ...form, exchangeRate: e.target.value })
                }
              />
            </div>

            <div className="col-span-2">
              <Label>Tipo de cambio</Label>
              <Select
                value={form.exchangeRateType}
                onValueChange={(v) => setForm({ ...form, exchangeRateType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIVISA VENTA BNA">
                    DIVISA VENTA BNA
                  </SelectItem>
                  <SelectItem value="DIVISA COMPRA BNA">
                    DIVISA COMPRA BNA
                  </SelectItem>
                  <SelectItem value="DOLAR MEP">DOLAR MEP</SelectItem>
                  <SelectItem value="DOLAR BLUE">DOLAR BLUE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Precio medio por Kg</Label>
              <Input value={avgKg.toFixed(4)} disabled />
            </div>
            <div>
              <Label>Monto neto</Label>
              <Input value={totals.net.toFixed(2)} disabled />
            </div>
            <div>
              <Label>Total Kg</Label>
              <Input value={totals.kg.toFixed(2)} disabled />
            </div>
            <div>
              <Label>Total</Label>
              <Input
                value={totals.net.toFixed(2)}
                disabled
                className="font-bold text-lg"
              />
            </div>

            <div>
              <Label>Estado de cotización</Label>
              <div className="mt-1.5">
                <Badge className={`text-sm px-3 py-1 ${computeQuoteStatus(form.status, form.purchaseOrder, form.closeReason).color}`}>
                  {computeQuoteStatus(form.status, form.purchaseOrder, form.closeReason).label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Se actualiza automáticamente según el estado</p>
              </div>
            </div>
            <div>
              <Label>Estado *</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridad</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NINGUNA">NINGUNA</SelectItem>
                  <SelectItem value="BAJA">BAJA</SelectItem>
                  <SelectItem value="MEDIA">MEDIA</SelectItem>
                  <SelectItem value="ALTA">ALTA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de cotización</Label>
              <Select
                value={form.quoteType}
                onValueChange={(v) => setForm({ ...form, quoteType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COTIZACION">COTIZACION</SelectItem>
                  <SelectItem value="LICITACION">LICITACION</SelectItem>
                  <SelectItem value="OFERTA">OFERTA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Creado por
              </Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border/50 bg-muted/30 text-sm text-muted-foreground">
                <span className="truncate">
                  {isNew
                    ? (user?.fullName || user?.username || "—")
                    : (form.createdByName || user?.fullName || user?.username || "—")}
                </span>
                {(isNew || form.createdBy === user?.id) && (
                  <Badge variant="outline" className="text-xs ml-auto shrink-0">Tú</Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                Responsable de seguimiento *
              </Label>
              <Select
                value={form.salespersonId}
                onValueChange={(v) => setForm({ ...form, salespersonId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  {salespeople.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Se le asignará una tarea de seguimiento automáticamente</p>
            </div>
            <div>
              <Label>Tipo de orden</Label>
              <Select
                value={form.orderType}
                onValueChange={(v) => setForm({ ...form, orderType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVENTA">REVENTA</SelectItem>
                  <SelectItem value="PRODUCCION">PRODUCCION</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Referencia de Cliente</Label>
              <Input
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Client Picker Modal ─────────────────────────────────────────── */}
      <Dialog open={clientPickerOpen} onOpenChange={(v) => { setClientPickerOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Buscar cliente
            </DialogTitle>
            <DialogDescription className="sr-only">Búsqueda avanzada de clientes</DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="px-6 py-3 border-b border-border/40 shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar por nombre o CUIT..."
                className="pl-9"
                value={clientPickerSearch}
                onChange={(e) => setClientPickerSearch(e.target.value)}
              />
              {clientPickerSearch && (
                <button type="button" onClick={() => setClientPickerSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por ciudad..."
                    className="pl-8 h-8 text-sm"
                    value={clientPickerCity}
                    onChange={(e) => setClientPickerCity(e.target.value)}
                  />
                </div>
              </div>
              <Select value={clientPickerStatus} onValueChange={setClientPickerStatus}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="potential">Potenciales</SelectItem>
                  <SelectItem value="final">Finales</SelectItem>
                  <SelectItem value="prospect">Prospectos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {clientPickerLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : clientPickerResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No se encontraron clientes
              </div>
            ) : (
              <>
                <div className="px-6 py-2 text-xs text-muted-foreground border-b border-border/30">
                  {clientPickerTotal} resultado{clientPickerTotal !== 1 ? "s" : ""}
                </div>
                <div className="divide-y divide-border/30">
                  {clientPickerResults.map((c: any) => {
                    const statusColors: Record<string, string> = {
                      prospect: "bg-orange-500/15 text-orange-400 border-orange-500/30",
                      potential: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                      final: "bg-green-500/15 text-green-400 border-green-500/30",
                      inactive: "bg-gray-500/15 text-gray-400 border-gray-500/30",
                    };
                    const statusLabels: Record<string, string> = {
                      prospect: "Prospecto", potential: "Potencial",
                      final: "Final", inactive: "Inactivo",
                    };
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-6 py-3 hover:bg-accent/40 transition-colors flex items-center gap-4"
                        onClick={() => {
                          setForm((prev: any) => ({
                            ...prev,
                            clientId: String(c.id),
                            cuit: c.taxId || "",
                            contactId: "",
                          }));
                          setClientSearch(c.companyName || "");
                          setClientPickerOpen(false);
                        }}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{c.companyName}</span>
                            {c.status && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${statusColors[c.status] || ""}`}>
                                {statusLabels[c.status] || c.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            {c.taxId && <span>CUIT: {c.taxId}</span>}
                            {c.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{c.city}
                              </span>
                            )}
                            {c.industry && <span className="truncate">{c.industry}</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-3 border-t border-border/50 shrink-0 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setClientPickerOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
        <DialogContent aria-describedby="new-contact-description">
          <DialogHeader>
            <DialogTitle>Nuevo contacto</DialogTitle>
            <DialogDescription id="new-contact-description">
              Se creará para la empresa seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={newContactForm.firstName}
                  onChange={(e) =>
                    setNewContactForm((f) => ({
                      ...f,
                      firstName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Apellido *</Label>
                <Input
                  value={newContactForm.lastName}
                  onChange={(e) =>
                    setNewContactForm((f) => ({
                      ...f,
                      lastName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>TELEFONO *</Label>
                <Input
                  value={newContactForm.phone}
                  onChange={(e) =>
                    setNewContactForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>EMAIL *</Label>
                <Input
                  type="email"
                  value={newContactForm.email}
                  onChange={(e) =>
                    setNewContactForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>DIRECCION *</Label>
                <Input
                  value={newContactForm.address}
                  onChange={(e) =>
                    setNewContactForm((f) => ({
                      ...f,
                      address: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>CIUDAD *</Label>
                <Input
                  value={newContactForm.city}
                  onChange={(e) =>
                    setNewContactForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>ROL *</Label>
              <Input
                value={newContactForm.position}
                onChange={(e) =>
                  setNewContactForm((f) => ({ ...f, position: e.target.value }))
                }
              />
            </div>
            <Button
              className="w-full"
              type="button"
              onClick={createContact}
              disabled={creatingContact}
            >
              {creatingContact ? "Creando..." : "Crear y asignar"}
            </Button>
            
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Líneas</h2>
            <Button size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar línea
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50">
                <tr className="text-left text-xs text-muted-foreground uppercase">
                  <th className="p-2 w-10">#</th>
                  <th className="p-2 min-w-[110px]">Tipo</th>
                  <th className="p-2 min-w-[280px]">Producto</th>
                  <th className="p-2 w-20">UM</th>
                  <th className="p-2 w-28">Cantidad</th>
                  <th className="p-2 w-28">Cant. Kg</th>
                  <th className="p-2 w-32">Precio</th>
                  <th className="p-2 w-32 text-right">Total neto</th>
                  <th className="p-2 w-28">Plazo</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2">
                      <Select
                        value={l.productType}
                        onValueChange={(v) => updateLine(i, { productType: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REVENTA">REVENTA</SelectItem>
                          <SelectItem value="PRODUCCION">PRODUCCION</SelectItem>
                          <SelectItem value="SERVICIO">SERVICIO</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <div className="min-w-[260px] space-y-1">
                        {/* Catalog modal buttons */}
                        <div className="flex gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => openCatalogModal("medidas", i)}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border font-medium transition-colors border-blue-500/50 text-blue-300 hover:bg-blue-600/20"
                          >
                            <Package className="w-2.5 h-2.5" />
                            Medidas
                          </button>
                          <button
                            type="button"
                            onClick={() => openCatalogModal("accesorios", i)}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border font-medium transition-colors border-amber-500/50 text-amber-300 hover:bg-amber-600/20"
                          >
                            <Package className="w-2.5 h-2.5" />
                            Accesorios
                          </button>
                          {l.catalogType && (
                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                              l.catalogType === "medidas"
                                ? "bg-blue-600/20 text-blue-300"
                                : "bg-amber-600/20 text-amber-300"
                            }`}>
                              {l.catalogType === "medidas" ? "Medida" : "Accesorio"}
                            </span>
                          )}
                        </div>
                        {/* Free-text name input */}
                        <Input
                          className="h-8 text-xs"
                          placeholder="Descripción del producto..."
                          value={l.productName || ""}
                          onChange={(e) =>
                            updateLine(i, {
                              productName: e.target.value,
                              productId: null,
                              catalogType: "",
                            })
                          }
                        />
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8 text-xs w-16"
                        value={l.unit}
                        onChange={(e) =>
                          updateLine(i, { unit: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(i, { quantity: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={l.quantityKg}
                        onChange={(e) =>
                          updateLine(i, { quantityKg: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={l.unitPrice}
                        onChange={(e) =>
                          updateLine(i, { unitPrice: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2 text-right font-mono text-xs">
                      {(
                        parseFloat(l.quantity || "0") *
                        parseFloat(l.unitPrice || "0")
                      ).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8 text-xs w-full"
                        value={l.deliveryTime || ""}
                        onChange={(e) =>
                          updateLine(i, { deliveryTime: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-6 text-center text-muted-foreground"
                    >
                      Sin líneas. Agregá una línea.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-border/50 font-bold">
                <tr>
                  <td colSpan={5}></td>
                  <td className="p-2 text-right">{totals.kg.toFixed(2)} kg</td>
                  <td></td>
                  <td className="p-2 text-right text-lg">
                    {totals.net.toFixed(2)} {form.currency}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      {!isNew && id && (
        <div className="mt-4">
          <DocumentUploader entityType="quote" entityId={id} />
        </div>
      )}

      </div>{/* end isLocked wrapper */}

      {/* ── Tareas vinculadas ── */}
      {!isNew && id && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-primary" />
                Tareas vinculadas
                {linkedTasks.length > 0 && (
                  <Badge variant="outline" className="text-xs ml-1">{linkedTasks.length}</Badge>
                )}
              </h3>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadLinkedTasks}>
                  Actualizar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setShowNewLinkedTask(true); setNewLinkedTaskForm({ type: "followup", dueDate: "", notes: "" }); }}>
                  <Plus className="w-3 h-3" />Nueva tarea
                </Button>
              </div>
            </div>

            {linkedTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sin tareas vinculadas a esta cotización</p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((t: any) => {
                  const isOverdue = t.status !== "completed" && t.dueDate && new Date(t.dueDate) < new Date();
                  const statusColor =
                    t.status === "completed"  ? "bg-green-500/20 text-green-300 border-green-500/30" :
                    t.status === "in_progress" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                    isOverdue                  ? "bg-red-500/20 text-red-300 border-red-500/30" :
                                                 "bg-amber-500/20 text-amber-300 border-amber-500/30";
                  const statusLabel =
                    t.status === "completed"   ? "Completada" :
                    t.status === "in_progress" ? "En progreso" :
                    isOverdue                  ? "Vencida" : "Pendiente";
                  const typeLabel: Record<string, string> = {
                    followup: "Seguimiento", call: "Llamada", meeting: "Reunión",
                    visit: "Visita", task: "Tarea", reminder: "Recordatorio",
                  };
                  return (
                    <div key={t.id} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${t.status === "completed" ? "opacity-60 border-border/30 bg-white/2" : "border-border/50 bg-white/5"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium truncate max-w-xs">{t.title}</span>
                          <Badge className={`text-xs shrink-0 ${statusColor}`}>{statusLabel}</Badge>
                          {typeLabel[t.type] && (
                            <Badge variant="outline" className="text-xs shrink-0">{typeLabel[t.type]}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {t.dueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue && t.status !== "completed" ? "text-red-400" : ""}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(t.dueDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                          {t.assigneeName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {t.assigneeName}
                            </span>
                          )}
                          {t.description && (
                            <span className="truncate max-w-xs">{t.description}</span>
                          )}
                        </div>
                      </div>
                      {t.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          title="Completar y agregar nota"
                          onClick={() => { setTaskToComplete(t); setCompleteNote(""); }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal: Completar tarea con nota ── */}
      <Dialog open={!!taskToComplete} onOpenChange={(open) => { if (!open) { setTaskToComplete(null); setCompleteNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Completar tarea
            </DialogTitle>
            <DialogDescription>
              {taskToComplete?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Nota / resultado <span className="text-muted-foreground/60">(opcional)</span>
              </label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                placeholder="¿Cómo resultó? ¿Qué se acordó? ¿Próximos pasos?"
                value={completeNote}
                onChange={e => setCompleteNote(e.target.value)}
                autoFocus
              />
            </div>
            {form.clientId && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                <Activity className="w-3 h-3 text-primary shrink-0" />
                Esta acción registrará una actividad en la ficha del cliente
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setTaskToComplete(null); setCompleteNote(""); }}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-500 text-white"
              onClick={confirmCompleteTask}
              disabled={savingComplete}
            >
              {savingComplete ? "Guardando…" : "Marcar como completada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nueva tarea vinculada ── */}
      <Dialog open={showNewLinkedTask} onOpenChange={setShowNewLinkedTask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              Nueva tarea vinculada
            </DialogTitle>
            <DialogDescription>
              La tarea quedará asociada a esta cotización y al cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de tarea</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={newLinkedTaskForm.type}
                onChange={e => setNewLinkedTaskForm(f => ({ ...f, type: e.target.value }))}
              >
                <option value="followup">Seguimiento</option>
                <option value="call">Llamada</option>
                <option value="meeting">Reunión</option>
                <option value="visit">Visita</option>
                <option value="task">Tarea</option>
                <option value="reminder">Recordatorio</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fecha límite <span className="text-red-400">*</span></label>
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={newLinkedTaskForm.dueDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setNewLinkedTaskForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descripción / notas <span className="text-muted-foreground/60">(opcional)</span></label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
                placeholder="¿Qué hay que hacer o verificar?"
                value={newLinkedTaskForm.notes}
                onChange={e => setNewLinkedTaskForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 border border-border/40 rounded-md px-3 py-2">
              <User className="w-3 h-3 shrink-0" />
              Se asignará a tu usuario. Podés reasignarla desde el módulo de Tareas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewLinkedTask(false)}>Cancelar</Button>
            <Button onClick={saveNewLinkedTask} disabled={savingLinkedTask || !newLinkedTaskForm.dueDate}>
              {savingLinkedTask ? "Creando…" : "Crear tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Cerrar Cotización (Perdida) ── */}
      <Dialog open={showCloseModal} onOpenChange={(open) => { setShowCloseModal(open); if (!open) { setCloseLostReason(""); setCloseLostDetail(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Marcar cotización como perdida
            </DialogTitle>
            <DialogDescription>
              Esta acción cierra la cotización sin OC. Seleccioná el motivo principal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm">Motivo de pérdida <span className="text-destructive">*</span></Label>
              <Select value={closeLostReason} onValueChange={setCloseLostReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccioná el motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRECIO">PRECIO — competidor más barato</SelectItem>
                  <SelectItem value="FLETE">FLETE — costo de envío fuera de rango</SelectItem>
                  <SelectItem value="PLAZO DE ENTREGA">PLAZO DE ENTREGA — el cliente necesitaba antes</SelectItem>
                  <SelectItem value="CONDICIÓN DE PAGO">CONDICIÓN DE PAGO — no se adaptó al crédito</SelectItem>
                  <SelectItem value="COMPETENCIA">COMPETENCIA — fue con otro proveedor</SelectItem>
                  <SelectItem value="ESPECIFICACIÓN TÉCNICA">ESPECIFICACIÓN TÉCNICA — el producto no cumplía requisitos</SelectItem>
                  <SelectItem value="CLIENTE DESISTIÓ">CLIENTE DESISTIÓ — proyecto cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Descripción adicional <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder="Detalle adicional o contexto del cierre..."
                value={closeLostDetail}
                onChange={(e) => setCloseLostDetail(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCloseModal(false)} disabled={closingQuote}>
                Cancelar
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={handleCloseQuote}
                disabled={closingQuote || !closeLostReason}
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                {closingQuote ? "Cerrando..." : "Confirmar pérdida"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Convertir a Pedido ── */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Convertir a Pedido
            </DialogTitle>
            <DialogDescription>
              Ingresá el número de Orden de Compra y adjuntá el PDF. Ambos son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium mb-1.5">
                Número de OC <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ej: OC-2024-00123"
                value={convertForm.purchaseOrder}
                onChange={(e) => setConvertForm((p) => ({ ...p, purchaseOrder: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5">
                PDF de la OC <span className="text-destructive">*</span>
              </Label>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setConvertForm((p) => ({ ...p, ocFile: f }));
                  }}
                />
                {convertForm.ocFile ? (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <FileText className="w-5 h-5" />
                    <span className="truncate max-w-[220px]">{convertForm.ocFile.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
                    <FileText className="w-6 h-6" />
                    <span>Hacé click para seleccionar el PDF</span>
                  </div>
                )}
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowConvertModal(false)} disabled={converting}>
                Cancelar
              </Button>
              <Button onClick={doConvertToOrder} disabled={converting}>
                <ShoppingCart className="w-4 h-4 mr-1" />
                {converting ? "Creando pedido..." : "Crear pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Búsqueda de Catálogo (Medidas / Accesorios) ── */}
      <Dialog open={!!catalogModal?.open} onOpenChange={(o) => { if (!o) closeCatalogModal(); }}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2 text-base">
              {catalogModal?.type === "medidas" ? (
                <span className="inline-flex items-center gap-1.5 text-blue-300">
                  <Package className="w-4 h-4" />
                  Catálogo de Medidas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <Package className="w-4 h-4" />
                  Catálogo de Accesorios
                </span>
              )}
              <span className="text-muted-foreground font-normal text-sm ml-1">
                — {catalogModalTotal.toLocaleString("es-AR")} registros
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              {catalogModal?.type === "medidas" ? "Búsqueda en catálogo de medidas" : "Búsqueda en catálogo de accesorios"}
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="px-6 py-3 border-b border-border/30 bg-muted/20 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9 h-9"
                placeholder="Buscar por código o nombre..."
                value={catalogModalSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setCatalogModalSearch(val);
                  setCatalogModalPage(1);
                  if (catalogModalTimer.current) clearTimeout(catalogModalTimer.current);
                  catalogModalTimer.current = setTimeout(() => {
                    if (catalogModal) fetchCatalogModal(catalogModal.type, val, 1, catalogFilters);
                  }, 300);
                }}
              />
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-2 items-center">
              {catalogModal?.type === "medidas" && (
                <>
                  <select
                    className="h-7 rounded border border-border/50 bg-background text-xs px-2 text-foreground focus:outline-none focus:border-border"
                    value={catalogFilters.category}
                    onChange={(e) => {
                      const next = { ...catalogFilters, category: e.target.value };
                      setCatalogFilters(next);
                      setCatalogModalPage(1);
                      if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, next);
                    }}
                  >
                    <option value="">Categoría</option>
                    {(catalogFilterOpts.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select
                    className="h-7 rounded border border-border/50 bg-background text-xs px-2 text-foreground focus:outline-none focus:border-border"
                    value={catalogFilters.seamType}
                    onChange={(e) => {
                      const next = { ...catalogFilters, seamType: e.target.value };
                      setCatalogFilters(next);
                      setCatalogModalPage(1);
                      if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, next);
                    }}
                  >
                    <option value="">Tipo de costura</option>
                    {(catalogFilterOpts.seamTypes || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <select
                    className="h-7 rounded border border-border/50 bg-background text-xs px-2 text-foreground focus:outline-none focus:border-border"
                    value={catalogFilters.shape}
                    onChange={(e) => {
                      const next = { ...catalogFilters, shape: e.target.value };
                      setCatalogFilters(next);
                      setCatalogModalPage(1);
                      if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, next);
                    }}
                  >
                    <option value="">Forma</option>
                    {(catalogFilterOpts.shapes || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              )}

              {catalogModal?.type === "accesorios" && (
                <>
                  <select
                    className="h-7 rounded border border-border/50 bg-background text-xs px-2 text-foreground focus:outline-none focus:border-border"
                    value={catalogFilters.accessoryType}
                    onChange={(e) => {
                      const next = { ...catalogFilters, accessoryType: e.target.value };
                      setCatalogFilters(next);
                      setCatalogModalPage(1);
                      if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, next);
                    }}
                  >
                    <option value="">Tipo de accesorio</option>
                    {(catalogFilterOpts.accessoryTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <select
                    className="h-7 rounded border border-border/50 bg-background text-xs px-2 text-foreground focus:outline-none focus:border-border"
                    value={catalogFilters.standard}
                    onChange={(e) => {
                      const next = { ...catalogFilters, standard: e.target.value };
                      setCatalogFilters(next);
                      setCatalogModalPage(1);
                      if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, next);
                    }}
                  >
                    <option value="">Norma</option>
                    {(catalogFilterOpts.accStandards || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              )}

              {/* Has price toggle — both types */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-emerald-500"
                  checked={catalogFilters.hasPrice}
                  onChange={(e) => {
                    const next = { ...catalogFilters, hasPrice: e.target.checked };
                    setCatalogFilters(next);
                    setCatalogModalPage(1);
                    if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, next);
                  }}
                />
                <span className="text-xs text-muted-foreground">Con precio</span>
              </label>

              {/* Active filters count + clear */}
              {(catalogFilters.category || catalogFilters.seamType || catalogFilters.shape ||
                catalogFilters.accessoryType || catalogFilters.standard || catalogFilters.hasPrice) && (
                <button
                  type="button"
                  className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => {
                    const fresh = blankFilters();
                    setCatalogFilters(fresh);
                    setCatalogModalPage(1);
                    if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, 1, fresh);
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Results table */}
          <div className="overflow-auto" style={{ maxHeight: "420px" }}>
            {catalogModalLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Cargando...
              </div>
            ) : catalogModalResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sin resultados{catalogModalSearch ? ` para "${catalogModalSearch}"` : ""}</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border/50 z-10">
                  <tr className="text-left text-[11px] text-muted-foreground uppercase">
                    <th className="px-4 py-2 w-28">Código</th>
                    <th className="px-4 py-2">Nombre</th>
                    {catalogModal?.type === "medidas" && (
                      <>
                        <th className="px-4 py-2 w-20">Ø ext.</th>
                        <th className="px-4 py-2 w-20">Esp.</th>
                        <th className="px-4 py-2 w-28">Norma</th>
                      </>
                    )}
                    {catalogModal?.type === "accesorios" && (
                      <>
                        <th className="px-4 py-2 w-32">Tipo</th>
                        <th className="px-4 py-2 w-28">Norma</th>
                      </>
                    )}
                    <th className="px-4 py-2 w-28 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogModalResults.map((p: any, idx: number) => {
                    const price = p.sale_price ?? p.price ?? null;
                    return (
                      <tr
                        key={`${p.source}-${p.id}-${idx}`}
                        onClick={() => selectCatalogItem(p)}
                        className="border-b border-border/20 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2 font-mono text-muted-foreground">{p.code || "—"}</td>
                        <td className="px-4 py-2 font-medium max-w-xs">
                          <span className="line-clamp-2">{p.name}</span>
                        </td>
                        {catalogModal?.type === "medidas" && (
                          <>
                            <td className="px-4 py-2 text-muted-foreground">
                              {p.outer_diameter ? `${p.outer_diameter}mm` : "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {p.nominal_thickness ? `${p.nominal_thickness}mm` : "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground truncate max-w-[112px]">
                              {p.standard || "—"}
                            </td>
                          </>
                        )}
                        {catalogModal?.type === "accesorios" && (
                          <>
                            <td className="px-4 py-2 text-muted-foreground">{p.sub_type || "—"}</td>
                            <td className="px-4 py-2 text-muted-foreground truncate max-w-[112px]">{p.standard || "—"}</td>
                          </>
                        )}
                        <td className="px-4 py-2 text-right">
                          {price != null && Number(price) > 0 ? (
                            <span className="text-emerald-400 font-medium">
                              {Number(price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {catalogModalTotal > CATALOG_PAGE_SIZE && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-border/30 bg-muted/10 text-xs text-muted-foreground">
              <span>
                Página {catalogModalPage} de {Math.ceil(catalogModalTotal / CATALOG_PAGE_SIZE)}
                {" · "}{catalogModalTotal.toLocaleString("es-AR")} registros
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={catalogModalPage <= 1 || catalogModalLoading}
                  onClick={() => {
                    const p = catalogModalPage - 1;
                    setCatalogModalPage(p);
                    if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, p, catalogFilters);
                  }}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={catalogModalPage >= Math.ceil(catalogModalTotal / CATALOG_PAGE_SIZE) || catalogModalLoading}
                  onClick={() => {
                    const p = catalogModalPage + 1;
                    setCatalogModalPage(p);
                    if (catalogModal) fetchCatalogModal(catalogModal.type, catalogModalSearch, p, catalogFilters);
                  }}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Agendar Seguimiento ── */}
      <Dialog open={showFollowup} onOpenChange={setShowFollowup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Agendar seguimiento?</DialogTitle>
            <DialogDescription>
              Cotización guardada. Podés agendar un recordatorio de seguimiento o saltearlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs mb-1">Fecha</Label>
              <Input
                type="date"
                value={followupForm.date}
                onChange={(e) => setFollowupForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1">Notas (opcional)</Label>
              <Textarea
                rows={2}
                value={followupForm.notes}
                onChange={(e) => setFollowupForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Detalles del seguimiento..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={skipFollowup}>Saltear</Button>
              <Button onClick={scheduleFollowup} disabled={savingFollowup}>
                <CalendarDays className="w-4 h-4 mr-1" />
                {savingFollowup ? "Agendando..." : "Agendar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
