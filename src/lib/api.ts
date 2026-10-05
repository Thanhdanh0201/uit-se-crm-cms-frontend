export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  // Mã lỗi nghiệp vụ trong ProblemDetails (AppException của backend): "media_in_use", "unsupported_type"...
  code?: string
  // Toàn bộ body lỗi, để đọc extension riêng (ví dụ usages khi 409 media_in_use).
  body?: Record<string, unknown>

  constructor(status: number, message: string, errors?: Record<string, string[]>, code?: string, body?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.errors = errors
    this.code = code
    this.body = body
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
  const b = (body ?? {}) as { detail?: string; title?: string; message?: string; code?: string; errors?: Record<string, string[]> }
  const message = b.detail || b.message || b.title || `Yêu cầu thất bại (${status}).`
  return new ApiError(status, message, b.errors, b.code, body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined)
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
  return unwrap(body) as T
}

// Backend bọc mọi response thành công: { success, message, data } (Shared/Responses/ApiResponse.cs).
// Trả thẳng data cho nơi gọi. Response chỉ có message (đăng xuất, đổi mật khẩu) thì trả undefined.
// Thông báo hiển thị cho người dùng do frontend tự viết, không dùng message của server.
export function unwrap(body: unknown): unknown {
  if (body && typeof body === 'object' && 'success' in body) return (body as { data?: unknown }).data
  return body
}

// Upload multipart có tiến độ (fetch không báo tiến độ upload). Cùng luật với api(): cookie, refresh khi 401, bóc lớp bọc.
export async function upload<T>(path: string, form: FormData, onProgress?: (percent: number) => void): Promise<T> {
  const send = () =>
    new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', BASE + path)
      xhr.withCredentials = true
      xhr.setRequestHeader('Accept', 'application/json')
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded * 100) / e.total))
      xhr.onload = () => {
        let body: unknown
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined
        } catch {
          body = undefined
        }
        resolve({ status: xhr.status, body })
      }
      xhr.onerror = () => reject(new TypeError('Failed to fetch'))
      xhr.send(form)
    })

  let res = await send()
  if (res.status === 401) {
    if (await refreshSession()) {
      onProgress?.(0)
      res = await send()
    }
    if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
  if (res.status < 200 || res.status >= 300) throw toApiError(res.status, res.body)
  return unwrap(res.body) as T
}
