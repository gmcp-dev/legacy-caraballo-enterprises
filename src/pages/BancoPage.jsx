import { useState, useEffect, useCallback } from 'react';
import BankReceipt from '../components/BankReceipt';
import './BancoPage.css';

const API = '/api';

const statusColors = {
  active: '#22c55e',
  paid: '#60a5fa',
  overdue: '#f87171',
};
const statusLabels = {
  active: 'Activo',
  paid: 'Pagado',
  overdue: 'Vencido',
};

export default function BancoPage() {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loanFilter, setLoanFilter] = useState('all');

  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', profile_link: '' });

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({ client_id: '', amount: '', interest_pct: '20', deadline: '', description: '' });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ loan_id: '', amount: '', description: '' });

  const [editingLoan, setEditingLoan] = useState(null);
  const [editLoanForm, setEditLoanForm] = useState({});

  const [receiptData, setReceiptData] = useState(null);
  const [receiptType, setReceiptType] = useState(null);

  const fetchAll = useCallback(async () => {
    const [s, c, l, p] = await Promise.all([
      fetch(`${API}/bank/stats`).then(r => r.json()),
      fetch(`${API}/bank/clients`).then(r => r.json()),
      fetch(`${API}/bank/loans${loanFilter !== 'all' ? `?status=${loanFilter}` : ''}`).then(r => r.json()),
      fetch(`${API}/bank/payments`).then(r => r.json()),
    ]);
    setStats(s);
    setClients(Array.isArray(c) ? c : []);
    setLoans(Array.isArray(l) ? l : []);
    setPayments(Array.isArray(p) ? p : []);
  }, [loanFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  const createClient = async (e) => {
    e.preventDefault();
    if (!clientForm.name) return;
    await fetch(`${API}/bank/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientForm),
    });
    setClientForm({ name: '', phone: '', profile_link: '' });
    setShowClientModal(false);
    fetchAll();
  };

  const createLoan = async (e) => {
    e.preventDefault();
    if (!loanForm.client_id || !loanForm.amount || !loanForm.deadline) return;
    const res = await fetch(`${API}/bank/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: parseInt(loanForm.client_id),
        amount: parseFloat(loanForm.amount),
        interest_pct: parseFloat(loanForm.interest_pct || 20),
        deadline: loanForm.deadline,
        description: loanForm.description,
      }),
    });
    const loanData = await res.json();
    const clientName = clients.find(c => c.id === parseInt(loanForm.client_id))?.name || '';
    setLoanForm({ client_id: '', amount: '', interest_pct: '20', deadline: '', description: '' });
    setShowLoanModal(false);
    fetchAll();
    setReceiptType('loan');
    setReceiptData({ ...loanData, client_name: clientName });
  };

  const makePayment = async (e) => {
    e.preventDefault();
    if (!payForm.loan_id || !payForm.amount) return;
    const res = await fetch(`${API}/bank/loans/${payForm.loan_id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(payForm.amount), description: payForm.description }),
    });
    const payData = await res.json();
    setPayForm({ loan_id: '', amount: '', description: '' });
    setShowPayModal(false);
    fetchAll();
    setReceiptType('payment');
    setReceiptData({
      client_name: payData.loan?.client_name || '',
      loan_id: payData.payment?.loan_id,
      payment_amount: payData.payment?.amount,
      remaining: payData.loan?.remaining,
      description: payData.payment?.description,
    });
  };

  const startEditLoan = (loan) => {
    setEditingLoan(loan.id);
    setEditLoanForm({ interest_pct: loan.interest_pct, deadline: loan.deadline, description: loan.description || '' });
  };

  const saveEditLoan = async (id) => {
    await fetch(`${API}/bank/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interest_pct: parseFloat(editLoanForm.interest_pct), deadline: editLoanForm.deadline, description: editLoanForm.description }),
    });
    setEditingLoan(null);
    fetchAll();
  };

  const deleteLoan = async (id) => {
    if (!confirm('Eliminar prestamo? Se reversara el dinero en tesoreria.')) return;
    await fetch(`${API}/bank/loans/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const deletePayment = async (id) => {
    if (!confirm('Eliminar pago? Se reversara en tesoreria.')) return;
    await fetch(`${API}/bank/payments/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const loanPreview = loanForm.amount && loanForm.interest_pct
    ? parseFloat(loanForm.amount) + (parseFloat(loanForm.amount) * parseFloat(loanForm.interest_pct) / 100)
    : 0;

  return (
    <div>
      <div className="bank-header">
        <div>
          <h1 className="page-title">Legacy Credits</h1>
          <p className="page-subtitle">Sistema de prestamos y cobranzas</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={() => { setShowPayModal(true); setPayForm({ ...payForm, loan_id: loans.find(l => l.status === 'active')?.id || '' }); }}>+ Registrar Pago</button>
          <button className="btn btn-outline" onClick={() => setShowClientModal(true)}>+ Cliente</button>
          <button className="btn btn-gold" onClick={() => setShowLoanModal(true)}>+ Prestamo</button>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Resumen</button>
        <button className={`detail-tab ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>Clientes ({clients.length})</button>
        <button className={`detail-tab ${activeTab === 'loans' ? 'active' : ''}`} onClick={() => setActiveTab('loans')}>Prestamos ({loans.length})</button>
        <button className={`detail-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Pagos ({payments.length})</button>
      </div>

      {activeTab === 'overview' && stats && (
        <div>
          <div className="grid grid-4" style={{ marginBottom: '32px' }}>
            <div className="stat-card">
              <div className="card-label">Total Prestado</div>
              <div className="stat-value" style={{ color: '#60a5fa' }}>{formatMoney(stats.total_lent)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Total Cobrado</div>
              <div className="stat-value" style={{ color: '#22c55e' }}>{formatMoney(stats.total_paid)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Ganancia Neta</div>
              <div className="stat-value" style={{ color: stats.profit >= 0 ? 'var(--gold-primary)' : '#f87171' }}>{formatMoney(stats.profit)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Pendiente</div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{formatMoney(stats.pending)}</div>
            </div>
          </div>
          <div className="grid grid-3" style={{ marginBottom: '32px' }}>
            <div className="stat-card">
              <div className="card-label">Prestamos Activos</div>
              <div className="stat-value">{stats.active_loans}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Vencidos</div>
              <div className="stat-value" style={{ color: stats.overdue_loans > 0 ? '#f87171' : undefined }}>{stats.overdue_loans}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Clientes</div>
              <div className="stat-value">{stats.total_clients}</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginBottom: '32px', gap: '24px' }}>
            <div className="stat-card" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'Cinzel', color: 'var(--gold-primary)', fontSize: '14px', marginBottom: '16px', letterSpacing: '1px' }}>NIVELES DE CREDITO</h3>
              <div className="table-container" style={{ border: 'none', padding: 0 }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '60px' }}>Nivel</th>
                      <th style={{ textAlign: 'right' }}>Rango</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { level: 1, min: 0, max: 5000 },
                      { level: 2, min: 5100, max: 15000 },
                      { level: 3, min: 15100, max: 35000 },
                      { level: 4, min: 35100, max: 75000 },
                      { level: 5, min: 75100, max: 150000 },
                      { level: 6, min: 150100, max: Infinity },
                    ].map(t => (
                      <tr key={t.level}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold-primary)' }}>{t.level}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{t.max === Infinity ? `${formatMoney(t.min)}+` : `${formatMoney(t.min)} — ${formatMoney(t.max)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'Cinzel', color: 'var(--gold-primary)', fontSize: '14px', marginBottom: '16px', letterSpacing: '1px' }}>INTERES POR PLAZO</h3>
              <div className="table-container" style={{ border: 'none', padding: 0 }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Plazo</th>
                      <th style={{ textAlign: 'right' }}>Interes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: '1 — 7 dias', pct: 20 },
                      { label: '8 — 14 dias', pct: 25 },
                      { label: '15 — 30 dias', pct: 30 },
                      { label: '31 — 60 dias', pct: 35 },
                      { label: '61+ dias', pct: 40 },
                    ].map((t, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{t.label}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{t.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h3 className="detail-section-title" style={{ marginBottom: '16px' }}>Prestamos Recientes</h3>
          {loans.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">Sin prestamos registrados</div></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'center' }}>Monto</th>
                    <th style={{ textAlign: 'center' }}>Total a Pagar</th>
                    <th style={{ textAlign: 'center' }}>Pagado</th>
                    <th style={{ textAlign: 'center' }}>Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loans.slice(0, 5).map(loan => (
                    <tr key={loan.id}>
                      <td style={{ fontWeight: 600 }}>{loan.client_name}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(loan.amount)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatMoney(loan.total_to_pay)}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e' }}>{formatMoney(loan.paid)}</td>
                      <td style={{ textAlign: 'center', color: '#f59e0b' }}>{formatMoney(loan.remaining)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ color: statusColors[loan.status], borderColor: statusColors[loan.status] + '40', background: statusColors[loan.status] + '15' }}>
                          {statusLabels[loan.status]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} title="Ver comprobante" onClick={() => { setReceiptType('loan'); setReceiptData(loan); }}><i className="fa-solid fa-receipt" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'clients' && (
        <div>
          {clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin clientes</div>
              <div className="empty-state-text">Registra tu primer cliente para comenzar</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th style={{ textAlign: 'center' }}>Telefono</th>
                    <th style={{ textAlign: 'center' }}>Prestamos</th>
                    <th style={{ textAlign: 'center' }}>Total Prestado</th>
                    <th style={{ textAlign: 'center' }}>Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/projects/legacy-credits/clients/${c.id}`}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{c.active_loans}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(c.total_lent)}</td>
                      <td style={{ textAlign: 'center', color: c.pending > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{formatMoney(c.pending)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge badge-${c.status}`}>{c.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'loans' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['all', 'active', 'overdue', 'paid'].map(s => (
              <button key={s} className={`btn ${loanFilter === s ? 'btn-gold' : 'btn-outline'}`} onClick={() => setLoanFilter(s)}>
                {s === 'all' ? 'Todos' : statusLabels[s]}
              </button>
            ))}
          </div>
          {loans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin prestamos</div>
              <div className="empty-state-text">Crea un prestamo para comenzar</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'center' }}>Monto</th>
                    <th style={{ textAlign: 'center' }}>Interes</th>
                    <th style={{ textAlign: 'center' }}>Total a Pagar</th>
                    <th style={{ textAlign: 'center' }}>Pagado</th>
                    <th style={{ textAlign: 'center' }}>Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Limite</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => (
                    <tr key={loan.id}>
                      <td style={{ fontWeight: 600 }}>{loan.client_name}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(loan.amount)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {editingLoan === loan.id ? (
                          <input type="number" className="form-input" style={{ width: '60px', padding: '4px 8px', fontSize: '12px' }} value={editLoanForm.interest_pct} onChange={(e) => setEditLoanForm({ ...editLoanForm, interest_pct: e.target.value })} />
                        ) : (
                          <span>{loan.interest_pct}%</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatMoney(loan.total_to_pay)}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e' }}>{formatMoney(loan.paid)}</td>
                      <td style={{ textAlign: 'center', color: loan.remaining > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{formatMoney(loan.remaining)}</td>
                      <td style={{ textAlign: 'center', fontSize: '13px' }}>
                        {editingLoan === loan.id ? (
                          <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: '12px' }} value={editLoanForm.deadline} onChange={(e) => setEditLoanForm({ ...editLoanForm, deadline: e.target.value })} />
                        ) : (
                          <span style={{ color: new Date(loan.deadline) < new Date() && loan.status !== 'paid' ? '#f87171' : 'var(--text-secondary)' }}>
                            {new Date(loan.deadline).toLocaleDateString('es-VE')}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ color: statusColors[loan.status], borderColor: statusColors[loan.status] + '40', background: statusColors[loan.status] + '15' }}>
                          {statusLabels[loan.status]}
                        </span>
                      </td>
                      <td>
                        {editingLoan === loan.id ? (
                          <span style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-gold" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => saveEditLoan(loan.id)}>OK</button>
                            <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditingLoan(null)}>X</button>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} title="Ver comprobante" onClick={() => { setReceiptType('loan'); setReceiptData(loan); }}><i className="fa-solid fa-receipt" /></button>
                            {loan.status !== 'paid' && <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => startEditLoan(loan)}>Editar</button>}
                            <button className="project-delete-btn" onClick={() => deleteLoan(loan.id)}>x</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          {payments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin pagos</div>
              <div className="empty-state-text">Los pagos registrados apareceran aqui</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'center' }}>Prestamo</th>
                    <th style={{ textAlign: 'center' }}>Monto Pagado</th>
                    <th style={{ textAlign: 'center' }}>Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Fecha</th>
                    <th style={{ textAlign: 'center' }}>Descripcion</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.client_name}</td>
                      <td style={{ textAlign: 'center' }}>#{p.loan_id}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{formatMoney(p.amount)}</td>
                      <td style={{ textAlign: 'center', color: p.loan_remaining > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{formatMoney(p.loan_remaining)}</td>
                      <td style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleDateString('es-VE')}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{p.description || '—'}</td>
                      <td>
                        <span style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} title="Ver comprobante" onClick={() => {
                            setReceiptType('payment');
                            setReceiptData({
                              client_name: p.client_name,
                              loan_id: p.loan_id,
                              payment_amount: p.amount,
                              remaining: p.loan_remaining,
                              description: p.description,
                            });
                          }}><i className="fa-solid fa-receipt" /></button>
                          <button className="project-delete-btn" onClick={() => deletePayment(p.id)}>x</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo Cliente</h2>
              <button className="modal-close" onClick={() => setShowClientModal(false)}>x</button>
            </div>
            <form onSubmit={createClient}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" placeholder="Nombre del cliente" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input className="form-input" placeholder="Telefono (opcional)" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Enlace de perfil</label>
                <input className="form-input" placeholder="URL de perfil externo (opcional)" value={clientForm.profile_link} onChange={(e) => setClientForm({ ...clientForm, profile_link: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowClientModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLoanModal && (
        <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo Prestamo</h2>
              <button className="modal-close" onClick={() => setShowLoanModal(false)}>x</button>
            </div>
            <form onSubmit={createLoan}>
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select className="form-input" value={loanForm.client_id} onChange={(e) => setLoanForm({ ...loanForm, client_id: e.target.value })}>
                  <option value="">Seleccionar cliente...</option>
                  {clients.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Monto ($) *</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Interes (%)</label>
                  <input type="number" className="form-input" placeholder="20" min="0" step="0.1" value={loanForm.interest_pct} onChange={(e) => setLoanForm({ ...loanForm, interest_pct: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha limite *</label>
                <input type="date" className="form-input" value={loanForm.deadline} onChange={(e) => setLoanForm({ ...loanForm, deadline: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input className="form-input" placeholder="Motivo del prestamo (opcional)" value={loanForm.description} onChange={(e) => setLoanForm({ ...loanForm, description: e.target.value })} />
              </div>
              {loanPreview > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Monto:</span><span>{formatMoney(parseFloat(loanForm.amount || 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Ganancia ({loanForm.interest_pct || 0}%):</span><span style={{ color: '#22c55e' }}>+{formatMoney(parseFloat(loanForm.amount || 0) * parseFloat(loanForm.interest_pct || 0) / 100)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px', color: 'var(--gold-primary)', borderTop: '1px solid rgba(201,168,76,0.2)', paddingTop: '8px', marginTop: '4px' }}>
                    <span>Total a pagar:</span><span>{formatMoney(loanPreview)}</span>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowLoanModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!loanForm.client_id || !loanForm.amount || !loanForm.deadline}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Pago</h2>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>x</button>
            </div>
            <form onSubmit={makePayment}>
              <div className="form-group">
                <label className="form-label">Prestamo *</label>
                <select className="form-input" value={payForm.loan_id} onChange={(e) => setPayForm({ ...payForm, loan_id: e.target.value })}>
                  <option value="">Seleccionar prestamo...</option>
                  {loans.filter(l => l.status === 'active' || l.status === 'overdue').map(l => (
                    <option key={l.id} value={l.id}>{l.client_name} — Pendiente: {formatMoney(l.remaining)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monto ($) *</label>
                <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input className="form-input" placeholder="Nota del pago (opcional)" value={payForm.description} onChange={(e) => setPayForm({ ...payForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowPayModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!payForm.loan_id || !payForm.amount}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {receiptData && (
        <BankReceipt type={receiptType} data={receiptData} onClose={() => { setReceiptData(null); setReceiptType(null); }} />
      )}
    </div>
  );
}
