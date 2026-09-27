import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api, ApiError } from './api'

export type Role = 'student' | 'editor' | 'admin'
export type User = { id: string; role: Role; email?: string | null; username?: string; fullName?: string }

type Auth = {
  user: User | null
  loading: boolean
  login: (usernameOrEmail: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

// Token nằm trong cookie HttpOnly; không lưu accessToken ở client.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ userId: string; role: Role; email: string | null }>('/api/auth/me')
      .then((me) => setUser({ id: me.userId, role: me.role, email: me.email }))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(usernameOrEmail: string, password: string) {
    const res = await api<{ user: User }>('/api/auth/login', { method: 'POST', json: { usernameOrEmail, password } })
    setUser(res.user)
    return res.user
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch((e) => {
      if (!(e instanceof ApiError && e.status === 401)) throw e
    })
    setUser(null)
  }

  return <AuthContext value={{ user, loading, login, logout }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return ctx
}

// Chỉ là UX. Quyền thật do server kiểm tra.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="muted">Đang tải...</p>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to="/403" replace />
  return children
}
