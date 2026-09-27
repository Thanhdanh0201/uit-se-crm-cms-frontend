import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'

// Menu theo vai trò (SRS 8.1). Mục chưa có trang sẽ thêm dần theo sprint.
const NAV = {
  editor: [{ to: '/editor', label: 'Tổng quan' }],
  admin: [{ to: '/admin', label: 'Tổng quan' }],
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = user?.role === 'admin' ? NAV.admin : NAV.editor

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="admin">
      <aside className="sidebar">
        <Link to="/" className="brand">CMS Khoa CNPM</Link>
        <nav>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end>{i.label}</NavLink>
          ))}
        </nav>
        <button type="button" className="link" onClick={onLogout}>Đăng xuất</button>
      </aside>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
