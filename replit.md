# CRM Comercial B2B Industrial

## Overview

Sistema CRM comercial integral para empresa industrial B2B. Automatiza la gestión de correos comerciales con clasificación IA, detección de pedidos de cotización y seguimiento de oportunidades.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + shadcn/ui + Tailwind CSS
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
│           └── routes/            # All API routes
├── lib/
│   ├── api-spec/         # OpenAPI spec + Orval codegen
│   ├── api-client-react/ # Generated React Query hooks
│   ├── api-zod/          # Generated Zod schemas
│   └── db/               # Drizzle ORM schema + DB connection
```

## Security Architecture (Phase A)

### Authentication
- Session-based auth with `requireAuth` middleware on all routes except `/auth/*` and `/health`
- `SESSION_SECRET` is required in production (no insecure defaults)
- Sessions stored server-side with httpOnly cookies

### Role-Based Authorization
- **admin**: Full access to all resources
- **gerente**: Commercial operations + Gmail + prompts + audit
- **vendedor**: Clients, emails, opportunities, activities (own scope)
- **operador**: Data entry, imports, corrections

### Route Protection
- `/api/users/*` → admin only
- `/api/prompts/*` → admin, gerente
- `/api/audit/*` → admin, gerente
- `/api/gmail/connect`, `/api/gmail/disconnect` → admin, gerente
- `/api/imports/*` → admin, gerente, operador
- All other routes → any authenticated user

### Audit Logging
- All logins/logouts/failed attempts logged
- User CRUD operations with old/new values
- Gmail connect/disconnect/sync events
- Email classification/processing events
- Import operations

## Database Schema

- `users` - Internal users with roles (admin, gerente, vendedor, operador)
- `clients` - Client companies
- `contacts` - Client contacts
- `salespeople` - Salespeople linked to users
- `products` - Products/measurements catalog
- `emails` - Email records with AI classification
- `opportunities` - Commercial opportunities auto-created from quote requests
- `activities` - Activity log (calls, visits, emails, tasks)
- `gmail_connections` - Gmail OAuth connections per user
- `prompts` - Editable AI prompts with versioning
- `audit_logs` - System audit trail (with old_value, new_value, origin fields)
- `import_logs` - CSV import history and results
- `extractions` - AI-extracted product requirements from emails with match scores
- `product_equivalences` - Product aliases for improved technical matching
- `followup_rules` - Configurable follow-up rules with triggers and delays
- `followup_templates` - Email templates with dynamic variables for follow-ups
- `scheduled_followups` - Scheduled follow-up tasks with status tracking

## Email Categories

- `quote_request` → "Pedido de Cotización" (main automation target)
- `complaint` → "Reclamo"
- `inquiry` → "Consulta"
- `follow_up` → "Seguimiento"
- `supplier` → "Proveedor"
- `internal` → "Interno"
- `spam` → "Spam/Publicidad"
- `other` → "Otro"

## Default Users (seed)

- `admin` / `admin123` - Full admin access
- `gerente` / `admin123` - Sales manager
- `vendedor1` / `admin123` - Salesperson

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` - Session encryption secret (required in production, auto-generated in dev)
- `OPENAI_API_KEY` - For AI email classification and extraction
- `GMAIL_CLIENT_ID` - For Gmail OAuth integration
- `GMAIL_CLIENT_SECRET` - For Gmail OAuth integration
- `GMAIL_REDIRECT_URI` - Gmail OAuth callback URL

## Key API Endpoints

- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET /api/emails` - List emails (filter by category, status)
- `POST /api/emails/:id/process` - AI process quote request email
- `POST /api/emails/:id/reply-draft` - Generate AI reply draft
- `POST /api/emails/:id/classify` - Manual classification
- `GET /api/gmail/connect` - Get Gmail OAuth URL
- `POST /api/gmail/sync` - Sync emails from Gmail
- `GET /api/dashboard/metrics` - Dashboard metrics
- `POST /api/imports/upload` - CSV upload with preview
- `POST /api/imports/execute` - Execute CSV import
- `GET /api/imports/template/:type` - Download CSV template
- `GET /api/imports/logs` - Import history
- `POST /api/extractions/extract/:emailId` - AI extract product requirements from email
- `POST /api/extractions/normalize` - Normalize measurements
- `POST /api/extractions/match` - Match measurement to products
- `PATCH /api/extractions/:id/accept` - Accept extraction match
- `PATCH /api/extractions/:id/correct` - Correct with right product (auto-learns)
- `GET /api/audit` - Audit logs (admin/gerente only)

## Development Commands

```bash
# DB schema push
pnpm --filter @workspace/db run push

# API codegen
pnpm --filter @workspace/api-spec run codegen

# Build API server
pnpm --filter @workspace/api-server run build
```
