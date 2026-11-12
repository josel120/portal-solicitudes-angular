/**
 * API simulada — Portal de Solicitudes Internas (prueba técnica Angular)
 * Basada en json-server 0.17.4 + middlewares que simulan condiciones reales.
 *
 * Variables de entorno (opcionales):
 *   PORT=3000            Puerto
 *   TOKEN_TTL_MIN=15     Minutos de vida del token
 *   LATENCY=on|off       Latencia aleatoria (on por defecto)
 *   FAILURE_RATE=0.1     Probabilidad de 500 en GET /requests/:id
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jsonServer = require('json-server');

const PORT = Number(process.env.PORT || 3000);
const TOKEN_TTL_MIN = Number(process.env.TOKEN_TTL_MIN || 15);
const LATENCY_ON = (process.env.LATENCY || 'on') !== 'off';
const FAILURE_RATE = process.env.FAILURE_RATE !== undefined ? Number(process.env.FAILURE_RATE) : 0.1;

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'db.seed.json');
if (!fs.existsSync(DB_FILE)) fs.copyFileSync(SEED_FILE, DB_FILE);

const server = jsonServer.create();
const router = jsonServer.router(DB_FILE);
const db = router.db;

server.use(jsonServer.defaults({ logger: true, noCors: false }));
server.use(jsonServer.bodyParser);

// Exponer headers útiles al navegador (paginación)
server.use((req, res, next) => {
  res.header('Access-Control-Expose-Headers', 'X-Total-Count, Link');
  next();
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const tokens = new Map(); // token -> { userId, expiresAt }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const publicUser = ({ password, ...u }) => u;
const toNumber = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

function validationError(res, errors) {
  return res.status(422).json({ message: 'Validación fallida', errors });
}

// ---------------------------------------------------------------------------
// Rutas bloqueadas (no exponer contraseñas ni el db completo)
// ---------------------------------------------------------------------------
server.all(['/db', '/users', '/users/*'], (req, res) => res.status(404).json({ message: 'No encontrado' }));
server.delete('*', (req, res) => res.status(405).json({ message: 'Método no permitido' }));
server.put('*', (req, res) => res.status(405).json({ message: 'Método no permitido. Usa PATCH.' }));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
server.post('/auth/login', async (req, res) => {
  if (LATENCY_ON) await sleep(randBetween(200, 600));
  const { email, password } = req.body || {};
  const errors = {};
  if (!email) errors.email = ['El email es obligatorio'];
  if (!password) errors.password = ['La contraseña es obligatoria'];
  if (Object.keys(errors).length) return validationError(res, errors);

  const user = db.get('users').find({ email: String(email).toLowerCase().trim() }).value();
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MIN * 60 * 1000;
  tokens.set(token, { userId: user.id, expiresAt });
  res.json({ token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) });
});

// Todo lo demás requiere token
server.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ message: 'No autenticado', code: 'UNAUTHORIZED' });
  }
  const session = tokens.get(token);
  if (Date.now() > session.expiresAt) {
    tokens.delete(token);
    return res.status(401).json({ message: 'La sesión expiró', code: 'TOKEN_EXPIRED' });
  }
  req.user = db.get('users').find({ id: session.userId }).value();
  next();
});

server.get('/auth/me', (req, res) => res.json(publicUser(req.user)));

server.post('/auth/logout', (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  tokens.delete(token);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Latencia y fallos simulados
// ---------------------------------------------------------------------------
server.use(async (req, res, next) => {
  if (!LATENCY_ON || req.method === 'OPTIONS') return next();
  const isList = req.method === 'GET' && /^\/requests\/?$/.test(req.path);
  await sleep(isList ? randBetween(300, 2000) : randBetween(100, 500));
  next();
});

server.get('/requests/:id', (req, res, next) => {
  if (Math.random() < FAILURE_RATE) {
    return res.status(500).json({ message: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
  }
  next();
});

// ---------------------------------------------------------------------------
// Crear solicitud (validación en servidor)
// ---------------------------------------------------------------------------
server.post('/requests', (req, res, next) => {
  const body = req.body || {};
  const details = body.details || {};
  const errors = {};
  const add = (field, msg) => (errors[field] = errors[field] || []).push(msg);

  const type = db.get('catalogTypes').find({ id: body.type }).value();
  if (!body.type) add('type', 'El tipo es obligatorio');
  else if (!type) add('type', 'Tipo de solicitud no válido');

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) add('title', 'El título es obligatorio');
  else if (title.length < 5) add('title', 'El título debe tener al menos 5 caracteres');
  else if (title.length > 80) add('title', 'El título no puede superar 80 caracteres');

  // Regla de negocio solo en servidor: no repetir título en solicitudes pendientes propias
  if (title && db.get('requests').find((r) => r.requesterId === req.user.id && r.status === 'pending' && r.title.toLowerCase() === title.toLowerCase()).value()) {
    add('title', 'Ya tienes una solicitud pendiente con este título');
  }

  const amount = toNumber(body.amount);

  if (body.type === 'equipment') {
    if (!details.model) add('model', 'El modelo es obligatorio');
    if (isNaN(amount) || amount <= 0) add('amount', 'El monto debe ser mayor a 0');
    else if (amount > toNumber(type.amount)) add('amount', `El monto máximo para equipo es ${toNumber(type.amount)}`);
  }

  if (body.type === 'access') {
    if (!details.system) add('system', 'El sistema es obligatorio');
    if (!details.justification || String(details.justification).trim().length < 20) {
      add('justification', 'La justificación debe tener al menos 20 caracteres');
    }
  }

  if (body.type === 'travel') {
    if (!details.destination) add('destination', 'El destino es obligatorio');
    if (!isIsoDate(details.startDate)) add('startDate', 'Fecha de inicio inválida (YYYY-MM-DD)');
    if (!isIsoDate(details.endDate)) add('endDate', 'Fecha de fin inválida (YYYY-MM-DD)');
    if (isIsoDate(details.startDate) && isIsoDate(details.endDate)) {
      if (details.endDate < details.startDate) add('endDate', 'La fecha de fin debe ser igual o posterior a la de inicio');
      // Regla de negocio solo en servidor: anticipación mínima de 3 días
      const minStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (details.startDate < minStart) add('startDate', 'Los viajes se solicitan con al menos 3 días de anticipación');
    }
    if (isNaN(amount) || amount <= 0) add('amount', 'El monto debe ser mayor a 0');
    else if (amount > toNumber(type.amount)) add('amount', `El monto máximo para viajes es ${toNumber(type.amount)}`);
  }

  if (Object.keys(errors).length) return validationError(res, errors);

  const now = new Date().toISOString();
  req.body = {
    title,
    type: body.type,
    status: 'pending',
    requesterId: req.user.id,
    requesterName: req.user.name,
    createdAt: now,
    updatedAt: now,
    version: 1,
    details,
    ...(body.type !== 'access' ? { amount: body.amount } : {})
  };
  next(); // json-server asigna el id y persiste
});

// ---------------------------------------------------------------------------
// Aprobar / rechazar (solo approver, control de concurrencia por version)
// ---------------------------------------------------------------------------
server.patch('/requests/:id', (req, res) => {
  if (req.user.role !== 'approver') {
    return res.status(403).json({ message: 'Solo un aprobador puede cambiar el estado', code: 'FORBIDDEN' });
  }
  const id = Number(req.params.id);
  const current = db.get('requests').find({ id }).value();
  if (!current) return res.status(404).json({ message: 'Solicitud no encontrada' });

  const { status, version, decisionComment } = req.body || {};
  const errors = {};
  if (!['approved', 'rejected'].includes(status)) errors.status = ['El estado debe ser "approved" o "rejected"'];
  if (version === undefined || version === null) errors.version = ['La versión es obligatoria'];
  if (status === 'rejected' && (!decisionComment || String(decisionComment).trim().length < 5)) {
    errors.decisionComment = ['Indica un motivo de rechazo (mínimo 5 caracteres)'];
  }
  if (Object.keys(errors).length) return validationError(res, errors);

  if (Number(version) !== current.version || current.status !== 'pending') {
    return res.status(409).json({
      message: 'La solicitud fue modificada por otra persona',
      code: 'VERSION_CONFLICT',
      current
    });
  }

  const now = new Date().toISOString();
  const updated = db
    .get('requests')
    .find({ id })
    .assign({
      status,
      decisionComment: decisionComment || undefined,
      decidedBy: req.user.id,
      decidedAt: now,
      updatedAt: now,
      version: current.version + 1
    })
    .write();
  res.json(updated);
});

// ---------------------------------------------------------------------------
// Rutas amigables y router de json-server
// ---------------------------------------------------------------------------
server.use(jsonServer.rewriter({ '/catalog/types': '/catalogTypes', '/catalog/types/:id': '/catalogTypes/:id' }));
server.use(router);

server.listen(PORT, () => {
  console.log(`\nAPI de la prueba lista en http://localhost:${PORT}`);
  console.log(`  Token TTL: ${TOKEN_TTL_MIN} min | Latencia: ${LATENCY_ON ? 'on' : 'off'} | Fallo en detalle: ${FAILURE_RATE * 100}%\n`);
});
