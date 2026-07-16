import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Members.css';

const API = 'http://localhost:3001/api';

function slugify(text) {
  return text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

export default function Members() {
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [farms, setFarms] = useState([]);
  const [stats, setStats] = useState(null);
  const [roles, setRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', photo: '', roles: [], projectIds: [], farmIds: [] });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Role management
  const [showRoles, setShowRoles] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', color: '#c9a84c' });
  const [editingRole, setEditingRole] = useState(null);

  const roleMap = {};
  roles.forEach(r => { roleMap[r.slug] = r; });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [m, p, f, s, r] = await Promise.all([
      fetch(`${API}/members`).then(r => r.json()),
      fetch(`${API}/projects`).then(r => r.json()),
      fetch(`${API}/projects/granjas-eden/farms`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/members/stats/summary`).then(r => r.json()),
      fetch(`${API}/roles`).then(r => r.json()),
    ]);
    setMembers(m);
    setProjects(p);
    setFarms(Array.isArray(f) ? f : []);
    setStats(s);
    setRoles(r);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', photo: '', roles: [], projectIds: [], farmIds: [] });
    setShowModal(true);
  };

  const toggleRole = (slug) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(slug)
        ? prev.roles.filter(r => r !== slug)
        : [...prev.roles, slug],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const slug = slugify(editing ? editing.name : form.name);
    const url = editing ? `${API}/members/${slug}` : `${API}/members`;
    const method = editing ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setShowModal(false);
    fetchAll();
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) return;
    const url = editingRole ? `${API}/roles/${editingRole.id}` : `${API}/roles`;
    const method = editingRole ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleForm),
    });

    setRoleForm({ name: '', color: '#c9a84c' });
    setEditingRole(null);
    fetchAll();
  };

  const deleteRole = async (id) => {
    if (!confirm('Eliminar este rol?')) return;
    await fetch(`${API}/roles/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  return (
    <div>
      <div className="members-header">
        <div>
          <h1 className="page-title">Miembros</h1>
          <p className="page-subtitle">Socios, inversionistas y propietarios de LEGACY Caraballo Enterprises</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={() => setShowRoles(!showRoles)}>
            {showRoles ? 'Volver a Miembros' : 'Gestionar Roles'}
          </button>
          {!showRoles && <button className="btn btn-gold" onClick={openCreate}>+ Nuevo Miembro</button>}
        </div>
      </div>

      {showRoles ? (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h3 className="detail-section-title" style={{ marginBottom: '16px' }}>{editingRole ? 'Editar Rol' : 'Crear Rol'}</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre del rol"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                style={{ maxWidth: '250px' }}
              />
              <input
                type="color"
                value={roleForm.color}
                onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                style={{ width: '40px', height: '38px', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
              />
              <button className="btn btn-gold" onClick={saveRole}>{editingRole ? 'Guardar' : 'Crear'}</button>
              {editingRole && (
                <button className="btn btn-outline" onClick={() => { setEditingRole(null); setRoleForm({ name: '', color: '#c9a84c' }); }}>Cancelar</button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Color</th>
                  <th>Tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="member-role-badge" style={{ color: role.color, borderColor: role.color + '40', background: role.color + '15' }}>
                          {role.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: role.color, border: '1px solid var(--border-color)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{role.color}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: role.is_special ? 'var(--gold-primary)' : 'var(--text-secondary)', fontSize: '13px' }}>
                        {role.is_special ? 'Especial' : 'Custom'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '5px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}
                          onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, color: role.color }); }}
                        >✎ Editar</button>
                        {!role.is_special && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: '5px 12px', fontSize: '13px', color: '#ef4444', borderColor: '#ef444440' }}
                            onClick={() => deleteRole(role.id)}
                          >✕ Eliminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar miembro por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, maxWidth: '400px' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn ${roleFilter === '' ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setRoleFilter('')}
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                Todos
              </button>
              {roles.map((r) => (
                <button
                  key={r.slug}
                  className={`btn ${roleFilter === r.slug ? 'btn-gold' : 'btn-outline'}`}
                  onClick={() => setRoleFilter(roleFilter === r.slug ? '' : r.slug)}
                  style={{ padding: '6px 14px', fontSize: '13px', borderColor: roleFilter === r.slug ? r.color : undefined, color: roleFilter === r.slug ? r.color : undefined }}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div className="members-grid">
            {members
              .filter(m => {
                if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
                if (roleFilter && !m.roles.some(r => r.role === roleFilter)) return false;
                return true;
              })
              .map((member) => (
              <Link to={`/members/${slugify(member.name)}`} key={member.id} className="member-card">
                <div className="member-card-top">
                  <div className="member-card-photo">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} draggable="false" />
                    ) : (
                      <span className="member-card-initial">{member.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="member-card-info-side">
                    <h3 className="member-card-name">{member.name}</h3>
                    <span className="member-role-badge" style={{ color: member.status === 'active' ? '#22c55e' : '#ef4444', borderColor: (member.status === 'active' ? '#22c55e' : '#ef4444') + '40', background: (member.status === 'active' ? '#22c55e' : '#ef4444') + '15', fontSize: '11px', padding: '2px 8px' }}>
                      {member.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="member-card-roles">
                  {member.roles.map((r) => (
                    <span key={r.role} className="member-role-badge" style={{ color: r.color, borderColor: r.color + '40', background: r.color + '15' }}>
                      {r.name}
                    </span>
                  ))}
                </div>

                <div className="member-card-info">
                  {member.roles.some(r => r.role === 'socio') && member.projects.length > 0 && (
                    <div className="member-card-info-row">
                      <span className="member-card-info-label">Proyectos</span>
                      <span className="member-card-info-value">{member.projects.map(p => p.name).join(', ')}</span>
                    </div>
                  )}
                  {member.roles.some(r => r.role === 'propietario') && member.farms.length > 0 && (
                    <div className="member-card-info-row">
                      <span className="member-card-info-label">Granjas</span>
                      <span className="member-card-info-value">{member.farms.map(f => f.name).join(', ')}</span>
                    </div>
                  )}
                  {member.roles.some(r => r.role === 'inversionista') && (
                    <div className="member-card-info-row">
                      <span className="member-card-info-label">Invertido</span>
                      <span className="member-card-info-value gold-text">{formatMoney(member.total_invested)}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Miembro' : 'Nuevo Miembro'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input type="text" className="form-input" placeholder="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Foto (URL opcional)</label>
                <input type="text" className="form-input" placeholder="https://..." value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Roles</label>
                <div className="form-check-group">
                  {roles.filter(r => !r.is_special || r.slug !== 'socio').map((r) => (
                    <label key={r.slug} className={`form-check ${form.roles.includes(r.slug) ? 'active' : ''}`} style={{ '--check-color': r.color }}>
                      <input type="checkbox" checked={form.roles.includes(r.slug)} onChange={() => toggleRole(r.slug)} />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">{editing ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
