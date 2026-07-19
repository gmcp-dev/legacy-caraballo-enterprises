const API_BASE = window.electronApp?.apiUrl || 'http://localhost:3001';

export const API = `${API_BASE}/api`;
export function api(path) {
  return `${API}${path}`;
}
