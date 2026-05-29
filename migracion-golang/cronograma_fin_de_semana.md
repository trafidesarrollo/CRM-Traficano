# 🚀 Hoja de Ruta de Fin de Semana: Migración Express a Golang

Este documento es tu **Plan de Vuelo cronológico** para este fin de semana. Está estructurado paso a paso para que tú y tu equipo de agentes de IA (coordinados con Gentle-AI o Aider usando Claude y Gemini) puedan migrar el backend del CRM a Go de forma extremadamente coordinada y tener el sistema 100% operativo para el lunes por la mañana.

---

## 🛠️ Fase 1: Configuración del Entorno en Casa (Viernes por la Noche / Sábado por la Mañana)
*El objetivo de esta fase es preparar las herramientas y los cimientos para que las IAs puedan programar de inmediato sin fricciones.*

### Pasos a seguir:
1.  **Instalar Go (si no lo tienes):** Descarga e instala la última versión de Go desde [golang.org](https://golang.org/).
2.  **Asegurar PostgreSQL:** Asegúrate de tener PostgreSQL corriendo localmente o mediante Docker en tu hogar (utiliza las credenciales de conexión habituales).
3.  **Instalar Gentle-AI / Aider (¡Tus Superpoderes!):**
    *   Para instalar **Gentle-AI**:
        ```bash
        go install github.com/gentleman-programming/gentle-ai/cmd/gentle-ai@latest
        gentle-ai install
        ```
    *   Para instalar **Aider** (altamente recomendado para interactuar vía terminal de forma ágil):
        ```bash
        pip install aider-chat
        ```
4.  **Configurar API Keys:** Exporta tus API Keys de Claude 3.5 Sonnet y Gemini Pro en las variables de entorno de tu terminal doméstica (`ANTHROPIC_API_KEY` y `GEMINI_API_KEY`).
5.  **Iniciar Git:** Crea una rama base limpia llamada `feature/golang-migration` sobre tu repositorio.

---

## 🏗️ Fase 2: Construcción de Cimientos y Base de Datos (Sábado por la Mañana)
*El objetivo es dejar listas las fronteras del proyecto (Dominio y Repositorio de BD) para que los agentes puedan trabajar en paralelo.*

*   **Agente Asignado:** **Agente 1 (Arquitecto de Base de Datos - Gemini Pro o Claude)**
*   **Archivos de Entrada para el Agente:** `/migracion-golang/golang_migration_plan.md` y `/lib/db/src/schema/`.

### 📋 Checklist del Agente 1:
- [ ] Inicializar el módulo de Go en la raíz del backend:
  ```bash
  cd ./api-server-go
  go mod init api-server-go
  ```
- [ ] Instalar dependencias esenciales de Go:
  ```bash
  go get github.com/labstack/echo/v4
  go get github.com/jackc/pgx/v5
  go get github.com/jackc/pgx/v5/pgxpool
  ```
- [ ] Crear la estructura de directorios de **Clean Architecture**:
  ```
  /api-server-go/internal/domain
  /api-server-go/internal/usecase
  /api-server-go/internal/repository/postgres
  /api-server-go/internal/delivery/http/dto
  ```
- [ ] Configurar **sqlc** (`sqlc.yaml`) e inicializar las migraciones en SQL puro con el diseño de **Class Table Inheritance** para caños y accesorios (Section 5.F) y la unificación de metas y actividades.
- [ ] Escribir los modelos de dominio base en `/internal/domain/` (`client.go`, `product.go`, `quote.go`, `activity.go`).

---

## 🔑 Fase 3: Seguridad, Autenticación y Casos de Uso Core (Sábado por la Tarde)
*Una vez construidos los cimientos, inyectamos la lógica de acceso y los primeros flujos comerciales.*

*   **Agentes en Paralelo:**
    *   **Agente 2 (Seguridad & Usuarios - Gemini Pro)**
    *   **Agente 4 (Negocio & Ventas - Claude)**

### 📋 Checklist del Agente 2 (Seguridad & Auth):
- [ ] Implementar cifrado de contraseñas con bcrypt en `/internal/usecase/auth.go`.
- [ ] Programar la lógica de login y generación de **Tokens JWT sin estado (Stateless)**.
- [ ] Crear el middleware de Echo para validar los JWTs y extraer el rol del usuario (`admin`, `gerente`, `vendedor`).
- [ ] **Semillero Automático (Critical):** Escribir la lógica en el arranque del servidor para que verifique si existe el usuario `admin` y, si no, lo cree automáticamente con password `admin123` (tal como lo hicimos en Node.js).

### 📋 Checklist del Agente 4 (Casos de Uso Core):
- [ ] **Módulo Clientes:** Crear el repositorio y casos de uso para clientes y contactos (deduplicando por CUIT).
- [ ] **Módulo Productos:** Implementar la lectura unificada del catálogo uniendo la tabla padre `products` con sus tablas débiles hijas mediante `JOINs` limpios en SQL.
- [ ] **Módulo Cotizaciones y Conversión a Pedido:**
  - Bloquear cotizaciones si el cliente es Prospecto (`prospect`).
  - Calcular automáticamente totales netos, totales en kg y precio promedio por kg.
  - Implementar la transacción ACID de **Conversión a Pedido** (crea `orders` y `order_lines`, cambia estado de cotización, promueve al cliente a `final` y cierra las tareas pendientes de la cotización).

---

## ⚡ Fase 4: Motor de CSVs Concurrente y Dashboard Analítico (Domingo por la Mañana)
*El domingo aprovechamos el verdadero poder de Go para programar el procesamiento pesado y de alta velocidad.*

*   **Agentes en Paralelo:**
    *   **Agente 3 (Motor de CSVs - Claude)**
    *   **Agente 4 (Dashboard Analítico - Gemini Pro)**

### 📋 Checklist del Agente 3 (Motor Concurrente de CSVs):
- [ ] Diseñar el **Worker Pool** de Go utilizando canales (`chan`) para procesar filas de forma concurrente.
- [ ] Implementar la carga masiva mediante el protocolo rápido **`CopyFrom` de pgx/v5** para importar productos de golpe.
- [ ] Replicar la lógica de novedades comerciales de `/csv/import/client-followups` insertando un registro `completed` (actividad histórica) y un registro `pending` con `due_date` (tarea programada) dentro de la misma tabla consolidada de interacciones.
- [ ] Programar los mapeos en español del ERP Traficaño (ej: `"Razón social"`, `"Número de cliente"`, etc.) cruzando y resolviendo IDs de vendedores en segundo plano de forma asíncrona.

### 📋 Checklist del Agente 4 (Dashboard Analítico):
- [ ] Programar el endpoint `/api/dashboard/metrics` y `/api/dashboard/commercial-plan`.
- [ ] Separar la analítica para roles Hunter, Farmer y Sales Admin según el plan de migración (Sección 1.1).
- [ ] Crear la tarea programada asíncrona en Go (`Background Worker`) para regenerar los reportes en caché cada 30 minutos, evitando ralentizar la base de datos transaccional en producción.

---

## 🔌 Fase 5: Cableado, Enrutamiento e Integración Frontend (Domingo por la Tarde / Noche)
*El broche de oro. Conectamos todas las piezas y validamos que el frontend en React se comunique de forma transparente.*

*   **Agente Asignado:** **Agente 1 (Arquitecto de Sistemas)**

### 📋 Checklist del Agente 1 (Integrador):
- [ ] **Enrutamiento Dedicado:** Crear el archivo `/internal/delivery/http/routes.go` registrando todos los controladores HTTP de Echo.
- [ ] **Cableado Final:** Completar el archivo `/cmd/api/main.go` conectando el pool de pgx, instanciando repositorios, inyectando los casos de uso en los controladores de Echo, y levantando el servidor en el puerto **`5001`**.
- [ ] **Prueba de Fuego (End-to-End):**
  1.  Levanta tu base de datos PostgreSQL local.
  2.  Inicia tu nuevo servidor Go corriendo `go run cmd/api/main.go` (comprueba que imprima la creación del usuario admin en consola).
  3.  Inicia tu frontend en React (en `./artifacts/crm/` corriendo `npm run dev` o mediante Docker). El proxy de Vite mapeará automáticamente `/api` al puerto `5001`.
  4.  Inicia sesión con `admin` / `admin123`.
  5.  ¡Navega por las pantallas del CRM, sube un CSV de prueba y mira la velocidad de respuesta de tu nuevo backend de Clean Architecture en Go!

---

## 🎯 Tu Meta para el Lunes:
*   Un backend en Go robusto, escalable, con Clean Architecture impecable, un 80% más rápido, y 100% compatible con el frontend existente.
*   **¡El lunes llegas al trabajo a sorprender a todos habiendo completado la migración de Node.js a Golang con éxito total!**
