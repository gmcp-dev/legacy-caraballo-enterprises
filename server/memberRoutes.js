const express = require('express');
const router = express.Router();
const db = require('./db');
const { slugify, matchSlug } = require('./slugify');
const { getProjectById } = require('./projects');

function getMemberById(id) {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!member) return null;

  member.slug = slugify(member.name);
  member.roles = db.prepare(`
    SELECT r.role, rd.name, rd.color FROM member_roles r
    JOIN role_definitions rd ON r.role = rd.slug
    WHERE r.member_id = ?
  `).all(id);

  member.projects = db.prepare(`
    SELECT mp.project_id FROM member_projects mp
    WHERE mp.member_id = ?
  `).all(id).map(r => {
    const p = getProjectById(r.project_id);
    return p ? { id: p.id, name: p.name, status: p.status } : null;
  }).filter(Boolean);

  member.farms = db.prepare(`
    SELECT f.id, f.name, f.status FROM farms f
    JOIN member_farms mf ON f.id = mf.farm_id
    WHERE mf.member_id = ?
  `).all(id);

  member.investments = db.prepare('SELECT * FROM investments WHERE member_id = ? ORDER BY date DESC').all(id);
  member.total_invested = member.investments.reduce((sum, inv) => sum + inv.amount, 0);

  return member;
}

function resolveMemberId(slugOrId) {
  const num = parseInt(slugOrId);
  if (!isNaN(num)) {
    const member = db.prepare('SELECT id FROM members WHERE id = ?').get(num);
    if (member) return member.id;
  }
  const all = db.prepare('SELECT id, name FROM members').all();
  const found = all.find(m => matchSlug(m.name, slugOrId));
  return found ? found.id : null;
}

// ==================== ROLE DEFINITIONS ====================

router.get('/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM role_definitions ORDER BY is_special DESC, created_at ASC').all();
  res.json(roles);
});

router.post('/roles', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const slug = slugify(name);
  const existing = db.prepare('SELECT id FROM role_definitions WHERE slug = ?').get(slug);
  if (existing) return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });

  const result = db.prepare('INSERT INTO role_definitions (name, slug, color) VALUES (?, ?, ?)').run(name, slug, color || '#c9a84c');
  const role = db.prepare('SELECT * FROM role_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(role);
});

router.put('/roles/:id', (req, res) => {
  const role = db.prepare('SELECT * FROM role_definitions WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

  const { name, color } = req.body;
  db.prepare('UPDATE role_definitions SET name = ?, color = ? WHERE id = ?')
    .run(name || role.name, color || role.color, req.params.id);

  const updated = db.prepare('SELECT * FROM role_definitions WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/roles/:id', (req, res) => {
  const role = db.prepare('SELECT * FROM role_definitions WHERE id = ?').get(req.params.id);
  if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
  if (role.is_special) return res.status(400).json({ error: 'No se pueden eliminar roles especiales' });

  db.prepare('DELETE FROM role_definitions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== MEMBER STATS ====================

router.get('/members/stats/summary', (req, res) => {
  const roles = db.prepare('SELECT slug, name FROM role_definitions').all();
  const summary = {
    total_members: db.prepare('SELECT COUNT(*) as c FROM members WHERE status = \'active\'').get().c,
    total_invested: db.prepare('SELECT COALESCE(SUM(amount), 0) as c FROM investments').get().c,
  };
  roles.forEach(r => {
    summary[`total_${r.slug}`] = db.prepare('SELECT COUNT(DISTINCT member_id) as c FROM member_roles WHERE role = ?').get(r.slug).c;
  });
  res.json(summary);
});

// ==================== MEMBERS ====================

router.get('/members', (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
  members.forEach(m => {
    m.slug = slugify(m.name);
    m.roles = db.prepare(`
      SELECT r.role, rd.name, rd.color FROM member_roles r
      JOIN role_definitions rd ON r.role = rd.slug
      WHERE r.member_id = ?
    `).all(m.id);
    m.projects = db.prepare('SELECT project_id FROM member_projects WHERE member_id = ?').all(m.id).map(r => {
      const p = getProjectById(r.project_id);
      return p ? { id: p.id, name: p.name } : null;
    }).filter(Boolean);
    m.farms = db.prepare('SELECT f.id, f.name FROM farms f JOIN member_farms mf ON f.id = mf.farm_id WHERE mf.member_id = ?').all(m.id);
    m.total_invested = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM investments WHERE member_id = ?').get(m.id).total;
  });
  res.json(members);
});

router.get('/members/:slug', (req, res) => {
  const memberId = resolveMemberId(req.params.slug);
  if (!memberId) return res.status(404).json({ error: 'Miembro no encontrado' });
  const member = getMemberById(memberId);
  res.json(member);
});

router.post('/members', (req, res) => {
  const { name, photo, roles, projectIds, farmIds } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare('INSERT INTO members (name, photo) VALUES (?, ?)').run(name, photo || null);
  const memberId = result.lastInsertRowid;

  if (roles && Array.isArray(roles)) {
    const validSlugs = db.prepare('SELECT slug FROM role_definitions').all().map(r => r.slug);
    const insertRole = db.prepare('INSERT INTO member_roles (member_id, role) VALUES (?, ?)');
    roles.forEach(role => {
      if (validSlugs.includes(role)) insertRole.run(memberId, role);
    });
  }

  if (projectIds && Array.isArray(projectIds)) {
    const insertProject = db.prepare('INSERT INTO member_projects (member_id, project_id) VALUES (?, ?)');
    projectIds.forEach(pid => insertProject.run(memberId, pid));
  }

  if (farmIds && Array.isArray(farmIds)) {
    const insertFarm = db.prepare('INSERT INTO member_farms (member_id, farm_id) VALUES (?, ?)');
    farmIds.forEach(fid => insertFarm.run(memberId, fid));
  }

  res.status(201).json(getMemberById(memberId));
});

router.put('/members/:slug', (req, res) => {
  const memberId = resolveMemberId(req.params.slug);
  if (!memberId) return res.status(404).json({ error: 'Miembro no encontrado' });

  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  const { name, photo, status, roles, projectIds, farmIds } = req.body;

  db.prepare('UPDATE members SET name = ?, photo = ?, status = ? WHERE id = ?')
    .run(name || existing.name, photo ?? existing.photo, status || existing.status, memberId);

  if (roles && Array.isArray(roles)) {
    db.prepare('DELETE FROM member_roles WHERE member_id = ?').run(memberId);
    const validSlugs = db.prepare('SELECT slug FROM role_definitions').all().map(r => r.slug);
    const insertRole = db.prepare('INSERT INTO member_roles (member_id, role) VALUES (?, ?)');
    roles.forEach(role => {
      if (validSlugs.includes(role)) insertRole.run(memberId, role);
    });
  }

  if (projectIds && Array.isArray(projectIds)) {
    db.prepare('DELETE FROM member_projects WHERE member_id = ?').run(memberId);
    const insertProject = db.prepare('INSERT INTO member_projects (member_id, project_id) VALUES (?, ?)');
    projectIds.forEach(pid => insertProject.run(memberId, pid));
  }

  if (farmIds && Array.isArray(farmIds)) {
    db.prepare('DELETE FROM member_farms WHERE member_id = ?').run(memberId);
    const insertFarm = db.prepare('INSERT INTO member_farms (member_id, farm_id) VALUES (?, ?)');
    farmIds.forEach(fid => insertFarm.run(memberId, fid));
  }

  res.json(getMemberById(memberId));
});

router.delete('/members/:slug', (req, res) => {
  const memberId = resolveMemberId(req.params.slug);
  if (!memberId) return res.status(404).json({ error: 'Miembro no encontrado' });
  db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
  res.json({ success: true });
});

// ==================== INVESTMENTS ====================

router.get('/members/:slug/investments', (req, res) => {
  const memberId = resolveMemberId(req.params.slug);
  if (!memberId) return res.status(404).json({ error: 'Miembro no encontrado' });

  const investments = db.prepare('SELECT * FROM investments WHERE member_id = ? ORDER BY date DESC').all(memberId);
  res.json(investments);
});

router.post('/members/:slug/investments', (req, res) => {
  const memberId = resolveMemberId(req.params.slug);
  if (!memberId) return res.status(404).json({ error: 'Miembro no encontrado' });

  const { amount, description } = req.body;
  if (!amount) return res.status(400).json({ error: 'El monto es requerido' });

  const result = db.prepare('INSERT INTO investments (member_id, amount, description) VALUES (?, ?, ?)')
    .run(memberId, amount, description || '');

  const member = db.prepare('SELECT name FROM members WHERE id = ?').get(memberId);
  db.prepare('INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)')
    .run('income', amount, description || `Inversion de ${member?.name || 'Miembro'}`, 'general', memberId, member?.name || 'Miembro');

  const investment = db.prepare('SELECT * FROM investments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(investment);
});

router.delete('/members/:slug/investments/:investmentId', (req, res) => {
  const memberId = resolveMemberId(req.params.slug);
  if (!memberId) return res.status(404).json({ error: 'Miembro no encontrado' });

  const inv = db.prepare('SELECT * FROM investments WHERE id = ? AND member_id = ?').get(req.params.investmentId, memberId);
  if (!inv) return res.status(404).json({ error: 'Inversion no encontrada' });

  const member = db.prepare('SELECT name FROM members WHERE id = ?').get(memberId);
  db.prepare('DELETE FROM treasury_transactions WHERE source = ? AND source_id = ? AND amount = ? AND description LIKE ?')
    .run('general', memberId, inv.amount, `%${member?.name || ''}%`);

  db.prepare('DELETE FROM investments WHERE id = ?').run(inv.id);
  res.json({ success: true });
});

module.exports = router;
