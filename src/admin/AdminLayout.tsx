import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { App, Avatar, Button, ConfigProvider, Dropdown, Grid, Layout, Menu } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { SidebarSimple, SignOut } from '@phosphor-icons/react'
import { useAuth, type Role } from '../lib/auth'
import { activePath, menuFor } from './menu'
import { adminTheme } from './theme'
import './admin.css'

const ROLE_LABEL: Record<Role, string> = { admin: 'Quản trị viên', editor: 'Biên tập viên', student: 'Sinh viên' }
const COLLAPSE_KEY = 'admin.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

// Khung trang quản trị: header + sidebar xanh đậm, menu lọc theo role, nội dung trên nền xám.
// previewRole chỉ dùng cho route /dev/admin (xem giao diện khi chưa có backend).
export default function AdminLayout({ previewRole }: { previewRole?: Role }) {
  const { user, logout } = useAuth()
  const role = previewRole ?? user?.role
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const prefix = previewRole ? '/dev' : ''

  function toggle() {
    if (isMobile) return setMobileOpen((o) => !o)
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // Không lưu được thì thôi, chỉ là tiện ích.
      }
      return !c
    })
  }

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  const items = menuFor(role).map((g, gi) => {
    const children = g.items.map((m) => ({ key: m.path, icon: m.icon, label: <Link to={prefix + m.path}>{m.label}</Link> }))
    return g.label ? { type: 'group' as const, key: `g${gi}`, label: g.label, children } : children
  }).flat()

  const siderHidden = isMobile && !mobileOpen

  return (
    <ConfigProvider theme={adminTheme} locale={viVN}>
      <App>
        <Layout className="admin-shell">
          <Layout.Header className="admin-header">
            <Button
              type="text"
              className="admin-header__toggle"
              icon={<SidebarSimple size={20} />}
              aria-label={collapsed || siderHidden ? 'Mở menu' : 'Thu gọn menu'}
              onClick={toggle}
            />
            <Link to="/" className="admin-header__brand">
              <strong>CMS Khoa CNPM</strong>
              <small>Trang quản trị</small>
            </Link>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'info', label: user?.email ?? 'Chế độ xem thử', disabled: true },
                  { type: 'divider' },
                  { key: 'logout', icon: <SignOut size={16} />, label: 'Đăng xuất', danger: true, onClick: onLogout },
                ],
              }}
            >
              <button type="button" className="admin-header__user">
                <Avatar size={32} style={{ background: '#eef3ff', color: '#0041d9', fontWeight: 600 }}>
                  {(user?.email ?? 'U')[0].toUpperCase()}
                </Avatar>
                {!isMobile && role && <span>{ROLE_LABEL[role]}</span>}
              </button>
            </Dropdown>
          </Layout.Header>
          <Layout>
            <Layout.Sider
              className="admin-sider"
              width={240}
              collapsedWidth={isMobile ? 0 : 68}
              collapsed={isMobile ? !mobileOpen : collapsed}
              trigger={null}
            >
              <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[activePath(pathname.replace(/^\/dev/, ''))]}
                items={items}
                onClick={() => isMobile && setMobileOpen(false)}
              />
            </Layout.Sider>
            {isMobile && mobileOpen && <div className="admin-backdrop" aria-hidden onClick={() => setMobileOpen(false)} />}
            <Layout.Content className="admin-content">
              <Outlet />
            </Layout.Content>
          </Layout>
        </Layout>
      </App>
    </ConfigProvider>
  )
}
