import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { EnvelopeSimple, List, MagnifyingGlass, MapPin, Phone } from '@phosphor-icons/react'
import { useAuth } from '../lib/auth'
import { buttonClass } from '../components/ui/Button'
import './layout.css'

// ponytail: menu cố định theo cấu trúc chuyên mục hiện tại của Khoa. Đổi sang menu do Admin cấu hình khi có API (FR-MENU).
const NAV = [
  { to: '/pages/gioi-thieu', label: 'Giới thiệu' },
  { to: '/categories/tin-tuc', label: 'Tin tức' },
  { to: '/events', label: 'Sự kiện' },
  { to: '/pages/bieu-mau', label: 'Biểu mẫu' },
  { to: '/pages/tuyen-sinh', label: 'Tuyển sinh' },
  { to: '/contact', label: 'Liên hệ' },
]

export default function PublicLayout() {
  const { user, logout } = useAuth()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const { pathname } = useLocation()

  // Đóng menu mobile sau khi chuyển trang.
  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false
  }, [pathname])

  const account = user ? (
    <>
      {user.role !== 'student' && <Link to="/admin" className={buttonClass('secondary', 'sm')}>Quản trị</Link>}
      <button type="button" className={buttonClass('ghost', 'sm')} onClick={logout}>Đăng xuất</button>
    </>
  ) : (
    <Link to="/login" className={buttonClass('primary', 'sm')}>Đăng nhập</Link>
  )

  return (
    <>
      <a href="#main" className="skip-link">Bỏ qua điều hướng</a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <strong>Khoa Công nghệ Phần mềm</strong>
            <small>Trường ĐH Công nghệ Thông tin, ĐHQG-HCM</small>
          </Link>

          <nav className="site-nav" aria-label="Điều hướng chính">
            {NAV.map((n) => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
          </nav>

          <div className="site-actions">
            <Link to="/search" className={`${buttonClass('ghost', 'sm')} ui-btn--icon`} aria-label="Tìm kiếm" title="Tìm kiếm">
              <MagnifyingGlass size={18} aria-hidden />
            </Link>
            <span className="site-actions__account">{account}</span>
            <details ref={menuRef} className="site-menu">
              <summary className={`${buttonClass('ghost', 'sm')} ui-btn--icon`} aria-label="Mở menu">
                <List size={20} aria-hidden />
              </summary>
              <nav className="site-menu__panel" aria-label="Điều hướng chính trên di động">
                {NAV.map((n) => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
                <div className="site-menu__account">{account}</div>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className="container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__about">
            <strong>Khoa Công nghệ Phần mềm</strong>
            <p>Trường Đại học Công nghệ Thông tin, Đại học Quốc gia Thành phố Hồ Chí Minh</p>
            <ul className="site-footer__contact">
              <li><MapPin size={16} aria-hidden /> Phòng E7.2, tòa nhà E, Trường Đại học Công nghệ Thông tin, Khu phố 34, Phường Linh Xuân, TP. Hồ Chí Minh</li>
              <li><Phone size={16} aria-hidden /> <a href="tel:+842837252002">(028) 3725 2002</a>, số nội bộ 120</li>
              <li><EnvelopeSimple size={16} aria-hidden /> <a href="mailto:se@uit.edu.vn">se@uit.edu.vn</a></li>
            </ul>
          </div>
          <nav className="site-footer__links" aria-label="Liên kết cuối trang">
            <Link to="/pages/gioi-thieu">Giới thiệu</Link>
            <Link to="/pages/chuong-trinh-dao-tao">Chương trình đào tạo</Link>
            <Link to="/categories/thong-bao-hoc-vu">Thông báo học vụ</Link>
            <Link to="/pages/bieu-mau">Biểu mẫu</Link>
            <Link to="/contact">Liên hệ</Link>
          </nav>
        </div>
      </footer>
    </>
  )
}
