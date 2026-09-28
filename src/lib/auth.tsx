import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api, AUTH_EXPIRED_EVENT } from './api'

export type Role = 'student' | 'editor' | 'admin'
export type User = { id: string; role: Role; email?: string | null; username?: string; fullName?: string }

type Auth = {
  user: User | null
  loading: boolean
  // true khi đang đăng nhập mà API trả 401 (cookie hết hạn). Trang đăng nhập hiện thông báo.
  sessionExpired: boolean
  login: (usernameOrEmail: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

// Backend trả role chữ thường ở /me nhưng không chắc ở /login: chuẩn hóa một chỗ.
const toRole = (role: string) => role.toLowerCase() as Role

// Chỉ nhận đường dẫn nội bộ ("/admin"), chặn open redirect kiểu "//evil.com" hoặc "https://evil.com".
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}

// Token nằm trong cookie HttpOnly; không lưu accessToken ở client.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    api<{ userId: string; role: string; email: string | null }>('/api/auth/me')
      .then((me) => setUser({ id: me.userId, role: toRole(me.role), email: me.email }))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    // Backend chưa có refresh token: hết hạn thì về trạng thái khách, RequireRole tự chuyển sang /login.
    const onExpired = () => {
      setUser((u) => {
        if (u) setSessionExpired(true)
        return null
      })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  async function login(usernameOrEmail: string, password: string) {
    const res = await api<{ user: User }>('/api/auth/login', { method: 'POST', json: { usernameOrEmail, password } })
    const u = { ...res.user, role: toRole(res.user.role) }
    setUser(u)
    setSessionExpired(false)
    return u
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // Cookie hết hạn hoặc mạng lỗi: vẫn đưa giao diện về trạng thái khách.
    } finally {
      setUser(null)
    }
  }

  return <AuthContext value={{ user, loading, sessionExpired, login, logout }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return ctx
}

// Chỉ là UX. Quyền thật do server kiểm tra.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  if (loading) return <p className="muted">Đang tải...</p>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />
  return children
}
