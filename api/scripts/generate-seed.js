/**
 * Genera data/db.seed.json con datos de ejemplo deterministas.
 * Uso: npm run seed   (luego npm run reset para copiarlo a data/db.json)
 *
 * Cambia SEED para rotar los datos entre convocatorias.
 */
const fs = require('fs');
const path = require('path');

const SEED = Number(process.env.SEED || 2026);
const TOTAL_REQUESTS = 120;

// PRNG determinista (mulberry32) para que todos los candidatos reciban los mismos datos
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const users = [
  { id: 1, name: 'Ana López', email: 'ana@demo.com', password: 'Demo123!', role: 'employee', department: 'Finanzas' },
  { id: 2, name: 'Bruno Díaz', email: 'bruno@demo.com', password: 'Demo123!', role: 'employee', department: 'Operaciones' },
  { id: 3, name: 'Carla Méndez', email: 'carla@demo.com', password: 'Demo123!', role: 'approver', department: 'Dirección' },
  { id: 4, name: 'Diego Ruiz', email: 'diego@demo.com', password: 'Demo123!', role: 'approver', department: 'Dirección' }
];

// Nota intencional: "amount" llega a veces como número y a veces como string.
const catalogTypes = [
  { id: 'equipment', name: 'Equipo', description: 'Laptops, monitores, periféricos', amount: 3000, requiredFields: ['model', 'amount'] },
  { id: 'access', name: 'Acceso', description: 'Accesos a sistemas o carpetas', amount: '0', requiredFields: ['system', 'justification'] },
  { id: 'travel', name: 'Viaje', description: 'Viajes de trabajo', amount: '15000.00', requiredFields: ['destination', 'startDate', 'endDate', 'amount'] }
];

const titles = {
  equipment: ['Laptop nueva', 'Monitor adicional', 'Teclado ergonómico', 'Docking station', 'Headset con micrófono', 'Mouse vertical'],
  access: ['Acceso a SAP', 'Acceso a Jira', 'Carpeta compartida de Finanzas', 'VPN corporativa', 'Acceso a Power BI', 'Repositorio GitLab'],
  travel: ['Visita a cliente', 'Capacitación presencial', 'Feria comercial', 'Auditoría en sucursal', 'Reunión regional', 'Kick-off de proyecto']
};
const models = ['Dell Latitude 7450', 'MacBook Air M3', 'LG 27UP850', 'Logitech MX Keys', 'Lenovo ThinkPad T14', 'Jabra Evolve2 65'];
const systems = ['SAP', 'Jira', 'Power BI', 'GitLab', 'VPN', 'SharePoint'];
const destinations = ['Ciudad de México', 'Monterrey', 'Guadalajara', 'Bogotá', 'Madrid', 'Miami', 'Lima', 'Santiago'];
const statuses = ['pending', 'pending', 'pending', 'approved', 'approved', 'rejected'];

const DAY = 24 * 60 * 60 * 1000;
const base = Date.UTC(2026, 9, 1); // 1 oct 2026

function isoDate(ms) { return new Date(ms).toISOString().slice(0, 10); }

// Monto a veces número, a veces string (con o sin decimales)
function messyAmount(n) {
  const r = rand();
  if (r < 0.5) return n;
  if (r < 0.8) return String(n);
  return n.toFixed(2);
}

const requests = [];
for (let i = 1; i <= TOTAL_REQUESTS; i++) {
  const type = pick(['equipment', 'access', 'travel']);
  const requester = pick(users.filter((u) => u.role === 'employee'));
  const status = pick(statuses);
  const createdAt = new Date(base + int(0, 38) * DAY + int(0, 86399) * 1000).toISOString();

  const r = {
    id: i,
    title: pick(titles[type]),
    type,
    status,
    requesterId: requester.id,
    requesterName: requester.name,
    createdAt,
    updatedAt: createdAt,
    version: 1,
    details: {}
  };

  if (type === 'equipment') {
    r.details = { model: pick(models) };
    r.amount = messyAmount(int(30, 60) * 50);
  } else if (type === 'access') {
    r.details = { system: pick(systems), justification: 'Necesario para las tareas del puesto' };
  } else {
    const start = base + int(40, 90) * DAY;
    r.details = { destination: pick(destinations), startDate: isoDate(start), endDate: isoDate(start + int(1, 5) * DAY) };
    r.amount = messyAmount(int(20, 140) * 100);
  }

  if (status !== 'pending') {
    const approver = pick(users.filter((u) => u.role === 'approver'));
    r.decidedBy = approver.id;
    r.decidedAt = new Date(new Date(createdAt).getTime() + int(1, 4) * DAY).toISOString();
    r.updatedAt = r.decidedAt;
    r.version = 2;
    if (status === 'rejected') r.decisionComment = 'Sin presupuesto este trimestre';
  }

  requests.push(r);
}

// Orden más reciente primero (el candidato puede usar _sort=createdAt&_order=desc)
requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const db = { users, catalogTypes, requests };
const out = path.join(__dirname, '..', 'data', 'db.seed.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(db, null, 2));
console.log(`Seed generado: ${out} (${requests.length} solicitudes, ${users.length} usuarios, SEED=${SEED})`);
