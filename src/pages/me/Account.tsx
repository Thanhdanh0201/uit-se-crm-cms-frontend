import { Link } from 'react-router'
import { BookmarkSimple, CalendarCheck, ChatCircleText, Key, SquaresFour, type Icon } from '@phosphor-icons/react'
import { RequireRole, useAuth } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { ROLE_LABEL } from '../../admin/roles'
import Badge from '../../components/ui/Badge'
import './me.css'

export const meta = () => noIndex('Tài khoản của tôi')

type Item = { label: string; hint: string; icon: Icon; to?: string }

// Khu tài khoản cho mọi vai trò (SRS 8.1: hồ sơ, bài đã lưu, sự kiện đã đăng ký, yêu cầu đã gửi).
// Mục chưa có API để "Sắp có" thay vì link tới trang 404.
const ITEMS: Item[] = [
  { label: 'Đổi mật khẩu', hint: 'Xác nhận bằng mật khẩu hiện tại', icon: Key, to: '/me/password' },
  { label: 'Bài đã lưu', hint: 'Bài viết bạn đánh dấu để đọc sau', icon: BookmarkSimple },
  { label: 'Sự kiện đã đăng ký', hint: 'Xem và hủy đăng ký trước hạn', icon: CalendarCheck },
  { label: 'Yêu cầu đã gửi', hint: 'Theo dõi trạng thái câu hỏi gửi Khoa', icon: ChatCircleText },
]

function AccountContent() {
  const { user } = useAuth()
  if (!user) return null
  const items: Item[] = user.role === 'student' ? ITEMS : [{ label: 'Trang quản trị', hint: 'Bài viết, media và cấu hình website', icon: SquaresFour, to: '/admin' }, ...ITEMS]

  return (
    <div className="me">
      <header className="me__head">
        <h1>Tài khoản của tôi</h1>
        <p className="muted">
          {user.email} <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
        </p>
      </header>
      <ul className="me__grid">
        {items.map(({ label, hint, icon: Ico, to }) => {
          const body = (
            <>
              <span className="me__icon" aria-hidden><Ico size={22} /></span>
              <span className="me__text">
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
              {!to && <Badge>Sắp có</Badge>}
            </>
          )
          return (
            <li key={label}>
              {to ? <Link to={to} className="me__item">{body}</Link> : <div className="me__item me__item--soon" aria-disabled="true">{body}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function Account() {
  return (
    <RequireRole roles={['student', 'editor', 'admin']}>
      <AccountContent />
    </RequireRole>
  )
}
