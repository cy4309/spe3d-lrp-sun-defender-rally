/** VITE_MOCK_MODE：模擬真實 [api] 日誌格式，方便對照 Network / 後端行為 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

function mockUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return url.toString();
}

/** 與 api.ts handleResponse 成功時格式對齊 */
export function logMockGet<T>(path: string, params: Record<string, string> | undefined, response: T): T {
  console.log(`[api mock] GET ${mockUrl(path, params)}`, response);
  return response;
}

export function logMockPost<T>(
  path: string,
  response: T,
  options?: { body?: unknown; params?: Record<string, string> },
): T {
  const url = mockUrl(path, options?.params);
  if (options?.body !== undefined) {
    console.log(`[api mock] POST ${url}`, { request: options.body, response });
  } else {
    console.log(`[api mock] POST ${url}`, response);
  }
  return response;
}

export function logMockPostForm<T>(path: string, formFields: Record<string, string>, response: T): T {
  console.log(`[api mock] POST ${mockUrl(path)}`, { form: formFields, response });
  return response;
}

export function logMockSkip(action: string, reason: string, detail?: unknown): void {
  console.log(`[api mock] SKIP ${action} — ${reason}`, detail ?? "");
}
