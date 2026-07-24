const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'legacy.db'));

const totals = db.prepare(`
  SELECT 
    (SELECT COALESCE(SUM(amount), 0) FROM farm_transactions WHERE farm_id = 2 AND type = 'entrada') as total_entradas,
    (SELECT COALESCE(SUM(amount), 0) FROM farm_transactions WHERE farm_id = 2 AND type = 'salida') as total_salidas
`).get();

console.log('Total entradas:', totals.total_entradas);
console.log('Total salidas:', totals.total_salidas);
console.log('Deuda real (entradas - salidas):', totals.total_entradas - totals.total_salidas);

const realDebt = totals.total_entradas - totals.total_salidas;
db.prepare('UPDATE farm_debts SET total_amount = ?, remaining = ? WHERE id = 1').run(totals.total_entradas, realDebt);
console.log('Deuda corregida');

const debt = db.prepare('SELECT * FROM farm_debts').all();
console.log('Resultado final:', JSON.stringify(debt, null, 2));
