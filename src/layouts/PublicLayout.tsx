import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../lib/auth'

export default function PublicLayout() {
  const { user, logout } = useAuth()
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Khoa Công nghệ Phần mềm</Link>
        <nav className="nav">
          <NavLink to="/">Trang chủ</NavLink>
          {user && user.role !== 'student' && <NavLink to={user.role === 'admin' ? '/admin' : '/editor'}>Quản trị</NavLink>}
          {user ? (
            <button type="button" className="link" onClick={logout}>Đăng xuất</button>
          ) : (
            <NavLink to="/login">Đăng nhập</NavLink>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
