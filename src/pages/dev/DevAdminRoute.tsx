import { useSearchParams } from 'react-router'
import AdminLayout from '../../admin/AdminLayout'
import { noIndex } from '../../lib/seo'

// Chỉ khi dev: xem khung quản trị không cần backend. ?as=editor để xem menu biên tập viên.
export async function clientLoader() {
  return null
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return <p className="container muted">Đang tải trang quản trị...</p>
}

export const meta = () => noIndex('Xem thử quản trị')

export default function DevAdminRoute() {
  const [params] = useSearchParams()
  return <AdminLayout previewRole={params.get('as') === 'editor' ? 'editor' : 'admin'} />
}
