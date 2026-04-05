# CHANGELOG — CRM Comercial B2B

## Fase A — Endurecimiento de Seguridad (2026-04-05)

### Agregado
- **Middleware `requireAuth`**: Valida sesión activa en todas las rutas protegidas. Rechaza con 401 si no hay sesión.
- **Middleware `requireRole`**: Control de acceso por rol (`admin`, `gerente`, `vendedor`, `operador`). Rechaza con 403 si el rol no tiene permiso.
- **Middleware `requireMinRole`**: Control por jerarquía de rol (admin > gerente > vendedor > operador).
- **Módulo de auditoría** (`lib/audit.ts`): Registra login, logout, intentos fallidos, cambios de usuarios, operaciones Gmail, clasificaciones, importaciones.
- **Ruta `/api/audit`**: Listado paginado de logs de auditoría (acceso: admin, gerente).
- **Refresh token automático para Gmail**: Renueva access token automáticamente antes de sincronizar.
- **Estado de conexión Gmail**: Muestra si está conectada, token vencido, o requiere reconexión.

### Corregido
- **Eliminado fallback `userId || 1`**: Todas las rutas de Gmail ahora requieren sesión autenticada real. No hay más fallbacks inseguros.
- **Eliminado secret por defecto**: `SESSION_SECRET` ya no tiene valor hardcodeado. En producción es obligatorio. En desarrollo genera uno temporal aleatorio y muestra warning.
- **Protección de rutas sensibles**:
  - `/api/users/*` → solo admin
  - `/api/prompts/*` → admin, gerente
  - `/api/audit/*` → admin, gerente
  - `/api/gmail/connect`, `/api/gmail/disconnect` → admin, gerente
  - `/api/imports/*` → admin, gerente, operador
  - Todas las demás rutas → requieren autenticación
- **Login mejorado**: Distingue entre usuario no encontrado, inactivo y contraseña incorrecta (internamente, al usuario se muestra mensaje genérico).
- **Logout con auditoría**: Se registra el evento antes de destruir la sesión.
- **Validación de cuenta activa en `/auth/me`**: Si la cuenta fue deshabilitada después del login, se destruye la sesión.
- **No se puede eliminar el propio usuario**: Protección contra auto-eliminación de admin.

### Esquema de base de datos
- `audit_logs`: Agregados campos `old_value`, `new_value`, `origin` para trazabilidad completa.

### Pendiente para siguientes fases
- Fase B: Gmail real (OAuth robusto, envío real, threads, adjuntos)
- Fase C: CSV real (upload de archivo, preview, mapping de columnas)
- Fase D: Matching técnico (normalización de medidas, matching multinivel)
- Fase E: Motor de seguimiento (reglas, templates, scheduler)
- Fase F: UX final (dashboards, páginas funcionales completas)
