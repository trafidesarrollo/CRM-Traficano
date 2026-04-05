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

---

## Fase B — Gmail Real y Operable (2026-04-05)

### Agregado
- **Sincronización con paginación**: Ya no se limita a `is:unread`. Soporta hasta 50 mensajes por lote, con `pageToken` para continuar. Acepta filtros de búsqueda personalizados (`query`).
- **Parsing recursivo de partes MIME**: Extrae cuerpo de emails con estructuras multipart anidadas (text/plain, text/html, multipart/alternative, etc.).
- **Detección de adjuntos**: Detecta archivos adjuntos, guarda metadata (nombre, tipo MIME, tamaño, attachmentId) en campo `attachments` de la tabla `emails`.
- **Descarga de adjuntos**: Nuevo endpoint `GET /api/gmail/attachment/:messageId/:attachmentId` para descargar adjuntos via Gmail API.
- **Envío real por Gmail API**: `POST /api/emails/:id/send-reply` ahora envía realmente por Gmail API con formato MIME correcto (text/plain + text/html). Soporta threading (In-Reply-To, References).
- **Registro de emails enviados**: Los emails enviados se guardan en la tabla `emails` con `direction: "outbound"` y se vinculan al thread, cliente y oportunidad del email original.
- **Vinculación automática de cliente/contacto**: Al sincronizar, intenta vincular el remitente con un contacto existente (por email) o un cliente (por dominio del website).
- **Dirección de email** (`direction`): Nuevo campo que distingue `inbound` / `outbound`.
- **CC del email**: Se guarda el campo CC.
- **Labels de Gmail**: Se guardan las etiquetas del mensaje.
- **Estado de sincronización**: La conexión Gmail muestra estados: `idle`, `syncing`, `error` con detalle del error.
- **historyId**: Se guarda el último historyId para preparar sync incremental futura.

### Corregido
- **Deduplicación por messageId**: Constraint `UNIQUE` en `gmail_message_id` (parcial, solo no-null). Imposible duplicar un email ya sincronizado.
- **Refresh token robusto**: Si el access token vence durante la sync, se renueva automáticamente y se reintenta. Si falla, se marca la conexión como `error`.
- **Token vencido detectable**: El endpoint `/gmail/status` ahora reporta si el token venció pero es renovable, o si se necesita reconectar.

### Esquema de base de datos
- `emails`: Agregados campos `direction`, `cc_email`, `contact_id`, `attachments`, `gmail_labels`, `has_attachments`, `gmail_history_id`. Constraint unique parcial en `gmail_message_id`.
- `gmail_connections`: Agregados campos `last_history_id`, `sync_status`, `sync_error`.

---

## Fase C — Importación CSV Real (2026-04-05)

### Agregado
- **Upload real de archivo CSV**: Endpoint `POST /api/imports/upload` acepta archivo CSV vía multipart/form-data. Soporta archivos hasta 10MB.
- **Parser CSV robusto**: Detecta automáticamente delimitador (coma, punto y coma, tab). Soporta UTF-8 con BOM, campos entre comillas, comillas escapadas.
- **Preview antes de importar**: Devuelve headers detectados, primeras 10 filas, total de registros, y mapeo de columnas sugerido.
- **Auto-mapping de columnas**: Reconoce nombres en español e inglés (empresa→companyName, cuit→taxId, telefono→phone, etc.) con aliases configurables.
- **Mapping manual**: El frontend puede enviar un mapping personalizado de columnas del CSV a campos del sistema.
- **Validación**: Verifica campos obligatorios, tipos de dato, y genera detalle de errores por fila.
- **Modos de importación**: `insert` (solo nuevos), `update`, `upsert` (insert o update por clave única como taxId).
- **Tabla `import_logs`**: Registra cada importación con: usuario, fecha, archivo, tipo de entidad, cantidades, errores, estado.
- **Export de errores**: Endpoint `GET /api/imports/logs/:id/errors` descarga CSV con filas rechazadas y motivo de error.
- **Plantillas CSV**: Endpoint `GET /api/imports/template/:entityType` descarga plantilla CSV con headers correctos.
- **Historial de importaciones**: Endpoint `GET /api/imports/logs` listado paginado de importaciones pasadas.
- **Entidades soportadas**: clientes, contactos, productos, vendedores.

### Esquema de base de datos
- Nueva tabla `import_logs` con campos: userId, entityType, fileName, totalRows, insertedRows, updatedRows, errorRows, skippedRows, mode, status, columnMapping, errorDetails, summary, completedAt.
- Índice único parcial en `clients.tax_id` para soportar upsert por CUIT.

---

## Fase D — Matching Técnico (2026-04-05)

### Agregado
- **Normalizador de medidas**: Módulo `measurement-normalizer.ts` que convierte entre pulgadas (fracciones y decimales), DN, mm, cm, m, ft, kg, ton. Incluye tablas NPS→OD, DN→OD, fracciones, y conversiones de unidades industriales.
- **Normas técnicas**: Reconoce y normaliza ASTM A53/A106/A312/A519, API 5L/5CT, ASME B16.x, DIN, IRAM, SAE, SCH 40/80/160, etc. con aliases múltiples.
- **Extracción AI de requerimientos**: Endpoint `POST /api/extractions/extract/:emailId` que usa GPT-4o-mini para extraer todos los productos/materiales mencionados en un email con sus especificaciones técnicas.
- **Matching multinivel**: Busca productos en BD por familia, luego calcula score por coincidencia de dimensión (exacta/aproximada/cercana) y norma. Puntaje máximo 100, con tipos exact/approximate/no_match.
- **Tabla `extractions`**: Almacena cada item extraído con medida normalizada, norma, cantidad, producto sugerido, score de match, y estado (pending/accepted/corrected/rejected).
- **Tabla `product_equivalences`**: Almacena aliases alternativos para productos (medida, norma, nombre, código). Se alimenta automáticamente al corregir un match.
- **Feedback loop**: Endpoint `PATCH /api/extractions/:id/correct` registra corrección humana y crea equivalencia automática para mejorar matches futuros.
- **Endpoints**: normalize, match, extract, accept, correct, reject, equivalences CRUD.

### Esquema de base de datos
- Nueva tabla `extractions` (14 campos: emailId, originalText, normalizedMeasurement, detectedStandard, detectedQuantity, suggestedProductId, matchType, matchScore, status, correctedProductId, rawAiOutput, etc.)
- Nueva tabla `product_equivalences` (productId, alias, aliasType)

---

## Fase E — Motor de Seguimiento (2026-04-05)

### Agregado
- **Tabla `followup_rules`**: Reglas configurables con evento disparador (quote_sent, quote_request_received, opportunity_created, no_response, email_sent), delay en días, máximo de intentos, template asociado, prioridad.
- **Tabla `followup_templates`**: Plantillas de email con variables dinámicas ({{contacto}}, {{empresa}}, {{producto}}, {{fecha_cotizacion}}, {{vendedor}}). Categorías: quote_followup, general_followup, thank_you, reminder, reactivation.
- **Tabla `scheduled_followups`**: Seguimientos programados con fecha, estado (pending/sent/skipped/failed/cancelled), número de intento, razón de omisión, cuerpo generado.
- **Motor de procesamiento**: Verifica condiciones antes de enviar (oportunidad ganada/perdida, cliente respondió), genera contenido desde template con variables reales, programa siguiente intento automáticamente.
- **Seed data**: 5 templates predeterminados (3 de seguimiento de cotización, 1 agradecimiento, 1 reactivación) y 4 reglas (post-cotización, agradecimiento automático, oportunidad nueva, reactivación).
- **Endpoints**: GET/POST/PATCH/DELETE rules, GET/POST/PATCH/DELETE templates, GET scheduled, PATCH cancel/reschedule, POST trigger, POST process, GET stats, POST preview.
- **Ruta protegida**: `/api/followups/*` accesible desde vendedor hacia arriba.

---

## Fase F — UX Final (2026-04-05)

### Agregado
- **Página Contactos**: CRUD completo con búsqueda, tarjetas con email/teléfono/cargo, diálogo de creación.
- **Página Vendedores**: CRUD completo con avatares, estado activo/inactivo, vinculación a usuario.
- **Página Productos**: CRUD completo con catálogo industrial (código, categoría, dimensiones, norma, precio, moneda), búsqueda por todos los campos.
- **Página Usuarios**: CRUD completo con roles visuales (iconos y colores por rol), selector de rol, creación con contraseña.
- **Página Prompts IA**: Visualización agrupada por tipo, activación de versiones, creación con editor de texto monoespaciado.
- **Página Seguimientos**: Dashboard con estadísticas (pendientes, enviados, vencidos hoy, esta semana), lista filtrable por estado con tabs, reglas activas, botones de procesamiento y cancelación.
- **Página Importación CSV mejorada**: Flujo de 3 pasos (upload→preview→result), selector de entidad y modo, mapeo de columnas visual con select, vista previa de datos, resumen de resultados con detalle de errores, historial, descarga de plantillas.
- **Navegación**: Agregado "Seguimientos" al sidebar con icono Timer. Eliminados todos los placeholders.

### Eliminado
- Todas las páginas placeholder reemplazadas por páginas funcionales completas.
