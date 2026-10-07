import { data, Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ShieldWarning } from '@phosphor-icons/react'
import { safeNext, useAuth } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { ROLE_LABEL } from '../../admin/roles'
import Button, { buttonClass } from '../../components/ui/Button'
import '../../styles/auth.css'

// Mở thẳng /403 cũng trả đúng HTTP 403.
export const loader = () => data(null, { status: 403 })

export const meta = () => noIndex('Không có quyền truy cập')

export default function Forbidden() {
  const { user, logout, loggingOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const from = safeNext((location.state as { from?: string } | null)?.from ?? params.get('from') ?? params.get('next') ?? null)

  async function switchAccount() {
    await logout()
    // Không dùng { replace: true } để khi bấm nút Back trên trình duyệt,
    // người dùng quay lại được trang 403 ở trạng thái khách mà không bị văng sang trang trước đó.
    navigate(from ? `/login?next=${encodeURIComponent(from)}` : '/login')
  }

  return (
    <div className="auth">
      <div className="auth__card stack" style={{ textAlign: 'center', alignItems: 'center' }}>
        <span className="ui-empty__icon" aria-hidden><ShieldWarning size={24} /></span>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>Bạn không có quyền truy cập trang này</h1>
        <p className="muted">
          {user
            ? `Tài khoản ${user.email ?? ''} (${ROLE_LABEL[user.role]}) không được phép mở trang này. Nếu bạn cần quyền, liên hệ quản trị viên Khoa.`
            : 'Trang này cần đăng nhập bằng tài khoản có quyền phù hợp.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <Link to="/" className={buttonClass('secondary')}>Về trang chủ</Link>
          {user && user.role !== 'student' && <Link to="/admin" className={buttonClass('secondary')}>Về trang quản trị</Link>}
          {user ? (
            <Button onClick={switchAccount} loading={loggingOut}>Đăng nhập tài khoản khác</Button>
          ) : (
            <Link to={from ? `/login?next=${encodeURIComponent(from)}` : '/login'} className={buttonClass('primary')}>Đăng nhập</Link>
          )}
        </div>
      </div>
    </div>
  )
}
