# Portal de Solicitudes Internas

Prueba técnica Frontend Angular 21 con microfrontends (shell + mfe-requests + mfe-approvals + libs/shared).

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `api/` | API simulada provista (json-server 0.17). No se modifica. Ver [api/README.md](api/README.md) |

## API

Requiere Node.js 18 o superior.

```bash
cd api
npm install
npm run api        # con latencia y fallos (modo evaluación)
```

La API queda en `http://localhost:3000`. En Windows, para el modo sin latencia ni fallos:

```bash
set LATENCY=off&& set FAILURE_RATE=0&& node server.js
```
