import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router'
import { Alert, App, Button, Card, Col, Drawer, Flex, Form, Input, Row, Select, Skeleton, Space, Tag } from 'antd'
import { Eye, ImageSquare, PaperPlaneTilt, X } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { PostArticle } from '../../components/PostArticle'
import { MediaPicker } from '../../admin/MediaPicker'
import { RichTextEditor, withMediaUrls } from '../../admin/RichTextEditor'
import type { MediaDto } from '../../admin/media'
import { canEdit, formatDateTime, postErrorMessage, STATUS_COLOR, statusLabel, type PostDetail, type PostMedia, type Ref, type RichNode } from '../../admin/posts'

export const meta = () => noIndex('Soạn bài viết')

type Values = { title: string; slug?: string; summary?: string; primaryCategoryId?: string; categoryIds: string[]; tagIds: string[] }
type Backup = { at: string; values: Values; content: RichNode; cover: PostMedia | null; media: Record<string, PostMedia> }

const EMPTY_DOC: RichNode = { type: 'doc', content: [{ type: 'paragraph' }] }
const EMPTY_VALUES: Values = { title: '', slug: '', summary: '', categoryIds: [], tagIds: [] }
const backupKey = (id: string | undefined) => `post-backup:${id ?? 'new'}`

// Ảnh chụp để so "có thay đổi chưa lưu". Bỏ đoạn trống cuối bài: Tiptap tự thêm khi bài kết thúc bằng ảnh,
// danh sách, trích dẫn... nên không tính là người dùng sửa.
// Giá trị form lấy theo thứ tự key cố định: antd trả object với thứ tự key khác nhau tùy lúc.
function snap(values: Partial<Values>, doc: RichNode, cover: PostMedia | null) {
  const c = [...(doc.content ?? [])]
  while (c.length && c[c.length - 1].type === 'paragraph' && !c[c.length - 1].content?.length) c.pop()
  const v = [values.title ?? '', values.slug ?? '', values.summary ?? '', values.primaryCategoryId ?? '', values.categoryIds ?? [], values.tagIds ?? []]
  return JSON.stringify({ v, c: { ...doc, content: c }, cv: cover?.id ?? null })
}

// Sao lưu bản đang soạn vào máy (localStorage), để không mất nội dung khi API lỗi, mất mạng hoặc hết phiên (SCRUM-40).
function readBackup(id: string | undefined): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id))
    return raw ? (JSON.parse(raw) as Backup) : null
  } catch {
    return null
  }
}
function writeBackup(id: string | undefined, b: Backup | null) {
  try {
    if (b) localStorage.setItem(backupKey(id), JSON.stringify(b))
    else localStorage.removeItem(backupKey(id))
  } catch {
    // Hết dung lượng hoặc bị chặn: bỏ qua, chỉ mất tính năng sao lưu.
  }
}

// Lỗi validation backend (key PascalCase) -> tên field của form.
const FIELD: Record<string, keyof Values> = { title: 'title', slug: 'slug', summary: 'summary', primarycategoryid: 'primaryCategoryId', categoryids: 'categoryIds', tagids: 'tagIds' }

export default function PostEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const { user: me } = useAuth()
  const [form] = Form.useForm<Values>()

  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [loadError, setLoadError] = useState('')
  const [content, setContent] = useState<RichNode>(EMPTY_DOC)
  // Đổi key để nạp lại nội dung vào trình soạn thảo (tải bài, khôi phục bản sao lưu).
  const [editorKey, setEditorKey] = useState(0)
  const [cover, setCover] = useState<PostMedia | null>(null)
  const [coverError, setCoverError] = useState('')
  const [contentError, setContentError] = useState('')
  const [media, setMedia] = useState<Record<string, PostMedia>>({})
  const [categories, setCategories] = useState<Ref[]>([])
  const [tags, setTags] = useState<Ref[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [backup, setBackup] = useState<Backup | null>(null)
  const [coverPicker, setCoverPicker] = useState(false)
  const [preview, setPreview] = useState(false)

  const savedRef = useRef('') // ảnh chụp lần lưu gần nhất, để biết có thay đổi chưa lưu
  const dirtyRef = useRef(false)
  const busyRef = useRef(false)
  const [dirty, setDirty] = useState(false)

  const editable = !post || canEdit(post, me)

  const snapshot = useCallback(
    (c = content, cv = cover) => snap(form.getFieldsValue(true), c, cv),
    [form, content, cover],
  )

  // Nạp bài từ server vào form và trình soạn thảo.
  const apply = useCallback(
    (p: PostDetail) => {
      const values: Values = {
        title: p.title,
        slug: p.slug,
        summary: p.summary,
        primaryCategoryId: p.primaryCategoryId,
        categoryIds: p.categories.map((c) => c.id).filter((c) => c !== p.primaryCategoryId),
        tagIds: p.tags.map((t) => t.id),
      }
      form.setFieldsValue(values)
      const doc = withMediaUrls(p.content, p.media)
      setPost(p)
      setMedia(p.media)
      setCover(p.cover)
      setContent(doc)
      setEditorKey((k) => k + 1)
      savedRef.current = snap(form.getFieldsValue(true), doc, p.cover)
      dirtyRef.current = false
      setDirty(false)
    },
    [form],
  )

  const load = useCallback(async () => {
    if (!id) {
      form.setFieldsValue(EMPTY_VALUES)
      savedRef.current = snap(form.getFieldsValue(true), EMPTY_DOC, null)
      setBackup(readBackup(undefined))
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const p = await api<PostDetail>(`/api/posts/${id}`)
      apply(p)
      // Bản sao lưu mới hơn bản trên server: có thể là lần lưu trước bị lỗi.
      const b = readBackup(id)
      setBackup(b && new Date(b.at) > new Date(p.updatedAt) ? b : null)
    } catch (err) {
      setLoadError(postErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id, apply, form])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api<Ref[]>('/api/admin/categories').then((c) => setCategories(c.map((x) => ({ id: x.id, name: x.name })))).catch(() => setCategories([]))
    api<Ref[]>('/api/admin/tags').then((t) => setTags(t.map((x) => ({ id: x.id, name: x.name })))).catch(() => setTags([]))
  }, [])

  // Có thay đổi: đánh dấu chưa lưu và sao lưu vào máy (trễ 800 ms để không ghi liên tục khi gõ).
  const onAnyChange = useCallback(
    (c = content, cv = cover) => {
      const isDirty = snapshot(c, cv) !== savedRef.current
      dirtyRef.current = isDirty
      setDirty(isDirty)
    },
    [snapshot, content, cover],
  )

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => writeBackup(id, { at: new Date().toISOString(), values: form.getFieldsValue(true), content, cover, media }), 800)
    return () => clearTimeout(t)
  }, [dirty, content, cover, media, id, form])

  // Cảnh báo khi rời trang mà chưa lưu: trong app (useBlocker) và khi đóng tab / F5 (beforeunload).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    modal.confirm({
      title: 'Rời trang khi chưa lưu?',
      content: 'Thay đổi chưa lưu vẫn còn trong bản sao lưu trên máy này, mở lại bài để khôi phục.',
      okText: 'Rời trang',
      cancelText: 'Ở lại',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
  }, [blocker, modal])
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function restoreBackup() {
    if (!backup) return
    form.setFieldsValue(backup.values)
    setCover(backup.cover)
    setMedia((m) => ({ ...m, ...backup.media }))
    setContent(backup.content)
    setEditorKey((k) => k + 1)
    setBackup(null)
    dirtyRef.current = true
    setDirty(true)
  }

  function discardBackup() {
    writeBackup(id, null)
    setBackup(null)
  }

  function showFieldErrors(err: unknown) {
    if (!(err instanceof ApiError) || !err.errors) return false
    const fields: { name: keyof Values; errors: string[] }[] = []
    for (const [key, errors] of Object.entries(err.errors)) {
      const k = key.toLowerCase()
      if (k === 'covermediaid') setCoverError(errors[0])
      else if (k === 'content') setContentError(errors[0])
      else if (FIELD[k]) fields.push({ name: FIELD[k], errors })
    }
    form.setFields(fields)
    return true
  }

  // Lưu nháp. Trả về bài đã lưu, hoặc null nếu lỗi (nội dung vẫn giữ nguyên trên màn hình và trong bản sao lưu).
  async function save(): Promise<PostDetail | null> {
    if (busyRef.current) return null
    let values: Values
    try {
      values = await form.validateFields()
    } catch {
      return null
    }
    busyRef.current = true
    setSaving(true)
    setSaveError('')
    setCoverError('')
    setContentError('')
    const body = {
      title: values.title.trim(),
      slug: values.slug?.trim() || null,
      summary: values.summary?.trim() ?? '',
      content,
      coverMediaId: cover?.id ?? null,
      primaryCategoryId: values.primaryCategoryId,
      categoryIds: values.categoryIds ?? [],
      tagIds: values.tagIds ?? [],
      ...(post && { version: post.version }),
    }
    try {
      const saved = post
        ? await api<PostDetail>(`/api/posts/${post.id}`, { method: 'PUT', json: body })
        : await api<PostDetail>('/api/posts', { method: 'POST', json: body })
      writeBackup(id, null)
      setBackup(null)
      apply(saved)
      message.success(post ? 'Đã lưu bài viết.' : 'Đã tạo bài nháp.')
      // Bài mới: sang URL sửa bài (dirtyRef đã về false trong apply nên không bị chặn).
      if (!post) navigate(`/admin/posts/${saved.id}/edit`, { replace: true })
      return saved
    } catch (err) {
      writeBackup(id, { at: new Date().toISOString(), values: form.getFieldsValue(true), content, cover, media })
      if (err instanceof ApiError && err.code === 'version_conflict') {
        const reload = await modal.confirm({
          title: 'Bài đã được sửa ở nơi khác',
          content: 'Tải lại bản mới nhất từ máy chủ? Nội dung bạn đang soạn vẫn nằm trong bản sao lưu trên máy này để khôi phục nếu cần.',
          okText: 'Tải lại',
          cancelText: 'Để sau',
        })
        if (reload) await load()
        else setSaveError(postErrorMessage(err))
      } else if (!showFieldErrors(err)) {
        setSaveError(postErrorMessage(err))
      }
      return null
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  async function submitForReview() {
    const saved = dirtyRef.current || !post ? await save() : post
    if (!saved) return
    busyRef.current = true
    setSaving(true)
    try {
      await api(`/api/posts/${saved.id}/status`, { method: 'POST', json: { toStatus: 'pending', version: saved.version } })
      dirtyRef.current = false
      message.success(`Đã gửi duyệt "${saved.title}".`)
      navigate('/admin/posts')
    } catch (err) {
      if (!showFieldErrors(err)) setSaveError(postErrorMessage(err))
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  if (loading) return <Card><Skeleton active /></Card>
  if (loadError) {
    return (
      <Card>
        <Alert type="error" showIcon title="Không mở được bài viết" description={loadError} action={<Button size="small" onClick={load}>Thử lại</Button>} />
      </Card>
    )
  }

  const canSubmit = !post || post.allowedStatuses.includes('pending')
  const categoryName = (cid?: string) => categories.find((c) => c.id === cid)?.name ?? null

  return (
    <Form form={form} layout="vertical" disabled={!editable || saving} onValuesChange={() => onAnyChange()} requiredMark initialValues={EMPTY_VALUES}>
      {!editable && post && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`Bài đang ở trạng thái "${statusLabel(post.status)}" nên bạn chỉ xem được.`}
          description={me?.role === 'editor' ? 'Biên tập viên chỉ sửa bài của mình khi bài là nháp hoặc bị yêu cầu chỉnh sửa.' : undefined}
        />
      )}
      {post?.status === 'changes_requested' && post.reviewReason && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Quản trị viên yêu cầu chỉnh sửa" description={post.reviewReason} />
      )}
      {backup && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`Có bản chưa lưu trên máy này (${formatDateTime(backup.at)})`}
          // Nút nằm dưới nội dung (không dùng action) để màn hẹp không bóp chữ thành cột.
          description={
            <Flex vertical gap={8} align="flex-start">
              Bản này được sao lưu khi lần lưu trước chưa thành công hoặc bạn rời trang khi chưa lưu.
              <Space wrap>
                <Button size="small" type="primary" onClick={restoreBackup}>Khôi phục</Button>
                <Button size="small" onClick={discardBackup}>Bỏ bản sao lưu</Button>
              </Space>
            </Flex>
          }
        />
      )}
      {saveError && <Alert type="error" showIcon closable={{ onClose: () => setSaveError('') }} style={{ marginBottom: 16 }} title="Chưa lưu được" description={saveError} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card>
            <Form.Item
              name="title"
              label="Tiêu đề"
              rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề bài viết.' }, { max: 200, message: 'Tiêu đề tối đa 200 ký tự.' }]}
            >
              <Input className="post-editor__title" maxLength={200} placeholder="Ví dụ: Thông báo nhận hồ sơ học bổng học kỳ 1" />
            </Form.Item>
            <div id="content-label" style={{ marginBottom: 8 }}>Nội dung</div>
            <RichTextEditor
              key={editorKey}
              initial={content}
              editable={editable && !saving}
              labelledBy="content-label"
              onReady={(doc) => {
                // Chưa sửa gì thì lấy bản chuẩn hóa làm mốc "đã lưu".
                if (dirtyRef.current) return
                setContent(doc)
                savedRef.current = snap(form.getFieldsValue(true), doc, cover)
              }}
              onChange={(doc) => {
                setContent(doc)
                setContentError('')
                onAnyChange(doc)
              }}
              onMediaAdded={(m: MediaDto) => setMedia((all) => ({ ...all, [m.id]: { id: m.id, kind: m.kind, name: m.name, altText: m.altText, url: m.url, videoId: null } }))}
            />
            {contentError && <div role="alert" style={{ color: 'var(--color-danger)', marginTop: 8 }}>{contentError}</div>}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Flex vertical gap={16}>
            <Card title="Xuất bản" size="small">
              <Flex vertical gap={12}>
                <div>
                  Trạng thái: <Tag color={STATUS_COLOR[post?.status ?? 'draft']}>{statusLabel(post?.status ?? 'draft')}</Tag>
                  {dirty && <Tag color="orange">Chưa lưu</Tag>}
                </div>
                {post && <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>Lưu lần cuối {formatDateTime(post.updatedAt)}</div>}
                <Flex wrap gap={8}>
                  <Button type="primary" loading={saving} disabled={!editable} onClick={save}>Lưu nháp</Button>
                  <Button icon={<Eye size={16} />} onClick={() => setPreview(true)} disabled={false}>Xem trước</Button>
                  {canSubmit && (
                    <Button icon={<PaperPlaneTilt size={16} />} disabled={!editable || saving} onClick={submitForReview}>Gửi duyệt</Button>
                  )}
                </Flex>
              </Flex>
            </Card>

            <Card title="Ảnh đại diện" size="small">
              {cover?.url ? (
                <Flex vertical gap={8}>
                  <img src={cover.url} alt={cover.altText ?? ''} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--radius-control)' }} />
                  <Flex gap={8}>
                    <Button size="small" disabled={!editable} onClick={() => setCoverPicker(true)}>Đổi ảnh</Button>
                    <Button size="small" icon={<X size={14} />} disabled={!editable} onClick={() => { setCover(null); onAnyChange(content, null) }}>Gỡ ảnh</Button>
                  </Flex>
                </Flex>
              ) : (
                <Button block icon={<ImageSquare size={16} />} disabled={!editable} onClick={() => setCoverPicker(true)}>Chọn ảnh từ thư viện</Button>
              )}
              {coverError && <div role="alert" style={{ color: 'var(--color-danger)', marginTop: 8 }}>{coverError}</div>}
            </Card>

            <Card title="Chuyên mục và thẻ" size="small">
              <Form.Item name="primaryCategoryId" label="Chuyên mục chính" rules={[{ required: true, message: 'Chọn chuyên mục chính.' }]}>
                <Select showSearch={{ optionFilterProp: 'label' }} placeholder="Chọn chuyên mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
              <Form.Item name="categoryIds" label="Chuyên mục khác" rules={[{ type: 'array', max: 4, message: 'Chọn tối đa 4 chuyên mục khác.' }]}>
                <Select mode="multiple" showSearch={{ optionFilterProp: 'label' }} placeholder="Không bắt buộc" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
              <Form.Item name="tagIds" label="Thẻ" rules={[{ type: 'array', max: 10, message: 'Chọn tối đa 10 thẻ.' }]} style={{ marginBottom: 0 }}>
                <Select mode="multiple" showSearch={{ optionFilterProp: 'label' }} placeholder="Không bắt buộc" options={tags.map((t) => ({ value: t.id, label: t.name }))} />
              </Form.Item>
            </Card>

            <Card title="Tóm tắt và đường dẫn" size="small">
              <Form.Item name="summary" label="Tóm tắt" extra="Hiện ở danh sách bài và khi chia sẻ lên mạng xã hội. Bắt buộc khi gửi duyệt." rules={[{ max: 500, message: 'Tóm tắt tối đa 500 ký tự.' }]}>
                <Input.TextArea maxLength={500} autoSize={{ minRows: 3, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="slug"
                label="Đường dẫn"
                extra={post ? `/posts/${post.slug}` : 'Bỏ trống để tự tạo từ tiêu đề.'}
                rules={[{ max: 200, message: 'Đường dẫn tối đa 200 ký tự.' }, { pattern: /^[a-z0-9-]*$/, message: 'Chỉ dùng chữ thường không dấu, chữ số và dấu gạch ngang.' }]}
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={200} autoCapitalize="none" spellCheck={false} />
              </Form.Item>
            </Card>
          </Flex>
        </Col>
      </Row>

      <MediaPicker
        open={coverPicker}
        kinds={['image']}
        title="Chọn ảnh đại diện"
        onCancel={() => setCoverPicker(false)}
        onSelect={(m) => {
          const c: PostMedia = { id: m.id, kind: m.kind, name: m.name, altText: m.altText, url: m.url, videoId: null }
          setCover(c)
          setCoverError('')
          setCoverPicker(false)
          onAnyChange(content, c)
        }}
      />

      <Drawer open={preview} title="Xem trước" size={900} onClose={() => setPreview(false)} destroyOnHidden>
        <PostArticle
          post={{
            title: form.getFieldValue('title') ?? '',
            summary: form.getFieldValue('summary') || null,
            content,
            cover,
            media,
            authorName: post?.author.name ?? me?.fullName ?? null,
            categoryName: categoryName(form.getFieldValue('primaryCategoryId')),
            publishedAt: post?.publishedAt ?? null,
          }}
        />
      </Drawer>
    </Form>
  )
}
