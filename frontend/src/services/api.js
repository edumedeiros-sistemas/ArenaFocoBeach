const API_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return window.localStorage.getItem('beach_flow_token');
}

export async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    },
  };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Erro ${res.status}`);
  return data;
}

export const apiGet = (path) => api('GET', path);
export const apiPost = (path, body) => api('POST', path, body);
export const apiPut = (path, body) => api('PUT', path, body);
export const apiPatch = (path, body) => api('PATCH', path, body);
export const apiDelete = (path) => api('DELETE', path);
