import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const API = '/api';
const APP_VERSION = typeof window !== 'undefined' && window.electronApp?.appVersion
  ? window.electronApp.appVersion
  : (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');

const mainLinks = [
  { path: '/', label: 'Dashboard', icon: 'fa-solid fa-house' },
  { path: '/members', label: 'Miembros', icon: 'fa-solid fa-users' },
  { path: '/finance', label: 'Finanzas', icon: 'fa-solid fa-coins' },
];

const projectIcons = {
  'granjas-eden': 'fa-solid fa-leaf',
  'banco-maze': 'fa-solid fa-building-columns',
};

const defaultProjectIcon = 'fa-solid fa-briefcase';

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

export default function Sidebar() {
  const location = useLocation();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, [location.pathname]);

  const fetchProjects = async () => {
    const res = await fetch(`${API}/projects`);
    const data = await res.json();
    setProjects(Array.isArray(data) ? data : []);
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

    </aside>
  );
}
