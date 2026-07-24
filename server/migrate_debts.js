const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'legacy.db');
const db = new Database(dbPath);

console.log('Buscando deudas duplicadas del mismo proveedor...');

const dups = db.prepare(`
  SELECT farm_id, proveedor_name, SUM(total_amount) as total, SUM(remaining) as rem, MIN(id) as keep_id, GROUP_CONCAT(id) as ids
  FROM farm_debts
  GROUP BY farm_id, proveedor_name
  HAVING COUNT(*) > 1
`).all();

console.log('Duplicados encontrados:', dups.length);

for (const d of dups) {
  console.log(`Proveedor ${d.proveedor_name}, farm ${d.farm_id}: total $${d.total}, remaining $${d.rem}, ids: ${d.ids}`);

  db.prepare('UPDATE farm_debts SET total_amount = ?, remaining = ? WHERE id = ?').run(d.total, d.rem, d.keep_id);

  const idsToDelete = d.ids.split(',').map(Number).filter(id => id !== d.keep_id);
  for (const id of idsToDelete) {
    console.log(`  Eliminando deuda duplicada id=${id}`);
    db.prepare('DELETE FROM farm_debts WHERE id = ?').run(id);
  }
}

console.log('\nDeudas después de migración:');
const debts = db.prepare('SELECT * FROM farm_debts').all();
console.log(JSON.stringify(debts, null, 2));
