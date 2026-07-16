import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import './MemberDetail.css';

const API = 'http://localhost:3001/api';

export default function MemberDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [roles, setRoles] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [investForm, setInvestForm] = useState({ amount: '', description: '' });
  const [editForm, setEditForm] = useState({});

  const roleMap = {};
  roles.forEach(r => { roleMap[r.slug] = r; });

  const fetchAll = useCallback(async () => {
    const [m, r] = await Promise.all([
      fetch(`${API}/members/${slug}`).then(r => r.json()),
      fetch(`${API}/roles`).then(r => r.json()),
    ]);
    setMember(m);
    setRoles(r);
    setEditForm({ name: m.name, photo: m.photo || '', roles: m.roles.map(r => r.role) });
  }, [slug]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addInvestment = async (e) => {
    e.preventDefault();
    if (!investForm.amount) return;

    await fetch(`${API}/members/${slug}/investments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(investForm.amount), description: investForm.description }),
    });

    setInvestForm({ amount: '', description: '' });
    setShowInvestModal(false);
    fetchAll();
  };

  const deleteInvestment = async (invId) => {
    if (!confirm('Eliminar inversion?')) return;
    await fetch(`${API}/members/${slug}/investments/${invId}`, { method: 'DELETE' });
    fetchAll();
  };

  const toggleStatus = async () => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    await fetch(`${API}/members/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchAll();
  };

  const deleteMember = async () => {
    await fetch(`${API}/members/${slug}`, { method: 'DELETE' });
    navigate('/members');
  };

  const saveEdit = async () => {
    await fetch(`${API}/members/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setActiveTab('overview');
    fetchAll();
  };

  const toggleRole = (roleSlug) => {
    setEditForm(prev => ({
      ...prev,
      roles: prev.roles.includes(roleSlug) ? prev.roles.filter(r => r !== roleSlug) : [...prev.roles, roleSlug],
    }));
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  if (!member) return null;

  const totalByProject = {};
  member.investments.forEach(inv => {
    const key = inv.project_name || 'General';
    totalByProject[key] = (totalByProject[key] || 0) + inv.amount;
  });

  return (
    <div>
      <Link to="/members" className="detail-back">← Volver a Miembros</Link>

      <div className="md-header">
        <div className="md-header-left">
          <div className="md-photo">
            {member.photo ? (
              <img src={member.photo} alt={member.name} draggable="false" />
            ) : (
              <span className="md-photo-initial">{member.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <h1 className="page-title">{member.name}</h1>
            <div className="md-roles">
              <span className="member-role-badge" style={{ color: member.status === 'active' ? '#22c55e' : '#ef4444', borderColor: (member.status === 'active' ? '#22c55e' : '#ef4444') + '40', background: (member.status === 'active' ? '#22c55e' : '#ef4444') + '15' }}>
                {member.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
              {member.roles.map((r) => (
                <span key={r.role} className="member-role-badge" style={{ color: r.color, borderColor: r.color + '40', background: r.color + '15' }}>
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="md-header-actions">
          <button className="btn btn-outline" onClick={() => { setEditForm({ name: member.name, photo: member.photo || '', roles: member.roles.map(r => r.role) }); setActiveTab('edit'); }}>Editar</button>
          <button className={`btn ${member.status === 'active' ? 'btn-outline' : 'btn-gold'}`} onClick={toggleStatus}>
            {member.status === 'active' ? 'Inactivar' : 'Activar'}
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Resumen</button>
        {member.roles.some(r => r.role === 'inversionista') && (
          <button className={`detail-tab ${activeTab === 'investments' ? 'active' : ''}`} onClick={() => setActiveTab('investments')}>Inversiones ({member.investments.length})</button>
        )}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-4" style={{ marginBottom: '32px' }}>
            {member.roles.some(r => r.role === 'inversionista') && (
              <div className="stat-card">
                <div className="card-label">Total Invertido</div>
                <div className="stat-value">{formatMoney(member.total_invested)}</div>
              </div>
            )}
          </div>

          {member.roles.some(r => r.role === 'socio') && member.projects.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="detail-section-title">Proyectos Asociados</h3>
              <div className="md-associated-grid">
                {member.projects.map(p => (
                  <Link to={`/projects/${p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-')}`} key={p.id} className="md-associated-card">
                    <span className="md-associated-icon">◆</span>
                    <span className="md-associated-name">{p.name}</span>
                    <span className={`badge badge-${p.status}`} style={{ fontSize: '10px' }}>{p.status === 'active' ? 'Activo' : 'Pausado'}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {member.roles.some(r => r.role === 'propietario') && member.farms.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 className="detail-section-title">Granjas Propias</h3>
              <div className="md-associated-grid">
                {member.farms.map(f => (
                  <Link to={`/projects/granjas-eden/${f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-')}`} key={f.id} className="md-associated-card">
                    <span className="md-associated-icon">♞</span>
                    <span className="md-associated-name">{f.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {Object.keys(totalByProject).length > 0 && (
            <div>
              <h3 className="detail-section-title">Inversiones por Proyecto</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Total Invertido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totalByProject).map(([name, total]) => (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td style={{ color: '#22c55e', fontWeight: 600 }}>{formatMoney(total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'investments' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Inversiones</h3>
            <button className="btn btn-gold" onClick={() => setShowInvestModal(true)}>+ Nueva Inversion</button>
          </div>
          {member.investments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">▣</div>
              <div className="empty-state-title">Sin inversiones</div>
              <div className="empty-state-text">Registra inversiones de este miembro</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Monto</th>
                    <th>Descripcion</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {member.investments.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{formatMoney(inv.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.description || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(inv.date).toLocaleDateString('es-VE')}</td>
                      <td>
                        <button className="project-delete-btn" onClick={() => deleteInvestment(inv.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'edit' && (
        <div className="md-edit-section">
          <h3 className="detail-section-title" style={{ marginBottom: '20px' }}>Editar Miembro</h3>
          <div className="md-edit-form">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input type="text" className="form-input" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Foto (URL)</label>
              <input type="text" className="form-input" value={editForm.photo || ''} onChange={(e) => setEditForm({ ...editForm, photo: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Roles</label>
              <div className="form-check-group">
                {roles.filter(r => r.slug !== 'socio').map((r) => (
                  <label key={r.slug} className={`form-check ${(editForm.roles || []).includes(r.slug) ? 'active' : ''}`} style={{ '--check-color': r.color }}>
                    <input type="checkbox" checked={(editForm.roles || []).includes(r.slug)} onChange={() => toggleRole(r.slug)} />
                    <span>{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => { setActiveTab('overview'); fetchAll(); }}>Cancelar</button>
              <button className="btn btn-gold" onClick={saveEdit}>Guardar Cambios</button>
            </div>
          </div>

          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <h3 className="detail-section-title" style={{ color: '#f87171', marginBottom: '8px' }}>Zona de Peligro</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>Eliminar este miembro es permanente y no se puede deshacer.</p>
            <button className="btn" style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' }} onClick={() => setShowDeleteModal(true)}>Eliminar Miembro</button>
          </div>
        </div>
      )}

      {showInvestModal && (
        <div className="modal-overlay" onClick={() => setShowInvestModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Inversion</h2>
              <button className="modal-close" onClick={() => setShowInvestModal(false)}>×</button>
            </div>
            <form onSubmit={addInvestment}>
              <div className="form-group">
                <label className="form-label">Monto ($)</label>
                <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={investForm.amount} onChange={(e) => setInvestForm({ ...investForm, amount: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo</label>
                <input type="text" className="form-input" placeholder="Ej: Inversion inicial, Aporte mensual..." value={investForm.description} onChange={(e) => setInvestForm({ ...investForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowInvestModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#f87171' }}>Eliminar Miembro</h2>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.6' }}>
              Estas seguro que deseas eliminar a <strong style={{ color: 'var(--text-primary)' }}>{member.name}</strong>? Esta accion es permanente y no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="btn" style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' }} onClick={deleteMember}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
