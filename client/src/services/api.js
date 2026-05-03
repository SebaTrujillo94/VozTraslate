// api.js - funciones para hablar con el servidor
// reemplazamos el localStorage por llamadas reales al backend con postgres

const API_URL = '';

export function getToken() {
  return localStorage.getItem('voztranslate_token');
}

export function setToken(token) {
  localStorage.setItem('voztranslate_token', token);
}

export function clearToken() {
  localStorage.removeItem('voztranslate_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw { status: res.status, message: data.error || 'Error desconocido' };
  return data;
}

export async function register({ email, password, username, displayName, preferredLanguage }) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username, displayName, preferredLanguage }),
  });
  setToken(data.token);
  return data;
}

export async function login({ email, password }) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function getMe() {
  return request('/api/auth/me');
}

export async function updateProfile({ displayName, preferredLanguage, avatarUrl }) {
  return request('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ displayName, preferredLanguage, avatarUrl }),
  });
}

export async function checkEmail(email) {
  return request('/api/auth/check-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword({ email, newPassword }) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, newPassword }),
  });
}

export function logout() {
  clearToken();
}

// ── HU-09: carga más mensajes viejos para el scroll infinito ──────────────────
// `before` es el timestamp del mensaje más viejo que ya tenemos en pantalla
export async function fetchChannelHistory(codigo, { before, limit = 20 }) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  return request(`/api/channels/${codigo}/history?${params.toString()}`);
}

// ── HU-10: pide al servidor los mensajes en un rango de fechas para exportar ──
// Solo funciona para usuarios Pro, el servidor devuelve 403 si no lo son
export async function exportChannelHistory(codigo, { from, to }) {
  const params = new URLSearchParams({ from, to });
  return request(`/api/channels/${codigo}/export?${params.toString()}`);
}
