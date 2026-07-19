import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const API = 'http://localhost:3001/api';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetch(`${API}/projects`).then(r => r.json()).then(setProjects);
    fetch(`${API}/finance/summary`).then(r => r.json()).then(setSummary);
  }, []);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount);
  };

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">LEGACY Caraballo Enterprises — Panel de control general</p>

      <div className="grid grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="card-label">Proyectos Activos</div>
          <div className="stat-value">{summary?.active_projects || 0}</div>
        </div>
        <div className="stat-card">
          <div className="card-label">Socios</div>
          <div className="stat-value">{summary?.total_partners || 0}</div>
        </div>
        <div className="stat-card">
          <div className="card-label">Capital Invertido</div>
          <div className="stat-value">{formatMoney(summary?.total_invested || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="card-label">Balance Total</div>
          <div className="stat-value" style={{ color: (summary?.balance || 0) >= 0 ? 'var(--gold-primary)' : '#f87171' }}>
            {formatMoney(summary?.balance || 0)}
          </div>
        </div>
      </div>

      <h2 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '16px',
        color: 'var(--text-primary)',
      }}>
        Proyectos
      </h2>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◆</div>
          <div className="empty-state-title">Sin proyectos</div>
          <div className="empty-state-text">
            No hay proyectos configurados
          </div>
        </div>
      ) : (
        <div className="grid grid-3">
          {projects.map((project) => {
            const balance = project.total_earned - project.total_expenses;
            return (
              <Link
                to={`/projects/${project.slug}`}
                key={project.id}
                className="project-card"
                style={{ textDecoration: 'none' }}
              >
                <div className="card-header">
                  <div className="card-icon">◆</div>
                  <span className={`badge badge-${project.status}`}>
                    {project.status === 'active' ? 'Activo' : 'Pausado'}
                  </span>
                </div>
                <div className="card-title">{project.name}</div>
                <p className="project-card-desc">{project.description || 'Sin descripcion'}</p>
                <div className="project-card-stats">
                  <div>
                    <span className="project-card-stat-value">{project.member_count}</span>
                    <span className="project-card-stat-label">Miembros</span>
                  </div>
                  <div>
                    <span className="project-card-stat-value">{formatMoney(balance)}</span>
                    <span className="project-card-stat-label">Balance</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
