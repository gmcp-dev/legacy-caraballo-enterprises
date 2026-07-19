const express = require('express');
const router = express.Router();
const db = require('./db');
const { slugify, matchSlug } = require('./slugify');
const { getProjectBySlug } = require('./projects');

const DEFAULT_PRODUCTS = [
  { name: 'Leche', icon: '', price: 0 },
  { name: 'Carne de vaca', icon: '', price: 0 },
  { name: 'Carne de cerdo', icon: '', price: 0 },
  { name: 'Muslos de pollo', icon: '', price: 0 },
  { name: 'Huevos', icon: '', price: 0 },
];

function resolveFarm(projectId, farmSlug) {
  const farms = db.prepare('SELECT * FROM farms WHERE project_id = ?').all(projectId);
  return farms.find(f => matchSlug(f.name, farmSlug));
}

function getDateFilter(period) {
  if (!period || period === 'all') return '';
  const now = new Date();
  let since;
  if (period === 'day') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    since = new Date(now);
    since.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (since) return `AND date >= '${since.toISOString()}'`;
  return '';
}

function getFarmInventory(farmId) {
  const products = db.prepare('SELECT * FROM farm_products WHERE farm_id = ?').all(farmId);
  for (const p of products) {
    const inv = db.prepare('SELECT quantity FROM farm_inventory WHERE farm_id = ? AND product_id = ?').get(farmId, p.id);
    p.quantity = inv ? inv.quantity : 0;
  }
  return products;
}

function getFarmStats(farmId, period) {
  const dateFilter = getDateFilter(period);
  const entradas = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM farm_transactions WHERE farm_id = ? AND type = 'entrada' ${dateFilter}`).get(farmId).total;
  const salidas = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM farm_transactions WHERE farm_id = ? AND type = 'salida' ${dateFilter}`).get(farmId).total;
  const txCount = db.prepare(`SELECT COUNT(*) as c FROM farm_transactions WHERE farm_id = ? ${dateFilter}`).get(farmId).c;

  const inventory = getFarmInventory(farmId);
  const inventoryValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return {
    entradas,
    salidas,
    balance: entradas - salidas,
    transaction_count: txCount,
    inventory_value: inventoryValue,
  };
}

// ==================== FARMS ====================

router.get('/projects/:slug/farms', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const period = req.query.period;
  const farms = db.prepare('SELECT * FROM farms WHERE project_id = ? ORDER BY created_at DESC').all(project.id);
  farms.forEach(f => {
    f.slug = slugify(f.name);
    f.inventory = getFarmInventory(f.id);
    const stats = getFarmStats(f.id, period);
    Object.assign(f, stats);
    f.total_debt = db.prepare('SELECT COALESCE(SUM(remaining), 0) as total FROM farm_debts WHERE farm_id = ?').get(f.id).total;
  });

  res.json(farms);
});

router.get('/projects/:slug/farms/:farmSlug', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  farm.slug = slugify(farm.name);
  farm.inventory = getFarmInventory(farm.id);

  const period = req.query.period;
  const dateFilter = getDateFilter(period);
  farm.transactions = db.prepare(`
    SELECT t.*, fp.name as product_name, fp.icon as product_icon
    FROM farm_transactions t
    LEFT JOIN farm_products fp ON t.product_id = fp.id
    WHERE t.farm_id = ? ${dateFilter}
    ORDER BY t.date DESC
  `).all(farm.id);

  const stats = getFarmStats(farm.id, period);
  Object.assign(farm, stats);

  farm.debts = db.prepare('SELECT * FROM farm_debts WHERE farm_id = ? AND remaining > 0 ORDER BY created_at ASC').all(farm.id);
  farm.total_debt = farm.debts.reduce((sum, d) => sum + d.remaining, 0);

  res.json(farm);
});

router.post('/projects/:slug/farms', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const { name, owner } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare('INSERT INTO farms (project_id, name, owner) VALUES (?, ?, ?)')
    .run(project.id, name, owner || '');

  const farmId = result.lastInsertRowid;

  const insertProduct = db.prepare('INSERT INTO farm_products (farm_id, name, icon, price) VALUES (?, ?, ?, ?)');
  const insertInventory = db.prepare('INSERT INTO farm_inventory (farm_id, product_id, quantity) VALUES (?, ?, 0)');
  for (const p of DEFAULT_PRODUCTS) {
    const prodResult = insertProduct.run(farmId, p.name, p.icon, p.price);
    insertInventory.run(farmId, prodResult.lastInsertRowid);
  }

  if (owner) {
    const ownerMember = db.prepare('SELECT id FROM members WHERE name = ?').get(owner);
    if (ownerMember) {
      db.prepare('INSERT OR IGNORE INTO member_roles (member_id, role) VALUES (?, ?)').run(ownerMember.id, 'proveedor');
    }
  }

  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(farmId);
  farm.slug = slugify(farm.name);
  farm.inventory = getFarmInventory(farmId);
  res.status(201).json(farm);
});

router.put('/projects/:slug/farms/:farmSlug', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  const { name, owner, status } = req.body;
  const newOwner = owner !== undefined ? owner : (farm.owner || '');
  db.prepare('UPDATE farms SET name = ?, owner = ?, status = ? WHERE id = ?')
    .run(name || farm.name, newOwner, status || farm.status, farm.id);

  const oldOwnerName = farm.owner || '';
  if (newOwner !== oldOwnerName) {
    const propSlug = 'proveedor';
    const insertRole = db.prepare('INSERT OR IGNORE INTO member_roles (member_id, role) VALUES (?, ?)');

    if (newOwner) {
      const newOwnerMember = db.prepare('SELECT id FROM members WHERE name = ?').get(newOwner);
      if (newOwnerMember) insertRole.run(newOwnerMember.id, propSlug);
    }

    if (oldOwnerName) {
      const oldOwnerMember = db.prepare('SELECT id FROM members WHERE name = ?').get(oldOwnerName);
      if (oldOwnerMember) {
        const ownsOther = db.prepare('SELECT COUNT(*) as c FROM farms WHERE owner = ? AND id != ?').get(oldOwnerName, farm.id);
        if (ownsOther.c === 0) {
          db.prepare('DELETE FROM member_roles WHERE member_id = ? AND role = ?').run(oldOwnerMember.id, propSlug);
        }
      }
    }
  }

  const updated = db.prepare('SELECT * FROM farms WHERE id = ?').get(farm.id);
  updated.slug = slugify(updated.name);
  updated.inventory = getFarmInventory(farm.id);
  res.json(updated);
});

router.delete('/projects/:slug/farms/:farmSlug', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  if (farm.owner) {
    const ownerMember = db.prepare('SELECT id FROM members WHERE name = ?').get(farm.owner);
    if (ownerMember) {
      const ownsOther = db.prepare('SELECT COUNT(*) as c FROM farms WHERE owner = ? AND id != ?').get(farm.owner, farm.id);
      if (ownsOther.c === 0) {
        db.prepare('DELETE FROM member_roles WHERE member_id = ? AND role = ?').run(ownerMember.id, 'proveedor');
      }
    }
  }

  db.prepare('DELETE FROM farms WHERE id = ?').run(farm.id);
  res.json({ success: true });
});

// ==================== FARM PRODUCTS ====================

router.get('/projects/:slug/farms/:farmSlug/products', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  const products = getFarmInventory(farm.id);
  res.json(products);
});

// ==================== FARM TRANSACTIONS ====================

router.get('/projects/:slug/farms/:farmSlug/transactions', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  const period = req.query.period;
  const dateFilter = getDateFilter(period);
  const transactions = db.prepare(`
    SELECT t.*, fp.name as product_name, fp.icon as product_icon
    FROM farm_transactions t
    LEFT JOIN farm_products fp ON t.product_id = fp.id
    WHERE t.farm_id = ? ${dateFilter}
    ORDER BY t.date DESC
  `).all(farm.id);
  res.json(transactions);
});

router.post('/projects/:slug/farms/:farmSlug/transactions', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  const { type, product_id, quantity, price: inputPrice, description } = req.body;
  if (!type) return res.status(400).json({ error: 'Tipo requerido' });
  if (!['entrada', 'salida'].includes(type)) return res.status(400).json({ error: 'Tipo invalido' });

  const qty = quantity ? parseFloat(quantity) : 0;
  let unitPrice = inputPrice ? parseFloat(inputPrice) : 0;
  let amount = 0;

  if (product_id && qty > 0) {
    if (!unitPrice) {
      const prod = db.prepare('SELECT price FROM farm_products WHERE id = ? AND farm_id = ?').get(product_id, farm.id);
      unitPrice = prod?.price || 0;
    }
    amount = qty * unitPrice;

    db.prepare('UPDATE farm_products SET price = ? WHERE id = ? AND farm_id = ?').run(unitPrice, product_id, farm.id);

    const inv = db.prepare('SELECT * FROM farm_inventory WHERE farm_id = ? AND product_id = ?').get(farm.id, product_id);
    if (inv) {
      const newQty = type === 'entrada' ? inv.quantity + qty : inv.quantity - qty;
      db.prepare('UPDATE farm_inventory SET quantity = ? WHERE id = ?').run(Math.max(0, newQty), inv.id);
    }
  } else if (req.body.amount !== undefined) {
    amount = parseFloat(req.body.amount) || 0;
  }

  const result = db.prepare('INSERT INTO farm_transactions (farm_id, type, product_id, quantity, price, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(farm.id, type, product_id || null, qty || null, unitPrice, amount, description || '');

  const tx = db.prepare(`
    SELECT t.*, fp.name as product_name, fp.icon as product_icon
    FROM farm_transactions t
    LEFT JOIN farm_products fp ON t.product_id = fp.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  const treasuryType = type === 'salida' ? 'expense' : 'income';
  db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
    .run(treasuryType, amount, description || `${farm.name}: ${type === 'entrada' ? 'Entrada' : 'Salida'}`, 'farm', farm.id, farm.name);

  if (type === 'entrada' && farm.owner && amount > 0) {
    db.prepare('INSERT INTO farm_debts (farm_id, proveedor_name, total_amount, remaining, source_tx_id) VALUES (?, ?, ?, ?, ?)')
      .run(farm.id, farm.owner, amount, amount, result.lastInsertRowid);
  }

  if (type === 'salida' && amount > 0) {
    db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
      .run('income', amount, description || `${farm.name}: Venta`, 'project', project.id, project.name);

    const totalDebt = db.prepare('SELECT COALESCE(SUM(remaining), 0) as total FROM farm_debts WHERE farm_id = ?').get(farm.id).total;
    if (totalDebt > 0) {
      const payment = Math.min(amount, totalDebt);
      db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
        .run('expense', payment, `Pago a ${farm.owner}: ${farm.name}`, 'project', project.id, project.name);

      let remaining = payment;
      const debts = db.prepare('SELECT * FROM farm_debts WHERE farm_id = ? AND remaining > 0 ORDER BY created_at ASC').all(farm.id);
      for (const debt of debts) {
        if (remaining <= 0) break;
        const paid = Math.min(remaining, debt.remaining);
        db.prepare('UPDATE farm_debts SET remaining = remaining - ? WHERE id = ?').run(paid, debt.id);
        remaining -= paid;
      }
    }
  }

  res.status(201).json(tx);
});

router.delete('/projects/:slug/farms/:farmSlug/transactions/:txId', (req, res) => {
  const project = getProjectBySlug(req.params.slug);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const farm = resolveFarm(project.id, req.params.farmSlug);
  if (!farm) return res.status(404).json({ error: 'Granja no encontrada' });

  const tx = db.prepare('SELECT * FROM farm_transactions WHERE id = ? AND farm_id = ?').get(req.params.txId, farm.id);
  if (!tx) return res.status(404).json({ error: 'Transaccion no encontrada' });

  if (tx.product_id && tx.quantity) {
    const inv = db.prepare('SELECT * FROM farm_inventory WHERE farm_id = ? AND product_id = ?').get(farm.id, tx.product_id);
    if (inv) {
      const newQty = tx.type === 'entrada' ? inv.quantity - tx.quantity : inv.quantity + tx.quantity;
      db.prepare('UPDATE farm_inventory SET quantity = ? WHERE id = ?').run(Math.max(0, newQty), inv.id);
    }
  }

  db.prepare('DELETE FROM farm_transactions WHERE id = ?').run(tx.id);

  db.prepare('DELETE FROM treasury_transactions WHERE source = ? AND source_id = ? AND amount = ? AND date = ?')
    .run('farm', farm.id, tx.amount, tx.date);

  if (tx.type === 'entrada') {
    db.prepare('DELETE FROM farm_debts WHERE source_tx_id = ?').run(tx.id);
  }

  if (tx.type === 'salida') {
    db.prepare("DELETE FROM treasury_transactions WHERE source = ? AND source_id = ? AND type = 'income' AND amount = ? AND date = ?")
      .run('project', project.id, tx.amount, tx.date);
    db.prepare("DELETE FROM treasury_transactions WHERE source = ? AND source_id = ? AND type = 'expense' AND description LIKE ? AND date = ?")
      .run('project', project.id, `Pago a %: ${farm.name}`, tx.date);
  }

  res.json({ success: true });
});

module.exports = router;
