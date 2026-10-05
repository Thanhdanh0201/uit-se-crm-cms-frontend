import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Empty, Flex, Form, Input, Popconfirm, Segmented, Select, Skeleton, Space, Table, Tag, Tooltip } from 'antd'
import { LockSimple, LockSimpleOpen, PencilSimple, Plus } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole, useAuth, type Role } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { ROLE_COLOR, ROLE_LABEL, ROLES } from '../../admin/roles'

export const meta = () => noIndex('Người dùng')

// DTO theo Business/DTOs/Admin (backend).
export type UserRow = { id: string; email: string; username: string; fullName: string; role: Role; isActive: boolean; createdAt: string }
type UsersPage = { items: UserRow[]; totalItems: number; page: number; pageSize: number }
type FormValues = { fullName: string; email?: string; username: string; password?: string; role: Role }

const STATUS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'locked', label: 'Đã khóa' },
]
const PAGE_SIZES = [10, 20, 50]
// Cùng quy tắc với CreateUserRequestValidator / UpdateUserRequestValidator.
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/
const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' })

// URL của trang (keyword, status, role, page, pageSize) -> query của GET /api/admin/users.
export function usersQuery(params: URLSearchParams): string {
  const q = new URLSearchParams()
  q.set('page', String(Number(params.get('page')) || 1))
  const size = Number(params.get('pageSize'))
  q.set('pageSize', String(PAGE_SIZES.includes(size) ? size : 10))
  const keyword = params.get('keyword')?.trim()
  if (keyword) q.set('search', keyword)
  const role = params.get('role')
  if (role && (ROLES as string[]).includes(role)) q.set('role', role)
  const status = params.get('status')
  if (status === 'active') q.set('isActive', 'true')
  if (status === 'locked') q.set('isActive', 'false')
  return q.toString()
}

// Thông báo lỗi dễ hiểu. 403 nói rõ là không có quyền, để không ai tưởng thao tác đã thành công.
export function userErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này. Quyền của bạn có thể vừa thay đổi, hãy đăng nhập lại.'
  if (err.status === 404) return 'Người dùng không còn tồn tại. Danh sách đã được tải lại.'
  if (err.status === 400) return err.message
  return 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

// Lỗi validation của backend (key PascalCase) -> lỗi dưới từng ô của Form.
function fieldErrors(err: unknown) {
  if (!(err instanceof ApiError) || !err.errors) return []
  return Object.entries(err.errors).map(([key, errors]) => ({ name: (key[0].toLowerCase() + key.slice(1)) as keyof FormValues, errors }))
}

function UsersPageContent() {
  const { message, modal } = App.useApp()
  const { user: me } = useAuth()
  const list = useListParams()
  const status = list.params.get('status') ?? 'all'
  const roleFilter = list.params.get('role')
  const query = usersQuery(list.params)

  const [data, setData] = useState<UsersPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  const [form] = Form.useForm<FormValues>()
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Tải danh sách. Hủy request cũ khi đổi bộ lọc nhanh để kết quả cũ không đè kết quả mới.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    api<UsersPage>(`/api/admin/users?${query}`, { signal: ctrl.signal })
      .then((res) => setData({ ...res, items: res.items.map((u) => ({ ...u, role: u.role.toLowerCase() as Role })) }))
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(userErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [query, reloadKey])

  // Mở form sửa: lấy bản mới nhất từ server (isActive phải là giá trị hiện tại, vì PUT gửi kèm isActive).
  useEffect(() => {
    setDrawerError('')
    if (list.action !== 'edit' || !list.id) {
      setEditing(null)
      return
    }
    const ctrl = new AbortController()
    setDetailLoading(true)
    api<UserRow>(`/api/admin/users/${list.id}`, { signal: ctrl.signal })
      .then((u) => {
        const fresh = { ...u, role: u.role.toLowerCase() as Role }
        setEditing(fresh)
        form.setFieldsValue(fresh)
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setDrawerError(userErrorMessage(err))
        if (err instanceof ApiError && err.status === 404) reload()
      })
      .finally(() => !ctrl.signal.aborted && setDetailLoading(false))
    return () => ctrl.abort()
  }, [list.action, list.id, form])

  function confirmRole(title: string, content: string) {
    return modal.confirm({ title, content, okText: 'Xác nhận', cancelText: 'Hủy' })
  }

  async function onSave(values: FormValues) {
    if (saving) return // chống submit lặp
    setDrawerError('')

    if (editing && values.role !== editing.role) {
      const ok = await confirmRole(
        'Đổi vai trò người dùng?',
        `${editing.fullName}: ${ROLE_LABEL[editing.role]} thành ${ROLE_LABEL[values.role]}. Quyền truy cập thay đổi ngay ở lần gọi tiếp theo của người dùng.`,
      )
      if (!ok) return
    }
    if (!editing && values.role === 'admin') {
      const ok = await confirmRole('Tạo tài khoản Quản trị viên?', 'Tài khoản này có toàn quyền: duyệt bài, cấu hình website, quản lý người dùng và nhật ký.')
      if (!ok) return
    }

    setSaving(true)
    try {
      const res = editing
        ? await api<UserRow>(`/api/admin/users/${editing.id}`, {
            method: 'PUT',
            json: { username: values.username.trim(), fullName: values.fullName.trim(), role: values.role, isActive: editing.isActive },
          })
        : await api<UserRow>('/api/admin/users', {
            method: 'POST',
            json: { email: values.email!.trim(), password: values.password, username: values.username.trim(), fullName: values.fullName.trim(), role: values.role },
          })
      message.success(editing ? `Đã lưu thay đổi của ${res.fullName}.` : `Đã tạo tài khoản ${res.fullName}.`)
      list.closeDrawer()
      form.resetFields()
      // Người mới nằm đầu danh sách (sắp theo ngày tạo giảm dần): về trang 1. Sửa thì tải lại trang hiện tại.
      if (!editing && list.page !== 1) list.update({ page: 1 })
      else reload()
    } catch (err) {
      form.setFields(fieldErrors(err))
      setDrawerError(fieldErrors(err).length ? '' : userErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleLock(row: UserRow) {
    setBusyId(row.id)
    try {
      await api<UserRow>(`/api/admin/users/${row.id}/status`, { method: 'PATCH', json: { isActive: !row.isActive } })
      message.success(row.isActive ? `Đã khóa tài khoản ${row.fullName}.` : `Đã mở khóa tài khoản ${row.fullName}.`)
      reload()
    } catch (err) {
      // Không đổi trạng thái trên UI khi server từ chối (kể cả 403).
      message.error(userErrorMessage(err))
      if (err instanceof ApiError && err.status === 404) reload()
    } finally {
      setBusyId(null)
    }
  }

  const filtered = Boolean(list.keyword || roleFilter || status !== 'all')

  return (
    <Card
      title={
        <Segmented
          value={status}
          options={STATUS}
          onChange={(v) => list.update({ status: v === 'all' ? null : v })}
          aria-label="Lọc theo trạng thái"
        />
      }
      extra={
        <Space wrap>
          <Select
            allowClear
            placeholder="Mọi vai trò"
            aria-label="Lọc theo vai trò"
            value={roleFilter ?? undefined}
            onChange={(v) => list.update({ role: v ?? null })}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            style={{ width: 150 }}
          />
          <Input.Search
            key={list.keyword}
            allowClear
            defaultValue={list.keyword}
            placeholder="Tìm theo họ tên, tên đăng nhập"
            aria-label="Tìm người dùng"
            onSearch={(v) => list.update({ keyword: v.trim() })}
            style={{ width: 260 }}
          />
          <Tooltip title="Thêm người dùng">
            <Button type="primary" icon={<Plus size={16} />} aria-label="Thêm người dùng" onClick={() => { form.resetFields(); list.openCreate() }} />
          </Tooltip>
        </Space>
      }
    >
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="Không tải được danh sách người dùng"
          description={error}
          action={<Button size="small" onClick={reload}>Thử lại</Button>}
        />
      )}

      <Table<UserRow>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 860 }}
        locale={{
          emptyText: error ? ' ' : (
            <Empty
              description={filtered ? 'Không có người dùng khớp bộ lọc.' : 'Chưa có người dùng nào.'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              {filtered && <Button onClick={() => list.update({ keyword: null, role: null, status: null })}>Xóa bộ lọc</Button>}
            </Empty>
          ),
        }}
        pagination={{
          current: list.page,
          pageSize: list.pageSize,
          total: data?.totalItems ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZES,
          showTotal: (t) => `Tổng ${t} người dùng`,
          onChange: (page, pageSize) => list.update(pageSize !== list.pageSize ? { pageSize, page: 1 } : { page }),
        }}
        columns={[
          {
            title: 'Họ tên',
            key: 'fullName',
            render: (_, r) => (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {r.fullName}
                  {r.id === me?.id && <Tag style={{ marginInlineStart: 8 }}>Bạn</Tag>}
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{r.email || 'Chưa có email'}</div>
              </div>
            ),
          },
          { title: 'Tên đăng nhập', dataIndex: 'username' },
          { title: 'Vai trò', dataIndex: 'role', render: (v: Role) => <Tag color={ROLE_COLOR[v]}>{ROLE_LABEL[v]}</Tag> },
          { title: 'Trạng thái', dataIndex: 'isActive', render: (v: boolean) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Đã khóa</Tag>) },
          { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v: string) => dateFmt.format(new Date(v)) },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 96,
            render: (_, r) => {
              const self = r.id === me?.id
              return (
                <Space size={4}>
                  <Tooltip title="Sửa">
                    <Button type="text" icon={<PencilSimple size={16} />} aria-label={`Sửa ${r.fullName}`} onClick={() => list.openEdit(r.id)} />
                  </Tooltip>
                  {self ? (
                    // Tự khóa mình sẽ mất quyền truy cập ngay. Backend chưa chặn, nên UI chặn.
                    <Tooltip title="Không thể tự khóa tài khoản của chính mình">
                      <Button type="text" icon={<LockSimple size={16} />} aria-label="Không thể tự khóa tài khoản của chính mình" disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title={r.isActive ? `Khóa tài khoản ${r.fullName}?` : `Mở khóa tài khoản ${r.fullName}?`}
                      description={r.isActive ? 'Người dùng bị đăng xuất và không đăng nhập được cho tới khi mở khóa.' : 'Người dùng đăng nhập lại được với mật khẩu hiện tại.'}
                      okText={r.isActive ? 'Khóa' : 'Mở khóa'}
                      cancelText="Hủy"
                      okButtonProps={{ danger: r.isActive }}
                      onConfirm={() => toggleLock(r)}
                    >
                      <Button
                        type="text"
                        danger={r.isActive}
                        loading={busyId === r.id}
                        icon={r.isActive ? <LockSimple size={16} /> : <LockSimpleOpen size={16} />}
                        aria-label={`${r.isActive ? 'Khóa' : 'Mở khóa'} ${r.fullName}`}
                      />
                    </Popconfirm>
                  )}
                </Space>
              )
            },
          },
        ]}
      />

      <Drawer
        open={!!list.action}
        title={list.action === 'edit' ? 'Sửa người dùng' : 'Tạo người dùng'}
        size={520}
        onClose={() => { list.closeDrawer(); form.resetFields() }}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => { list.closeDrawer(); form.resetFields() }}>Hủy</Button>
            <Button type="primary" loading={saving} disabled={detailLoading || (list.action === 'edit' && !editing)} onClick={() => form.submit()}>Lưu</Button>
          </Flex>
        }
      >
        {drawerError && <Alert type="error" showIcon title={drawerError} style={{ marginBottom: 16 }} />}
        {detailLoading && <Skeleton active />}
        {/* Form luôn mounted (chỉ ẩn khi đang tải) để setFieldsValue không bị mất. */}
        <Form form={form} layout="vertical" onFinish={onSave} requiredMark disabled={saving} initialValues={{ role: 'student' }} hidden={detailLoading}>
          <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên.' }, { max: 100, message: 'Họ và tên không được vượt quá 100 ký tự.' }]}>
            <Input maxLength={100} autoComplete="off" />
          </Form.Item>
          {list.action === 'edit' ? (
            <Form.Item name="email" label="Email" extra="Email đăng nhập không đổi được ở đây.">
              <Input disabled />
            </Form.Item>
          ) : (
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email.' }, { type: 'email', message: 'Email chưa đúng định dạng.' }]}>
              <Input type="email" autoComplete="off" />
            </Form.Item>
          )}
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[
              { required: true, whitespace: true, message: 'Nhập tên đăng nhập.' },
              { max: 50, message: 'Tên đăng nhập không được vượt quá 50 ký tự.' },
              { pattern: USERNAME_PATTERN, message: 'Chỉ dùng chữ không dấu, chữ số và các ký tự . _ -' },
            ]}
          >
            <Input maxLength={50} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Form.Item>
          {list.action !== 'edit' && (
            <Form.Item
              name="password"
              label="Mật khẩu ban đầu"
              extra="Gửi mật khẩu cho người dùng qua kênh riêng. Người dùng nên đổi mật khẩu sau lần đăng nhập đầu."
              rules={[{ required: true, message: 'Nhập mật khẩu ban đầu.' }, { min: 6, message: 'Mật khẩu phải có tối thiểu 6 ký tự.' }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="Vai trò"
            rules={[{ required: true, message: 'Chọn vai trò.' }]}
            extra={editing?.id === me?.id ? 'Không thể tự đổi vai trò của chính mình.' : undefined}
          >
            <Select disabled={editing?.id === me?.id} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default function Users() {
  return (
    <RequireRole roles={['admin']}>
      <UsersPageContent />
    </RequireRole>
  )
}
