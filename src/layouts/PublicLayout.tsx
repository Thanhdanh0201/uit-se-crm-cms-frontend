import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { CaretDown, EnvelopeSimple, List, MagnifyingGlass, MapPin, Phone } from '@phosphor-icons/react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { PublicMenuDto, PublicMenuItemDto } from '../admin/menus'
import { buttonClass } from '../components/ui/Button'
import './layout.css'

// Fallback menu cố định theo cấu trúc chuyên mục hiện tại của Khoa khi chưa có API hoặc đang tải.
const FALLBACK_NAV = [
  { to: '/pages/gioi-thieu', label: 'Giới thiệu' },
  { to: '/categories/tin-tuc', label: 'Tin tức' },
  { to: '/events', label: 'Sự kiện' },
  { to: '/pages/bieu-mau', label: 'Biểu mẫu' },
  { to: '/pages/tuyen-sinh', label: 'Tuyển sinh' },
  { to: '/contact', label: 'Liên hệ' },
]

type NavItem = {
  key: string
  to: string
  label: string
  isExternal?: boolean
  children?: NavItem[]
}

export default function PublicLayout() {
  const { user, logout, loggingOut } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const { pathname } = useLocation()
  const [navItems, setNavItems] = useState<NavItem[]>(() =>
    FALLBACK_NAV.map((n) => ({ key: n.to, to: n.to, label: n.label }))
  )

  useEffect(() => {
    let active = true
    api<PublicMenuDto>('/api/public/menus/main')
      .then((res) => {
        if (!active) return
        if (res?.items?.length) {
          function mapItem(item: PublicMenuItemDto): NavItem {
            const label = item.label || item.title || 'Mục'
            const to = item.url || '/'
            const isExternal = item.kind === 'external' || /^https?:\/\//.test(to)
            return {
              key: item.id,
              to,
              label,
              isExternal,
              children: item.children?.length ? item.children.map(mapItem) : undefined,
            }
          }
          setNavItems(res.items.map(mapItem))
        }
      })
      .catch(() => {
        // Giữ fallback NAV
      })
    return () => {
      active = false
    }
  }, [])

  // Đóng menu mobile sau khi chuyển trang.
  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false
  }, [pathname])

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const account = user ? (
    <>
      {user.role !== 'student' && <Link to="/admin" className={buttonClass('secondary', 'sm')}>Quản trị</Link>}
      <Link to="/me" className={buttonClass('ghost', 'sm')}>Tài khoản</Link>
      <button type="button" className={buttonClass('ghost', 'sm')} onClick={onLogout} disabled={loggingOut} aria-busy={loggingOut || undefined}>
        {loggingOut ? 'Đang đăng xuất' : 'Đăng xuất'}
      </button>
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
            {navItems.map((n) =>
              n.children?.length ? (
                <div key={n.key} className="site-nav__item-group">
                  {n.isExternal ? (
                    <a href={n.to} target="_blank" rel="noopener noreferrer">
                      {n.label} <CaretDown size={12} aria-hidden />
                    </a>
                  ) : (
                    <NavLink to={n.to}>
                      {n.label} <CaretDown size={12} aria-hidden />
                    </NavLink>
                  )}
                  <div className="site-nav__dropdown" role="menu">
                    {n.children.map((sub) =>
                      sub.isExternal ? (
                        <a key={sub.key} href={sub.to} target="_blank" rel="noopener noreferrer" role="menuitem">
                          {sub.label}
                        </a>
                      ) : (
                        <NavLink key={sub.key} to={sub.to} role="menuitem">
                          {sub.label}
                        </NavLink>
                      )
                    )}
                  </div>
                </div>
              ) : n.isExternal ? (
                <a key={n.key} href={n.to} target="_blank" rel="noopener noreferrer">
                  {n.label}
                </a>
              ) : (
                <NavLink key={n.key} to={n.to}>
                  {n.label}
                </NavLink>
              )
            )}
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
                {navItems.map((n) =>
                  n.children?.length ? (
                    <details key={n.key} className="site-menu__sub">
                      <summary>{n.label}</summary>
                      <div className="site-menu__sub-items">
                        <NavLink to={n.to}>{n.label} (Tất cả)</NavLink>
                        {n.children.map((sub) =>
                          sub.isExternal ? (
                            <a key={sub.key} href={sub.to} target="_blank" rel="noopener noreferrer">
                              {sub.label}
                            </a>
                          ) : (
                            <NavLink key={sub.key} to={sub.to}>
                              {sub.label}
                            </NavLink>
                          )
                        )}
                      </div>
                    </details>
                  ) : n.isExternal ? (
                    <a key={n.key} href={n.to} target="_blank" rel="noopener noreferrer">
                      {n.label}
                    </a>
                  ) : (
                    <NavLink key={n.key} to={n.to}>
                      {n.label}
                    </NavLink>
                  )
                )}
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
