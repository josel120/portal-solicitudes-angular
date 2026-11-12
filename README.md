# Portal de Solicitudes Internas

Prueba técnica Frontend Angular: portal donde los empleados crean solicitudes (equipos, accesos, viajes) y los aprobadores las revisan. Construido como **microfrontends con Native Federation** sobre **Angular 22.2** (la última estable; el enunciado pide 21 o superior).

| Proyecto | Tipo | Puerto | Responsabilidad |
| --- | --- | --- | --- |
| `projects/shell` | Host | 4200 | Layout, menú, login, guards/interceptor, carga de remotes por ruta desde el manifiesto |
| `projects/mfe-requests` | Remote | 4201 | Listado, detalle y creación de solicitudes |
| `projects/mfe-approvals` | Remote | 4202 | Bandeja de aprobación (solo rol `approver`) |
| `libs/shared` (`@portal/shared`) | Librería | — | Modelos, cliente de API, sesión, contrato entre remotes, UI común |
| `api/` | API simulada | 3000 | Provista por la prueba (json-server). **Sin modificar** |

Decisiones de arquitectura, supuestos, defectos encontrados en la API y lo que quedó fuera: **[DECISIONS.md](DECISIONS.md)**. Uso de IA: **[AI_LOG.md](AI_LOG.md)**.

## Requisitos

- Node.js 20.19+ (probado con Node 24) y npm.

## Instalación

```bash
npm install            # workspace Angular (raíz)
npm --prefix api install   # API simulada
```

## Ejecución

### 1. API (puerto 3000)

```bash
cd api
npm run api            # modo evaluación: latencia y fallos activos
npm run reset          # restaura los datos originales
```

Modo tranquilo (sin latencia ni fallos), útil al desarrollar:

```bash
# macOS / Linux
LATENCY=off FAILURE_RATE=0 node server.js
# Windows (cmd)
set LATENCY=off&& set FAILURE_RATE=0&& node server.js
```

Usuarios: `ana@demo.com`, `bruno@demo.com` (employee) · `carla@demo.com`, `diego@demo.com` (approver). Contraseña: `Demo123!`.

### 2. Frontend completo (shell + remotes)

```bash
npm start              # levanta shell (4200), mfe-requests (4201) y mfe-approvals (4202)
```

Abre http://localhost:4200. Cada app es un proceso independiente: puedes detener un remote y el shell sigue funcionando (muestra la sección como no disponible, con botón **Reintentar**).

### 3. Cada app por separado

```bash
npm run start:shell        # ng serve shell
npm run start:requests     # ng serve mfe-requests  → http://localhost:4201 (modo standalone)
npm run start:approvals    # ng serve mfe-approvals → http://localhost:4202 (modo standalone)
```

En modo standalone cada remote tiene su propio login (el `localStorage` es por origen/puerto, así que la sesión no se comparte con el shell en ese modo).

Las URLs de los remotes **no están en el código**: el shell las lee en runtime de [`projects/shell/public/federation.manifest.json`](projects/shell/public/federation.manifest.json). Para otro entorno basta con desplegar un manifiesto distinto.

## Pruebas y calidad

```bash
npm test               # unitarias (Vitest) de shared, shell, mfe-requests y mfe-approvals
npx ng test shared     # una sola librería/app (modo watch)
npm run lint           # ESLint + reglas de límites entre módulos
npm run e2e            # Playwright: empleado crea → aprobador aprueba → el listado lo refleja
npm run build          # build de producción de las 3 apps (dist/<app>/browser)
```

`npm run e2e` reutiliza la API y las apps si ya están levantadas; si no, las inicia (la API en modo tranquilo). La primera vez instala el navegador con `npx playwright install chromium`.

## Estructura

```
api/                         API simulada (provista, sin cambios)
libs/shared/src/lib/
  models/                    tipos de dominio, ApiError, etiquetas
  api/                       RequestsApi, CatalogApi, AuthApi, normalización (amount), caché
  session/                   SessionStore (signals, persistida)
  auth/                      interceptor, guards, provideAuth()
  events/                    RequestEvents: contrato tipado entre remotes
  forms/ ui/                 helpers de formularios y componentes comunes
projects/shell/              host: layout, rutas, RemoteRegistry (carga + reintento)
projects/mfe-requests/       remote: list/, detail/, create/  (expone ./routes)
projects/mfe-approvals/      remote: inbox/                   (expone ./routes)
e2e/                         prueba end-to-end (Playwright)
.github/workflows/ci.yml     CI: lint/test/build de lo afectado, e2e, deploy por app
```
