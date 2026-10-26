import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, DatePicker, Drawer, Empty, Flex, Form, Input, Popconfirm, Radio, Segmented, Skeleton, Switch, Tag, Tooltip } from 'antd'
import type { Dayjs } from 'dayjs'
import { ArrowDown, ArrowSquareOut, ArrowUp, ImageSquare, Info, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { MediaPicker } from '../../admin/MediaPicker'
import { utcToVnPicker, vnPickerToUtc } from '../../admin/vnTime'
import { moveId } from './HomeSections'
import { LOCALES, localeColor, localeLabel, parseLocale } from '../../admin/locale'

export const meta = () => noIndex('Slider trang chủ')

// DTO theo backend HomeSlideDto (SCRUM-64). image.url là signed URL có hạn, không lưu lại.
type SlideStatus = 'showing' | 'scheduled' | 'expired' | 'hidden'
type Position = 'top' | 'bottom'
export type HomeSlide = {
  id: string
  title: string
  caption: string | null
  image: { id: string; name: string; altText: string | null; url: string | null } | null
  linkUrl: string | null
  buttonLabel: string | null
  position: Position
  sortOrder: number
  isVisible: boolean
  startsAt: string | null
  endsAt: string | null
  status: SlideStatus
  locale?: 'vi' | 'en'
}
type Image = { id: string; name: string; altText: string | null; url: string | null }
type Values = { title: string; caption?: string; image?: Image | null; linkUrl?: string; buttonLabel?: string; position: Position; isVisible: boolean; startsAt?: Dayjs | null; endsAt?: Dayjs | null }

const STATUS: Record<SlideStatus, { label: string; color: string }> = {
  showing: { label: 'Đang hiện', color: 'green' },
  scheduled: { label: 'Hẹn giờ', color: 'blue' },
  expired: { label: 'Đã hết hạn', color: 'default' },
  hidden: { label: 'Đang ẩn', color: 'default' },
}
const MAX_VISIBLE = 10 // mỗi vị trí, backend PageConstants.MaxVisibleSlides
const POSITIONS: { value: Position; label: string; hint: string }[] = [
  { value: 'top', label: 'Đầu trang', hint: 'Slider ở đầu trang chủ, cạnh khối Thông báo mới.' },
  { value: 'bottom', label: 'Cuối trang', hint: 'Slider rộng ở cuối trang chủ, trên khối Có câu hỏi cho Khoa.' },
]

// Đổi chỗ trong một vị trí: danh sách gửi backend vẫn là toàn bộ id, slide vị trí khác giữ nguyên chỗ.
export function reorderWithin(all: { id: string; position: Position }[], position: Position, index: number, dir: -1 | 1): string[] {
  const group = moveId(all.filter((s) => s.position === position).map((s) => s.id), index, dir)
  let i = 0
  return all.map((s) => (s.position === position ? group[i++] : s.id))
}

// Cùng quy tắc backend SaveHomeSlideRequestValidator.BeSafeLink: trang trong website (/...) hoặc http/https.
export function isSafeLink(link: string) {
  const l = link.trim()
  if (l.startsWith('/')) return !l.startsWith('//') && !l.startsWith('/\\')
  try {
    return ['http:', 'https:'].includes(new URL(l).protocol)
  } catch {
    return false
  }
}

const errorMessage = (err: unknown) =>
  !(err instanceof ApiError) ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    : err.status === 400 && err.errors ? Object.values(err.errors).flat().join(' ')
      : err.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
        : err.status === 404 ? 'Slide không còn tồn tại. Danh sách đã được tải lại.'
          : err.message || 'Không thực hiện được lúc này. Vui lòng thử lại sau.' // 422 too_many_slides: detail tiếng Việt

const formatVn = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function schedule(s: HomeSlide) {
  if (s.startsAt && s.endsAt) return `${formatVn.format(new Date(s.startsAt))} đến ${formatVn.format(new Date(s.endsAt))}`
  if (s.startsAt) return `Từ ${formatVn.format(new Date(s.startsAt))}`
  if (s.endsAt) return `Đến ${formatVn.format(new Date(s.endsAt))}`
  return 'Luôn hiện khi bật'
}

// Ô chọn ảnh trong Form: hiện ảnh đang chọn, mở thư viện media để đổi.
function ImageField({ value, onChange, id }: { value?: Image | null; onChange?: (v: Image | null) => void; id?: string }) {
  const [open, setOpen] = useState(false)
  return (
    // id của Form.Item đặt ở khung ngoài (antd cuộn tới khi lỗi); không gắn vào nút để nút giữ tên "Chọn ảnh từ thư viện".
    <div className="slide-image-field" id={id}>
      {value?.url ? <img src={value.url} alt={value.altText ?? ''} className="slide-image-field__preview" /> : <span className="slide-image-field__empty" aria-hidden><ImageSquare size={32} /></span>}
      <Flex gap={8} align="center" wrap>
        <Button icon={<ImageSquare size={16} />} onClick={() => setOpen(true)}>{value ? 'Đổi ảnh' : 'Chọn ảnh từ thư viện'}</Button>
        {value && <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{value.name}</span>}
      </Flex>
      <MediaPicker
        open={open}
        kinds={['image']}
        title="Chọn ảnh cho slide"
        onCancel={() => setOpen(false)}
        onSelect={(m) => {
          setOpen(false)
          onChange?.({ id: m.id, name: m.name, altText: m.altText, url: m.url ?? m.thumbnailUrl })
        }}
      />
    </div>
  )
}

function HomeSlidesContent() {
  const { message } = App.useApp()
  const list = useListParams()
  const locale = parseLocale(list.params.get('locale'))
  const [form] = Form.useForm<Values>()
  const [slides, setSlides] = useState<HomeSlide[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const editing = list.action === 'edit' ? slides?.find((s) => s.id === list.id) ?? null : null
  const position: Position = list.params.get('position') === 'bottom' ? 'bottom' : 'top'
  const shown = slides?.filter((s) => s.position === position) ?? null
  const visibleAt = (p: Position) => slides?.filter((s) => s.isVisible && s.position === p).length ?? 0
  const visibleCount = visibleAt(position)
  // Trong form: đủ 10 slide đang bật ở vị trí đang chọn thì không bật thêm (trừ slide đang sửa vốn đã bật ở đó).
  const formPosition = (Form.useWatch('position', form) ?? position) as Position
  const formFull = visibleAt(formPosition) >= MAX_VISIBLE && !(editing?.isVisible && editing.position === formPosition)

  useEffect(() => {
    const ctrl = new AbortController()
    setError('')
    api<HomeSlide[]>(`/api/admin/home-slides?locale=${locale}`, { signal: ctrl.signal })
      .then(setSlides)
      .catch((err) => !ctrl.signal.aborted && setError(errorMessage(err)))
    return () => ctrl.abort()
  }, [locale, reloadKey])

  // Mở drawer: nạp slide đang sửa hoặc giá trị mặc định khi thêm.
  useEffect(() => {
    setDrawerError('')
    if (list.action === 'create') form.setFieldsValue({ title: '', caption: '', image: null, linkUrl: '', buttonLabel: '', position, isVisible: visibleCount < MAX_VISIBLE, startsAt: null, endsAt: null })
    if (editing) {
      form.setFieldsValue({
        title: editing.title,
        caption: editing.caption ?? '',
        image: editing.image,
        linkUrl: editing.linkUrl ?? '',
        buttonLabel: editing.buttonLabel ?? '',
        position: editing.position,
        isVisible: editing.isVisible,
        startsAt: editing.startsAt ? utcToVnPicker(editing.startsAt) : null,
        endsAt: editing.endsAt ? utcToVnPicker(editing.endsAt) : null,
      })
    }
    // visibleCount chỉ dùng cho giá trị mặc định lúc mở, không nạp lại form khi danh sách đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.action, editing, form])

  const body = (s: { title: string; caption?: string | null; mediaId: string; linkUrl?: string | null; buttonLabel?: string | null; position: Position; isVisible: boolean; startsAt?: string | null; endsAt?: string | null }) => ({
    title: s.title.trim(),
    caption: s.caption?.trim() || null,
    mediaId: s.mediaId,
    linkUrl: s.linkUrl?.trim() || null,
    buttonLabel: s.linkUrl?.trim() ? s.buttonLabel?.trim() || null : null,
    position: s.position,
    isVisible: s.isVisible,
    startsAt: s.startsAt ?? null,
    endsAt: s.endsAt ?? null,
  })

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
    run(() => api('/api/admin/home-slides/order', { method: 'PUT', json: { ids: reorderWithin(slides!, position, index, dir) } }), 'Đã đổi thứ tự.')

  const toggle = (s: HomeSlide) =>
    run(
      () => api(`/api/admin/home-slides/${s.id}`, { method: 'PUT', json: body({ ...s, mediaId: s.image!.id, isVisible: !s.isVisible }) }),
      s.isVisible ? `Đã ẩn slide "${s.title}".` : `Đã bật slide "${s.title}".`,
    )

  async function onSave(values: Values) {
    if (busy) return
    setBusy(true)
    setDrawerError('')
    const payload = {
      ...body({
        ...values,
        mediaId: values.image!.id,
        startsAt: values.startsAt ? vnPickerToUtc(values.startsAt) : null,
        endsAt: values.endsAt ? vnPickerToUtc(values.endsAt) : null,
      }),
      ...(editing ? {} : { locale }),
    }
    try {
      if (editing) await api(`/api/admin/home-slides/${editing.id}`, { method: 'PUT', json: payload })
      else await api('/api/admin/home-slides', { method: 'POST', json: payload })
      message.success(editing ? 'Đã lưu slide.' : 'Đã thêm slide.')
      list.closeDrawer()
      reload()
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        // Lỗi validation backend (key PascalCase) gắn vào field; MediaId là ô chọn ảnh.
        form.setFields(Object.entries(err.errors).map(([k, errors]) => ({ name: (k.toLowerCase() === 'mediaid' ? 'image' : k[0].toLowerCase() + k.slice(1)) as keyof Values, errors })))
      } else setDrawerError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={
        <Flex gap={12} align="center" wrap="wrap">
          <Segmented
            value={locale}
            onChange={(v) => list.update({ locale: v as 'vi' | 'en', action: null, id: null })}
            options={LOCALES.map((l) => ({ value: l.code, label: l.label }))}
          />
          <Segmented
            value={position}
            aria-label="Vị trí slider"
            options={POSITIONS.map((p) => ({ value: p.value, label: `${p.label} (${slides?.filter((s) => s.position === p.value).length ?? 0})` }))}
            onChange={(v) => list.update({ position: v === 'top' ? null : v })}
          />
        </Flex>
      }
      extra={
        <Flex gap={8}>
          <Button icon={<ArrowSquareOut size={16} />} href="/" target="_blank" rel="noopener noreferrer">Xem trang chủ</Button>
          <Tooltip title="Thêm slide">
            <Button type="primary" icon={<Plus size={16} />} aria-label="Thêm slide" onClick={list.openCreate} />
          </Tooltip>
        </Flex>
      }
    >
      <Flex gap={8} align="center" className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 16 }}>
        <Info size={16} aria-hidden style={{ flex: 'none' }} />
        {POSITIONS.find((p) => p.value === position)!.hint} Slide đang bật hiện theo đúng thứ tự, tối đa {MAX_VISIBLE} slide.{' '}
        {position === 'top' ? 'Không có slide nào thì trang chủ hiện phần giới thiệu mặc định.' : 'Không có slide nào thì trang chủ không có slider cuối trang.'}
      </Flex>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách slide" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      {!slides && !error && <Skeleton active />}
      {shown && shown.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Chưa có slide nào ở ${position === 'top' ? 'đầu' : 'cuối'} trang.`}>
          <Button type="primary" onClick={list.openCreate}>Thêm slide đầu tiên</Button>
        </Empty>
      )}
      {shown && shown.length > 0 && (
        <ol className="slide-list" aria-label={`Thứ tự slide ${position === 'top' ? 'đầu' : 'cuối'} trang chủ`}>
          {shown.map((s, i) => (
            <li key={s.id} className="home-section-row slide-row" style={{ opacity: s.status === 'showing' ? 1 : 0.7 }}>
              <span className="muted home-section-row__index">{i + 1}</span>
              {s.image?.url ? <img src={s.image.url} alt="" className="slide-row__thumb" /> : <span className="slide-row__thumb slide-image-field__empty" aria-hidden><ImageSquare size={20} /></span>}
              <div className="home-section-row__info">
                <div style={{ fontWeight: 600 }}>
                  {s.title} <Tag color={STATUS[s.status].color}>{STATUS[s.status].label}</Tag> <Tag color={localeColor(s.locale ?? locale)}>{localeLabel(s.locale ?? locale)}</Tag>
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {schedule(s)}
                  {s.linkUrl && `, link: ${s.linkUrl}`}
                </div>
              </div>
              <div className="home-section-row__actions">
                <Switch checked={s.isVisible} disabled={busy || (!s.isVisible && visibleCount >= MAX_VISIBLE)} onChange={() => toggle(s)} aria-label={`${s.isVisible ? 'Tắt' : 'Bật'} slide ${s.title}`} />
                <Tooltip title="Lên trên"><Button type="text" icon={<ArrowUp size={16} />} aria-label={`Đưa ${s.title} lên trên`} disabled={busy || i === 0} onClick={() => move(i, -1)} /></Tooltip>
                <Tooltip title="Xuống dưới"><Button type="text" icon={<ArrowDown size={16} />} aria-label={`Đưa ${s.title} xuống dưới`} disabled={busy || i === shown.length - 1} onClick={() => move(i, 1)} /></Tooltip>
                <Tooltip title="Sửa"><Button type="text" icon={<PencilSimple size={16} />} aria-label={`Sửa ${s.title}`} onClick={() => list.openEdit(s.id)} /></Tooltip>
                <Popconfirm title={`Xóa slide "${s.title}"?`} description="Slide bị gỡ khỏi trang chủ. Ảnh vẫn còn trong thư viện media. Muốn tạm ẩn thì tắt công tắc." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => run(() => api(`/api/admin/home-slides/${s.id}`, { method: 'DELETE' }), `Đã xóa slide "${s.title}".`)}>
                  <Button type="text" danger icon={<Trash size={16} />} aria-label={`Xóa ${s.title}`} />
                </Popconfirm>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Drawer
        open={list.action === 'create' || !!editing}
        title={
          <Flex gap={8} align="center">
            <span>{editing ? `Sửa slide "${editing.title}"` : 'Thêm slide'}</span>
            <Tag color={localeColor(editing?.locale ?? locale)}>{localeLabel(editing?.locale ?? locale)}</Tag>
          </Flex>
        }
        size={520}
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
          <Form.Item
            name="image"
            label="Ảnh"
            extra="Nên dùng ảnh ngang, rộng từ 1600px. Ảnh phải có văn bản thay thế (alt text) trong Thư viện media."
            rules={[
              { required: true, message: 'Chọn ảnh cho slide.' },
              { validator: (_, v: Image | null) => (!v || v.altText?.trim() ? Promise.resolve() : Promise.reject(new Error('Ảnh chưa có văn bản thay thế (alt text). Bổ sung trong Thư viện media rồi chọn lại.'))) },
            ]}
          >
            <ImageField />
          </Form.Item>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề slide.' }, { max: 150, message: 'Tiêu đề tối đa 150 ký tự.' }]}>
            <Input maxLength={150} placeholder="Ví dụ: Ngày hội việc làm Khoa CNPM 2026" />
          </Form.Item>
          <Form.Item name="caption" label="Mô tả ngắn" rules={[{ max: 300, message: 'Mô tả tối đa 300 ký tự.' }]}>
            <Input.TextArea maxLength={300} showCount autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Một hai câu giới thiệu, hiện dưới tiêu đề" />
          </Form.Item>
          <Form.Item
            name="linkUrl"
            label="Đường dẫn"
            extra="Trang trong website bắt đầu bằng /, ví dụ /posts/ngay-hoi-viec-lam-2026. Hoặc link ngoài bắt đầu bằng https://."
            rules={[{ max: 500, message: 'Đường dẫn tối đa 500 ký tự.' }, { validator: (_, v?: string) => (!v?.trim() || isSafeLink(v) ? Promise.resolve() : Promise.reject(new Error('Đường dẫn phải bắt đầu bằng / (trang trong website) hoặc http://, https://.'))) }]}
          >
            <Input maxLength={500} placeholder="Bỏ trống nếu slide không dẫn tới đâu" />
          </Form.Item>
          <Form.Item
            name="buttonLabel"
            label="Chữ trên nút"
            dependencies={['linkUrl']}
            extra="Bỏ trống thì cả slide là link (nếu có đường dẫn)."
            rules={[
              { max: 40, message: 'Chữ trên nút tối đa 40 ký tự.' },
              ({ getFieldValue }) => ({ validator: (_, v?: string) => (!v?.trim() || getFieldValue('linkUrl')?.trim() ? Promise.resolve() : Promise.reject(new Error('Có chữ trên nút thì phải nhập đường dẫn.'))) }),
            ]}
          >
            <Input maxLength={40} placeholder="Ví dụ: Xem chi tiết" />
          </Form.Item>
          <Form.Item name="position" label="Vị trí trên trang chủ">
            <Radio.Group options={POSITIONS.map((p) => ({ value: p.value, label: p.label }))} optionType="button" />
          </Form.Item>
          <Flex gap={16} wrap>
            <Form.Item name="startsAt" label="Bắt đầu hiện (giờ Việt Nam)" style={{ flex: '1 1 200px' }}>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Ngay khi bật" />
            </Form.Item>
            <Form.Item
              name="endsAt"
              label="Thôi hiện (giờ Việt Nam)"
              style={{ flex: '1 1 200px' }}
              dependencies={['startsAt']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, v: Dayjs | null) => {
                    const start = getFieldValue('startsAt') as Dayjs | null
                    return !v || !start || vnPickerToUtc(v) > vnPickerToUtc(start) ? Promise.resolve() : Promise.reject(new Error('Thời điểm thôi hiện phải sau thời điểm bắt đầu.'))
                  },
                }),
              ]}
            >
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Không giới hạn" />
            </Form.Item>
          </Flex>
          <Form.Item name="isVisible" label="Bật slide" valuePropName="checked" extra={formFull ? `Vị trí này đã có ${MAX_VISIBLE} slide đang bật. Tắt bớt slide khác để bật slide này.` : undefined}>
            <Switch disabled={formFull} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default function HomeSlides() {
  return (
    <RequireRole roles={['admin']}>
      <HomeSlidesContent />
    </RequireRole>
  )
}
