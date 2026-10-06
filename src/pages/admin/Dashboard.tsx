import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Card, Flex, Typography } from 'antd'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// GET /api/admin/menu-items/warnings (backend SCRUM-29): mục menu trỏ tới đích không xem được công khai.
export type MenuWarning = { itemId: string; menuId: string; menuName: string; label: string; kind: string; isVisible: boolean; code: string; message: string }

// Cảnh báo menu cho Admin (SCRUM-54). Lỗi tải hoặc API chưa có thì không hiện gì, không chặn trang tổng quan.
function MenuWarnings() {
  const [items, setItems] = useState<MenuWarning[] | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    api<MenuWarning[]>('/api/admin/menu-items/warnings', { signal: ctrl.signal })
      .then(setItems)
      .catch(() => {}) // không chặn trang tổng quan vì cảnh báo phụ
    return () => ctrl.abort()
  }, [])
  if (!items?.length) return null
  return (
    <Alert
      type="warning"
      showIcon
      title={`${items.length} mục menu đang dẫn tới trang lỗi hoặc bị ẩn`}
      description={
        <Flex vertical gap={8}>
          <span>Các mục này không hiện trên menu công khai cho tới khi sửa đích hoặc xuất bản lại trang.</span>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {items.map((w) => (
              <li key={w.itemId}>
                <strong>{w.menuName}: {w.label}</strong>. {w.message}
              </li>
            ))}
          </ul>
          <Link to="/admin/menus">Mở quản lý menu</Link>
        </Flex>
      }
    />
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <Flex vertical gap={16}>
      {user?.role === 'admin' && <MenuWarnings />}
      <Card title="Tổng quan">
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Số bài theo trạng thái, bài chờ duyệt, người dùng, sự kiện và phản hồi (FR-REP-01) sẽ hiện ở đây khi có API dashboard.
        </Typography.Paragraph>
      </Card>
    </Flex>
  )
}
