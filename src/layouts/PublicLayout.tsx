import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLoaderData, useLocation, useNavigate } from 'react-router'
import { CaretDown, EnvelopeSimple, List, MagnifyingGlass, MapPin, Phone } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { buttonClass } from '../components/ui/Button'
import './layout.css'

// GET /api/public/menus/{code} (PublicMenuItemDto): backend đã bỏ mục ẩn và cả nhánh con của mục ẩn, đã sắp xếp.
export type NavItem = { id: string; label: string; kind: string; url: string | null; children: NavItem[] }

// Menu dự phòng khi chưa tạo menu "main" trong trang quản trị hoặc không gọi được API.
const FALLBACK: NavItem[] = [
  ['Giới thiệu', '/pages/gioi-thieu'],
  ['Tin tức', '/categories/tin-tuc'],
  ['Sự kiện', '/events'],
  ['Biểu mẫu', '/pages/bieu-mau'],
  ['Tuyển sinh', '/pages/tuyen-sinh'],
  ['Liên hệ', '/contact'],
].map(([label, url]) => ({ id: url, label, kind: 'page', url, children: [] }))

// Menu chính do Admin cấu hình (FR-MENU), mã "main". Lấy trên server để HTML trả về đã có menu.
export async function loader() {
  try {
    const menu = await api<{ items: NavItem[] }>('/api/public/menus/main')
    return { nav: menu.items.length ? menu.items : FALLBACK }
  } catch {
    return { nav: FALLBACK }
  }
}

// Menu không đổi theo trang: chỉ tải khi mở site (F5), không tải lại mỗi lần chuyển trang.
export const shouldRevalidate = () => false

function NavTo({ item, className }: { item: NavItem; className?: string }) {
  if (!item.url) return <span className={className}>{item.label}</span>
  if (/^https?:\/\//i.test(item.url))
    return <a href={item.url} className={className} target="_blank" rel="noopener noreferrer">{item.label}</a>
  return <NavLink to={item.url} className={className}>{item.label}</NavLink>
}

// Cấp 2 và cấp 3 (cấp 3 thụt vào trong cùng danh sách).
function SubItems({ items }: { items: NavItem[] }) {
  return (
    <ul>
      {items.map((c) => (
        <li key={c.id}>
          <NavTo item={c} />
          {c.children.length > 0 && <SubItems items={c.children} />}
        </li>
      ))}
    </ul>
  )
}

export default function PublicLayout() {
  const { user, logout, loggingOut } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const { pathname } = useLocation()
  const nav = useLoaderData<typeof loader>()?.nav ?? FALLBACK

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
            {nav.map((n) =>
              n.children.length ? (
                // Mở bằng rê chuột hoặc Tab vào (focus-within), không cần JS.
                <div key={n.id} className="site-nav__group">
                  <NavTo item={n} className="site-nav__parent" />
                  <CaretDown size={12} aria-hidden className="site-nav__caret" />
                  <div className="site-nav__dropdown"><SubItems items={n.children} /></div>
                </div>
              ) : (
                <NavTo key={n.id} item={n} />
              ),
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
                {nav.map((n) => (
                  <div key={n.id} className="site-menu__item">
                    <NavTo item={n} />
                    {n.children.length > 0 && <SubItems items={n.children} />}
                  </div>
                ))}
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
