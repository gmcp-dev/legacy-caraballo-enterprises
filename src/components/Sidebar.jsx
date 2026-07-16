import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const API = 'http://localhost:3001/api';
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const mainLinks = [
  { path: '/', label: 'Dashboard', icon: 'fa-solid fa-house' },
  { path: '/members', label: 'Miembros', icon: 'fa-solid fa-users' },
  { path: '/finance', label: 'Finanzas', icon: 'fa-solid fa-coins' },
];

const projectIcons = {
  'granjas-eden': 'fa-solid fa-leaf',
};

const defaultProjectIcon = 'fa-solid fa-briefcase';

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchProjects();
  }, [location.pathname]);

  const fetchProjects = async () => {
    const res = await fetch(`${API}/projects`);
    const data = await res.json();
    setProjects(Array.isArray(data) ? data : []);
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const project = await res.json();
    setForm({ name: '', description: '' });
    setShowModal(false);
    fetchProjects();
    navigate(`/projects/${project.slug}`);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logos/legacy-logo.png" alt="Legacy" className="sidebar-logo-img" draggable="false" />
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">LEGACY</span>
            <span className="sidebar-brand-sub">Caraballo Enterprises</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {mainLinks.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            <i className={`sidebar-link-icon ${item.icon}`} />
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}

        <div className="sidebar-divider" />

        <div className="sidebar-section-header">
          <span className="sidebar-section-label">Proyectos</span>
          <button className="sidebar-add-btn" onClick={() => setShowModal(true)} title="Nuevo proyecto">
            <i className="fa-solid fa-plus" />
          </button>
        </div>

        {projects.map((project) => {
          const slug = slugify(project.name);
          const icon = projectIcons[slug] || defaultProjectIcon;
          const isActive = location.pathname.startsWith(`/projects/${slug}`);

          return (
            <NavLink
              key={project.id}
              to={`/projects/${slug}`}
              className={`sidebar-link sidebar-link-project ${isActive ? 'active' : ''}`}
            >
              <i className={`sidebar-link-icon ${icon}`} />
              <span className="sidebar-link-text">{project.name}</span>
            </NavLink>
          );
        })}

        {projects.length === 0 && (
          <div className="sidebar-empty">Sin proyectos</div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-build-info">
          <span className="sidebar-build-label">Build</span>
          <span className="sidebar-build-version">v{APP_VERSION}</span>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo Proyecto</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={createProject}>
              <div className="form-group">
                <label className="form-label">Nombre del Proyecto</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Granjas, Logistica, Bienes Raices..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Descripcion breve del proyecto..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold">Crear Proyecto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
