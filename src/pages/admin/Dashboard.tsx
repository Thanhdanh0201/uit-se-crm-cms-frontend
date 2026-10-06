import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, Button, Card, Col, Empty, Flex, List, Row, Skeleton, Statistic, Typography } from 'antd'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDateTime, statusLabel, type PostStatus } from '../../admin/posts'
import { ROLE_LABEL } from '../../admin/roles'
import { CONTACT_STATUS_LABEL } from '../../admin/labels'

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

// GET /api/admin/dashboard (backend SCRUM-23, FR-REP-01).
export type DashboardData = {
  posts: Partial<Record<PostStatus, number>>
  pendingPosts: { id: string; title: string; authorName: string; submittedAt: string }[]
  users: { activeByRole: Partial<Record<'student' | 'editor' | 'admin', number>>; locked: number }
  events: { upcoming: number; openForRegistration: number; activeRegistrations: number }
  contacts: Partial<Record<'new' | 'in_progress' | 'resolved' | 'closed', number>>
  generatedAt: string
}

const POST_ORDER: PostStatus[] = ['draft', 'pending', 'changes_requested', 'published', 'archived']

function StatCard({ title, link, children }: { title: string; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <Card title={title} size="small" extra={link && <Link to={link.to}>{link.label}</Link>} style={{ height: '100%' }}>
      <Flex wrap gap={24}>{children}</Flex>
    </Card>
  )
}

// Dashboard Admin. Cảnh báo menu tải riêng: lỗi ở phần này không làm hỏng phần kia.
function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setError(false)
    setData(null)
    api<DashboardData>('/api/admin/dashboard', { signal: ctrl.signal })
      .then(setData)
      .catch(() => !ctrl.signal.aborted && setError(true))
    return () => ctrl.abort()
  }, [reloadKey])

  const n = (v?: number) => v ?? 0

  return (
    <Flex vertical gap={16}>
      <MenuWarnings />
      {error && (
        <Alert type="error" showIcon title="Không tải được số liệu tổng quan" description="Kiểm tra kết nối rồi thử lại." action={<Button size="small" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>} />
      )}
      {!data && !error && <Card><Skeleton active /></Card>}
      {data && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <StatCard title="Bài viết" link={{ to: '/admin/posts', label: 'Xem tất cả' }}>
                {POST_ORDER.map((s) => <Statistic key={s} title={statusLabel(s)} value={n(data.posts[s])} />)}
              </StatCard>
            </Col>
            <Col xs={24} lg={12}>
              <StatCard title="Liên hệ" link={{ to: '/admin/contacts?status=new', label: 'Xử lý yêu cầu mới' }}>
                {(['new', 'in_progress', 'resolved', 'closed'] as const).map((s) => <Statistic key={s} title={CONTACT_STATUS_LABEL[s]} value={n(data.contacts[s])} />)}
              </StatCard>
            </Col>
            <Col xs={24} lg={12}>
              <StatCard title="Người dùng đang hoạt động" link={{ to: '/admin/users', label: 'Quản lý' }}>
                {(['student', 'editor', 'admin'] as const).map((r) => <Statistic key={r} title={ROLE_LABEL[r]} value={n(data.users.activeByRole[r])} />)}
                <Statistic title="Đã khóa" value={data.users.locked} />
              </StatCard>
            </Col>
            <Col xs={24} lg={12}>
              <StatCard title="Sự kiện" link={{ to: '/admin/events', label: 'Quản lý' }}>
                <Statistic title="Sắp diễn ra" value={data.events.upcoming} />
                <Statistic title="Đang mở đăng ký" value={data.events.openForRegistration} />
                <Statistic title="Lượt đăng ký" value={data.events.activeRegistrations} />
              </StatCard>
            </Col>
          </Row>
          <Card title="Bài chờ duyệt" size="small" extra={<Link to="/admin/review">Mở hàng chờ duyệt</Link>}>
            {data.pendingPosts.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có bài nào chờ duyệt." />
            ) : (
              <List
                dataSource={data.pendingPosts}
                renderItem={(p) => (
                  <List.Item extra={<span className="muted" style={{ fontSize: 'var(--text-sm)' }}>Gửi {formatDateTime(p.submittedAt)}</span>}>
                    <List.Item.Meta title={<Link to={`/admin/review/${p.id}`}>{p.title}</Link>} description={p.authorName} />
                  </List.Item>
                )}
              />
            )}
          </Card>
          <Typography.Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>Cập nhật lúc {formatDateTime(data.generatedAt)}. Không tính nội dung đã xóa.</Typography.Text>
        </>
      )}
    </Flex>
  )
}

// Biên tập viên: không có số liệu toàn Khoa (API chỉ cho Admin), chỉ lối tắt công việc.
function EditorDashboard() {
  const navigate = useNavigate()
  return (
    <Card title="Tổng quan">
      <Typography.Paragraph type="secondary">Bắt đầu nhanh công việc biên tập.</Typography.Paragraph>
      <Flex gap={8} wrap>
        <Button type="primary" onClick={() => navigate('/admin/posts/new')}>Viết bài mới</Button>
        <Button onClick={() => navigate('/admin/posts')}>Bài viết của tôi</Button>
        <Button onClick={() => navigate('/admin/media')}>Thư viện media</Button>
      </Flex>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <AdminDashboard /> : <EditorDashboard />
}
