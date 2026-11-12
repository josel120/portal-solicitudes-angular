# API simulada — Portal de Solicitudes Internas

API REST para la prueba técnica de Angular. Está basada en [json-server 0.17](https://github.com/typicode/json-server/tree/v0.17.4) y simula condiciones de un backend real: latencia variable, errores intermitentes, validaciones del servidor, expiración de sesión y conflictos de concurrencia.

> **No modifiques esta API.** Si crees que tiene un defecto, documéntalo en tu `DECISIONS.md`.

## Requisitos

- Node.js 18 o superior

## Cómo arrancarla

```bash
npm install
npm run api
```

La API queda en `http://localhost:3000`. CORS está habilitado para que la consumas desde `http://localhost:4200` (o los puertos de tus microfrontends).

| Comando | Qué hace |
| --- | --- |
| `npm run api` | Arranca la API con latencia y fallos activados (modo de evaluación) |
| `npm run api:calm` | Arranca sin latencia ni fallos (útil mientras desarrollas) |
| `npm run reset` | Restaura los datos originales (json-server guarda los cambios en `data/db.json`) |

> En Windows, si `api:calm` no funciona, usa `set LATENCY=off&& set FAILURE_RATE=0&& node server.js`.

## Usuarios de prueba

Todos usan la contraseña `Demo123!`.

| Email | Rol |
| --- | --- |
| ana@demo.com | employee |
| bruno@demo.com | employee |
| carla@demo.com | approver |
| diego@demo.com | approver |

## Autenticación

Todas las rutas, excepto `POST /auth/login`, requieren el header:

```
Authorization: Bearer <token>
```

El token dura **15 minutos**. Sin token o con token inválido la API responde `401` con `code: "UNAUTHORIZED"`; con token vencido responde `401` con `code: "TOKEN_EXPIRED"`.

## Endpoints

### `POST /auth/login`

```json
// Request
{ "email": "ana@demo.com", "password": "Demo123!" }

// 200 OK
{
  "token": "3f9c...",
  "expiresAt": "2026-11-09T18:21:00.000Z",
  "user": { "id": 1, "name": "Ana López", "email": "ana@demo.com", "role": "employee", "department": "Finanzas" }
}
```

Errores: `401` credenciales inválidas, `422` campos vacíos.

### `GET /auth/me`

Devuelve el usuario de la sesión actual.

### `POST /auth/logout`

Invalida el token. Responde `204`.

### `GET /requests`

Listado de solicitudes. Parámetros soportados (de json-server):

| Parámetro | Ejemplo | Descripción |
| --- | --- | --- |
| `_page`, `_limit` | `_page=2&_limit=10` | Paginación. El total viene en el header `X-Total-Count` |
| `q` | `q=laptop` | Búsqueda de texto completo |
| `status` | `status=pending` | `pending`, `approved`, `rejected` |
| `type` | `type=travel` | `equipment`, `access`, `travel` |
| `_sort`, `_order` | `_sort=createdAt&_order=desc` | Ordenamiento |

La latencia de este endpoint varía entre 300 y 2000 ms.

Ejemplo de solicitud:

```json
{
  "id": 37,
  "title": "Visita a cliente",
  "type": "travel",
  "status": "pending",
  "requesterId": 2,
  "requesterName": "Bruno Díaz",
  "createdAt": "2026-10-21T14:03:11.000Z",
  "updatedAt": "2026-10-21T14:03:11.000Z",
  "version": 1,
  "details": { "destination": "Bogotá", "startDate": "2026-12-15", "endDate": "2026-12-18" },
  "amount": "8400.00"
}
```

Observa con cuidado los tipos de cada campo.

### `GET /requests/:id`

Detalle de una solicitud. Este endpoint puede fallar de forma intermitente con `500`.

### `POST /requests`

Crea una solicitud. El servidor asigna `id`, `status`, `requesterId`, fechas y `version`.

```json
// Equipo
{ "type": "equipment", "title": "Laptop para diseño", "amount": 2500, "details": { "model": "MacBook Air M3" } }

// Acceso
{ "type": "access", "title": "Acceso a Power BI", "details": { "system": "Power BI", "justification": "Necesito los reportes de ventas del área" } }

// Viaje
{ "type": "travel", "title": "Visita a cliente", "amount": 8400, "details": { "destination": "Bogotá", "startDate": "2026-12-15", "endDate": "2026-12-18" } }
```

Si la validación falla responde `422`. Las claves de `errors` corresponden al nombre del campo (también para los campos dentro de `details`):

```json
{
  "message": "Validación fallida",
  "errors": {
    "endDate": ["La fecha de fin debe ser igual o posterior a la de inicio"],
    "amount": ["El monto máximo para viajes es 15000"]
  }
}
```

El servidor aplica reglas de negocio que no todas están descritas aquí; tu interfaz debe mostrar cualquier error `422` en el campo correspondiente.

### `PATCH /requests/:id`

Aprueba o rechaza una solicitud. **Solo rol `approver`** (otro rol recibe `403`).

```json
{ "status": "approved", "version": 1 }
{ "status": "rejected", "version": 1, "decisionComment": "Sin presupuesto" }
```

- `version` es obligatorio y debe ser la versión que tienes de la solicitud.
- Si otra persona la modificó antes, responde `409` con `code: "VERSION_CONFLICT"` y el estado actual en `current`.
- Rechazar exige `decisionComment`.

### `GET /catalog/types`

Tipos de solicitud disponibles con sus campos requeridos y monto máximo (`amount`).

## Métodos no soportados

`PUT` y `DELETE` responden `405`.
