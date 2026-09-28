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

// Phát khi API trả 401 lúc đang dùng (cookie hết hạn). AuthProvider nghe để đưa về trạng thái khách.
export const AUTH_EXPIRED_EVENT = 'auth:expired'
// 401 ở hai endpoint này là bình thường (sai mật khẩu, khách chưa đăng nhập), không phải hết phiên.
const EXPECTED_401 = ['/api/auth/login', '/api/auth/me']

// Trình duyệt: đường dẫn tương đối (Vite proxy / nginx cùng origin).
// Server SSR: gọi thẳng backend, không có origin để tương đối.
const BASE = typeof window === 'undefined' ? (process.env.API_URL ?? 'http://localhost:5179') : (import.meta.env.VITE_API_BASE_URL ?? '')

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
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !EXPECTED_401.includes(path)) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    throw toApiError(res.status, body)
  }
  return body as T
}
