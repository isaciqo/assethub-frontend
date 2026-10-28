import type { ApiError } from '@/types';

// Aceita a URL da API com ou sem "/api/v1" (e com barra no fim) — erro comum
// ao configurar a variável na Vercel. Sem a variável, usa "/api/v1" na mesma
// origem (nginx no Docker ou o rewrite do vercel.json fazem o proxy).
function apiBase(raw?: string) {
  const url = (raw || '').trim().replace(/\/+$/, '');
  if (!url) return '/api/v1';
  return /\/api\/v\d+$/.test(url) ? url : `${url}/api/v1`;
}

const BASE_URL = apiBase(import.meta.env.VITE_API_BASE_URL as string);

export const TOKEN_KEY = 'assethub_token';
export const REFRESH_KEY = 'assethub_refresh_token';
export const USER_KEY = 'assethub_user';

const AUTH_ISSUING_PATHS = ['/auth/login', '/auth/refresh'];

function clearSessionAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async res => (res.ok ? ((await res.json()).accessToken as string) ?? null : null))
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  const token = await refreshPromise;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  return token;
}

// Erro de rede (sem internet, servidor fora) vira um ApiError com `offline: true`
// — quem chama decide o que fazer (ex.: a fila de sincronização só espera).
// Diferente do MEDagenda, NUNCA derruba a sessão por falta de conexão.
const offlineError = (): ApiError => ({ message: 'Sem conexão com o servidor', statusCode: 0, offline: true });

export const isOfflineError = (e: unknown) => !!(e as ApiError)?.offline;

type Body = unknown;

class HttpClient {
  constructor(private baseUrl: string) {}

  private headers(json = true): HeadersInit {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  private async raw(method: string, path: string, body?: Body, params?: Record<string, string | undefined>, isRetry = false): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });

    const isForm = body instanceof FormData;
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: this.headers(!isForm),
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch {
      throw offlineError();
    }

    if (res.status === 401 && !isRetry && !AUTH_ISSUING_PATHS.includes(path)) {
      const token = await refreshAccessToken();
      if (token) return this.raw(method, path, body, params, true);
      if (navigator.onLine) clearSessionAndRedirect();
      throw { message: 'Sessão expirada', statusCode: 401 } as ApiError;
    }

    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw { message: b.message || b.details?.[0] || b.error || 'Erro inesperado', statusCode: res.status } as ApiError;
    }
    return res;
  }

  async request<T>(method: string, path: string, body?: Body, params?: Record<string, string | undefined>): Promise<T> {
    const res = await this.raw(method, path, body, params);
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  get<T>(path: string, params?: Record<string, string | undefined>) { return this.request<T>('GET', path, undefined, params); }
  post<T>(path: string, body?: Body) { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body?: Body) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }

  // Binários (PDF, XLSX, imagens de evidência) precisam do Bearer — <img src>
  // e <a href> não mandam header, então baixamos como Blob.
  async blob(path: string, params?: Record<string, string | undefined>): Promise<{ blob: Blob; fileName: string }> {
    const res = await this.raw('GET', path, undefined, params);
    const disp = res.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(disp);
    return { blob: await res.blob(), fileName: match ? decodeURIComponent(match[1]) : 'arquivo' };
  }
}

export const http = new HttpClient(BASE_URL);

export async function downloadFile(path: string, params?: Record<string, string | undefined>) {
  const { blob, fileName } = await http.blob(path, params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function openFile(path: string) {
  // Abre a aba antes do await: navegadores bloqueiam window.open fora do clique.
  const tab = window.open('', '_blank');
  const { blob } = await http.blob(path);
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
}
