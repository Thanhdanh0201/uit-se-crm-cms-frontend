export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// Backend trả ProblemDetails ({ title, detail, errors }) hoặc { message } (login 401).
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as { detail?: string; title?: string; message?: string; errors?: Record<string, string[]> }
  const message = b.detail || b.message || b.title || `Yêu cầu thất bại (${status}).`
  return new ApiError(status, message, b.errors)
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  const res = await fetch(BASE + path, {
    credentials: 'include',
    ...rest,
    headers: { Accept: 'application/json', ...(json !== undefined && { 'Content-Type': 'application/json' }), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : undefined
  if (!res.ok) throw toApiError(res.status, body)
  return body as T
}
