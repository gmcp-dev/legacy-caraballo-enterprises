function slugify(text) {
  return text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

function slugifyLegacy(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

function matchSlug(name, slug) {
  return slugify(name) === slug || slugifyLegacy(name) === slug;
}

module.exports = { slugify, slugifyLegacy, matchSlug };
