# CRM Comercial B2B Industrial

## Overview

Sistema CRM comercial integral para empresa industrial B2B. Automatiza la gestión de correos comerciales con clasificación IA, detección de pedidos de cotización y seguimiento de oportunidades. Incluye Plan Comercial de Especialización con roles funcionales Hunter/Farmer/Admin Ventas.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + shadcn/ui + Tailwind CSS + @dnd-kit (Kanban)
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **AI**: OpenAI GPT-4o-mini (via OPENAI_API_KEY)
- **Auth**: Session-based (express-session + bcryptjs)

## Structure

```text
├── artifacts/
│   ├── crm/              # React frontend (previewPath: /)
│   └── api-server/       # Express API server (path: /api)
│       └── src/
│           ├── middleware/auth.ts  # requireAuth, requireRole, requireMinRole
│           ├── lib/audit.ts       # Audit logging utility
│           ├── lib/ai.ts          # OpenAI integration
│           ├── lib/gmail.ts       # Gmail sync logic
│           ├── lib/measurement-normalizer.ts  # Industrial measurement normalization
│           ├── lib/followup-engine.ts  # Follow-up automation engine
│           └── routes/            # All API routes
├── lib/
│   ├── api-spec/         # OpenAPI spec + Orval codegen
│   ├── api-client-react/ # Generated React Query hooks
│   ├── api-zod/          # Generated Zod schemas
│   └── db/               # Drizzle ORM schema + DB connection
```

## Commercial Plan (Hunter/Farmer/Admin Ventas)

### Functional Roles
- **Hunter**: Generates leads (calls/visits). Cannot quote. Goals: 100 calls/week, 20 meetings/month.
- **Farmer**: Receives leads from Hunter, closes sales. Must respond to leads in <2h. Tracks close rate.
- **Admin Ventas**: Processes quotations within 24h. Tracks turnaround time and on-time rate.

### Flow
Hunter generates lead → assigns to Farmer → Farmer requests quote → Admin quotes (<24h) → Farmer closes.

### Opportunity Statuses
- `new` → "Lead Nuevo" (SLA: 4h to assign farmer)
- `quote_requested` → "Cotización Solicitada" (SLA: 24h to quote)
- `quoted` → "Cotización Enviada" (SLA: 72h for client response)
- `negotiating` → "En Negociación"
- `won` → "Cerrado Ganado"
- `lost` → "Cerrado Perdido"
- `closed` → "Cerrado"

## Security Architecture

### Authentication
- Session-based auth with `requireAuth` middleware on all routes except `/auth/*` and `/health`
- `SESSION_SECRET` is required in production (no insecure defaults)

### Role-Based Authorization
- **admin**: Full access to all resources
- **gerente**: Commercial operations + Gmail + prompts + audit + goals
- **vendedor**: Clients, emails, opportunities, activities (own scope)
- **operador**: Data entry, imports, corrections

### Route Protection
- `/api/settings/*` → admin only (in-app credential management)
- `/api/users/*` → admin only
- `/api/prompts/*` → admin, gerente
- `/api/audit/*` → admin, gerente
- `/api/goals/*` → all authenticated (write: admin, gerente)
- `/api/imports/*` → admin, gerente, operador
- All other routes → any authenticated user

## Database Schema (32 tables)

- `users` - Internal users with roles
- `clients` - Client companies (with clientEmails JSON array)
- `contacts` - Client contacts
- `salespeople` - Salespeople with functionalRole (hunter/farmer/admin_ventas)
- `products` - Products/measurements catalog
- `emails` - Email records with AI classification
- `opportunities` - With hunterId, farmerId, stageEnteredAt, quote_requested status
- `activities` - Activity log (calls, visits, emails, tasks)
- `gmail_connections` - Gmail OAuth connections
- `prompts` - Editable AI prompts with versioning
- `audit_logs` - System audit trail
- `import_logs` - CSV import history
- `extractions` - AI-extracted product requirements
- `product_equivalences` - Product aliases
- `followup_rules` - Follow-up automation rules
- `followup_templates` - Email templates for follow-ups
- `scheduled_followups` - Scheduled follow-up tasks
- `goals` - Sales performance goals per vendedor
- `settings` - Key-value app configuration store (credentials, API keys)
- `conversations` - Gmail thread conversations (inbox comercial)
- `conversation_messages` - Individual messages within conversations
- `conversation_events` - Status/assignment change audit trail for conversations
- `anura_webhooks` - Anura telephony webhook events (calls received/made)
- `price_lists` - Sales/purchase price lists (VENTA/REVENDEDOR/COMPRA, currency, default flag)
- `price_list_items` - Per-product prices within a price list
- `sale_conditions` - Payment terms (CONTADO/30/60/90 días)
- `quotes` - Sales quotes with full Argentine industrial fields (CUIT, FX rate type, priority, type, lines)
- `quote_lines` - Line items per quote (product, qty, qty_kg, unit_price, totals)
- `orders` - Customer orders (created from quotes or directly), with status workflow
- `order_lines` - Line items per order
- `tasks` - Tasks/todos with assignee, priority, due date, related entity (client/opp/quote/order)
- `notifications` - Per-user notifications (task assigned, etc.) with read state
- `email_templates` - Reusable email templates with variable substitution ({{var}})
- `documents` - File attachments stored in object storage, linked to any entity (quote/order/client/etc.)
- `automation_rules` - Trigger-based automation (event + conditions + actions, JSON-based DSL)
- `automation_logs` - Execution history of automation rules
- `custom_field_defs` - Per-entity custom field definitions (text/number/date/select/etc.)
- `custom_field_values` - Values for custom fields per entity instance

## Frontend Pages

- `/dashboard` - Dashboard with metrics + commercial plan panels (Hunter/Farmer/Admin) + pipeline funnel
- `/inbox` - Commercial Inbox with conversation threads (Gmail sync), status tabs, search, message detail
- `/emails` - Email management with AI classification (legacy)
- `/emails/:id` - Email detail + reply
- `/opportunities` - List + Kanban views with SLA badges, drag-and-drop
- `/clients` - Client management
- `/contacts` - Contact management
- `/salespeople` - Salespeople with functional role badges, "Ver panel" sheet
- `/products` - Product catalog
- `/imports` - CSV import with preview/mapping
- `/followups` - Follow-up automation dashboard
- `/goals` - Sales goals management (admin/gerente only)
- `/gmail` - Gmail OAuth integration + in-app credential configuration (admin only)
- `/anura` - Anura telephony webhooks viewer (call list + detail with recording playback)
- `/prompts` - AI prompt management
- `/users` - User management (admin only)
- `/quotes` + `/quotes/new` + `/quotes/:id` - Sales quotes list and editor (line items, totals, convert-to-order)
- `/orders` + `/orders/new` + `/orders/:id` - Customer orders list and editor with status workflow
- `/tasks` - Task list with stats (pending/overdue/today/completed), today/overdue filters, create dialog
- `/price-lists` - Price list configuration (VENTA/REVENDEDOR/COMPRA), currency, default selection
- `/calendar` - Weekly calendar view of tasks (color-coded by priority, navigate by week)
- `/email-templates` - CRUD of reusable email templates with HTML body and variable substitution
- `/reports` - Dashboard with charts: sales summary KPIs, sales by month (line chart), pipeline funnel (bar), salesperson ranking, activities by type (pie), top clients
- `/automation` - Trigger-based automation rules (gerente+) with execution logs tab
- `/custom-fields` - Define custom fields per entity (gerente+)

## Quick Activity FAB

Floating action button (bottom-right) on all pages. Allows quick logging of calls/visits/tasks with optional lead generation. Creates activity + optionally creates opportunity with farmer assignment.

## Default Users (seed)

- `admin` / `admin123` - Full admin access
- `gerente` / `admin123` - Sales manager
- `vendedor1` / `admin123` - Salesperson

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption secret
- `OPENAI_API_KEY` - For AI email classification and extraction (can also be set via in-app Settings)
- `GMAIL_CLIENT_ID` - For Gmail OAuth integration (can also be set via in-app Settings)
- `GMAIL_CLIENT_SECRET` - For Gmail OAuth integration (can also be set via in-app Settings)
- `GMAIL_REDIRECT_URI` - Gmail OAuth callback URL (can also be set via in-app Settings)

## Key API Endpoints

- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET /api/dashboard/metrics` - Dashboard metrics
- `GET /api/dashboard/commercial-plan` - Hunter/Farmer/Admin metrics + pipeline funnel
- `GET/POST/PATCH/DELETE /api/goals` - Goals CRUD
- `GET/POST/PATCH /api/opportunities` - With hunterId/farmerId/stageEnteredAt
- `GET/POST /api/activities` - Activity logging
- `GET/POST/PATCH/DELETE /api/salespeople` - With functionalRole
- `POST /api/imports/upload` - CSV upload with preview
- `POST /api/imports/execute` - Execute CSV import
- `POST /api/extractions/extract/:emailId` - AI extract products
- `GET /api/audit` - Audit logs
- `GET/POST/DELETE /api/settings` - In-app credential management (admin only)
- `GET /api/conversations` - List conversations with status/priority/search filters
- `GET /api/conversations/:id` - Conversation detail with messages and events
- `PATCH /api/conversations/:id` - Update status/priority/assignment
- `GET /api/conversations/metrics/summary` - Conversation metrics
- `POST /api/integrations/anura/webhook` - Anura webhook (no auth required)
- `GET /api/integrations/anura/health` - Anura healthcheck (no auth required)
- `GET /api/integrations/anura/webhooks` - List Anura call webhooks (auth required)
- `PATCH /api/integrations/anura/webhooks/:id` - Assign clientId/salespersonId/notes to a call
- `GET /api/salespeople/:id/profile` - Salesperson profile with calls, activities, stats
- `GET/POST/PATCH/DELETE /api/price-lists` - Price lists CRUD (vendedor+)
- `GET/POST/PATCH/DELETE /api/quotes` - Quotes CRUD with server-canonical totals (vendedor+)
- `POST /api/quotes/:id/convert-to-order` - Atomic transactional quote-to-order conversion
- `GET/POST/PATCH/DELETE /api/orders` - Orders CRUD with status workflow (vendedor+)
- `GET /api/sale-conditions` - Payment terms list
- `GET/POST/PATCH/DELETE /api/tasks` - Task management with due dates, assignment, related entities
- `GET /api/tasks/stats/summary` - Per-user task counts (pending/overdue/today/completed)
- `GET /api/notifications` - Per-user notifications with unreadCount
- `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` - Mark read
- Notification bell in app header polls every 60s for unread count

## Phase 1 Salesforce-parity Features (added)
- **Cotizaciones** (Quotes): Full editor matching Traficaño screenshot — client, CUIT, contacts, sale condition, dates (issue/delivery/due/followup), price list, currency + FX rate, priority, type (COTIZACION/LICITACION/OFERTA), order type (REVENTA/PRODUCCION), description, internal notes, reference, purchase order, line items with product type/code/qty/qty_kg/unit_price/delivery_time/client_code, totals (net, total kg, avg price/kg). One-click convert to order (transactional).
- **Pedidos** (Orders): Status workflow (draft → confirmed → in_production → shipped → delivered → invoiced), urgent/authorized flags, full line items.
- **Listas de precios**: Multiple lists with currency, purchase/sale flags, default selection.
- **Tareas**: Assignment, priority, due date, type (task/call/meeting/email/followup/reminder), related to client/opportunity/quote/order. Stats dashboard.
- **Notificaciones**: Auto-fired on task assignment/reassignment, displayed in header bell with unread badge.

## Development Commands

```bash
# DB schema push
pnpm --filter @workspace/db run push

# API codegen
pnpm --filter @workspace/api-spec run codegen

# Build API server
pnpm --filter @workspace/api-server run build
```

## Fase 5 — Expansión Salesforce-level (mayo 2026)

Seis funcionalidades agregadas:

1. **Multi-pipelines + etapas custom**: tablas `pipelines` (4 sembrados: General, OCTG, Trefilados, Exportación) y `pipeline_stages` (6 c/u, color/winProb/SLA). UI: `/pipelines` (admin/gerente). Filtro y selectores en oportunidades.
2. **PDF cotización server-side**: `/api/quotes/:id/pdf` con pdfkit. Botón "Descargar PDF" en `/quotes/:id`. Requiere `@swc/helpers` para fontkit.
3. **Excel export reportes**: `/api/reports/export/{sales,quotes,pipeline}.xlsx` con exceljs. Botones en `/reports`.
4. **Contactos extendidos**: jsonb `additionalEmails`, `additionalPhones`, `tags`; campos `linkedinUrl`, `photoUrl`, `score`, `status`, `source`. UI `/contacts/new` y `/contacts/:id`.
5. **PWA instalable**: `vite-plugin-pwa` (autoUpdate). Manifest + service worker. Íconos en `public/images/`.
6. **Google Calendar sync bidireccional**: scope `calendar` agregado al OAuth de Gmail. Tabla `gmail_connections` extendida (`calendarSyncEnabled`, `calendarLastSyncAt`). Tabla `tasks` extendida (`googleEventId`, `googleCalendarId`, `googleSyncedAt`). Endpoints `/api/gcal/{status,toggle,push,pull}`. UI `/calendar/sync`. Push best-effort en POST `/api/tasks`.

### Hardening de seguridad
- OAuth state ahora es nonce aleatorio + userId firmado en sesión (anti-CSRF).
- Mutaciones de `/pipelines` requieren rol `gerente` (defensa en profundidad).
- DELETE de pipeline bloqueado si tiene oportunidades; cascada manual de stages.
- Pull de Calendar es realmente bidireccional: eventos con `crmTaskId` actualizan la task; eventos cancelados marcan task como `cancelled`.
