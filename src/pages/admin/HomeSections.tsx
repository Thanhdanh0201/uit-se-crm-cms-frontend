import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Empty, Flex, Form, Input, InputNumber, Popconfirm, Select, Skeleton, Switch, Tag, Tooltip } from 'antd'
import { ArrowDown, ArrowSquareOut, ArrowUp, Info, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import type { Ref } from '../../admin/posts'

export const meta = () => noIndex('Cấu hình trang chủ')

// DTO theo backend HomeSectionDto (SCRUM-17).
export type HomeSection = { id: string; title: string; categoryId: string | null; categoryName: string | null; sortOrder: number; itemLimit: number; isVisible: boolean }
type Values = { title: string; categoryId?: string | null; itemLimit: number; isVisible: boolean }

// Đổi chỗ phần tử index với phần tử kề (dir = -1 lên, 1 xuống), trả về danh sách id theo thứ tự mới.
export function moveId(ids: string[], index: number, dir: -1 | 1): string[] {
  const j = index + dir
  if (j < 0 || j >= ids.length) return ids
  const next = [...ids]
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

const errorMessage = (err: unknown) =>
  !(err instanceof ApiError) ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    : err.status === 400 && err.errors ? Object.values(err.errors).flat().join(' ')
      : err.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
        : err.status === 404 ? 'Khối không còn tồn tại. Danh sách đã được tải lại.'
          : err.message || 'Không thực hiện được lúc này. Vui lòng thử lại sau.'

function HomeSectionsContent() {
  const { message } = App.useApp()
  const list = useListParams()
  const [form] = Form.useForm<Values>()
  const [sections, setSections] = useState<HomeSection[] | null>(null)
  const [categories, setCategories] = useState<Ref[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const editing = list.action === 'edit' ? sections?.find((s) => s.id === list.id) ?? null : null

  useEffect(() => {
    const ctrl = new AbortController()
    setError('')
    api<HomeSection[]>('/api/admin/home-sections', { signal: ctrl.signal })
      .then(setSections)
      .catch((err) => !ctrl.signal.aborted && setError(errorMessage(err)))
    return () => ctrl.abort()
  }, [reloadKey])

  useEffect(() => {
    api<Ref[]>('/api/admin/categories').then((c) => setCategories(c.map((x) => ({ id: x.id, name: x.name })))).catch(() => setCategories([]))
  }, [])

  // Mở drawer: nạp giá trị khối đang sửa hoặc mặc định khi thêm.
  useEffect(() => {
    setDrawerError('')
    if (list.action === 'create') form.setFieldsValue({ title: '', categoryId: null, itemLimit: 6, isVisible: true })
    if (editing) form.setFieldsValue({ title: editing.title, categoryId: editing.categoryId, itemLimit: editing.itemLimit, isVisible: editing.isVisible })
  }, [list.action, editing, form])

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return false
    setBusy(true)
    try {
      await action()
      message.success(success)
      reload()
      return true
    } catch (err) {
      message.error(errorMessage(err))
      if (err instanceof ApiError && err.status === 404) reload()
      return false
    } finally {
      setBusy(false)
    }
  }

  const move = (index: number, dir: -1 | 1) =>
    run(() => api('/api/admin/home-sections/order', { method: 'PUT', json: { ids: moveId(sections!.map((s) => s.id), index, dir) } }), 'Đã đổi thứ tự.')

  const toggle = (s: HomeSection) =>
    run(() => api(`/api/admin/home-sections/${s.id}`, { method: 'PUT', json: { title: s.title, categoryId: s.categoryId, itemLimit: s.itemLimit, isVisible: !s.isVisible } }), s.isVisible ? `Đã ẩn khối "${s.title}".` : `Đã hiện khối "${s.title}".`)

  async function onSave(values: Values) {
    if (busy) return
    setBusy(true)
    setDrawerError('')
    const body = { title: values.title.trim(), categoryId: values.categoryId ?? null, itemLimit: values.itemLimit, isVisible: values.isVisible }
    try {
      if (editing) await api(`/api/admin/home-sections/${editing.id}`, { method: 'PUT', json: body })
      else await api('/api/admin/home-sections', { method: 'POST', json: body })
      message.success(editing ? 'Đã lưu khối trang chủ.' : 'Đã thêm khối trang chủ.')
      list.closeDrawer()
      reload()
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        form.setFields(Object.entries(err.errors).map(([k, errors]) => ({ name: (k[0].toLowerCase() + k.slice(1)) as keyof Values, errors })))
      } else setDrawerError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Khối nội dung trang chủ"
      extra={
        <Flex gap={8}>
          <Button icon={<ArrowSquareOut size={16} />} href="/" target="_blank" rel="noopener noreferrer">Xem trang chủ</Button>
          <Tooltip title="Thêm khối">
            <Button type="primary" icon={<Plus size={16} />} aria-label="Thêm khối" onClick={list.openCreate} />
          </Tooltip>
        </Flex>
      }
    >
      <Flex gap={8} align="center" className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 16 }}>
        <Info size={16} aria-hidden />
        Tin nổi bật và tin mới luôn ở đầu trang chủ. Các khối dưới đây hiện tiếp theo đúng thứ tự; khối không có bài nào sẽ tự ẩn.
      </Flex>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được cấu hình trang chủ" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      {!sections && !error && <Skeleton active />}
      {sections && sections.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có khối nào. Trang chủ chỉ hiện tin nổi bật và tin mới.">
          <Button type="primary" onClick={list.openCreate}>Thêm khối đầu tiên</Button>
        </Empty>
      )}
      {sections && sections.length > 0 && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Thứ tự khối trên trang chủ">
          {sections.map((s, i) => (
            <li key={s.id} className="home-section-row" style={{ opacity: s.isVisible ? 1 : 0.65 }}>
              <span className="muted home-section-row__index">{i + 1}</span>
              <div className="home-section-row__info">
                <div style={{ fontWeight: 600 }}>{s.title} {!s.isVisible && <Tag>Đang ẩn</Tag>}</div>
                <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {s.categoryName ? `Chuyên mục: ${s.categoryName}` : 'Bài mới nhất mọi chuyên mục'} · tối đa {s.itemLimit} bài
                </div>
              </div>
              <div className="home-section-row__actions">
              <Switch checked={s.isVisible} disabled={busy} onChange={() => toggle(s)} aria-label={`${s.isVisible ? 'Ẩn' : 'Hiện'} khối ${s.title}`} />
              <Tooltip title="Lên trên"><Button type="text" icon={<ArrowUp size={16} />} aria-label={`Đưa ${s.title} lên trên`} disabled={busy || i === 0} onClick={() => move(i, -1)} /></Tooltip>
              <Tooltip title="Xuống dưới"><Button type="text" icon={<ArrowDown size={16} />} aria-label={`Đưa ${s.title} xuống dưới`} disabled={busy || i === sections.length - 1} onClick={() => move(i, 1)} /></Tooltip>
              <Tooltip title="Sửa"><Button type="text" icon={<PencilSimple size={16} />} aria-label={`Sửa ${s.title}`} onClick={() => list.openEdit(s.id)} /></Tooltip>
              <Popconfirm title={`Xóa khối "${s.title}"?`} description="Khối bị gỡ khỏi trang chủ. Bài viết không bị ảnh hưởng. Muốn tạm ẩn thì tắt công tắc." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => run(() => api(`/api/admin/home-sections/${s.id}`, { method: 'DELETE' }), `Đã xóa khối "${s.title}".`)}>
                <Button type="text" danger icon={<Trash size={16} />} aria-label={`Xóa ${s.title}`} />
              </Popconfirm>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Drawer
        open={list.action === 'create' || !!editing}
        title={editing ? `Sửa khối "${editing.title}"` : 'Thêm khối trang chủ'}
        size={480}
        onClose={list.closeDrawer}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={list.closeDrawer}>Hủy</Button>
            <Button type="primary" loading={busy} onClick={() => form.submit()}>Lưu</Button>
          </Flex>
        }
      >
        {drawerError && <Alert type="error" showIcon title={drawerError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={onSave} disabled={busy} requiredMark>
          <Form.Item name="title" label="Tiêu đề khối" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề khối.' }, { max: 100, message: 'Tiêu đề tối đa 100 ký tự.' }]}>
            <Input maxLength={100} placeholder="Ví dụ: Thông báo học vụ" />
          </Form.Item>
          <Form.Item name="categoryId" label="Chuyên mục" extra="Bỏ trống để hiện bài mới nhất của mọi chuyên mục. Chuyên mục bị ẩn hoặc xóa thì khối tự ẩn.">
            <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="Bài mới nhất mọi chuyên mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="itemLimit" label="Số bài hiển thị" rules={[{ required: true, message: 'Nhập số bài.' }, { type: 'number', min: 1, max: 12, message: 'Từ 1 đến 12 bài.' }]}>
            <InputNumber min={1} max={12} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="isVisible" label="Hiển thị trên trang chủ" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default function HomeSections() {
  return (
    <RequireRole roles={['admin']}>
      <HomeSectionsContent />
    </RequireRole>
  )
}
