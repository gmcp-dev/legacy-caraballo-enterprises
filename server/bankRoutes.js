const express = require('express');
const router = express.Router();
const db = require('./db');
const { getProjectById } = require('./projects');

const PROJECT_ID = 2;

function getClientStats(clientId) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_loans,
      COALESCE(SUM(l.total_to_pay), 0) as total_lent,
      COALESCE((
        SELECT SUM(p.amount) FROM bank_payments p
        JOIN bank_loans l2 ON p.loan_id = l2.id
        WHERE l2.client_id = ?
      ), 0) as total_paid
    FROM bank_loans l
    WHERE l.client_id = ?
  `).get(clientId, clientId);

  const activeCount = db.prepare(`
    SELECT COUNT(*) as c FROM bank_loans WHERE client_id = ? AND status = 'active'
  `).get(clientId).c;

  return {
    ...stats,
    active_loans: activeCount,
    pending: stats.total_lent - stats.total_paid,
  };
}

function getLoanRemaining(loanId) {
  const paid = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM bank_payments WHERE loan_id = ?
  `).get(loanId).total;
  return paid;
}

function updateLoanStatus(loanId) {
  const loan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(loanId);
  if (!loan || loan.status === 'paid') return;

  const paid = getLoanRemaining(loanId);
  if (paid >= loan.total_to_pay) {
    db.prepare("UPDATE bank_loans SET status = 'paid' WHERE id = ?").run(loanId);
  } else if (new Date(loan.deadline) < new Date()) {
    db.prepare("UPDATE bank_loans SET status = 'overdue' WHERE id = ?").run(loanId);
  } else {
    db.prepare("UPDATE bank_loans SET status = 'active' WHERE id = ?").run(loanId);
  }
}

// ==================== CLIENTS ====================

router.get('/bank/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM bank_clients ORDER BY created_at DESC').all();
  for (const c of clients) {
    const stats = getClientStats(c.id);
    Object.assign(c, stats);
  }
  res.json(clients);
});

router.get('/bank/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM bank_clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  const stats = getClientStats(client.id);
  Object.assign(client, stats);

  const loans = db.prepare('SELECT * FROM bank_loans WHERE client_id = ? ORDER BY created_at DESC').all(client.id);
  for (const loan of loans) {
    updateLoanStatus(loan.id);
    const paid = getLoanRemaining(loan.id);
    loan.paid = paid;
    loan.remaining = loan.total_to_pay - paid;
    loan.payments = db.prepare('SELECT * FROM bank_payments WHERE loan_id = ? ORDER BY created_at DESC').all(loan.id);
  }

  client.loans = loans;
  res.json(client);
});

router.post('/bank/clients', (req, res) => {
  const { name, phone, profile_link } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare('INSERT INTO bank_clients (name, phone, profile_link) VALUES (?, ?, ?)')
    .run(name, phone || null, profile_link || null);
  const client = db.prepare('SELECT * FROM bank_clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(client);
});

router.put('/bank/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM bank_clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { name, phone, profile_link, status } = req.body;
  db.prepare('UPDATE bank_clients SET name = ?, phone = ?, profile_link = ?, status = ? WHERE id = ?')
    .run(name || client.name, phone ?? client.phone, profile_link ?? client.profile_link, status || client.status, client.id);

  const updated = db.prepare('SELECT * FROM bank_clients WHERE id = ?').get(client.id);
  const stats = getClientStats(client.id);
  Object.assign(updated, stats);
  res.json(updated);
});

router.delete('/bank/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM bank_clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  const active = db.prepare("SELECT COUNT(*) as c FROM bank_loans WHERE client_id = ? AND status = 'active'").get(client.id).c;
  if (active > 0) return res.status(400).json({ error: 'No se puede eliminar: tiene prestamos activos' });

  db.prepare('DELETE FROM bank_clients WHERE id = ?').run(client.id);
  res.json({ success: true });
});

// ==================== LOANS ====================

router.get('/bank/loans', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT bl.*, bc.name as client_name,
      COALESCE((SELECT SUM(bp.amount) FROM bank_payments bp WHERE bp.loan_id = bl.id), 0) as paid
    FROM bank_loans bl
    JOIN bank_clients bc ON bl.client_id = bc.id
  `;
  const params = [];
  if (status && status !== 'all') {
    query += ' WHERE bl.status = ?';
    params.push(status);
  }
  query += ' ORDER BY bl.created_at DESC';

  const loans = db.prepare(query).all(...params);
  for (const loan of loans) {
    loan.remaining = loan.total_to_pay - loan.paid;
    updateLoanStatus(loan.id);
  }
  res.json(loans);
});

router.post('/bank/loans', (req, res) => {
  const { client_id, amount, interest_pct, deadline, description } = req.body;
  if (!client_id || !amount || !interest_pct || !deadline) {
    return res.status(400).json({ error: 'Cliente, monto, interes y fecha limite son requeridos' });
  }

  const client = db.prepare('SELECT * FROM bank_clients WHERE id = ?').get(client_id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  const amt = parseFloat(amount);
  const pct = parseFloat(interest_pct);
  const total_to_pay = amt + (amt * pct / 100);

  const result = db.prepare('INSERT INTO bank_loans (client_id, amount, interest_pct, total_to_pay, deadline, description) VALUES (?, ?, ?, ?, ?, ?)')
    .run(client_id, amt, pct, total_to_pay, deadline, description || '');

  db.prepare("INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)")
    .run('expense', amt, `Prestamo a ${client.name}: ${description || ''}`.trim(), 'project', PROJECT_ID, 'Banco MAZE');

  const loan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(result.lastInsertRowid);
  loan.paid = 0;
  loan.remaining = total_to_pay;
  res.status(201).json(loan);
});

router.put('/bank/loans/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Prestamo no encontrado' });
  if (loan.status === 'paid') return res.status(400).json({ error: 'No se puede editar un prestamo pagado' });

  const { interest_pct, deadline, description, status } = req.body;

  let newPct = loan.interest_pct;
  if (interest_pct !== undefined) newPct = parseFloat(interest_pct);

  const newTotal = loan.amount + (loan.amount * newPct / 100);

  db.prepare('UPDATE bank_loans SET interest_pct = ?, total_to_pay = ?, deadline = ?, description = ?, status = ? WHERE id = ?')
    .run(newPct, newTotal, deadline || loan.deadline, description ?? loan.description, status || loan.status, loan.id);

  const updated = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(loan.id);
  const paid = getLoanRemaining(loan.id);
  updated.paid = paid;
  updated.remaining = updated.total_to_pay - paid;
  res.json(updated);
});

router.delete('/bank/loans/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Prestamo no encontrado' });

  const client = db.prepare('SELECT name FROM bank_clients WHERE id = ?').get(loan.client_id);

  const paid = getLoanRemaining(loan.id);
  if (paid > 0) {
    db.prepare("INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)")
      .run('income', paid, `Devolucion prestamo: ${client ? client.name : 'N/A'}`, 'project', PROJECT_ID, 'Banco MAZE');
  }

  db.prepare('DELETE FROM bank_loans WHERE id = ?').run(loan.id);
  res.json({ success: true });
});

// ==================== PAYMENTS ====================

router.get('/bank/payments', (req, res) => {
  const payments = db.prepare(`
    SELECT bp.*, bc.name as client_name, bl.amount as loan_amount, bl.total_to_pay as loan_total_to_pay, bl.interest_pct as loan_interest_pct, bl.deadline as loan_deadline, bl.status as loan_status
    FROM bank_payments bp
    JOIN bank_loans bl ON bp.loan_id = bl.id
    JOIN bank_clients bc ON bl.client_id = bc.id
    ORDER BY bp.created_at DESC
  `).all();
  for (const p of payments) {
    const paid = getLoanRemaining(p.loan_id);
    p.loan_remaining = p.loan_total_to_pay - paid;
  }
  res.json(payments);
});

router.post('/bank/loans/:id/pay', (req, res) => {
  const loan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Prestamo no encontrado' });
  if (loan.status === 'paid') return res.status(400).json({ error: 'Este prestamo ya esta pagado' });

  const { amount, description } = req.body;
  if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'El monto es requerido' });

  const payAmt = parseFloat(amount);
  const paid = getLoanRemaining(loan.id);
  const remaining = loan.total_to_pay - paid;
  const actualPay = Math.min(payAmt, remaining);

  const result = db.prepare('INSERT INTO bank_payments (loan_id, amount, description) VALUES (?, ?, ?)')
    .run(loan.id, actualPay, description || '');

  const client = db.prepare('SELECT name FROM bank_clients WHERE id = ?').get(loan.client_id);
  db.prepare("INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)")
    .run('income', actualPay, `Pago de ${client ? client.name : 'N/A'}: prestamo #${loan.id}`, 'project', PROJECT_ID, 'Banco MAZE');

  updateLoanStatus(loan.id);

  const payment = db.prepare('SELECT * FROM bank_payments WHERE id = ?').get(result.lastInsertRowid);
  const updatedLoan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(loan.id);
  const newPaid = getLoanRemaining(loan.id);
  updatedLoan.paid = newPaid;
  updatedLoan.remaining = updatedLoan.total_to_pay - newPaid;
  updatedLoan.client_name = client ? client.name : 'N/A';

  res.status(201).json({ payment, loan: updatedLoan });
});

router.delete('/bank/payments/:id', (req, res) => {
  const payment = db.prepare('SELECT * FROM bank_payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });

  const loan = db.prepare('SELECT * FROM bank_loans WHERE id = ?').get(payment.loan_id);
  const client = loan ? db.prepare('SELECT name FROM bank_clients WHERE id = ?').get(loan.client_id) : null;

  db.prepare("INSERT INTO treasury_transactions (type, amount, description, source, source_id, source_name) VALUES (?, ?, ?, ?, ?, ?)")
    .run('expense', payment.amount, `Reverso pago: ${client ? client.name : 'N/A'}: prestamo #${payment.loan_id}`, 'project', PROJECT_ID, 'Banco MAZE');

  db.prepare('DELETE FROM bank_payments WHERE id = ?').run(payment.id);

  if (loan) updateLoanStatus(loan.id);
  res.json({ success: true });
});

// ==================== STATS ====================

router.get('/bank/stats', (req, res) => {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(l.amount), 0) as total_lent,
      COALESCE(SUM(l.total_to_pay), 0) as total_to_recover,
      (SELECT COALESCE(SUM(p.amount), 0) FROM bank_payments p JOIN bank_loans l2 ON p.loan_id = l2.id) as total_paid,
      (SELECT COUNT(*) FROM bank_loans WHERE status = 'active') as active_loans,
      (SELECT COUNT(*) FROM bank_loans WHERE status = 'overdue') as overdue_loans,
      (SELECT COUNT(*) FROM bank_loans WHERE status = 'paid') as paid_loans,
      (SELECT COUNT(*) FROM bank_clients WHERE status = 'active') as total_clients
    FROM bank_loans l
  `).get();

  totals.pending = totals.total_to_recover - totals.total_paid;
  totals.profit = totals.total_paid - totals.total_lent;

  res.json(totals);
});

module.exports = router;
