# AI_LOG

Herramienta: **Claude Code** (modelo Claude Opus) en la terminal, con acceso al repositorio, a la API corriendo localmente y a un navegador automatizado (Playwright) para probar la app.

> Este registro lo redactó la IA a partir de la sesión de trabajo. **Revísalo y complétalo con tu propio criterio** (qué aceptaste o cambiaste tú y por qué) antes de entregar: la evaluación mira tu juicio, no el de la IA.

## Qué le pedí

1. "Crea un repositorio público para la prueba (PDF + zip de la API) y clónalo aquí." → repo `portal-solicitudes-angular`, la API descomprimida sin cambios en `api/` como primer commit.
2. "Ya tengo la API corriendo, continúa con el frontend." → todo lo demás: workspace, federación, shared, remotes, pruebas, lint, CI y documentación, en commits incrementales.

## Qué propuso y acepté

- **Angular 22.2** (última estable, el PDF pide "21 o superior, la última estable") y workspace de **Angular CLI + Native Federation** en vez de Nx, compensando con reglas de límites en ESLint y CI por proyecto afectado.
- Leer primero `api/server.js` completo para conocer las reglas reales (reglas ocultas de 3 días y título duplicado, catálogo con `amount` string/número) antes de diseñar los modelos.
- Contrato de carga de remotes: cada remote expone `./routes` con `default export`; el shell carga desde el manifiesto en runtime.
- `RemoteRegistry` con reintento vía `initRemoteEntry` + `withNavigationErrorHandler` → página "no disponible" con Reintentar.
- `amount` normalizado solo en `normalize.ts`; errores normalizados a `ApiError`/`VersionConflictError`.
- Servicios propios con Signals (`SessionStore`, `RequestEvents`) en vez de NgRx SignalStore.
- `rxResource` para evitar condiciones de carrera y `linkedSignal` para el texto de búsqueda y para mantener la página anterior visible.
- Reactive Forms tipados (no Signal Forms) con campos dinámicos guiados por `requiredFields` del catálogo.

## Qué verificó en vez de suponer

- Que Signal Forms es estable en v22 y las firmas reales de `rxResource`, `currentNavigation` y de la API de Native Federation v4 (leyendo los `.d.ts` instalados), en lugar de confiar en lo que recordaba de versiones anteriores.
- En el navegador: guard + `returnUrl`, filtros en la URL tras refresh, montos normalizados, **409 real** (aprobando la misma solicitud con otro aprobador vía `curl`), 422 del servidor en el campo correcto, creación completa, y **remote caído → Reintentar** apagando y levantando `mfe-approvals`.
- Que los singletons quedaron así en `remoteEntry.json` (`@angular/core`, `rxjs`, `@portal/shared` con `singleton` y `strictVersion`).
- Que la regla de límites del lint realmente falla con un import entre remotes.
- Los defectos de la API listados en DECISIONS, con peticiones que no modifican datos.

## Qué se corrigió o rechazó (y por qué)

- **Bug encontrado por las pruebas**: el formulario de rechazo usaba `(ngSubmit)` sin `[formGroup]`, así que nunca se enviaba (solo `ReactiveFormsModule`, sin `NgForm`). Se corrigió envolviendo el control en un `FormGroup`.
- `FieldError` renderizaba el mismo `id` en el host y en el primer mensaje (id duplicado para `aria-describedby`): se eliminó el input redundante.
- Se descartó una hipótesis de defecto de la API ("ordenar por `amount` falla con tipos mezclados") porque al probarlo el orden era correcto; no se documentó.
- Se descartó duplicar en el cliente las reglas de negocio ocultas del servidor: la UI debe mostrar cualquier 422, y duplicar reglas no documentadas las desincroniza.
- Se descartó `@defer` "porque suma puntos": las vistas ya son lazy por ruta y no había contenido diferible que lo justificara.
- La primera versión de la e2e paginaba la bandeja antes de que cargara la tabla; se corrigió esperando cada página.
- La primera ejecución de la e2e falló por `ngDevMode is not defined` tras editar `libs/shared` con el dev server corriendo; se diagnosticó como un problema del rebuild incremental (se arregla reiniciando) y se documentó en lugar de esconderlo.
- Ajustes de lint (`void` en uniones, clase vacía) corregidos en el código, no desactivando reglas.

## Lo que la IA no puede garantizar

- La defensa en vivo es sin IA: conviene recorrer `libs/shared/src/lib/api/requests-api.ts`, `projects/shell/src/app/remotes/remote-registry.ts`, `requests-list.page.ts`, `request-create.page.ts` y `approvals-inbox.page.ts` hasta poder explicarlos y modificarlos.
- El job de deploy de la CI es un placeholder y la CI no se ejecutó en GitHub durante la sesión.
