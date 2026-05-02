# CRM Comercial B2B Industrial

## Overview

This project is a comprehensive B2B industrial commercial CRM system designed to automate sales processes. It features AI-powered email management for classification and quotation order detection, robust opportunity tracking, and a specialized commercial plan with Hunter, Farmer, and Sales Admin roles. The system aims to streamline sales workflows, improve lead conversion, and enhance overall sales team efficiency in an industrial B2B context. Its key capabilities include automating email correspondence, intelligently identifying sales opportunities, and providing a structured framework for managing the sales pipeline from lead generation to deal closure.

## User Preferences

- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `artifacts/crm`.
- Do not make changes to the folder `lib/api-client-react`.
- Do not make changes to the folder `lib/api-zod`.
- Do not make changes to the file `lib/api-spec/openapi.yaml`.

## System Architecture

The CRM is built as a monorepo using pnpm workspaces. The frontend is a React application utilizing Vite, shadcn/ui, Tailwind CSS, and @dnd-kit for UI components like Kanban boards. The backend is an Express 5 API server. Data persistence is handled by PostgreSQL with Drizzle ORM. Validation is implemented using Zod and drizzle-zod. API client code is generated from an OpenAPI specification using Orval. AI capabilities for email classification and extraction are provided by OpenAI GPT-4o-mini. Authentication is session-based using express-session and bcryptjs.

### Commercial Plan
The system enforces a structured commercial plan with distinct roles:
- **Hunter**: Focuses on lead generation (calls/visits) and cannot quote.
- **Farmer**: Receives and closes leads, responsible for lead response times and close rates.
- **Admin Ventas**: Processes quotations within strict turnaround times.

The opportunity workflow includes statuses like `new`, `quote_requested`, `quoted`, `negotiating`, `won`, `lost`, and `closed`, each with defined SLAs.

### Security Architecture
- **Authentication**: Session-based with `requireAuth` middleware for most routes.
- **Authorization**: Role-Based Access Control (RBAC) with roles: `admin` (full access), `gerente` (commercial operations, AI prompts, audit, goals), `vendedor` (clients, emails, opportunities, activities within scope), and `operador` (data entry). Specific routes are protected based on these roles (e.g., `/api/settings/*` is admin only).

### Database Schema
The database comprises 32 tables covering various entities:
- **Core Entities**: `users`, `clients`, `contacts`, `salespeople`, `products`, `emails`, `opportunities`, `activities`.
- **Integration & Automation**: `gmail_connections`, `prompts`, `audit_logs`, `import_logs`, `extractions`, `followup_rules`, `scheduled_followups`, `automation_rules`.
- **Sales & Finance**: `price_lists`, `quotes`, `orders`, `sale_conditions`, `goals`.
- **Productivity**: `tasks`, `notifications`, `email_templates`, `conversations`.
- **Extensibility**: `custom_field_defs`, `custom_field_values`.

### UI/UX and Features
The frontend provides a rich set of pages:
- **Dashboards**: `/dashboard` for metrics and commercial plan panels; `/reports` for sales KPIs and charts.
- **Sales Workflow**: `/opportunities` (list/Kanban), `/quotes` (editor with conversion to order), `/orders` (editor with status workflow), `/tasks` (list with stats and calendar view).
- **Communication**: `/inbox` (commercial inbox with Gmail sync and AI classification), `/emails`, `/email-templates`.
- **Management**: `/clients`, `/contacts`, `/products`, `/salespeople`, `/users`, `/prompts`, `/goals`, `/price-lists`.
- **Automation**: `/followups` and `/automation` for trigger-based rules.
- **Utilities**: `/imports` (CSV import/export), `/gmail` (OAuth integration), `/anura` (telephony webhooks viewer), `/custom-fields`.
- A **Quick Activity FAB** allows for rapid logging of calls, visits, or tasks, with optional lead and opportunity creation.
- **Multi-pipelines + custom stages**: Supports multiple sales pipelines with customizable stages, including color, win probability, and SLA.
- **PDF Quote Generation**: Server-side PDF generation for quotes.
- **Excel Export**: Export sales, quotes, and pipeline reports to Excel.
- **Extended Contacts**: Enhanced contact details with additional emails, phones, tags, LinkedIn, photo, score, status, and source.
- **PWA**: The application is installable as a Progressive Web App.
- **Google Calendar Bidirectional Sync**: Integrates with Google Calendar for task synchronization, including event updates and cancellations.
- **Universal CSV Import/Export**: A generic API and UI for importing and exporting data for key entities (clients, contacts, products, opportunities, etc.) with automatic type coercion and detailed reporting.
- **Global Search (Cmd/Ctrl+K)**: Cross-entity search palette over clients, contacts, products, opportunities, quotes, and orders. Backend `GET /api/search?q=` (vendedor+); frontend `CommandPalette` with keyboard navigation.
- **Bulk Actions**: Server endpoints `POST /api/bulk/delete` and `POST /api/bulk/update` (gerente+) for multi-row delete and whitelisted field updates on clients/contacts/products/opportunities/tasks. Multi-select UI on contacts list with action bar.
- **Audit Log Viewer (`/audit`)**: Admin/gerente page that browses `audit_logs` with filters by entity, action and user, expandable JSON details, and pagination. Backed by existing `GET /api/audit`.
- **Keyboard Shortcuts**: Global handler — `?` opens the cheatsheet dialog; `G + letter` navigates (d/c/o/t/q/i/r/a). Ignored when typing in inputs.
- **Recently Viewed**: Command palette persists last 6 visited entities in `localStorage` and shows them under "Recientes" when the query is empty.
- **Duplicate Detection**: `GET /api/duplicates/clients` (taxId, companyName) and `/duplicates/contacts` (email, phone), vendedor+. Reusable `DuplicateWarning` component with debounce shows a yellow inline panel under create/edit forms; wired into the new-client dialog.
- **Today Tasks Widget**: Dashboard card "Mis tareas de hoy" lists pending tasks due today + overdue, sorted by due time, with one-click complete (PATCH `/api/tasks/:id` → `status=completed`) and priority/overdue badges.

## External Dependencies

- **OpenAI GPT-4o-mini**: Used for AI-driven email classification, quotation order detection, and product requirement extraction.
- **Gmail API**: Integrated for commercial email inbox synchronization and management, including OAuth for secure connections.
- **Anura Telephony**: Webhook integration for logging and managing call events (received/made) within the CRM.
- **Google Calendar API**: Used for bidirectional synchronization of tasks and events.