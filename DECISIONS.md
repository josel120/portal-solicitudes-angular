# DECISIONS

Decisiones de arquitectura, supuestos, trade-offs y pendientes. Ordenado de lo estructural a lo puntual.

## 1. Workspace y versión

- **Angular 22.2** (última estable al momento; el enunciado pide "21 o superior, la última estable"). Builder `application` (esbuild), TypeScript 6 `strict`, standalone, **zoneless** (en v21+ es el default: no hay `zone.js` en polyfills de ninguna de las 3 apps).
- **Workspace de Angular CLI en vez de Nx.** Native Federation tiene soporte de primera clase en el CLI, el workspace es más simple de explicar y modificar en vivo, y lo que Nx aportaría lo cubrí con piezas explícitas:
  - límites entre módulos → reglas `no-restricted-imports` en `eslint.config.js` (un remote no puede importar a otro ni al shell; todos consumen `@portal/shared` solo por su API pública). Verificado con un archivo de prueba que importaba de `mfe-approvals` desde `mfe-requests`: falla el lint.
  - "solo lo afectado" en CI → `dorny/paths-filter` + matriz por proyecto (un cambio en `libs/shared` o en la config del workspace afecta a todos).
  - Trade-off: sin grafo de dependencias real ni caché de tareas de Nx. Con más remotes migraría a Nx.

## 2. Microfrontends

### División
- `mfe-requests` (dominio del solicitante) y `mfe-approvals` (dominio del aprobador) siguen roles y equipos distintos: es una división por **dominio de negocio**, no técnica. El shell solo compone.

### Carga en runtime
- El shell lee `federation.manifest.json` (en `public/`) al arrancar y llama a `initFederation(manifest)`. **No hay URLs de remotes en el código**; cambiar de entorno = desplegar otro manifiesto.
- Contrato de carga: **cada remote expone `./routes` con su tabla de rutas como `default export`**. El shell las monta con `loadChildren: loadRemoteRoutes('mfe-requests')`. Las rutas internas de cada remote son relativas, así funcionan bajo `/requests` en el shell y en `/` en modo standalone.
- `canMatch` (no `canActivate`) en las rutas de remotes: un usuario anónimo o sin rol **no descarga** el código del remote.

### Remote caído (fallback controlado)
- Si el manifiesto o un remote no responden, el shell **arranca igual** (`main.ts` captura el error de `initFederation`).
- `RemoteRegistry.loadRoutes` intenta cargar el módulo; si falla (p. ej. el remote estaba caído al arrancar y nunca se registró) vuelve a registrar su `remoteEntry` con `initRemoteEntry` y reintenta. Si sigue fallando lanza `RemoteUnavailableError`.
- `withNavigationErrorHandler` convierte ese error en un `RedirectCommand` a `/unavailable?remote=…&returnUrl=…`. El botón **Reintentar** repite la navegación original: el router no cachea `loadChildren` fallidos, así que realmente vuelve a pedir el remote. **Probado a mano**: con `mfe-approvals` apagado aparece el estado de error; al levantarlo y pulsar Reintentar carga sin recargar la página.

### Singletons y estrategia de versiones
- `federation.config.mjs` (las 3 apps): `fromPackageJson({ singleton: true, strictVersion: true, requiredVersion: 'auto' })` para Angular, RxJS y el resto de dependencias, y `sharedMappings` para `@portal/shared` también como singleton. Verificado en el `remoteEntry.json` de los remotes (`singleton: true, strictVersion: true`).
- **Política de versión única**: hay un solo `package.json` en la raíz, así que todas las apps compilan contra exactamente las mismas versiones. `strictVersion` hace que una divergencia futura (si un remote se separara a otro repo) falle de forma ruidosa en vez de cargar dos Angular. Actualizar Angular = actualizar el workspace y redesplegar shell + remotes juntos (es el costo de compartir singletons).
- `@portal/shared` se consume **desde el código fuente** (alias de tsconfig), no como paquete publicado: el versionado es el del monorepo. Si los remotes se separaran, habría que publicarla con semver y `requiredVersion` explícito.

### Comunicación entre remotes
- Los remotes **no se importan entre sí**. Se comunican por:
  1. **Contrato tipado con Signals** en la librería compartida: `RequestEvents` publica `RequestChange` (`created | decided | conflict`) y expone `revision` (signal). `RequestsApi` publica después de crear/aprobar/rechazar y ante un 409.
  2. **URL**: la bandeja enlaza al detalle con `/requests/:id`.
- Así se cumple "al aprobar en mfe-approvals, el listado de mfe-requests se actualiza": el listado lee `revision()` dentro de los `params` de su `rxResource`, y además la caché del listado se invalida al aprobar, por lo que al volver a `/requests` se ve el estado real. Lo cubre la prueba e2e.

### Costos de usar microfrontends (honestamente)
- **Complejidad operativa**: 3 procesos en desarrollo, 3 artefactos y despliegues, un manifiesto por entorno, CORS/URLs entre orígenes.
- **Acoplamiento por versiones**: los singletons estrictos obligan a actualizar Angular en todas las apps a la vez; el "despliegue independiente" lo es para código de negocio, no para upgrades del framework.
- **DX**: el dev server de federación es más lento que `ng serve` normal y tiene trampas propias (ver el final de §11). Los errores de carga de remotes aparecen en runtime, no en compilación.
- **Rendimiento**: un request extra por remote (`remoteEntry.json`) y chunks compartidos que no se pueden optimizar globalmente.
- **Testing**: las pruebas unitarias no detectan problemas de federación; por eso hay una e2e contra las 3 apps reales.
- Para un portal de este tamaño, **un monolito modular con lazy loading sería más barato**. Los microfrontends se justifican si equipos distintos poseen y despliegan cada dominio.

## 3. Estado y sesión

- **Servicios propios con Signals en vez de NgRx SignalStore.** El estado global es pequeño (sesión + un contador de cambios), y el estado de servidor ya lo resuelven `rxResource` + la caché del cliente. Un servicio con `signal/computed` es menos código, sin dependencia adicional (menos cosas que compartir como singleton entre remotes) y fácil de defender. Si el estado creciera (entidades normalizadas, optimistic updates) SignalStore sería el siguiente paso.
- `SessionStore` (`providedIn: 'root'`) vive en `@portal/shared`; al ser la librería un singleton de federación, **shell y remotes leen la misma instancia** (un solo token, un solo timer de expiración).
- La sesión se persiste en `localStorage` para sobrevivir un refresh. Trade-off: un token en `localStorage` es accesible a JS (XSS); lo ideal sería una cookie `HttpOnly`, pero la API devuelve el token en el body. Al restaurar se descartan sesiones vencidas.
- Expiración: además de reaccionar al `401 TOKEN_EXPIRED`, `SessionStore` agenda el fin de sesión en `expiresAt` y `provideAuth()` redirige al login (con `returnUrl`) en ese momento, sin esperar a la próxima petición.

## 4. Datos y API

- **`amount` se normaliza en una sola capa**: `libs/shared/src/lib/api/normalize.ts` (`parseAmount`). Acepta número o string numérico (`"8400.00"`), cualquier otra cosa → `null`. Las vistas solo ven `number | null`. Para `access` se fuerza `null`. El catálogo expone `maxAmount` (un `"0"` en el catálogo significa "este tipo no lleva monto" → `null`).
- Modelos de dominio como **unión discriminada** (`InternalRequest` por `type`), con DTOs separados (`RequestDto`) que reflejan lo que la API manda de verdad.
- Todos los errores se normalizan a `ApiError` (status, code, fieldErrors). Un 409 en `decide` se convierte en `VersionConflictError` con el estado actual (`latest`) ya normalizado.
- **Caché del listado**: en memoria, por query string, TTL 30 s, en `RequestsApi`. Se invalida al crear, al aprobar/rechazar y ante un 409 (el dato que teníamos estaba viejo). Vive en la librería compartida para que una acción en un remote invalide la caché que usa el otro.

## 5. Angular moderno: decisiones puntuales

- **Formularios: Reactive Forms tipados, no Signal Forms.** En Angular 22 Signal Forms ya figura como API estable (en v21 era experimental), pero el enunciado pide explícitamente Reactive Forms tipados en el formulario de creación, el ecosistema y la documentación son más maduros, y es más fácil de defender y modificar en vivo. `NonNullableFormBuilder`, tipos inferidos de `buildRequestForm`.
- **Campos dinámicos según el catálogo**: los controles habilitados para cada tipo salen de `requiredFields` de `/catalog/types`, y el `max` del monto de su `amount`. Los controles deshabilitados no validan ni se envían. El payload se arma con un `switch` sobre el tipo (`toCreatePayload`), así el tipo de TS garantiza que cada solicitud lleva solo sus campos.
- Validación fin ≥ inicio como validador de grupo (`dateRangeValidator`); el error se muestra junto a "Fecha de fin".
- **422 → campo correcto**: `applyServerErrors` busca el control por nombre en profundidad (`endDate` está en `details.endDate`) y pone los mensajes en `errors.server`; los mensajes sin control se muestran en una alerta general. Se probó con reglas que **solo existen en el servidor** (anticipación mínima de 3 días en viajes, título duplicado en pendientes). Decidí **no duplicar** esas reglas no documentadas en el cliente: el servidor es la fuente de verdad y la UI está preparada para cualquier 422.
- **RxJS solo donde aporta**: debounce de la búsqueda (`toObservable` + `debounceTime` + `distinctUntilChanged`), reintentos con backoff, y como puente `rxResource`/`toSignal`. El resto es signals.
- **Condiciones de carrera en la búsqueda**: el listado usa `rxResource`; cuando cambian los `params` (filtros en la URL) cancela la suscripción anterior (semántica `switchMap`, y con `withFetch` la petición HTTP se aborta). Una respuesta lenta y vieja nunca pisa una más nueva.
- **Filtros en la URL**: los query params son la fuente de verdad (`filtersFromParams`/`filtersToParams`), sobreviven un refresh y el back/forward. El texto de búsqueda es un `linkedSignal` de la URL: editable mientras escribes, se resincroniza si la URL cambia. Valores manipulados en la URL vuelven a los defaults.
- `linkedSignal` también mantiene la última página visible mientras carga la siguiente (sin parpadeo; la tabla se atenúa y marca `aria-busy`).
- Detalle (`/requests/:id`): el `id` llega por `input()` (`withComponentInputBinding`). **Reintento automático** (2 veces, backoff de 250/500 ms) solo para GET y solo para 5xx, porque el 500 es transitorio. Si aun así falla se muestra el error con **Reintentar**. Trade-off: oculta parte de los 500 simulados; lo prefiero en UX real.
- `@defer`: no lo usé. Las vistas ya son lazy por ruta (`loadComponent`) y no hay contenido pesado debajo del pliegue que justifique otro nivel de diferido. Lo dejo explícito para no forzarlo.

## 6. Errores y casos borde (resumen)

| Caso | Comportamiento |
| --- | --- |
| 401 `UNAUTHORIZED` / `TOKEN_EXPIRED` | El interceptor cierra la sesión y navega a `/login?returnUrl=<url actual o destino en curso>`; el login explica si la sesión expiró. El 401 del propio login no dispara esto. El `returnUrl` se valida (solo rutas internas). |
| 403 | Guard de rol → `/forbidden`; si la API responde 403 se muestra su mensaje. El rol se chequea en el shell **y** dentro de `mfe-approvals` (el remote no confía en su host). |
| 409 `VERSION_CONFLICT` | Se informa quién/qué cambió ("Otra persona ya dejó la solicitud #7 como aprobada") y la bandeja se refresca con el estado del servidor. |
| 422 | Mensajes bajo cada campo (incluidos los de `details`) y foco al primer campo inválido. |
| 500 en detalle | Reintento automático + estado de error con Reintentar. |
| Remote caído | Sección con error y Reintentar; el resto del shell funciona. |
| Red caída (status 0) | Mensaje "No se pudo contactar al servidor". |
| Lista vacía / sin resultados | Estado vacío con "Limpiar filtros". |

## 7. Accesibilidad

- Labels en todos los campos, `aria-describedby` hacia los mensajes de error, `role="alert"`/`aria-live` para errores y resultados.
- Foco al `h1` de la nueva vista tras cada navegación, y skip link "Saltar al contenido".
- Tabla con **roving tabindex**: un solo tab stop, flechas ↑/↓/Inicio/Fin entre filas, Enter abre el detalle. `caption` describe la interacción.
- `prefers-reduced-motion` respetado en el spinner. Lint con `templateAccessibility` de angular-eslint.

## 8. Testing

- **Unitarias (Vitest, 56)**: normalización de `amount`; `RequestsApi` (params, `X-Total-Count`, caché e invalidación, 409 → `VersionConflictError`, reintento de 500 sí/404 no); interceptor (token solo a nuestra API, 401 → login con `returnUrl`, el 401 del login no cuenta); guards; `SessionStore` (persistencia, expiración); `applyServerErrors`; query params; **componentes**: formulario de creación (campos dinámicos, validación de fechas, payload, 422 en el campo) y bandeja (aprobar, 409, comentario obligatorio al rechazar); `RemoteRegistry` (carga, reintento, remote caído).
- Las pruebas encontraron un bug real: el formulario de rechazo no tenía `[formGroup]`, así que `ngSubmit` nunca se disparaba (ver commit `fix(mfe-approvals)`).
- **E2E (Playwright)**: empleado crea una solicitud → aprobador la aprueba desde la bandeja → el listado y el detalle muestran "Aprobada".

## 9. Defectos y ambigüedades encontrados en la API

Verificados con peticiones reales (sin modificar datos) o por lectura de `api/server.js`:

1. **El catálogo es modificable por cualquier usuario autenticado.** `PATCH /catalog/types/equipment` como `ana` (employee) responde `200`: el router de json-server expone escritura sobre `catalogTypes` (por la misma razón también `POST`, según el código; no lo ejecuté para no alterar datos). Un empleado podría subir el monto máximo permitido.
2. **Un empleado puede ver las solicitudes de todos** (`GET /requests` y `GET /requests/:id` no filtran por `requesterId`). Lo traté como **supuesto**: el listado muestra todas las solicitudes (lo que entrega la API). Si la regla fuera "cada empleado ve solo las suyas", debe aplicarse en el servidor; filtrar en el cliente no es seguridad.
3. **El tipo de `amount` lo decide el cliente**: `POST /requests` guarda `amount: body.amount` tal cual llega (si se envía `"2500"`, queda string). Es el origen de los tipos mezclados del listado. El cliente siempre envía número.
4. **Fechas imposibles aceptadas**: `isIsoDate` usa `Date.parse`, que acepta `2026-02-31` (lo convierte en 3 de marzo).
5. **La regla de 3 días usa la fecha en UTC**: para un usuario en UTC-5 después de las 19:00 el "día mínimo" se corre un día.
6. **`details` no se sanea**: se persiste cualquier clave enviada (asignación masiva), incluidos campos de otro tipo.
7. **El 500 simulado ocurre antes de validar existencia**: `GET /requests/9999` puede responder 500 en vez de 404.
8. **Tokens en memoria**: reiniciar la API invalida todas las sesiones y responde `UNAUTHORIZED` (no `TOKEN_EXPIRED`); el cliente lo maneja igual (vuelve al login).
9. **Reglas de negocio no documentadas** (solo en el servidor): anticipación mínima de 3 días en viajes, título único entre las pendientes propias, justificación de acceso de 20+ caracteres, comentario de rechazo de 5+ caracteres. El README advierte que existen; la UI las muestra vía 422 sin duplicarlas (salvo las de longitud, que son validaciones de formulario obvias).
10. CORS abierto a cualquier origen (default de json-server); aceptable solo en desarrollo.

## 10. Supuestos sobre el enunciado

- "Normalizar amount en una sola capa de la librería compartida": `normalize.ts`, usado por el cliente de API. Las vistas nunca ven strings.
- "Sesión compartida sin duplicar instancias": dentro del shell. En modo standalone cada remote tiene su propio origen (puerto) y por lo tanto su propio `localStorage` y login; es inherente a orígenes distintos.
- La bandeja muestra solo `pending`, de la más antigua a la más reciente (es una cola de trabajo).
- Un aprobador también puede crear solicitudes (la API lo permite).

## 11. Lo que no hice / pendientes

- **i18n**: no implementado; queda la **estrategia**. Todos los textos de dominio están centralizados (`models/labels.ts`, mensajes de validación en `FieldError`). El plan sería `@angular/localize` con `i18n` en las plantillas y **un build por idioma** servido en `/es` y `/en` (compilación AOT, sin costo en runtime). Con federación eso implica que el manifiesto también es por idioma (cada remote publica `/es/remoteEntry.json` y `/en/remoteEntry.json`) y que `@angular/localize` debe compartirse como singleton. Alternativa si se necesita cambiar de idioma en caliente: runtime i18n (Transloco) a costa de bundle y complejidad.
- **Despliegue real**: la CI sube un artefacto por app y el job de deploy es un placeholder; falta el destino (S3+CloudFront, Netlify…) y un manifiesto por entorno.
- Filtro "mis solicitudes" (`requesterId`) y ordenamiento por columnas.
- Foco tras navegar: en vistas que cargan datos de forma asíncrona (detalle) el `h1` aún no existe al terminar la navegación, así que el foco cae en `<main>`. Mejorable moviendo el foco cuando el `h1` aparece.
- Pruebas de accesibilidad automatizadas (axe) y visual regression.

### Problema de DX encontrado y resuelto
- Síntoma: app en blanco con `ReferenceError: ngDevMode is not defined`. Causa: el dev server de Native Federation sirve `remoteEntry.json` y los externals compartidos **desde la carpeta de salida en disco**, y por defecto `ng build` (producción) escribe en la misma (`dist/<app>/browser`). Un build de producción con `npm start` corriendo reemplazaba el import map por uno que apuntaba al Angular de producción (sin `ngDevMode`), mezclado con código de la app compilado en desarrollo.
- Solución: la configuración `development` de cada app escribe en `dist/dev/<app>` (`angular.json`). Verificado: con los dev servers corriendo se hace un `ng build` de producción y la app sigue funcionando.
