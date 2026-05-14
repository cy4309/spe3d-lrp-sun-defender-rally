const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

let _token: string | null = sessionStorage.getItem("access_token");

export function setAuthToken(token: string) {
  _token = token;
  sessionStorage.setItem("access_token", token);
}

export function clearAuthToken() {
  _token = null;
  sessionStorage.removeItem("access_token");
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

function authHeaders(): Record<string, string> {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const code =
      typeof detail === "object" ? detail?.code : typeof detail === "string" ? detail : `HTTP_${res.status}`;
    const msg = typeof detail === "object" ? detail?.message : undefined;
    console.warn(`[api] ${res.status} ${res.url}`, body);
    throw new ApiError(res.status, code ?? `HTTP_${res.status}`, msg);
  }
  console.log(`[api] ${res.url}`, body);
  return body as T;
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: authHeaders() });
  return handleResponse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse<T>(res);
}

export const apiBaseUrl = API_BASE;
