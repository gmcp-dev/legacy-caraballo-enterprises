const express = require('express');
const router = express.Router();
const db = require('./db');
const { getProjectBySlug } = require('./projects');

const PROJECT_SLUG = 'big-bistec';

function checkProject(req, res) {
  const project = getProjectBySlug(req.params.slug || PROJECT_SLUG);
  if (!project) {
    res.status(404).json({ error: 'Proyecto no encontrado' });
    return null;
  }
  return project;
}

function getInventory() {
  const products = db.prepare('SELECT * FROM bistec_products ORDER BY created_at DESC').all();
  for (const p of products) {
    const inv = db.prepare('SELECT quantity FROM bistec_inventory WHERE product_id = ?').get(p.id);
    p.quantity = inv ? inv.quantity : 0;
  }
  return products;
}

function getProductInventory(productId) {
  const inv = db.prepare('SELECT quantity FROM bistec_inventory WHERE product_id = ?').get(productId);
  return inv ? inv.quantity : 0;
}

function getDeliveryRemaining(deliveryId) {
  const delivery = db.prepare('SELECT * FROM bistec_deliveries WHERE id = ?').get(deliveryId);
  if (!delivery) return 0;
  const totalSold = db.prepare('SELECT COALESCE(SUM(quantity_sold), 0) as total FROM bistec_sales WHERE delivery_id = ?').get(deliveryId).total;
  const totalReturned = db.prepare('SELECT COALESCE(SUM(quantity_returned), 0) as total FROM bistec_settlements WHERE delivery_id = ?').get(deliveryId).total;
  return Math.max(0, delivery.quantity - totalSold - totalReturned);
}

function getStats() {
  const products = getInventory();
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const inventoryValue = products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.cost_price || 0)), 0);

  const pendingDeliveries = db.prepare("SELECT COUNT(*) as c FROM bistec_deliveries WHERE status = 'pending'").get().c;
  const totalDeliveries = db.prepare('SELECT COUNT(*) as c FROM bistec_deliveries').get().c;

  const totalDeliveredValue = db.prepare('SELECT COALESCE(SUM(quantity * cost_price), 0) as total FROM bistec_deliveries').get().total;
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(revenue), 0) as total FROM bistec_sales').get().total;
  const totalSoldQty = db.prepare('SELECT COALESCE(SUM(quantity_sold), 0) as total FROM bistec_sales').get().total;

  const totalReturnedQty = db.prepare('SELECT COALESCE(SUM(quantity_returned), 0) as total FROM bistec_settlements').get().total;
  const totalReturnedValue = db.prepare(`
    SELECT COALESCE(SUM(s.quantity_returned * d.cost_price), 0) as total
    FROM bistec_settlements s
    JOIN bistec_deliveries d ON s.delivery_id = d.id
  `).get().total;

  const employeeCount = db.prepare('SELECT COUNT(DISTINCT member_id) as c FROM bistec_deliveries').get().c;

  return {
    totalProducts,
    totalStock,
    inventoryValue,
    pendingDeliveries,
    totalDeliveries,
    totalDeliveredValue,
    totalRevenue,
    totalSoldQty,
    totalReturnedQty,
    totalReturnedValue,
    profit: totalRevenue - totalDeliveredValue + totalReturnedValue,
    employeeCount,
  };
}

function getDeliveryDetail(d) {
  const totalSold = db.prepare('SELECT COALESCE(SUM(quantity_sold), 0) as total, COALESCE(SUM(revenue), 0) as revenue FROM bistec_sales WHERE delivery_id = ?').get(d.id);
  const totalReturned = db.prepare('SELECT COALESCE(SUM(quantity_returned), 0) as total FROM bistec_settlements WHERE delivery_id = ?').get(d.id).total;
  d.total_sold = totalSold.total;
  d.total_revenue = totalSold.revenue;
  d.total_returned = totalReturned;
  d.remaining = Math.max(0, d.quantity - d.total_sold - d.total_returned);
  return d;
}

// ==================== PRODUCTS ====================

router.get('/projects/:slug/products', (req, res) => {
  if (!checkProject(req, res)) return;
  res.json(getInventory());
});

router.post('/projects/:slug/products', (req, res) => {
  if (!checkProject(req, res)) return;
  const { name, cost_price, selling_price } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare('INSERT INTO bistec_products (name, cost_price, selling_price) VALUES (?, ?, ?)')
    .run(name, parseFloat(cost_price) || 0, parseFloat(selling_price) || 0);
  db.prepare('INSERT INTO bistec_inventory (product_id, quantity) VALUES (?, 0)').run(result.lastInsertRowid);

  const product = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(result.lastInsertRowid);
  product.quantity = 0;
  res.status(201).json(product);
});

router.put('/projects/:slug/products/:productId', (req, res) => {
  if (!checkProject(req, res)) return;
  const product = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, cost_price, selling_price } = req.body;
  db.prepare('UPDATE bistec_products SET name = ?, cost_price = ?, selling_price = ? WHERE id = ?')
    .run(name || product.name, parseFloat(cost_price) ?? product.cost_price, parseFloat(selling_price) ?? product.selling_price, product.id);

  const updated = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(product.id);
  updated.quantity = getProductInventory(product.id);
  res.json(updated);
});

router.delete('/projects/:slug/products/:productId', (req, res) => {
  if (!checkProject(req, res)) return;
  const product = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  db.prepare('DELETE FROM bistec_products WHERE id = ?').run(product.id);
  res.json({ success: true });
});

// ==================== INVENTORY ====================

router.get('/projects/:slug/inventory', (req, res) => {
  if (!checkProject(req, res)) return;
  res.json(getInventory());
});

router.post('/projects/:slug/inventory', (req, res) => {
  if (!checkProject(req, res)) return;
  const { product_id, quantity, price, description } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'Producto y cantidad son requeridos' });

  const product = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const qty = parseFloat(quantity);
  const unitPrice = price !== undefined ? parseFloat(price) : (product.cost_price || 0);
  const amount = qty * unitPrice;

  db.prepare('UPDATE bistec_products SET cost_price = ? WHERE id = ?').run(unitPrice, product.id);

  const inv = db.prepare('SELECT * FROM bistec_inventory WHERE product_id = ?').get(product.id);
  if (inv) {
    db.prepare('UPDATE bistec_inventory SET quantity = quantity + ? WHERE id = ?').run(qty, inv.id);
  } else {
    db.prepare('INSERT INTO bistec_inventory (product_id, quantity) VALUES (?, ?)').run(product.id, qty);
  }

  db.prepare('INSERT INTO bistec_transactions (product_id, type, quantity, price, amount, description) VALUES (?, ?, ?, ?, ?, ?)')
    .run(product.id, 'entrada', qty, unitPrice, amount, description || '');

  db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
    .run('expense', amount, description || `Big Bistec: Entrada de ${product.name}`, 'project', 2, 'Big Bistec');

  const updated = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(product.id);
  updated.quantity = getProductInventory(product.id);
  res.status(201).json(updated);
});

// ==================== TRANSACTIONS ====================

router.get('/projects/:slug/transactions', (req, res) => {
  if (!checkProject(req, res)) return;
  const transactions = db.prepare(`
    SELECT t.*, bp.name as product_name
    FROM bistec_transactions t
    LEFT JOIN bistec_products bp ON t.product_id = bp.id
    ORDER BY t.date DESC
  `).all();
  res.json(transactions);
});

router.delete('/projects/:slug/transactions/:txId', (req, res) => {
  if (!checkProject(req, res)) return;
  const tx = db.prepare('SELECT * FROM bistec_transactions WHERE id = ?').get(req.params.txId);
  if (!tx) return res.status(404).json({ error: 'Transaccion no encontrada' });

  if (tx.product_id && tx.quantity) {
    const inv = db.prepare('SELECT * FROM bistec_inventory WHERE product_id = ?').get(tx.product_id);
    if (inv) {
      db.prepare('UPDATE bistec_inventory SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(tx.quantity, inv.id);
    }
  }

  db.prepare('DELETE FROM bistec_transactions WHERE id = ?').run(tx.id);
  db.prepare("DELETE FROM treasury_transactions WHERE source = 'project' AND source_id = 2 AND amount = ? AND date = ? AND description LIKE 'Big Bistec:%'")
    .run(tx.amount, tx.date);
  res.json({ success: true });
});

// ==================== EMPLOYEES ====================

router.get('/projects/:slug/employees', (req, res) => {
  const project = checkProject(req, res);
  if (!project) return;

  const employees = db.prepare(`
    SELECT m.id, m.name, m.photo, m.status
    FROM members m
    JOIN member_projects mp ON m.id = mp.member_id
    WHERE mp.project_id = ?
  `).all(project.id);

  for (const emp of employees) {
    emp.roles = db.prepare(`
      SELECT r.role, rd.name, rd.color FROM member_roles r
      JOIN role_definitions rd ON r.role = rd.slug
      WHERE r.member_id = ?
    `).all(emp.id);

    emp.deliveries_count = db.prepare('SELECT COUNT(*) as c FROM bistec_deliveries WHERE member_id = ?').get(emp.id).c;
    emp.pending_deliveries = db.prepare("SELECT COUNT(*) as c FROM bistec_deliveries WHERE member_id = ? AND status = 'pending'").get(emp.id).c;
    emp.total_delivered = db.prepare('SELECT COALESCE(SUM(quantity * cost_price), 0) as total FROM bistec_deliveries WHERE member_id = ?').get(emp.id).total;
    emp.total_revenue = db.prepare('SELECT COALESCE(SUM(revenue), 0) as total FROM bistec_sales WHERE member_id = ?').get(emp.id).total;
  }

  res.json(employees);
});

router.put('/projects/:slug/employees', (req, res) => {
  const project = checkProject(req, res);
  if (!project) return;

  const { memberIds, role } = req.body;
  if (!Array.isArray(memberIds)) return res.status(400).json({ error: 'memberIds debe ser un array' });

  const newMemberIds = memberIds.map(Number);

  db.prepare('DELETE FROM member_projects WHERE project_id = ?').run(project.id);
  const insert = db.prepare('INSERT INTO member_projects (member_id, project_id) VALUES (?, ?)');
  newMemberIds.forEach(mid => insert.run(mid, project.id));

  const roleSlug = role || 'empleado';
  const insertRole = db.prepare('INSERT OR IGNORE INTO member_roles (member_id, role) VALUES (?, ?)');
  for (const mid of newMemberIds) {
    insertRole.run(mid, roleSlug);
  }

  for (const mid of newMemberIds) {
    insertRole.run(mid, 'socio');
  }

  const rolesToRemove = db.prepare(`
    SELECT mr.member_id, mr.role FROM member_roles mr
    WHERE mr.role IN ('socio', 'empleado')
    AND NOT EXISTS (SELECT 1 FROM member_projects mp WHERE mp.member_id = mr.member_id)
  `).all();
  for (const { member_id, role: r } of rolesToRemove) {
    db.prepare('DELETE FROM member_roles WHERE member_id = ? AND role = ?').run(member_id, r);
  }

  const employees = db.prepare(`
    SELECT m.id, m.name, m.photo FROM members m
    JOIN member_projects mp ON m.id = mp.member_id
    WHERE mp.project_id = ?
  `).all(project.id);
  res.json(employees);
});

// ==================== DELIVERIES ====================

router.get('/projects/:slug/deliveries', (req, res) => {
  if (!checkProject(req, res)) return;
  const { member_id, status } = req.query;
  let where = 'WHERE 1=1';
  const params = [];

  if (member_id) { where += ' AND d.member_id = ?'; params.push(parseInt(member_id)); }
  if (status) { where += ' AND d.status = ?'; params.push(status); }

  const deliveries = db.prepare(`
    SELECT d.*, m.name as member_name, bp.name as product_name
    FROM bistec_deliveries d
    LEFT JOIN members m ON d.member_id = m.id
    LEFT JOIN bistec_products bp ON d.product_id = bp.id
    ${where}
    ORDER BY d.date DESC
  `).all(...params);

  deliveries.forEach(getDeliveryDetail);
  res.json(deliveries);
});

router.post('/projects/:slug/deliveries', (req, res) => {
  if (!checkProject(req, res)) return;
  const { member_id, product_id, quantity, assigned_price, description } = req.body;
  if (!member_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Miembro, producto y cantidad son requeridos' });
  }

  const product = db.prepare('SELECT * FROM bistec_products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(member_id);
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  const qty = parseFloat(quantity);
  const costPrice = product.cost_price || 0;
  const assignPrice = parseFloat(assigned_price) || costPrice;

  const currentStock = getProductInventory(product.id);
  if (currentStock < qty) return res.status(400).json({ error: `Stock insuficiente. Disponible: ${currentStock}` });

  const inv = db.prepare('SELECT * FROM bistec_inventory WHERE product_id = ?').get(product.id);
  if (inv) {
    db.prepare('UPDATE bistec_inventory SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(qty, inv.id);
  }

  const result = db.prepare(`
    INSERT INTO bistec_deliveries (member_id, product_id, quantity, cost_price, assigned_price, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(member_id, product.id, qty, costPrice, assignPrice, description || '');

  const delivery = db.prepare(`
    SELECT d.*, m.name as member_name, bp.name as product_name
    FROM bistec_deliveries d
    LEFT JOIN members m ON d.member_id = m.id
    LEFT JOIN bistec_products bp ON d.product_id = bp.id
    WHERE d.id = ?
  `).get(result.lastInsertRowid);
  getDeliveryDetail(delivery);

  res.status(201).json(delivery);
});

router.delete('/projects/:slug/deliveries/:deliveryId', (req, res) => {
  if (!checkProject(req, res)) return;
  const delivery = db.prepare('SELECT * FROM bistec_deliveries WHERE id = ?').get(req.params.deliveryId);
  if (!delivery) return res.status(404).json({ error: 'Entrega no encontrada' });

  const soldQty = db.prepare('SELECT COALESCE(SUM(quantity_sold), 0) as total FROM bistec_sales WHERE delivery_id = ?').get(delivery.id).total;
  const returnedQty = db.prepare('SELECT COALESCE(SUM(quantity_returned), 0) as total FROM bistec_settlements WHERE delivery_id = ?').get(delivery.id).total;

  if (delivery.status === 'pending' || (soldQty === 0 && returnedQty === 0)) {
    const inv = db.prepare('SELECT * FROM bistec_inventory WHERE product_id = ?').get(delivery.product_id);
    if (inv) {
      db.prepare('UPDATE bistec_inventory SET quantity = quantity + ? WHERE id = ?').run(delivery.quantity, inv.id);
    }
  }

  const sales = db.prepare('SELECT * FROM bistec_sales WHERE delivery_id = ?').all(delivery.id);
  for (const sale of sales) {
    if (sale.revenue > 0) {
      db.prepare("DELETE FROM treasury_transactions WHERE source = 'project' AND source_id = 2 AND amount = ? AND description LIKE 'Big Bistec: Venta%' AND date = ?")
        .run(sale.revenue, sale.date);
    }
  }

  db.prepare('DELETE FROM bistec_deliveries WHERE id = ?').run(delivery.id);
  res.json({ success: true });
});

// ==================== SALES ====================

router.get('/projects/:slug/sales', (req, res) => {
  if (!checkProject(req, res)) return;
  const { member_id, delivery_id } = req.query;
  let where = 'WHERE 1=1';
  const params = [];

  if (member_id) { where += ' AND s.member_id = ?'; params.push(parseInt(member_id)); }
  if (delivery_id) { where += ' AND s.delivery_id = ?'; params.push(parseInt(delivery_id)); }

  const sales = db.prepare(`
    SELECT s.*, m.name as member_name, bp.name as product_name
    FROM bistec_sales s
    LEFT JOIN members m ON s.member_id = m.id
    LEFT JOIN bistec_products bp ON s.product_id = bp.id
    ${where}
    ORDER BY s.date DESC
  `).all(...params);
  res.json(sales);
});

router.post('/projects/:slug/sales', (req, res) => {
  if (!checkProject(req, res)) return;
  const { delivery_id, quantity_sold, description } = req.body;
  if (!delivery_id || !quantity_sold) return res.status(400).json({ error: 'Entrega y cantidad vendida son requeridos' });

  const delivery = db.prepare('SELECT * FROM bistec_deliveries WHERE id = ?').get(delivery_id);
  if (!delivery) return res.status(404).json({ error: 'Entrega no encontrada' });
  if (delivery.status === 'settled') return res.status(400).json({ error: 'Esta entrega ya fue liquidada' });

  const qty = parseFloat(quantity_sold);
  const remaining = getDeliveryRemaining(delivery.id);
  if (qty > remaining) return res.status(400).json({ error: `Cantidad excede el disponible. Pendiente: ${remaining}` });

  const revenue = qty * delivery.assigned_price;

  const result = db.prepare(`
    INSERT INTO bistec_sales (delivery_id, product_id, member_id, quantity_sold, revenue, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(delivery_id, delivery.product_id, delivery.member_id, qty, revenue, description || '');

  db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
    .run('income', revenue, description || `Big Bistec: Venta`, 'project', 2, 'Big Bistec');

  const sale = db.prepare(`
    SELECT s.*, m.name as member_name, bp.name as product_name
    FROM bistec_sales s
    LEFT JOIN members m ON s.member_id = m.id
    LEFT JOIN bistec_products bp ON s.product_id = bp.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(sale);
});

router.delete('/projects/:slug/sales/:saleId', (req, res) => {
  if (!checkProject(req, res)) return;
  const sale = db.prepare('SELECT * FROM bistec_sales WHERE id = ?').get(req.params.saleId);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  if (sale.revenue > 0) {
    db.prepare("DELETE FROM treasury_transactions WHERE source = 'project' AND source_id = 2 AND amount = ? AND description LIKE 'Big Bistec: Venta%' AND date = ?")
      .run(sale.revenue, sale.date);
  }

  db.prepare('DELETE FROM bistec_sales WHERE id = ?').run(sale.id);
  res.json({ success: true });
});

// ==================== SETTLEMENTS ====================

router.get('/projects/:slug/settlements', (req, res) => {
  if (!checkProject(req, res)) return;
  const { member_id } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (member_id) { where += ' AND s.member_id = ?'; params.push(parseInt(member_id)); }

  const settlements = db.prepare(`
    SELECT s.*, m.name as member_name, bp.name as product_name
    FROM bistec_settlements s
    LEFT JOIN members m ON s.member_id = m.id
    LEFT JOIN bistec_products bp ON s.product_id = bp.id
    ${where}
    ORDER BY s.date DESC
  `).all(...params);
  res.json(settlements);
});

router.post('/projects/:slug/settlements', (req, res) => {
  if (!checkProject(req, res)) return;
  const { delivery_id, quantity_returned, description } = req.body;
  if (!delivery_id) return res.status(400).json({ error: 'ID de entrega es requerido' });

  const delivery = db.prepare('SELECT * FROM bistec_deliveries WHERE id = ?').get(delivery_id);
  if (!delivery) return res.status(404).json({ error: 'Entrega no encontrada' });
  if (delivery.status === 'settled') return res.status(400).json({ error: 'Esta entrega ya fue liquidada' });

  const returned = parseFloat(quantity_returned) || 0;
  const remaining = getDeliveryRemaining(delivery.id);
  if (returned > remaining) return res.status(400).json({ error: `Cantidad excede el disponible. Pendiente: ${remaining}` });

  const result = db.prepare(`
    INSERT INTO bistec_settlements (delivery_id, product_id, member_id, quantity_returned, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(delivery_id, delivery.product_id, delivery.member_id, returned, description || '');

  if (returned > 0) {
    const inv = db.prepare('SELECT * FROM bistec_inventory WHERE product_id = ?').get(delivery.product_id);
    if (inv) {
      db.prepare('UPDATE bistec_inventory SET quantity = quantity + ? WHERE id = ?').run(returned, inv.id);
    } else {
      db.prepare('INSERT INTO bistec_inventory (product_id, quantity) VALUES (?, ?)').run(delivery.product_id, returned);
    }
  }

  const newRemaining = getDeliveryRemaining(delivery.id);
  if (newRemaining <= 0) {
    db.prepare("UPDATE bistec_deliveries SET status = 'settled' WHERE id = ?").run(delivery_id);
  }

  const settlement = db.prepare(`
    SELECT s.*, m.name as member_name, bp.name as product_name
    FROM bistec_settlements s
    LEFT JOIN members m ON s.member_id = m.id
    LEFT JOIN bistec_products bp ON s.product_id = bp.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(settlement);
});

router.delete('/projects/:slug/settlements/:settlementId', (req, res) => {
  if (!checkProject(req, res)) return;
  const settlement = db.prepare('SELECT * FROM bistec_settlements WHERE id = ?').get(req.params.settlementId);
  if (!settlement) return res.status(404).json({ error: 'Liquidacion no encontrada' });

  if (settlement.quantity_returned > 0) {
    const inv = db.prepare('SELECT * FROM bistec_inventory WHERE product_id = ?').get(settlement.product_id);
    if (inv) {
      db.prepare('UPDATE bistec_inventory SET quantity = MAX(0, quantity - ?) WHERE id = ?').run(settlement.quantity_returned, inv.id);
    }
  }

  db.prepare('UPDATE bistec_deliveries SET status = ? WHERE id = ?').run('pending', settlement.delivery_id);
  db.prepare('DELETE FROM bistec_settlements WHERE id = ?').run(settlement.id);
  res.json({ success: true });
});

// ==================== STATS ====================

router.get('/projects/:slug/stats', (req, res) => {
  if (!checkProject(req, res)) return;
  res.json(getStats());
});

module.exports = router;
