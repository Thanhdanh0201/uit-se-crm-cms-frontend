import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api, AUTH_EXPIRED_EVENT } from './api'

export type Role = 'student' | 'editor' | 'admin'
export type User = { id: string; role: Role; email?: string | null; username?: string; fullName?: string }

type Auth = {
  user: User | null
  loading: boolean
  // true khi đang đăng nhập mà API trả 401 (cookie hết hạn). Trang đăng nhập hiện thông báo.
  sessionExpired: boolean
  loggingOut: boolean
  login: (usernameOrEmail: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

// Chuẩn hóa role chữ thường một chỗ, cho cả /me và /login.
const toRole = (role: string) => role.toLowerCase() as Role

type Me = { userId: string; role: string; email: string | null }
const fromMe = (me: Me): User => ({ id: me.userId, role: toRole(me.role), email: me.email })

// Đồng bộ giữa các tab: đăng xuất ở tab này thì tab khác về trạng thái khách ngay, không đợi lần gọi API sau.
const CHANNEL = 'auth'
type AuthMessage = 'login' | 'logout'

const AuthContext = createContext<Auth | null>(null)


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
  const [loggingOut, setLoggingOut] = useState(false)
  const loggingOutRef = useRef(false)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const loadMe = () =>
      api<Me>('/api/auth/me')
        .then((me) => setUser(fromMe(me)))
        .catch(() => setUser(null))
    loadMe().finally(() => setLoading(false))

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    if (channel) {
      channel.onmessage = (e: MessageEvent<AuthMessage>) => {
        if (e.data === 'logout') setUser(null)
        if (e.data === 'login') void loadMe()
      }
    }

    // Refresh cũng thất bại (api.ts phát event): về trạng thái khách, RequireRole tự chuyển sang /login.
    const onExpired = () => {
      setUser((u) => {
        if (u) setSessionExpired(true)
        return null
      })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
      channel?.close()
    }
  }, [])

  async function login(usernameOrEmail: string, password: string) {
    const res = await api<{ user: User }>('/api/auth/login', { method: 'POST', json: { usernameOrEmail, password } })
    const u = { ...res.user, role: toRole(res.user.role) }
    setUser(u)
    setSessionExpired(false)
    channelRef.current?.postMessage('login' satisfies AuthMessage)
    return u
  }

  async function logout() {
    // Chống bấm lặp: đang đăng xuất thì bỏ qua lần bấm sau.
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    setLoggingOut(true)
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // Cookie hết hạn hoặc mạng lỗi: vẫn đưa giao diện về trạng thái khách.
    } finally {
      setUser(null)
      setSessionExpired(false)
      channelRef.current?.postMessage('logout' satisfies AuthMessage)
      loggingOutRef.current = false
      setLoggingOut(false)
    }
  }

  return <AuthContext value={{ user, loading, sessionExpired, loggingOut, login, logout }}>{children}</AuthContext>
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
