import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './GranjasEden.css';

const API = 'http://localhost:3001/api';
const SLUG = 'granjas-eden';

const PERIODS = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'all', label: 'Todo' },
];

function memberSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

const txTypeLabel = { income: 'Entrada', expense: 'Salida' };
const txTypeColor = { income: '#22c55e', expense: '#f87171' };

export default function GranjasEden() {
  const [farms, setFarms] = useState([]);
  const [project, setProject] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [period, setPeriod] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');
  const [editingField, setEditingField] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({ type: 'income', amount: '', description: '' });

  const fetchFarms = useCallback(async () => {
    const res = await fetch(`${API}/projects/${SLUG}/farms?period=${period}`);
    const data = await res.json();
    setFarms(Array.isArray(data) ? data : []);
  }, [period]);

  const fetchAll = useCallback(async () => {
    const [p, m, tx] = await Promise.all([
      fetch(`${API}/projects/${SLUG}`).then(r => r.json()),
      fetch(`${API}/members`).then(r => r.json()),
      fetch(`${API}/treasury?source=project`).then(r => r.json()),
    ]);
    setProject(p);
    setAllMembers(m);
    setProjectMembers(m.filter(memb => memb.projects.some(proj => proj.name === p.name)));
    setTransactions(tx.transactions || []);
    fetchFarms();
  }, [fetchFarms]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchFarms();
  }, [fetchFarms]);

  const startEdit = (field, value) => {
    setEditingField(field);
    setEditForm({ [field]: value || '' });
  };

  const saveEdit = async () => {
    await fetch(`${API}/projects/${SLUG}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingField(null);
    fetchAll();
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditForm({});
  };

  const addMember = async () => {
    if (!selectedMemberId) return;
    const newIds = [...projectMembers.map(m => m.id), parseInt(selectedMemberId)];
    await fetch(`${API}/projects/${SLUG}/socios`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: newIds }),
    });
    setSelectedMemberId('');
    setShowAddMember(false);
    fetchAll();
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remover miembro del proyecto? Se le quitara el rol de Socio si no tiene otros proyectos.')) return;
    const newIds = projectMembers.filter(m => m.id !== memberId).map(m => m.id);
    await fetch(`${API}/projects/${SLUG}/socios`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: newIds }),
    });
    fetchAll();
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    if (!txForm.amount) return;
    await fetch(`${API}/treasury`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: txForm.type,
        amount: parseFloat(txForm.amount),
        description: txForm.description,
        source: 'project',
        source_id: project.id,
        source_name: project.name,
      }),
    });
    setTxForm({ type: 'income', amount: '', description: '' });
    setShowTxModal(false);
    fetchAll();
  };

  const removeTransaction = async (txId) => {
    if (!confirm('Eliminar movimiento?')) return;
    await fetch(`${API}/treasury/${txId}`, { method: 'DELETE' });
    fetchAll();
  };

  const createFarm = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await fetch(`${API}/projects/${SLUG}/farms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '' });
    setShowModal(false);
    fetchFarms();
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  const balance = (project?.total_earned || 0) - (project?.total_expenses || 0);
  const totalInventario = farms.filter(f => f.status === 'active').reduce((a, f) => a + (f.inventory_value || 0), 0);
  const availableMembers = allMembers.filter(m => m.status === 'active' && !projectMembers.some(pm => pm.id === m.id));

  if (!project) return null;

  return (
    <div>
      <Link to="/finanzas" className="detail-back">← Finanzas</Link>

      <div className="ge-header">
        <div>
          {editingField === 'name' ? (
            <div className="fd-edit-inline">
              <input
                className="form-input"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ name: e.target.value })}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              />
              <button className="btn btn-gold" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={saveEdit}>✓</button>
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={cancelEdit}>×</button>
            </div>
          ) : (
            <h1 className="page-title" onClick={() => startEdit('name', project.name)} style={{ cursor: 'pointer' }}>
              {project.name} ✎
            </h1>
          )}
          {editingField === 'description' ? (
            <div className="fd-edit-inline">
              <input
                className="form-input"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ description: e.target.value })}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              />
              <button className="btn btn-gold" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={saveEdit}>✓</button>
              <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={cancelEdit}>×</button>
            </div>
          ) : (
            <p className="page-subtitle" onClick={() => startEdit('description', project.description)} style={{ cursor: 'pointer' }}>
              {project.description || 'Sin descripcion'} ✎
            </p>
          )}
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Nueva Granja</button>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Resumen</button>
        <button className={`detail-tab ${activeTab === 'farms' ? 'active' : ''}`} onClick={() => setActiveTab('farms')}>Granjas ({farms.length})</button>
        <button className={`detail-tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Transacciones ({transactions.length})</button>
        <button className={`detail-tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>Miembros ({projectMembers.length})</button>
      </div>

      {activeTab === 'overview' && (
        <div>
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
          </div>

          <div className="grid grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="card-label">Dinero Fisico</div>
              <div className="stat-value" style={{ color: balance >= 0 ? 'var(--gold-primary)' : '#f87171' }}>{formatMoney(balance)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Valor en Objetos</div>
              <div className="stat-value" style={{ color: '#a78bfa' }}>{formatMoney(totalInventario)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Total Proyecto</div>
              <div className="stat-value">{formatMoney(balance + totalInventario)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Granjas</div>
              <div className="stat-value">{farms.length}</div>
            </div>
          </div>

          <div className="detail-section-header">
            <h3 className="detail-section-title">Desglose</h3>
          </div>
          <div className="table-container" style={{ marginBottom: '32px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'center' }}>Ingresos</th>
                  <th style={{ textAlign: 'center' }}>Egresos</th>
                  <th style={{ textAlign: 'center' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Dinero Fisico</td>
                  <td style={{ textAlign: 'center', color: '#22c55e' }}>{formatMoney(project.total_earned)}</td>
                  <td style={{ textAlign: 'center', color: '#f87171' }}>{formatMoney(project.total_expenses)}</td>
                  <td style={{ textAlign: 'center', color: balance >= 0 ? 'var(--gold-primary)' : '#f87171', fontWeight: 600 }}>{formatMoney(balance)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Valor en Objetos</td>
                  <td style={{ textAlign: 'center', color: '#a78bfa' }}>{formatMoney(totalInventario)}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ textAlign: 'center', color: '#a78bfa', fontWeight: 600 }}>{formatMoney(totalInventario)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>Total</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatMoney(project.total_earned + totalInventario)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatMoney(project.total_expenses)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gold-primary)' }}>{formatMoney(balance + totalInventario)}</td>
                </tr>
              </tbody>
            </table>
          </div>


          {transactions.length > 0 && (
            <div className="detail-recent">
              <h3 className="detail-section-title">Transacciones Recientes</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Descripcion</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 5).map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <span className="tx-type-badge" style={{ color: txTypeColor[tx.type], borderColor: txTypeColor[tx.type] + '40', background: txTypeColor[tx.type] + '15' }}>
                            {txTypeLabel[tx.type]}
                          </span>
                        </td>
                        <td style={{ color: txTypeColor[tx.type], fontWeight: 600 }}>{formatMoney(tx.amount)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{tx.description || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(tx.date).toLocaleDateString('es-VE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="detail-partners">
          <div className="detail-section-header">
            <h3 className="detail-section-title">Miembros del Proyecto</h3>
            <button className="btn btn-gold" onClick={() => setShowAddMember(true)}>+ Agregar Miembro</button>
          </div>
          {projectMembers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◇</div>
              <div className="empty-state-title">Sin miembros</div>
              <div className="empty-state-text">Agrega miembros a este proyecto. Se les asignara el rol de Socio automaticamente.</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Roles</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {projectMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <Link to={`/members/${memberSlug(member.name)}`} className="partner-cell" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                          <div className="partner-avatar">{member.name.charAt(0)}</div>
                          {member.name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {member.roles.map(r => (
                            <span key={r.role} className="member-role-badge" style={{ color: r.color, borderColor: r.color + '40', background: r.color + '15', fontSize: '12px', padding: '2px 8px' }}>
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button className="project-delete-btn" onClick={() => removeMember(member.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="detail-transactions">
          <div className="detail-section-header">
            <h3 className="detail-section-title">Transacciones</h3>
            <button className="btn btn-gold" onClick={() => setShowTxModal(true)}>+ Nueva Transaccion</button>
          </div>
          {transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◎</div>
              <div className="empty-state-title">Sin transacciones</div>
              <div className="empty-state-text">Registra inversiones, ganancias y gastos</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Descripcion</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="tx-type-badge" style={{ color: txTypeColor[tx.type], borderColor: txTypeColor[tx.type] + '40', background: txTypeColor[tx.type] + '15' }}>
                          {txTypeLabel[tx.type]}
                        </span>
                      </td>
                      <td style={{ color: txTypeColor[tx.type], fontWeight: 600 }}>{formatMoney(tx.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{tx.description || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(tx.date).toLocaleDateString('es-VE')}</td>
                      <td>
                        <button className="project-delete-btn" onClick={() => removeTransaction(tx.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'farms' && (
        <div>
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
          </div>

          {farms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin granjas</div>
              <div className="empty-state-text">Crea tu primera granja para comenzar</div>
              <button className="btn btn-gold" style={{ marginTop: '12px' }} onClick={() => setShowModal(true)}>+ Crear Granja</button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th style={{ textAlign: 'center' }}>Propietario</th>
                    <th style={{ textAlign: 'center' }}>Entradas</th>
                    <th style={{ textAlign: 'center' }}>Salidas</th>
                    <th style={{ textAlign: 'center' }}>Balance</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((farm) => (
                    <tr key={farm.id} onClick={() => window.location.href = `/projects/granjas-eden/${farm.slug}`} style={{ cursor: 'pointer', opacity: farm.status === 'active' ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{farm.name}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{farm.owner || '—'}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{formatMoney(farm.entradas)}</td>
                      <td style={{ textAlign: 'center', color: '#f87171', fontWeight: 600 }}>{formatMoney(farm.salidas)}</td>
                      <td style={{ textAlign: 'center', color: (farm.balance || 0) >= 0 ? 'var(--gold-primary)' : '#f87171', fontWeight: 600 }}>{formatMoney(farm.balance)}</td>
                      <td style={{ textAlign: 'center' }}><span className={`badge badge-${farm.status}`}>{farm.status === 'active' ? 'Activa' : 'Inactiva'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Agregar Miembro al Proyecto</h2>
              <button className="modal-close" onClick={() => setShowAddMember(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Seleccionar Miembro</label>
              <select className="form-input" value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {availableMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Se asignara el rol de <strong style={{ color: '#60a5fa' }}>Socio</strong> automaticamente.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowAddMember(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={addMember} disabled={!selectedMemberId}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {showTxModal && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Entrada / Salida</h2>
              <button className="modal-close" onClick={() => setShowTxModal(false)}>×</button>
            </div>
            <form onSubmit={addTransaction}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div className="form-radio-group">
                  <label className={`form-radio ${txForm.type === 'income' ? 'active' : ''}`} style={{ '--radio-color': '#22c55e' }}>
                    <input type="radio" name="type" value="income" checked={txForm.type === 'income'} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} />
                    <span>Entrada</span>
                  </label>
                  <label className={`form-radio ${txForm.type === 'expense' ? 'active' : ''}`} style={{ '--radio-color': '#f87171' }}>
                    <input type="radio" name="type" value="expense" checked={txForm.type === 'expense'} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} />
                    <span>Salida</span>
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Monto ($)</label>
                <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo</label>
                <input type="text" className="form-input" placeholder="Ej: Venta de leche, Compra de alimento..." value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowTxModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Granja</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={createFarm}>
              <div className="form-group">
                <label className="form-label">Nombre de la Granja</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Green Valley Farm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Crear Granja</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
