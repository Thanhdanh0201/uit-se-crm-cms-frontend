import { data, Link } from 'react-router'
import { noIndex } from '../../lib/seo'

// Trả HTTP 404 thật để Google không index URL sai.
export const loader = () => data(null, { status: 404 })

export const meta = () => noIndex('Không tìm thấy trang')

export default function NotFound() {
  return <p>Không tìm thấy trang. <Link to="/">Về trang chủ</Link></p>
}
