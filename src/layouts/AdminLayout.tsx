import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { House, SignOut } from '@phosphor-icons/react'
import { useAuth } from '../lib/auth'
import Button from '../components/ui/Button'
import './layout.css'

// Menu theo vai trò (SRS 8.1). Mục chưa có trang sẽ thêm dần theo sprint.
const NAV = {
  editor: [{ to: '/editor', label: 'Tổng quan', icon: House }],
  admin: [{ to: '/admin', label: 'Tổng quan', icon: House }],
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
      <aside className="admin__sidebar">
        <Link to="/" className="brand">
          <strong>CMS Khoa CNPM</strong>
          <small>Trang quản trị</small>
        </Link>
        <nav className="admin__nav" aria-label="Quản trị">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end>
              <Icon size={18} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        {user?.email && <span className="admin__user">{user.email}</span>}
        <Button variant="ghost" size="sm" icon={<SignOut size={16} aria-hidden />} onClick={onLogout}>Đăng xuất</Button>
      </aside>
      <main className="admin__main container">
        <Outlet />
      </main>
    </div>
  )
}
