/**
 * Restaura data/db.json desde data/db.seed.json (json-server escribe los cambios en db.json).
 * Uso: npm run reset
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'data');
fs.copyFileSync(path.join(dir, 'db.seed.json'), path.join(dir, 'db.json'));
console.log('data/db.json restaurado desde data/db.seed.json');
