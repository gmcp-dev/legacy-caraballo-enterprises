import { useState, useEffect, useCallback } from 'react';
import './Finance.css';

const API = 'http://localhost:3001/api';

const PERIODS = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'all', label: 'Todo' },
];

export default function Finance() {
  const [treasury, setTreasury] = useState({ transactions: [], balance: 0, totalIncome: 0, totalExpense: 0 });
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('week');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: 'income', amount: '', description: '' });

  const fetchTreasury = useCallback(async () => {
    const params = new URLSearchParams();
    if (period !== 'all') params.set('period', period);
    if (filter !== 'all') params.set('type', filter);
    const res = await fetch(`${API}/treasury?${params}`);
    const data = await res.json();
    setTreasury(data);
  }, [filter, period]);

  useEffect(() => {
    fetchTreasury();
    fetch(`${API}/treasury/summary`).then(r => r.json()).then(setSummary);
  }, [fetchTreasury]);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  const sourceIcon = (source) => {
    if (source === 'project') return <i className="fa-solid fa-briefcase" style={{ color: '#60a5fa' }} />;
    if (source === 'farm') return <i className="fa-solid fa-leaf" style={{ color: '#a78bfa' }} />;
    return <i className="fa-solid fa-coins" style={{ color: '#22c55e' }} />;
  };
  const sourceLabel = (source) => {
    if (source === 'project') return 'Proyecto';
    if (source === 'farm') return 'Granja';
    return 'General';
  };

  const addMovement = async (e) => {
    e.preventDefault();
    if (!form.amount) return;
    await fetch(`${API}/treasury`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setForm({ type: 'income', amount: '', description: '' });
    setShowModal(false);
    fetchTreasury();
    fetch(`${API}/treasury/summary`).then(r => r.json()).then(setSummary);
  };

  const deleteMovement = async (id) => {
    if (!confirm('Eliminar movimiento?')) return;
    await fetch(`${API}/treasury/${id}`, { method: 'DELETE' });
    fetchTreasury();
    fetch(`${API}/treasury/summary`).then(r => r.json()).then(setSummary);
  };

  return (
    <div>
      <div className="finance-header">
        <div>
          <h1 className="page-title">LEGACY Caraballo Enterprises</h1>
          <p className="page-subtitle">Sistema economico general</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Nueva Entrada/Salida</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="card-label">Fondo Total</div>
          <div className="stat-value" style={{ color: (summary?.balance || 0) >= 0 ? 'var(--gold-primary)' : '#f87171' }}>
            {formatMoney(summary?.balance)}
          </div>
        </div>
        <div className="stat-card">
          <div className="card-label">Dinero Fisico</div>
          <div className="stat-value" style={{ color: '#22c55e' }}>{formatMoney(summary?.totalPhysical)}</div>
        </div>
        <div className="stat-card">
          <div className="card-label">Valor en Objetos</div>
          <div className="stat-value" style={{ color: '#a78bfa' }}>{formatMoney(summary?.totalObjectValue)}</div>
        </div>
      </div>

      {summary && summary.projects.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Por Proyecto</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th style={{ textAlign: 'center' }}>Fisico</th>
                  <th style={{ textAlign: 'center' }}>Objetos</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {summary.projects.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ textAlign: 'center', color: p.physical >= 0 ? '#22c55e' : '#f87171' }}>{formatMoney(p.physical)}</td>
                    <td style={{ textAlign: 'center', color: '#a78bfa' }}>{p.objectValue > 0 ? formatMoney(p.objectValue) : '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold-primary)' }}>{formatMoney(p.total)}</td>
                    <td style={{ textAlign: 'center' }}><span className={`badge badge-${p.status}`}>{p.status === 'active' ? 'Activo' : 'Pausado'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ge-period-filter">
        {PERIODS.map(p => (
          <button
            key={p.key}
            className={`btn ${period === p.key ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
        <div style={{ marginLeft: '12px', display: 'flex', gap: '8px' }}>
          {[
            { key: 'all', label: 'Todo' },
            { key: 'income', label: 'Entradas' },
            { key: 'expense', label: 'Salidas' },
          ].map(f => (
            <button
              key={f.key}
              className={`btn ${filter === f.key ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="finance-sections">
        <div className="finance-section">
          <div className="detail-section-header">
            <h3 className="detail-section-title">Registro Completo</h3>
          </div>
          {treasury.transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◎</div>
              <div className="empty-state-title">Sin movimientos</div>
              <div className="empty-state-text">Los movimientos de los proyectos y granjas se reflejaran aqui</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Origen</th>
                    <th>Descripcion</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {treasury.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="tx-type-badge" style={{
                          color: tx.type === 'income' ? '#22c55e' : '#f87171',
                          borderColor: (tx.type === 'income' ? '#22c55e' : '#f87171') + '40',
                          background: (tx.type === 'income' ? '#22c55e' : '#f87171') + '15',
                        }}>
                          {tx.type === 'income' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td style={{ color: tx.type === 'income' ? '#22c55e' : '#f87171', fontWeight: 600 }}>
                        {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {sourceIcon(tx.source)} <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sourceLabel(tx.source)}</span> {tx.source_name}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{tx.description || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(tx.date).toLocaleDateString('es-VE')}</td>
                      <td>
                        <button className="project-delete-btn" onClick={() => deleteMovement(tx.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Entrada / Salida</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={addMovement}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div className="form-radio-group">
                  <label className={`form-radio ${form.type === 'income' ? 'active' : ''}`} style={{ '--radio-color': '#22c55e' }}>
                    <input type="radio" name="type" value="income" checked={form.type === 'income'} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                    <span>Entrada</span>
                  </label>
                  <label className={`form-radio ${form.type === 'expense' ? 'active' : ''}`} style={{ '--radio-color': '#f87171' }}>
                    <input type="radio" name="type" value="expense" checked={form.type === 'expense'} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                    <span>Salida</span>
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto ($)</label>
                <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo</label>
                <input type="text" className="form-input" placeholder="Ej: Inversion de Juan, Compra de inventario, Invertido en Granjas Eden..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
