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

## Database Schema (22 tables)

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
- `/prompts` - AI prompt management
- `/users` - User management (admin only)

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

## Development Commands

```bash
# DB schema push
pnpm --filter @workspace/db run push

# API codegen
pnpm --filter @workspace/api-spec run codegen

# Build API server
pnpm --filter @workspace/api-server run build
```
