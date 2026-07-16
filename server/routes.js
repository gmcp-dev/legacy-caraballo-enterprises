const express = require('express');
const router = express.Router();
const db = require('./db');
const { slugify, matchSlug } = require('./slugify');

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(DISTINCT mp.member_id) FROM member_projects mp WHERE mp.project_id = p.id) as member_count,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND type = 'investment') as total_invested,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND type = 'earning') as total_earned,
    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND type = 'expense') as total_expenses
  FROM projects p
`;

// ==================== PROJECTS ====================

router.get('/projects', (req, res) => {
  const projects = db.prepare(`${PROJECT_SELECT} ORDER BY p.created_at DESC`).all();
  projects.forEach(p => { p.slug = slugify(p.name); });
  res.json(projects);
});

router.get('/projects/:slug', (req, res) => {
  const projects = db.prepare(PROJECT_SELECT).all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  project.slug = slugify(project.name);
  res.json(project);
});

router.post('/projects', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, description || '');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  project.slug = slugify(project.name);
  res.status(201).json(project);
});

router.put('/projects/:slug', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const { name, description, status } = req.body;
  db.prepare('UPDATE projects SET name = ?, description = ?, status = ? WHERE id = ?')
    .run(name || project.name, description ?? project.description, status || project.status, project.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
  updated.slug = slugify(updated.name);
  res.json(updated);
});

router.get('/projects/:slug/socios', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const socios = db.prepare(`
    SELECT m.id, m.name, m.photo FROM members m
    JOIN member_projects mp ON m.id = mp.member_id
    WHERE mp.project_id = ?
  `).all(project.id);
  res.json(socios);
});

router.put('/projects/:slug/socios', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const { memberIds } = req.body;
  if (!Array.isArray(memberIds)) return res.status(400).json({ error: 'memberIds debe ser un array' });

  const oldMembers = db.prepare('SELECT member_id FROM member_projects WHERE project_id = ?').all(project.id).map(r => r.member_id);
  const newMemberIds = memberIds.map(Number);

  db.prepare('DELETE FROM member_projects WHERE project_id = ?').run(project.id);
  const insert = db.prepare('INSERT INTO member_projects (member_id, project_id) VALUES (?, ?)');
  newMemberIds.forEach(mid => insert.run(mid, project.id));

  const socioSlug = 'socio';
  const insertRole = db.prepare('INSERT OR IGNORE INTO member_roles (member_id, role) VALUES (?, ?)');
  const hasOtherProject = db.prepare('SELECT COUNT(*) as c FROM member_projects WHERE member_id = ? AND project_id != ?').get;

  for (const mid of newMemberIds) {
    insertRole.run(mid, socioSlug);
  }

  const removedMembers = oldMembers.filter(id => !newMemberIds.includes(id));
  for (const mid of removedMembers) {
    const inOther = hasOtherProject(mid, project.id);
    if (inOther.c === 0) {
      db.prepare('DELETE FROM member_roles WHERE member_id = ? AND role = ?').run(mid, socioSlug);
    }
  }

  const socios = db.prepare(`
    SELECT m.id, m.name, m.photo FROM members m
    JOIN member_projects mp ON m.id = mp.member_id
    WHERE mp.project_id = ?
  `).all(project.id);
  res.json(socios);
});

// ==================== TRANSACTIONS ====================

router.get('/projects/:slug/transactions', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const transactions = db.prepare('SELECT * FROM transactions WHERE project_id = ? ORDER BY date DESC').all(project.id);
  res.json(transactions);
});

router.post('/projects/:slug/transactions', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const { type, amount, description } = req.body;
  if (!type || amount === undefined) return res.status(400).json({ error: 'Tipo y monto son requeridos' });
  if (!['investment', 'earning', 'expense'].includes(type)) return res.status(400).json({ error: 'Tipo invalido' });

  const result = db.prepare('INSERT INTO transactions (project_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(project.id, type, amount, description || '');
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);

  const treasuryType = type === 'expense' ? 'expense' : 'income';
  db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
    .run(treasuryType, amount, description || '', 'project', project.id, project.name);

  res.status(201).json(transaction);
});

router.delete('/projects/:slug/transactions/:transactionId', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const project = projects.find(p => matchSlug(p.name, req.params.slug));
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND project_id = ?').get(req.params.transactionId, project.id);
  if (!tx) return res.status(404).json({ error: 'Transaccion no encontrada' });

  db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  db.prepare('DELETE FROM treasury_transactions WHERE source = ? AND source_id = ? AND amount = ? AND description = ? AND date = ?')
    .run('project', project.id, tx.amount, tx.description || '', tx.date);

  res.json({ success: true });
});

// ==================== TREASURY ====================

router.post('/treasury', (req, res) => {
  const { type, amount, description, source, source_id, source_name } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'El monto es requerido' });
  if (!type || !['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Tipo invalido' });

  const result = db.prepare(
    'INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, amount, description || '', source || 'general', source_id || null, source_name || 'General');

  const tx = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tx);
});

router.delete('/treasury/:id', (req, res) => {
  const tx = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaccion no encontrada' });
  db.prepare('DELETE FROM treasury_transactions WHERE id = ?').run(tx.id);
  res.json({ success: true });
});

router.get('/treasury', (req, res) => {
  const { source, type, period } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (source) {
    where += ' AND source = ?';
    params.push(source);
  }
  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }
  if (period && period !== 'all') {
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
    if (since) {
      where += ' AND date >= ?';
      params.push(since.toISOString());
    }
  }

  const transactions = db.prepare(`SELECT * FROM treasury_transactions ${where} ORDER BY date DESC`).all(...params);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  res.json({ transactions, balance, totalIncome, totalExpense });
});

router.get('/treasury/summary', (req, res) => {
  const projects = db.prepare('SELECT id, name, status FROM projects').all();

  const projectData = projects.map(project => {
    const tx = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type='earning' THEN amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN type='investment' THEN amount ELSE 0 END), 0) as total_invested
      FROM transactions WHERE project_id = ?
    `).get(project.id);

    const physical = tx.total_earned - tx.total_expenses;

    let objectValue = 0;
    const farms = db.prepare('SELECT id, name FROM farms WHERE project_id = ?').all(project.id);
    for (const farm of farms) {
      const inv = db.prepare(`
        SELECT COALESCE(SUM(fi.quantity * fp.price), 0) as total
        FROM farm_inventory fi
        JOIN farm_products fp ON fi.product_id = fp.id
        WHERE fi.farm_id = ?
      `).get(farm.id);
      objectValue += inv.total || 0;
    }

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      physical,
      objectValue,
      total: physical + objectValue,
      total_earned: tx.total_earned,
      total_expenses: tx.total_expenses,
      total_invested: tx.total_invested,
      farmCount: farms.length,
    };
  });

  const totalPhysical = projectData.reduce((s, p) => s + p.physical, 0);
  const totalObjectValue = projectData.reduce((s, p) => s + p.objectValue, 0);

  res.json({
    balance: totalPhysical + totalObjectValue,
    totalPhysical,
    totalObjectValue,
    projects: projectData,
  });
});

// ==================== FINANCIAL SUMMARY ====================

router.get('/finance/summary', (req, res) => {
  const summary = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'investment') as total_invested,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'earning') as total_earned,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense') as total_expenses,
      (SELECT COUNT(DISTINCT member_id) FROM member_roles) as total_partners
  `).get();

  summary.balance = summary.total_earned - summary.total_expenses;
  summary.profit_margin = summary.total_earned > 0
    ? ((summary.balance / summary.total_earned) * 100).toFixed(1)
    : 0;

  res.json(summary);
});

module.exports = router;
