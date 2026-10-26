import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { Alert, App, Button, Card, Col, DatePicker, Drawer, Flex, Form, Input, Row, Select, Skeleton, Tag } from 'antd'
import type { Dayjs } from 'dayjs'
import { ArrowLeft, Eye } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { RichText } from '../../components/PostArticle'
import { docSnapshot, RichTextEditor, withMediaUrls } from '../../admin/RichTextEditor'
import { videoIdOf, type MediaDto } from '../../admin/media'
import { formatDateTime, type PostMedia, type RichNode } from '../../admin/posts'
import { SCHEDULE_LABEL, scheduleState, utcToVnPicker, vnPickerToUtc } from '../../admin/vnTime'
import { PAGE_STATUS, pageErrorMessage, type PageStatus } from './StaticPages'

export const meta = () => noIndex('Soạn trang tĩnh')

// DTO theo backend PageDetailDto (SCRUM-17).
type MenuRef = { id: string; label: string; menuName: string }
export type PageDetail = {
  id: string
  title: string
  slug: string
  content: RichNode
  status: PageStatus
  media: Record<string, PostMedia>
  publishedAt: string | null
  expiresAt: string | null
  menuItems: MenuRef[]
  createdAt: string
  updatedAt: string
}
type Values = { title: string; slug?: string; status: PageStatus; publishedAt?: Dayjs | null; expiresAt?: Dayjs | null }

const EMPTY_DOC: RichNode = { type: 'doc', content: [{ type: 'paragraph' }] }

// So sánh để biết có thay đổi chưa lưu: giá trị form theo thứ tự cố định.
function snap(v: Partial<Values>, doc: RichNode) {
  return JSON.stringify([v.title ?? '', v.slug ?? '', v.status ?? '', v.publishedAt?.valueOf() ?? null, v.expiresAt?.valueOf() ?? null, docSnapshot(doc)])
}

function PageEditorContent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<Values>()
  const status: PageStatus = Form.useWatch('status', form) ?? 'draft'
  const [page, setPage] = useState<PageDetail | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [loadError, setLoadError] = useState('')
  const [content, setContent] = useState<RichNode>(EMPTY_DOC)
  const [editorKey, setEditorKey] = useState(0)
  const [media, setMedia] = useState<Record<string, PostMedia>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [contentError, setContentError] = useState('')
  const [preview, setPreview] = useState(false)
  const savedRef = useRef('')
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)

  const markDirty = (doc = content) => {
    const d = snap(form.getFieldsValue(true), doc) !== savedRef.current
    dirtyRef.current = d
    setDirty(d)
  }

  const apply = useCallback((p: PageDetail) => {
    form.setFieldsValue({ title: p.title, slug: p.slug, status: p.status, publishedAt: p.publishedAt ? utcToVnPicker(p.publishedAt) : null, expiresAt: p.expiresAt ? utcToVnPicker(p.expiresAt) : null })
    const doc = withMediaUrls(p.content, p.media)
    setPage(p)
    setMedia(p.media)
    setContent(doc)
    setEditorKey((k) => k + 1)
    savedRef.current = snap(form.getFieldsValue(true), doc)
    dirtyRef.current = false
    setDirty(false)
  }, [form])

  const load = useCallback(async () => {
    if (!id) {
      form.setFieldsValue({ title: '', slug: '', status: 'draft', publishedAt: null, expiresAt: null })
      savedRef.current = snap(form.getFieldsValue(true), EMPTY_DOC)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      apply(await api<PageDetail>(`/api/admin/pages/${id}`))
    } catch (err) {
      setLoadError(pageErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id, apply, form])

  useEffect(() => {
    load()
  }, [load])

  // Cảnh báo rời trang khi chưa lưu.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    modal.confirm({ title: 'Rời trang khi chưa lưu?', content: 'Thay đổi chưa lưu sẽ mất.', okText: 'Rời trang', cancelText: 'Ở lại', onOk: () => blocker.proceed(), onCancel: () => blocker.reset() })
  }, [blocker, modal])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  async function save() {
    if (saving) return
    let values: Values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    // Đổi trang đang có trong menu sang nháp/lưu trữ làm mục menu bị ẩn khỏi website: hỏi trước.
    if (page && page.menuItems.length > 0 && page.status === 'published' && values.status !== 'published') {
      const ok = await modal.confirm({
        title: 'Gỡ trang đang có trong menu?',
        content: `Trang có trong ${page.menuItems.length} mục menu. Sau khi chuyển sang ${PAGE_STATUS[values.status].label}, các mục này bị ẩn khỏi menu công khai cho tới khi xuất bản lại.`,
        okText: 'Vẫn lưu',
        cancelText: 'Hủy',
      })
      if (!ok) return
    }
    setSaving(true)
    setSaveError('')
    setContentError('')
    const body = {
      title: values.title.trim(),
      slug: values.slug?.trim() || null,
      status: values.status,
      content,
      publishedAt: values.publishedAt ? vnPickerToUtc(values.publishedAt) : null,
      expiresAt: values.expiresAt ? vnPickerToUtc(values.expiresAt) : null,
    }
    try {
      const saved = page
        ? await api<PageDetail>(`/api/admin/pages/${page.id}`, { method: 'PUT', json: body })
        : await api<PageDetail>('/api/admin/pages', { method: 'POST', json: body })
      apply(saved)
      message.success(page ? 'Đã lưu trang.' : 'Đã tạo trang.')
      if (!page) navigate(`/admin/pages/${saved.id}/edit`, { replace: true })
    } catch (err) {
      // Lỗi validation (slug trùng, tiêu đề...) gắn vào đúng ô (AC SCRUM-45).
      if (err instanceof ApiError && err.errors) {
        const fields: { name: keyof Values; errors: string[] }[] = []
        for (const [k, errors] of Object.entries(err.errors)) {
          const key = k.toLowerCase()
          if (key === 'content') setContentError(errors[0])
          else if (key === 'title' || key === 'slug' || key === 'status') fields.push({ name: key, errors })
          else if (key === 'expiresat') fields.push({ name: 'expiresAt', errors })
          else if (key === 'publishedat') fields.push({ name: 'publishedAt', errors })
        }
        form.setFields(fields)
        if (!fields.length && !err.errors.Content) setSaveError(pageErrorMessage(err))
      } else {
        setSaveError(pageErrorMessage(err))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Card><Skeleton active /></Card>
  if (loadError) return <Card><Alert type="error" showIcon title="Không mở được trang" description={loadError} action={<Button size="small" onClick={load}>Thử lại</Button>} /></Card>

  const menuWarning = page && page.menuItems.length > 0 && page.status !== 'published'

  return (
    <Form form={form} layout="vertical" disabled={saving} onValuesChange={() => markDirty()} requiredMark initialValues={{ status: 'draft' }}>
      <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
        <Link to="/admin/pages" aria-label="Về danh sách trang"><ArrowLeft size={18} aria-hidden /></Link>
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{page ? 'Sửa trang' : 'Trang mới'}</h1>
        {dirty && <Tag color="orange">Chưa lưu</Tag>}
      </Flex>
      {menuWarning && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Trang chưa xuất bản nhưng đang có trong menu"
          description={`Mục menu ${page!.menuItems.map((m) => `"${m.menuName}: ${m.label}"`).join(', ')} đang bị ẩn khỏi website cho tới khi trang được xuất bản.`}
        />
      )}
      {saveError && <Alert type="error" showIcon closable={{ onClose: () => setSaveError('') }} style={{ marginBottom: 16 }} title="Chưa lưu được" description={saveError} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card>
            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề trang.' }, { max: 200, message: 'Tiêu đề tối đa 200 ký tự.' }]}>
              <Input className="post-editor__title" maxLength={200} placeholder="Ví dụ: Giới thiệu Khoa Công nghệ Phần mềm" />
            </Form.Item>
            <div id="page-content-label" style={{ marginBottom: 8 }}>Nội dung</div>
            <RichTextEditor
              key={editorKey}
              initial={content}
              editable={!saving}
              labelledBy="page-content-label"
              onReady={(doc) => {
                if (dirtyRef.current) return
                setContent(doc)
                savedRef.current = snap(form.getFieldsValue(true), doc)
              }}
              onChange={(doc) => {
                setContent(doc)
                setContentError('')
                markDirty(doc)
              }}
              onMediaAdded={(m: MediaDto) => setMedia((all) => ({ ...all, [m.id]: { id: m.id, kind: m.kind, name: m.name, altText: m.altText, url: m.url, videoId: videoIdOf(m) } }))}
            />
            {contentError && <div role="alert" style={{ color: 'var(--color-danger)', marginTop: 8 }}>{contentError}</div>}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Flex vertical gap={16}>
            <Card title="Xuất bản" size="small">
              <Form.Item name="status" label="Trạng thái" extra="Chỉ trang Đã xuất bản mới xem được công khai.">
                <Select options={(Object.keys(PAGE_STATUS) as PageStatus[]).map((s) => ({ value: s, label: PAGE_STATUS[s].label }))} />
              </Form.Item>
              <Form.Item name="publishedAt" label="Xuất bản lúc (giờ Việt Nam)" extra="Bỏ trống: xuất bản ngay khi lưu ở trạng thái Đã xuất bản.">
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Ngay khi xuất bản" />
              </Form.Item>
              <Form.Item
                name="expiresAt"
                label="Hết hiển thị lúc (giờ Việt Nam)"
                dependencies={['publishedAt']}
                rules={[({ getFieldValue }) => ({
                  validator: (_, v: Dayjs | null) => {
                    const pub = getFieldValue('publishedAt') as Dayjs | null
                    const from = pub ? vnPickerToUtc(pub) : new Date().toISOString()
                    return !v || vnPickerToUtc(v) > from ? Promise.resolve() : Promise.reject(new Error('Thời điểm hết hạn phải sau thời điểm xuất bản.'))
                  },
                })]}
              >
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Không hết hạn" />
              </Form.Item>
              {page && scheduleState(page) && (
                <div style={{ marginBottom: 12 }}><Tag color={SCHEDULE_LABEL[scheduleState(page)!].color}>{SCHEDULE_LABEL[scheduleState(page)!].label}</Tag></div>
              )}
              {page && <div className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 12 }}>Lưu lần cuối {formatDateTime(page.updatedAt)}</div>}
              <Flex wrap gap={8}>
                <Button type="primary" loading={saving} onClick={save}>Lưu</Button>
                <Button icon={<Eye size={16} />} onClick={() => setPreview(true)} disabled={false}>Xem trước</Button>
                {page?.status === 'published' && <Button href={`/pages/${page.slug}`} target="_blank" rel="noopener noreferrer" disabled={false}>Mở trang công khai</Button>}
              </Flex>
            </Card>
            <Card title="Đường dẫn" size="small">
              <Form.Item
                name="slug"
                label="Đường dẫn (slug)"
                extra={page ? `/pages/${page.slug}` : 'Bỏ trống để tự tạo từ tiêu đề.'}
                rules={[{ max: 200, message: 'Đường dẫn tối đa 200 ký tự.' }, { pattern: /^[a-z0-9-]*$/, message: 'Chỉ dùng chữ thường không dấu, chữ số và dấu gạch ngang.' }]}
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={200} autoCapitalize="none" spellCheck={false} />
              </Form.Item>
            </Card>
            <Card title="Có trong menu" size="small">
              {page?.menuItems.length ? (
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {page.menuItems.map((m) => <li key={m.id}>{m.menuName}: {m.label}</li>)}
                </ul>
              ) : (
                <span className="muted">Chưa có mục menu nào trỏ tới trang này.</span>
              )}
            </Card>
          </Flex>
        </Col>
      </Row>
      <Drawer open={preview} title="Xem trước" size={900} onClose={() => setPreview(false)} destroyOnHidden>
        <article className="post-article">
          <header className="post-article__header">
            <h1>{form.getFieldValue('title') || 'Chưa có tiêu đề'}</h1>
            {status !== 'published' && <p className="muted">Trang chưa xuất bản, người xem chưa thấy.</p>}
          </header>
          <RichText doc={content} media={media} />
        </article>
      </Drawer>
    </Form>
  )
}

export default function PageEditor() {
  return (
    <RequireRole roles={['admin']}>
      <PageEditorContent />
    </RequireRole>
  )
}
