import { Link } from 'react-router'
import { noIndex } from '../../lib/seo'

export const meta = () => noIndex('Không có quyền truy cập')

export default function Forbidden() {
  return <p>Bạn không có quyền truy cập trang này. <Link to="/">Về trang chủ</Link></p>
}
