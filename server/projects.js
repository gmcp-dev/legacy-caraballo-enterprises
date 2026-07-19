const projects = [
  {
    id: 1,
    name: 'Granjas Eden',
    description: 'Proyecto de granjas agrícolas y pecuarias',
    status: 'active',
    icon: 'fa-solid fa-leaf',
  },
  {
    id: 2,
    name: 'Banco MAZE',
    description: 'Sistema de préstamos y cobranzas',
    status: 'active',
    icon: 'fa-solid fa-building-columns',
  },
];

function getProjectBySlug(slug) {
  return projects.find(p => {
    const s = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
    return s === slug;
  });
}

function getProjectById(id) {
  return projects.find(p => p.id === id);
}

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

module.exports = { projects, getProjectBySlug, getProjectById, slugify };
