import { lazy, Suspense } from 'react'
import { redirect, type ClientLoaderFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { api } from '../lib/api'
import { fromMe, getCachedUser, RequireRole, setCachedUser, type Me } from '../lib/auth'
import { noIndex } from '../lib/seo'

// Lazy-load AdminLayout (chứa antd, menu, sidebar) để user không có quyền không phải tải bundle admin.
const AdminLayout = lazy(() => import('./AdminLayout'))

// 1. Server SSR loader: chặn ngay trên server khi gõ thẳng URL hoặc F5.
// Trả HTTP 302 về /403 hoặc /login ngay lập tức (~10ms), không gửi về thẻ <script> hay chunk antd nào.
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const next = encodeURIComponent(url.pathname + url.search)
  const cookie = request.headers.get('Cookie') ?? ''

  // Không có cookie đăng nhập: chuyển thẳng về login
  if (!cookie.includes('access_token')) {
    throw redirect(`/login?next=${next}`)
  }

  try {
    const base = process.env.API_URL ?? 'http://localhost:5179'
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: cookie, Accept: 'application/json' },
    })
    if (!res.ok) {
      throw redirect(`/login?next=${next}`)
    }
    const body = await res.json()
    const me = (body && typeof body === 'object' && 'data' in body ? body.data : body) as { role?: string }
    const role = (me?.role ?? '').toLowerCase()
    if (role !== 'admin' && role !== 'editor') {
      throw redirect('/403')
    }
    return null
  } catch (err) {
    if (err instanceof Response) throw err
    // Nếu backend không phản hồi lúc SSR: clientLoader sẽ kiểm tra tiếp
    return null
  }
}

// 2. Client loader: chặn ngay khi chuyển trang client-side (SPA).
// Kiểm tra cachedUser (0ms) hoặc gọi /api/auth/me trước khi React Router kịp tải chunk của trang con (Users, Dashboard...).
export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const url = new URL(request.url)
  const next = encodeURIComponent(url.pathname + url.search)

  let user = getCachedUser()
  if (!user) {
    try {
      const res = await api<Me>('/api/auth/me')
      user = fromMe(res)
      setCachedUser(user)
    } catch {
      throw redirect(`/login?next=${next}`)
    }
  }

  if (user.role !== 'admin' && user.role !== 'editor') {
    throw redirect('/403')
  }

  return null
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return <p className="container muted">Đang tải trang quản trị...</p>
}

export const meta = () => noIndex('Quản trị')

export default function AdminRoute() {
  return (
    <RequireRole roles={['editor', 'admin']}>
      <Suspense fallback={<p className="container muted">Đang tải trang quản trị...</p>}>
        <AdminLayout />
      </Suspense>
    </RequireRole>
  )
}
