import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api, AUTH_EXPIRED_EVENT, PASSWORD_CHANGE_REQUIRED_EVENT } from './api'

export type Role = 'student' | 'editor' | 'admin'
// mustChangePassword: đang dùng mật khẩu admin cấp (tạo tài khoản, nhập Excel, đặt lại), phải đổi trước khi dùng tiếp.
export type User = { id: string; role: Role; email?: string | null; username?: string; fullName?: string; mustChangePassword?: boolean }

type Auth = {
  user: User | null
  loading: boolean
  // true khi đang đăng nhập mà API trả 401 (cookie hết hạn). Trang đăng nhập hiện thông báo.
  sessionExpired: boolean
  loggingOut: boolean
  login: (usernameOrEmail: string, password: string) => Promise<User>
  logout: () => Promise<void>
  // Gọi sau khi tự đổi mật khẩu thành công: bỏ yêu cầu đổi mật khẩu.
  passwordChanged: () => void
}

// Chuẩn hóa role chữ thường một chỗ, cho cả /me và /login.
export const toRole = (role: string) => role.toLowerCase() as Role

// UserProfileDto của backend, dùng chung cho /api/auth/me và user trong response đăng nhập.
export type Me = { id: string; username: string; fullName: string; role: string; email: string | null; mustChangePassword?: boolean }
export const fromMe = (me: Me): User => ({ id: me.id, username: me.username, fullName: me.fullName, role: toRole(me.role), email: me.email, mustChangePassword: me.mustChangePassword === true })

// Cache người dùng cấp module để clientLoader (React Router) kiểm tra quyền tức thời (0ms),
// chặn không cho tải chunk của admin khi người dùng là sinh viên hoặc khách.
let cachedUser: User | null = null
export const getCachedUser = () => cachedUser
export const setCachedUser = (u: User | null) => { cachedUser = u }

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
        .then((me) => {
          const u = fromMe(me)
          setCachedUser(u)
          setUser(u)
          return u
        })
        .catch(() => {
          setCachedUser(null)
          setUser(null)
          return null
        })
    loadMe().finally(() => setLoading(false))

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    if (channel) {
      channel.onmessage = (e: MessageEvent<AuthMessage>) => {
        if (e.data === 'logout') {
          setCachedUser(null)
          setUser(null)
        }
        // Tab khác đăng nhập lại: đồng bộ thông tin user mới qua loadMe().
        // React Router và RequireRole sẽ tự động chuyển hướng an toàn (không reload làm trắng màn).
        if (e.data === 'login') void loadMe()
      }
    }

    // Refresh cũng thất bại (api.ts phát event): về trạng thái khách, RequireRole tự chuyển sang /login.
    const onExpired = () => {
      setCachedUser(null)
      setUser((u) => {
        if (u) setSessionExpired(true)
        return null
      })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    // Server chặn vì chưa đổi mật khẩu admin cấp: bật cờ, RequireRole chuyển tới trang đổi mật khẩu.
    const onPasswordChangeRequired = () => setUser((u) => (u && !u.mustChangePassword ? { ...u, mustChangePassword: true } : u))
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChangeRequired)
    return () => {
      setCachedUser(null)
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChangeRequired)
      channel?.close()
    }
  }, [])

  async function login(usernameOrEmail: string, password: string) {
    const res = await api<{ user: Me }>('/api/auth/login', { method: 'POST', json: { usernameOrEmail, password } })
    const u = fromMe(res.user)
    setCachedUser(u)
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
      setCachedUser(null)
      setUser(null)
      setSessionExpired(false)
      channelRef.current?.postMessage('logout' satisfies AuthMessage)
      loggingOutRef.current = false
      setLoggingOut(false)
    }
  }

  function passwordChanged() {
    setUser((u) => {
      const next = u ? { ...u, mustChangePassword: false } : u
      setCachedUser(next)
      return next
    })
  }

  return <AuthContext value={{ user, loading, sessionExpired, loggingOut, login, logout, passwordChanged }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return ctx
}

export const CHANGE_PASSWORD_PATH = '/me/password'

// Chỉ là UX. Quyền thật do server kiểm tra.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  if (loading) return <p className="muted">Đang tải...</p>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  // Truyền trang bị chặn để trang 403 cho đăng nhập tài khoản khác rồi quay lại đúng chỗ.
  if (!roles.includes(user.role)) return <Navigate to="/403" replace state={{ from: pathname + search }} />
  // Mật khẩu do admin cấp: phải đổi trước khi vào trang khác (server cũng chặn API).
  if (user.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={`${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(pathname + search)}`} replace />
  }
  return children
}
