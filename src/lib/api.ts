export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }

  // Lỗi validation của một field. Backend trả key PascalCase ("UsernameOrEmail"), form dùng camelCase.
  field(name: string): string | undefined {
    const key = Object.keys(this.errors ?? {}).find((k) => k.toLowerCase() === name.toLowerCase())
    return key ? this.errors![key][0] : undefined
  }
}

// Phát khi refresh cũng thất bại (phiên hết hạn hẳn). AuthProvider nghe để đưa về trạng thái khách.
export const AUTH_EXPIRED_EVENT = 'auth:expired'
// Không tự refresh cho chính các endpoint auth: 401 ở đây là kết quả thật, và tránh vòng lặp.
const NO_REFRESH = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout']

// Trình duyệt: đường dẫn tương đối (Vite proxy / nginx cùng origin).
// Server SSR: gọi thẳng backend, không có origin để tương đối.
const BASE = typeof window === 'undefined' ? (process.env.API_URL ?? 'http://localhost:5179') : (import.meta.env.VITE_API_BASE_URL ?? '')

// Backend trả ProblemDetails ({ title, detail, errors }) hoặc { message } (login 401).
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as { detail?: string; title?: string; message?: string; errors?: Record<string, string[]> }
  const message = b.detail || b.message || b.title || `Yêu cầu thất bại (${status}).`
  return new ApiError(status, message, b.errors)
}

let refreshing: Promise<boolean> | null = null

// Đổi refresh token (cookie HttpOnly, Path=/api/auth) lấy access token mới.
// Nhiều request 401 cùng lúc chỉ gọi refresh một lần: refresh token của Supabase chỉ dùng được một lần.
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(BASE + '/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  const send = () =>
    fetch(BASE + path, {
      credentials: 'include',
      ...rest,
      headers: { Accept: 'application/json', ...(json !== undefined && { 'Content-Type': 'application/json' }), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })

  let res = await send()
  // Access token hết hạn (khoảng 1 giờ): refresh rồi gửi lại đúng một lần. SSR không có cookie nên bỏ qua.
  if (res.status === 401 && typeof window !== 'undefined' && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) res = await send()
    if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }

  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : undefined
  if (!res.ok) throw toApiError(res.status, body)
  return body as T
}
