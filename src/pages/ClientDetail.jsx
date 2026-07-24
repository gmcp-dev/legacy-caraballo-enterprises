import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import BankReceipt from '../components/BankReceipt';
import './ClientDetail.css';

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

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({ amount: '', interest_pct: '20', deadline: '', description: '' });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ loan_id: '', amount: '', description: '' });

  const [editingLoan, setEditingLoan] = useState(null);
  const [editLoanForm, setEditLoanForm] = useState({});

  const [receiptData, setReceiptData] = useState(null);
  const [receiptType, setReceiptType] = useState(null);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`${API}/bank/clients/${clientId}`);
      if (!res.ok) { navigate('/projects/legacy-credits'); return; }
      const data = await res.json();
      setClient(data);
      setEditForm({ name: data.name, phone: data.phone || '', profile_link: data.profile_link || '' });
    } catch {
      navigate('/projects/legacy-credits');
    } finally {
      setLoading(false);
    }
  }, [clientId, navigate]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const saveEdit = async () => {
    await fetch(`${API}/bank/clients/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditing(false);
    fetchClient();
  };

  const createLoan = async (e) => {
    e.preventDefault();
    if (!loanForm.amount || !loanForm.deadline) return;
    const res = await fetch(`${API}/bank/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: parseInt(clientId),
        amount: parseFloat(loanForm.amount),
        interest_pct: parseFloat(loanForm.interest_pct || 20),
        deadline: loanForm.deadline,
        description: loanForm.description,
      }),
    });
    const loanData = await res.json();
    setLoanForm({ amount: '', interest_pct: '20', deadline: '', description: '' });
    setShowLoanModal(false);
    fetchClient();
    setReceiptType('loan');
    setReceiptData({ ...loanData, client_name: client.name });
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
    fetchClient();
    setReceiptType('payment');
    setReceiptData({
      client_name: client.name,
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
    fetchClient();
  };

  const deleteLoan = async (id) => {
    if (!confirm('Eliminar prestamo? Se reversara el dinero en tesoreria.')) return;
    await fetch(`${API}/bank/loans/${id}`, { method: 'DELETE' });
    fetchClient();
  };

  const _deletePayment = async (id) => {
    if (!confirm('Eliminar pago? Se reversara en tesoreria.')) return;
    await fetch(`${API}/bank/payments/${id}`, { method: 'DELETE' });
    fetchClient();
  };

  const deleteClient = async () => {
    if (!confirm(`Eliminar cliente "${client.name}"?`)) return;
    const res = await fetch(`${API}/bank/clients/${clientId}`, { method: 'DELETE' });
    if (res.ok) navigate('/projects/legacy-credits');
  };

  if (loading || !client) return null;

  const loanPreview = loanForm.amount && loanForm.interest_pct
    ? parseFloat(loanForm.amount) + (parseFloat(loanForm.amount) * parseFloat(loanForm.interest_pct) / 100)
    : 0;

  return (
    <div>
      <div className="client-detail-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <Link to="/projects/legacy-credits" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px' }}>Legacy Credits</Link>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>/</span>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{editing ? '' : client.name}</h1>
          </div>
          {!editing && (
            <div className="client-info-row">
              {client.phone && <span><i className="fa-solid fa-phone" style={{ marginRight: '6px' }} />{client.phone}</span>}
              {client.profile_link && <a href={client.profile_link} target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-link" style={{ marginRight: '4px' }} />Perfil</a>}
              <span className={`badge badge-${client.status}`}>{client.status === 'active' ? 'Activo' : 'Inactivo'}</span>
            </div>
          )}
        </div>
        <div className="client-actions">
          {!editing ? (
            <>
              <button className="btn btn-outline" onClick={() => { setShowPayModal(true); setPayForm({ ...payForm, loan_id: client.loans.find(l => l.status === 'active' || l.status === 'overdue')?.id || '' }); }}>+ Pago</button>
              <button className="btn btn-gold" onClick={() => setShowLoanModal(true)}>+ Prestamo</button>
              <button className="btn btn-outline" onClick={() => setEditing(true)}>Editar</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={saveEdit}>Guardar</button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
          <div className="client-edit-row">
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Telefono</label>
              <input className="form-input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Enlace de perfil</label>
              <input className="form-input" value={editForm.profile_link} onChange={(e) => setEditForm({ ...editForm, profile_link: e.target.value })} />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button className="project-delete-btn" onClick={deleteClient}>Eliminar cliente</button>
          </div>
        </div>
      ) : (
        <div className="client-stats-row">
          <div className="stat-card">
            <div className="card-label">Total Prestado</div>
            <div className="stat-value" style={{ color: '#60a5fa', fontSize: '22px' }}>{formatMoney(client.total_lent)}</div>
          </div>
          <div className="stat-card">
            <div className="card-label">Total Pagado</div>
            <div className="stat-value" style={{ color: '#22c55e', fontSize: '22px' }}>{formatMoney(client.total_paid)}</div>
          </div>
          <div className="stat-card">
            <div className="card-label">Pendiente</div>
            <div className="stat-value" style={{ color: client.pending > 0 ? '#f59e0b' : undefined, fontSize: '22px' }}>{formatMoney(client.pending)}</div>
          </div>
          <div className="stat-card">
            <div className="card-label">Prestamos</div>
            <div className="stat-value" style={{ fontSize: '22px' }}>{client.total_loans}</div>
          </div>
          <div className="stat-card">
            <div className="card-label">Activos</div>
            <div className="stat-value" style={{ fontSize: '22px' }}>{client.active_loans}</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="detail-section-title" style={{ margin: 0 }}>Prestamos</h3>
          {!editing && <button className="btn btn-outline btn-sm" onClick={() => setShowLoanModal(true)}>+ Prestamo</button>}
        </div>
        {!client.loans || client.loans.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">Sin prestamos registrados</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>Monto</th>
                  <th style={{ textAlign: 'center' }}>Interes</th>
                  <th style={{ textAlign: 'center' }}>Total a Pagar</th>
                  <th style={{ textAlign: 'center' }}>Pagado</th>
                  <th style={{ textAlign: 'center' }}>Pendiente</th>
                  <th style={{ textAlign: 'center' }}>Limite</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'center' }}>Descripcion</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {client.loans.map(loan => (
                  <tr key={loan.id}>
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
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {editingLoan === loan.id ? (
                        <input className="form-input" style={{ padding: '4px 8px', fontSize: '12px' }} value={editLoanForm.description} onChange={(e) => setEditLoanForm({ ...editLoanForm, description: e.target.value })} />
                      ) : (
                        loan.description || '—'
                      )}
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
        {client.loans && client.loans.some(l => l.payments && l.payments.length > 0) && (
          <div style={{ marginTop: '24px' }}>
            <h3 className="detail-section-title" style={{ marginBottom: '12px' }}>Historial de Pagos</h3>
            {client.loans.filter(l => l.payments && l.payments.length > 0).map(loan => (
              <div key={loan.id} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Prestamo #{loan.id} — {formatMoney(loan.amount)} — <span style={{ color: statusColors[loan.status] }}>{statusLabels[loan.status]}</span>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center' }}>Monto</th>
                        <th style={{ textAlign: 'center' }}>Restante</th>
                        <th style={{ textAlign: 'center' }}>Fecha</th>
                        <th style={{ textAlign: 'center' }}>Descripcion</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.payments.map(p => (
                        <tr key={p.id}>
                          <td style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{formatMoney(p.amount)}</td>
                          <td style={{ textAlign: 'center', color: '#f59e0b' }}>{formatMoney(loan.total_to_pay - loan.paid + (loan.payments.indexOf(p) === 0 ? 0 : p.amount))}</td>
                          <td style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleDateString('es-VE')}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{p.description || '—'}</td>
                          <td>
                            <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} title="Ver comprobante" onClick={() => {
                              setReceiptType('payment');
                              setReceiptData({
                                client_name: client.name,
                                loan_id: p.loan_id,
                                payment_amount: p.amount,
                                remaining: loan.total_to_pay - loan.paid,
                                description: p.description,
                              });
                            }}><i className="fa-solid fa-receipt" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLoanModal && (
        <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo Prestamo — {client.name}</h2>
              <button className="modal-close" onClick={() => setShowLoanModal(false)}>x</button>
            </div>
            <form onSubmit={createLoan}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Monto ($) *</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} autoFocus />
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
                <button type="submit" className="btn btn-gold" disabled={!loanForm.amount || !loanForm.deadline}>Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Pago — {client.name}</h2>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>x</button>
            </div>
            <form onSubmit={makePayment}>
              <div className="form-group">
                <label className="form-label">Prestamo *</label>
                <select className="form-input" value={payForm.loan_id} onChange={(e) => setPayForm({ ...payForm, loan_id: e.target.value })}>
                  <option value="">Seleccionar prestamo...</option>
                  {client.loans.filter(l => l.status === 'active' || l.status === 'overdue').map(l => (
                    <option key={l.id} value={l.id}>Prestamo #{l.id} — Pendiente: {formatMoney(l.remaining)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monto ($) *</label>
                <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
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
