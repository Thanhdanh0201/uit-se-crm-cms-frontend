import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../lib/auth'
import { buttonClass } from '../components/ui/Button'
import './layout.css'

export default function PublicLayout() {
  const { user, logout } = useAuth()
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <strong>Khoa Công nghệ Phần mềm</strong>
            <small>Trường ĐH Công nghệ Thông tin, ĐHQG-HCM</small>
          </Link>
          <nav className="site-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>Trang chủ</NavLink>
            {user && user.role !== 'student' && <NavLink to="/admin">Quản trị</NavLink>}
            {user ? (
              <button type="button" className={buttonClass('ghost', 'sm')} onClick={logout}>Đăng xuất</button>
            ) : (
              <Link to="/login" className={buttonClass('primary', 'sm')}>Đăng nhập</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <strong>Khoa Công nghệ Phần mềm</strong>
          <p>Trường Đại học Công nghệ Thông tin, Đại học Quốc gia Thành phố Hồ Chí Minh</p>
        </div>
      </footer>
    </>
  )
}
