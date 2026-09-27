import { useMemo, useState } from 'react'
import { App, Button, Card, Drawer, Flex, Form, Input, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip } from 'antd'
import { LockSimple, LockSimpleOpen, PencilSimple, Plus } from '@phosphor-icons/react'
import { useListParams } from '../../lib/useListParams'
import type { Role } from '../../lib/auth'

// MẪU trang danh sách quản trị (dữ liệu giả, chỉ có ở /dev/admin/users).
// Trang thật copy khung này, thay dữ liệu giả bằng api() và phân trang ở server.

type Row = { id: string; fullName: string; username: string; email: string; role: Role; isActive: boolean; createdAt: string }

const NAMES = ['Trần Minh Khoa', 'Lê Thu Hà', 'Phạm Quốc Bảo', 'Nguyễn Hoàng Yến', 'Võ Đức Thịnh', 'Đặng Mai Linh', 'Huỳnh Gia Huy', 'Bùi Ngọc Trâm', 'Đỗ Anh Tuấn', 'Phan Thảo Vy', 'Lý Khánh Duy', 'Mai Phương Anh']
const ROLES: Role[] = ['student', 'student', 'editor', 'student', 'admin', 'student', 'editor']
const SEED: Row[] = Array.from({ length: 37 }, (_, i) => {
  const name = NAMES[i % NAMES.length]
  const username = `${name.split(' ').pop()!.normalize('NFD').replace(/[̀-ͯ]/g, '').replace('đ', 'd').toLowerCase()}${24520100 + i * 7}`
  return { id: String(i + 1), fullName: name, username, email: `${username}@gm.uit.edu.vn`, role: ROLES[i % ROLES.length], isActive: i % 9 !== 4, createdAt: new Date(Date.UTC(2026, 8, 27 - i)).toISOString() }
})

const ROLE_TAG: Record<Role, { label: string; color: string }> = {
  admin: { label: 'Quản trị viên', color: 'blue' },
  editor: { label: 'Biên tập viên', color: 'cyan' },
  student: { label: 'Sinh viên', color: 'default' },
}
const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' })

export default function AdminListDemo() {
  const { message } = App.useApp()
  const list = useListParams()
  const status = list.params.get('status') ?? 'all'
  const [rows, setRows] = useState(SEED)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<Row>()

  // Trang thật: gọi api(`/api/admin/users?${list.params}`) thay cho đoạn lọc này.
  const filtered = useMemo(() => {
    const k = list.keyword.toLowerCase()
    return rows.filter(
      (r) => (status === 'all' || r.isActive === (status === 'active')) && (!k || `${r.fullName} ${r.username} ${r.email}`.toLowerCase().includes(k)),
    )
  }, [rows, list.keyword, status])
  const pageRows = filtered.slice((list.page - 1) * list.pageSize, list.page * list.pageSize)
  const editing = list.action === 'edit' ? rows.find((r) => r.id === list.id) : undefined

  async function onSave(values: Row) {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    if (editing) setRows((all) => all.map((r) => (r.id === editing.id ? { ...r, ...values } : r)))
    else setRows((all) => [{ ...values, id: String(Date.now()), isActive: true, createdAt: new Date().toISOString() }, ...all])
    setSaving(false)
    message.success(editing ? 'Đã cập nhật người dùng.' : 'Đã tạo người dùng.')
    list.closeDrawer()
  }

  function toggleLock(row: Row) {
    setRows((all) => all.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)))
    message.success(row.isActive ? `Đã khóa ${row.fullName}.` : `Đã mở khóa ${row.fullName}.`)
  }

  return (
    <Card
      title={
        <Segmented
          value={status}
          onChange={(v) => list.update({ status: v === 'all' ? null : v })}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'locked', label: 'Đã khóa' },
          ]}
        />
      }
      extra={
        <Space wrap>
          <Input.Search
            key={list.keyword}
            allowClear
            defaultValue={list.keyword}
            placeholder="Tìm theo tên, email"
            aria-label="Tìm người dùng"
            onSearch={(v) => list.update({ keyword: v.trim() })}
            style={{ width: 240 }}
          />
          <Tooltip title="Thêm người dùng">
            <Button type="primary" icon={<Plus size={16} />} aria-label="Thêm người dùng" onClick={list.openCreate} />
          </Tooltip>
        </Space>
      }
    >
      <title>Người dùng - CMS Khoa CNPM</title>
      <Table<Row>
        rowKey="id"
        dataSource={pageRows}
        scroll={{ x: 800 }}
        pagination={{
          current: list.page,
          pageSize: list.pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (t) => `Tổng ${t} mục`,
          onChange: (page, pageSize) => list.update(pageSize !== list.pageSize ? { pageSize, page: 1 } : { page }),
        }}
        columns={[
          {
            title: 'Họ tên',
            key: 'fullName',
            render: (_, r) => (
              <div>
                <div style={{ fontWeight: 500 }}>{r.fullName}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{r.email}</div>
              </div>
            ),
          },
          { title: 'Tên đăng nhập', dataIndex: 'username' },
          { title: 'Vai trò', dataIndex: 'role', render: (v: Role) => <Tag color={ROLE_TAG[v].color}>{ROLE_TAG[v].label}</Tag> },
          { title: 'Trạng thái', dataIndex: 'isActive', render: (v: boolean) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Đã khóa</Tag>) },
          { title: 'Ngày tạo', dataIndex: 'createdAt', render: (v: string) => dateFmt.format(new Date(v)) },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 96,
            render: (_, r) => (
              <Space size={4}>
                <Tooltip title="Sửa">
                  <Button type="text" icon={<PencilSimple size={16} />} aria-label={`Sửa ${r.fullName}`} onClick={() => list.openEdit(r.id)} />
                </Tooltip>
                <Popconfirm
                  title={r.isActive ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
                  description={r.isActive ? 'Người dùng sẽ bị đăng xuất và không đăng nhập được.' : undefined}
                  okText={r.isActive ? 'Khóa' : 'Mở khóa'}
                  cancelText="Hủy"
                  okButtonProps={{ danger: r.isActive }}
                  onConfirm={() => toggleLock(r)}
                >
                  {/* Không bọc Tooltip: tooltip sẽ đè lên nút của Popconfirm */}
                  <Button
                    type="text"
                    danger={r.isActive}
                    icon={r.isActive ? <LockSimple size={16} /> : <LockSimpleOpen size={16} />}
                    aria-label={`${r.isActive ? 'Khóa' : 'Mở khóa'} ${r.fullName}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        open={!!list.action}
        title={editing ? 'Sửa người dùng' : 'Tạo người dùng'}
        size={520}
        onClose={list.closeDrawer}
        destroyOnHidden
        afterOpenChange={(open) => open && form.setFieldsValue(editing ?? { role: 'student' } as Row)}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={list.closeDrawer}>Hủy</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>Lưu</Button>
          </Flex>
        }
      >
        <Form form={form} layout="vertical" onFinish={onSave} requiredMark>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên.' }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email chưa đúng định dạng.' }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={(Object.keys(ROLE_TAG) as Role[]).map((r) => ({ value: r, label: ROLE_TAG[r].label }))} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}
