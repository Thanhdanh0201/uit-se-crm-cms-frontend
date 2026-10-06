import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, App, Button, Card, DatePicker, Drawer, Empty, Flex, Form, Input, InputNumber, Popconfirm, Progress, Segmented, Select, Skeleton, Space, Table, Tag, Tooltip } from 'antd'
import { PencilSimple, Plus, Trash, UsersThree } from '@phosphor-icons/react'
import type { Dayjs } from 'dayjs'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { formatDateTime } from '../../admin/posts'
import { utcToVnPicker, vnPickerToUtc } from '../../admin/vnTime'

export const meta = () => noIndex('Sự kiện')

// DTO theo backend Business/DTOs/Events/EventDtos.cs (SCRUM-21).
export type EventStatus = 'draft' | 'published' | 'closed' | 'cancelled'
export type EventRow = {
  id: string
  title: string
  startAt: string
  endAt: string | null
  venue: string
  capacity: number
  registeredCount: number
  registrationDeadline: string
  status: EventStatus
  updatedAt: string
}
export type EventDetail = EventRow & { description: string; createdAt: string }
type EventPage = { items: EventRow[]; totalItems: number; page: number; pageSize: number }
type Values = { title: string; description?: string; startAt: Dayjs; endAt?: Dayjs | null; venue: string; capacity: number; registrationDeadline: Dayjs; status: EventStatus }

export const EVENT_STATUS: Record<EventStatus, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'default' },
  published: { label: 'Đang mở', color: 'green' },
  closed: { label: 'Ngừng nhận đăng ký', color: 'orange' },
  cancelled: { label: 'Đã hủy', color: 'red' },
}

export function eventErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.code) return err.message
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Sự kiện không còn tồn tại. Danh sách đã được tải lại.'
  if (err.status === 400) return err.errors ? Object.values(err.errors).flat().join(' ') : err.message
  return 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

// Kiểm tra thời gian trước khi gửi, cùng quy tắc backend: kết thúc sau bắt đầu, hạn đăng ký không sau bắt đầu.
export function checkTimes(v: { startAt?: Dayjs | null; endAt?: Dayjs | null; registrationDeadline?: Dayjs | null }) {
  const errors: { name: 'endAt' | 'registrationDeadline'; errors: string[] }[] = []
  if (v.startAt && v.endAt && !v.endAt.isAfter(v.startAt)) errors.push({ name: 'endAt', errors: ['Thời gian kết thúc phải sau thời gian bắt đầu.'] })
  if (v.startAt && v.registrationDeadline && v.registrationDeadline.isAfter(v.startAt)) errors.push({ name: 'registrationDeadline', errors: ['Hạn đăng ký không được sau thời gian bắt đầu.'] })
  return errors
}

const PICKER = { showTime: { format: 'HH:mm' }, format: 'DD/MM/YYYY HH:mm', style: { width: '100%' } } as const

function EventsContent() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const list = useListParams(20)
  const status = list.params.get('status') ?? 'all'
  const [form] = Form.useForm<Values>()
  const [data, setData] = useState<EventPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const [editing, setEditing] = useState<EventDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) })
    if (status !== 'all') q.set('status', status)
    if (list.keyword) q.set('search', list.keyword)
    setLoading(true)
    setError('')
    api<EventPage>(`/api/admin/events?${q}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(eventErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [status, list.page, list.pageSize, list.keyword, reloadKey])

  // Mở form sửa: lấy bản mới nhất (số đã đăng ký dùng để giới hạn sức chứa tối thiểu).
  useEffect(() => {
    setDrawerError('')
    if (list.action === 'create') {
      setEditing(null)
      form.resetFields()
      form.setFieldsValue({ status: 'draft', capacity: 50 })
      return
    }
    if (list.action !== 'edit' || !list.id) {
      setEditing(null)
      return
    }
    const ctrl = new AbortController()
    setDetailLoading(true)
    api<EventDetail>(`/api/admin/events/${list.id}`, { signal: ctrl.signal })
      .then((e) => {
        setEditing(e)
        form.setFieldsValue({
          title: e.title, description: e.description, venue: e.venue, capacity: e.capacity, status: e.status,
          startAt: utcToVnPicker(e.startAt), endAt: e.endAt ? utcToVnPicker(e.endAt) : null, registrationDeadline: utcToVnPicker(e.registrationDeadline),
        })
      })
      .catch((err) => !ctrl.signal.aborted && setDrawerError(eventErrorMessage(err)))
      .finally(() => !ctrl.signal.aborted && setDetailLoading(false))
    return () => ctrl.abort()
  }, [list.action, list.id, form])

  async function onSave(values: Values) {
    if (saving) return
    const timeErrors = checkTimes(values)
    if (timeErrors.length) return form.setFields(timeErrors)
    setSaving(true)
    setDrawerError('')
    // Không gửi registeredCount: server tự quản lý.
    const body = {
      title: values.title.trim(),
      description: values.description?.trim() ?? '',
      startAt: vnPickerToUtc(values.startAt),
      endAt: values.endAt ? vnPickerToUtc(values.endAt) : null,
      venue: values.venue.trim(),
      capacity: values.capacity,
      registrationDeadline: vnPickerToUtc(values.registrationDeadline),
      status: values.status,
    }
    try {
      if (editing) await api(`/api/admin/events/${editing.id}`, { method: 'PUT', json: body })
      else await api('/api/admin/events', { method: 'POST', json: body })
      message.success(editing ? `Đã lưu sự kiện "${body.title}".` : `Đã tạo sự kiện "${body.title}".`)
      list.closeDrawer()
      reload()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'capacity_below_registered') {
        form.setFields([{ name: 'capacity', errors: [err.message] }])
      } else if (err instanceof ApiError && err.errors) {
        form.setFields(Object.entries(err.errors).map(([k, errors]) => ({ name: (k[0].toLowerCase() + k.slice(1)) as keyof Values, errors })))
      } else {
        setDrawerError(eventErrorMessage(err))
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: EventRow) {
    setBusyId(row.id)
    try {
      await api(`/api/admin/events/${row.id}`, { method: 'DELETE' })
      message.success(`Đã xóa sự kiện "${row.title}".`)
      reload()
    } catch (err) {
      message.error(eventErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const filtered = Boolean(list.keyword || status !== 'all')

  return (
    <Card
      title={
        <Segmented
          value={status}
          aria-label="Lọc theo trạng thái"
          options={[{ value: 'all', label: 'Tất cả' }, ...(Object.keys(EVENT_STATUS) as EventStatus[]).map((s) => ({ value: s, label: EVENT_STATUS[s].label }))]}
          onChange={(v) => list.update({ status: v === 'all' ? null : v })}
        />
      }
      extra={
        <Space wrap>
          <Input.Search key={list.keyword} allowClear defaultValue={list.keyword} placeholder="Tìm theo tên, địa điểm" aria-label="Tìm sự kiện" onSearch={(v) => list.update({ keyword: v.trim() })} style={{ width: 240 }} />
          <Tooltip title="Thêm sự kiện">
            <Button type="primary" icon={<Plus size={16} />} aria-label="Thêm sự kiện" onClick={list.openCreate} />
          </Tooltip>
        </Space>
      }
    >
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách sự kiện" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      <Table<EventRow>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 980 }}
        locale={{
          emptyText: error ? ' ' : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có sự kiện khớp bộ lọc.' : 'Chưa có sự kiện nào.'}>
              {!filtered && <Button type="primary" onClick={list.openCreate}>Tạo sự kiện đầu tiên</Button>}
            </Empty>
          ),
        }}
        pagination={{ current: list.page, pageSize: list.pageSize, total: data?.totalItems ?? 0, showTotal: (t) => `Tổng ${t} sự kiện`, onChange: (page) => list.update({ page }) }}
        columns={[
          {
            title: 'Sự kiện',
            key: 'title',
            render: (_, e) => (
              <div>
                <div style={{ fontWeight: 500 }}>{e.title}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{e.venue}</div>
              </div>
            ),
          },
          { title: 'Bắt đầu', dataIndex: 'startAt', width: 140, render: (v: string) => formatDateTime(v) },
          { title: 'Hạn đăng ký', dataIndex: 'registrationDeadline', width: 140, render: (v: string) => formatDateTime(v) },
          {
            title: 'Đăng ký',
            key: 'count',
            width: 150,
            render: (_, e) => (
              <div>
                <div>{e.registeredCount}/{e.capacity}</div>
                <Progress percent={Math.round((e.registeredCount * 100) / e.capacity)} size="small" showInfo={false} status={e.registeredCount >= e.capacity ? 'exception' : 'normal'} aria-label={`Đã đăng ký ${e.registeredCount} trên ${e.capacity}`} />
              </div>
            ),
          },
          { title: 'Trạng thái', dataIndex: 'status', width: 170, render: (s: EventStatus) => <Tag color={EVENT_STATUS[s].color}>{EVENT_STATUS[s].label}</Tag> },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 132,
            render: (_, e) => (
              <Space size={4}>
                <Tooltip title="Danh sách đăng ký">
                  <Button type="text" icon={<UsersThree size={16} />} aria-label={`Danh sách đăng ký ${e.title}`} onClick={() => navigate(`/admin/events/${e.id}`)} />
                </Tooltip>
                <Tooltip title="Sửa">
                  <Button type="text" icon={<PencilSimple size={16} />} aria-label={`Sửa ${e.title}`} onClick={() => list.openEdit(e.id)} />
                </Tooltip>
                <Popconfirm
                  title={`Xóa sự kiện "${e.title}"?`}
                  description={e.registeredCount ? `${e.registeredCount} người đã đăng ký. Nên chuyển sang Đã hủy để người đăng ký còn thấy thông báo.` : 'Sự kiện bị gỡ khỏi website.'}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(e)}
                >
                  <Button type="text" danger icon={<Trash size={16} />} loading={busyId === e.id} aria-label={`Xóa ${e.title}`} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        open={!!list.action}
        title={list.action === 'edit' ? 'Sửa sự kiện' : 'Tạo sự kiện'}
        size={560}
        onClose={list.closeDrawer}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={list.closeDrawer}>Hủy</Button>
            <Button type="primary" loading={saving} disabled={detailLoading || (list.action === 'edit' && !editing)} onClick={() => form.submit()}>Lưu</Button>
          </Flex>
        }
      >
        {drawerError && <Alert type="error" showIcon title={drawerError} style={{ marginBottom: 16 }} />}
        {detailLoading && <Skeleton active />}
        <Form form={form} layout="vertical" onFinish={onSave} disabled={saving} requiredMark hidden={detailLoading}>
          <Form.Item name="title" label="Tên sự kiện" rules={[{ required: true, whitespace: true, message: 'Nhập tên sự kiện.' }, { max: 200, message: 'Tên tối đa 200 ký tự.' }]}>
            <Input maxLength={200} placeholder="Ví dụ: Hội thảo khoa học sinh viên 2026" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả" rules={[{ max: 5000, message: 'Mô tả tối đa 5000 ký tự.' }]}>
            <Input.TextArea maxLength={5000} autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
          <Form.Item name="venue" label="Địa điểm" rules={[{ required: true, whitespace: true, message: 'Nhập địa điểm.' }, { max: 200, message: 'Địa điểm tối đa 200 ký tự.' }]}>
            <Input maxLength={200} placeholder="Ví dụ: Hội trường E, UIT" />
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item name="startAt" label="Bắt đầu (giờ Việt Nam)" rules={[{ required: true, message: 'Chọn thời gian bắt đầu.' }]} style={{ flex: '1 1 220px' }}>
              <DatePicker {...PICKER} />
            </Form.Item>
            <Form.Item name="endAt" label="Kết thúc (giờ Việt Nam)" style={{ flex: '1 1 220px' }}>
              <DatePicker {...PICKER} placeholder="Không bắt buộc" />
            </Form.Item>
          </Flex>
          <Form.Item name="registrationDeadline" label="Hạn đăng ký (giờ Việt Nam)" extra="Không sau thời gian bắt đầu. Sau hạn, người dùng không đăng ký hoặc hủy được." rules={[{ required: true, message: 'Chọn hạn đăng ký.' }]}>
            <DatePicker {...PICKER} />
          </Form.Item>
          <Form.Item
            name="capacity"
            label="Sức chứa"
            extra={editing ? `Đã có ${editing.registeredCount} người đăng ký: không giảm dưới số này.` : undefined}
            rules={[{ required: true, message: 'Nhập sức chứa.' }, { type: 'number', min: Math.max(1, editing?.registeredCount ?? 0), max: 10000, message: `Sức chứa từ ${Math.max(1, editing?.registeredCount ?? 0)} đến 10000.` }]}
          >
            <InputNumber min={1} max={10000} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" extra="Đang mở: hiện công khai và nhận đăng ký. Ngừng nhận đăng ký: vẫn hiện nhưng khóa đăng ký." rules={[{ required: true }]}>
            <Select options={(Object.keys(EVENT_STATUS) as EventStatus[]).map((s) => ({ value: s, label: EVENT_STATUS[s].label }))} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default function Events() {
  return (
    <RequireRole roles={['admin']}>
      <EventsContent />
    </RequireRole>
  )
}
