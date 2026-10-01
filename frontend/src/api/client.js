// Cliente HTTP da API com renovação automática do token de acesso.
// O access token fica apenas em memória; o refresh token é um cookie httpOnly.
const BASE = import.meta.env.VITE_API_URL || '/api';

let accessToken = null;
let refreshing = null;
let onUnauthorized = () => {};

export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new ApiError(r.status, 'Sessão expirada');
        const data = await r.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request(method, url, { body, query, raw, retry = true } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))}` : '';
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${url}${qs}`, {
    method, headers, credentials: 'include',
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && retry && !url.startsWith('/auth/login')) {
    try {
      await refreshSession();
      return request(method, url, { body, query, raw, retry: false });
    } catch {
      onUnauthorized();
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
    }
  }
  if (raw) {
    if (!res.ok) throw new ApiError(res.status, 'Falha no download');
    return res;
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.details) ? data.details.map((d) => `${d.path}: ${d.message}`).join('; ') : '';
    throw new ApiError(res.status, `${data.error || 'Erro inesperado'}${detail ? ` — ${detail}` : ''}`, data.details);
  }
  return data;
}

export const api = {
  get: (url, query) => request('GET', url, { query }),
  post: (url, body) => request('POST', url, { body }),
  put: (url, body) => request('PUT', url, { body }),
  patch: (url, body) => request('PATCH', url, { body }),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, { body: formData }),
  download: async (url, filename, query) => {
    const res = await request('GET', url, { query, raw: true });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};
