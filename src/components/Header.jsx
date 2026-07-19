import { useLocation } from 'react-router-dom';
import './Header.css';

const pageTitles = {
  '/': 'Dashboard',
  '/projects': 'Proyectos',
  '/projects/granjas-eden': 'Granjas Eden',
  '/members': 'Miembros',
  '/finance': 'Finanzas',
};

export default function Header() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  let title = pageTitles[location.pathname];
  if (!title && segments[0] === 'projects' && segments.length === 3) {
    title = 'Detalle de Granja';
  } else if (!title && segments[0] === 'projects' && segments.length >= 2) {
    title = 'Detalle del Proyecto';
  } else if (!title && segments[0] === 'members' && segments.length >= 2) {
    title = 'Detalle del Miembro';
  }
  if (!title) title = 'LEGACY';

  const breadcrumbParts = ['LEGACY'];
  if (segments[0]) {
    const segLabel = segments[0] === 'projects' ? 'Proyectos' : segments[0] === 'members' ? 'Miembros' : segments[0];
    breadcrumbParts.push(segLabel);
  }
  if (segments[1]) {
    const slugName = segments[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    breadcrumbParts.push(slugName);
  }
  if (segments.length >= 3) breadcrumbParts.push(title);

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        <span className="header-breadcrumb">
          {breadcrumbParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="header-breadcrumb-sep"> / </span>}
              {part}
            </span>
          ))}
        </span>
      </div>
    </header>
  );
}
