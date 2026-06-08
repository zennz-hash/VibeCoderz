export class ApiConnectionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

const configuredApiUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function apiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!API_BASE_URL || typeof input !== 'string') return input;
  if (!input.startsWith('/')) return input;
  return `${API_BASE_URL}${input}`;
}

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function readStoredCsrfToken() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return typeof user.csrfToken === 'string' ? user.csrfToken : '';
  } catch {
    return '';
  }
}

function apiTargetLabel(input: RequestInfo | URL) {
  const target = apiUrl(input);
  if (typeof target === 'string') return target;
  if (target instanceof URL) return target.toString();
  return 'API server';
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('vc_csrf') || readStoredCsrfToken();
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }

  try {
    return await fetch(apiUrl(input), {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;

    const baseHint = API_BASE_URL
      ? `API target: ${API_BASE_URL}.`
      : 'Buka aplikasi dari server backend yang sama, misalnya http://localhost:3000, atau set VITE_API_URL bila frontend dipisah.';

    throw new ApiConnectionError(
      `Tidak bisa menghubungi API (${apiTargetLabel(input)}). ${baseHint}`,
      error
    );
  }
}

export async function readApiError(response: Response, fallback = 'Request gagal.') {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    return data?.error || data?.message || fallback;
  }

  const text = await response.text().catch(() => '');
  return text.trim().slice(0, 240) || fallback;
}

export function userFacingError(error: any, fallback = 'Request gagal.') {
  if (error?.name === 'AbortError') {
    return error?.message || 'Request timeout. Server sedang sibuk atau koneksi terputus.';
  }
  if (error instanceof ApiConnectionError) return error.message;
  return error?.message || fallback;
}
