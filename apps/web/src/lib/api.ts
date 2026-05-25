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

export function getAuthToken(): string | null {
  return _token;
}

/** 讀 JWT payload 的 exp（秒），不驗簽，僅供前端倒數過期 */
export function getTokenExpiresAtMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

let _onUnauthorized: ((message: string) => void) | null = null;

export function setUnauthorizedHandler(handler: ((message: string) => void) | null) {
  _onUnauthorized = handler;
}

function messageFor401(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (detail === "session_expired") return "登入已過期，請重新從 LINE 開啟活動";
  if (detail === "invalid_session_token" || detail === "missing_bearer") {
    return "登入狀態已失效，請重新登入";
  }
  if (typeof detail === "object" && detail !== null && "message" in detail) {
    const msg = (detail as { message?: string }).message;
    if (msg) return msg;
  }
  return "登入已過期，請重新從 LINE 開啟活動";
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
    if (res.status === 401) {
      clearAuthToken();
      _onUnauthorized?.(messageFor401(body));
    }
    const detail = body?.detail;
    const code =
      typeof detail === "object" ? detail?.code : typeof detail === "string" ? detail : `HTTP_${res.status}`;
    const msg =
      res.status === 401
        ? messageFor401(body)
        : typeof detail === "object"
          ? detail?.message
          : undefined;
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

const CAMPAIGN_CODE = (import.meta.env.VITE_CAMPAIGN_CODE as string) || "";

/** 上報頁面瀏覽（失敗不影響使用者流程） */
export async function recordPageView(path: string): Promise<void> {
  if (!CAMPAIGN_CODE) return;
  try {
    const url = new URL(`${API_BASE}/api/v1/analytics/page-view`, window.location.origin);
    await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ campaign_code: CAMPAIGN_CODE, path }),
    });
  } catch {
    /* ignore */
  }
}
