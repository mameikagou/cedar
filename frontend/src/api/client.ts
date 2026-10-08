/** Framework-independent request layer, adapted from analyze's frontend client. */
const API_BASE = '/api'
export class APIError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
    this.name = 'APIError'
  }
}
type Params = Record<string, string | number | undefined>
function buildUrl(path: string, params?: Params) {
  const normalized = path.startsWith('/api/') ? path.slice(4) : path
  const url = new URL(`${API_BASE}/${normalized.replace(/^\//, '')}`, window.location.origin)
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  })
  return url
}
async function request<T>(path: string, init: RequestInit = {}, params?: Params, timeoutMs = 8000): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    let detail = '请求失败，请稍后重试。'
    const body: unknown = await response.json().catch(() => null)
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') detail = body.detail
    throw new APIError(response.status, detail)
  }
  return response.json() as Promise<T>
}
export const apiGet = <T>(path: string, params?: Params, signal?: AbortSignal, timeoutMs?: number) => request<T>(path, { signal }, params, timeoutMs)
export const apiPost = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const apiPatch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
