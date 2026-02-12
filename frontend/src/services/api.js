// Sem .env, use o backend local (obrigatório ter backend rodando na porta 4000)
const API_URL = (import.meta.env.VITE_API_URL ?? '').trim() || 'http://localhost:4000';

function getToken() {
  return window.localStorage.getItem('beach_flow_token');
}

export async function api(method, path, body = null) {
  const url = `${API_URL}${path}`;
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
  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando (npm run dev:backend ou porta 4000).');
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Erro ${res.status}`);
  return data;
}

export const apiGet = (path) => api('GET', path);
export const apiPost = (path, body) => api('POST', path, body);
export const apiPut = (path, body) => api('PUT', path, body);
export const apiPatch = (path, body) => api('PATCH', path, body);
export const apiDelete = (path) => api('DELETE', path);
