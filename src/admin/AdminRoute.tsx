import { RequireRole } from '../lib/auth'
import { noIndex } from '../lib/seo'
import AdminLayout from './AdminLayout'

// Trang quản trị chỉ render ở client: không cần SEO, và tránh SSR style của Ant Design.
// clientLoader.hydrate làm server trả HydrateFallback, component thật chạy sau khi JS tải.
export async function clientLoader() {
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
      <AdminLayout />
    </RequireRole>
  )
}
