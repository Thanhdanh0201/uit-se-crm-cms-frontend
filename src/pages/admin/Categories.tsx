import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Empty, Flex, Form, Input, InputNumber, Modal, Segmented, Select, Space, Switch, Table, Tag } from 'antd'
import { CaretDown, CaretRight, EyeSlash, Info, PencilSimple, Plus, Trash, Warning } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { findNode, flatten, subtreeIds, viSearchMatch } from '../../admin/tree'

export const meta = () => noIndex('Chuyên mục và thẻ')

// DTO theo backend: CategoryTreeDto (GET /api/admin/categories/tree), TagDto (GET /api/admin/tags).
export type Category = { id: string; parentId: string | null; name: string; slug: string; description: string | null; sortOrder: number; isVisible: boolean; postCount: number; children: Category[] }
type Tag = { id: string; name: string; slug: string; postCount: number }
type CategoryValues = { name: string; slug?: string; description?: string; parentId?: string | null; sortOrder: number; isVisible: boolean }
type TagValues = { name: string; slug?: string }

const SLUG = /^[a-z0-9-]+$/ // cùng quy tắc FluentValidation backend

// Gợi ý đường dẫn từ chữ có dấu: "Thông báo học vụ" -> "thong-bao-hoc-vu".
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const slugRule = (max: number) => ({
  validator: (_: unknown, v?: string) => {
    if (!v) return Promise.resolve()
    if (v.length > max) return Promise.reject(new Error(`Đường dẫn tối đa ${max} ký tự.`))
    if (SLUG.test(v)) return Promise.resolve()
    const hint = slugify(v)
    return Promise.reject(new Error(`Đường dẫn chỉ gồm chữ thường không dấu, chữ số và dấu gạch ngang.${hint ? ` Ví dụ: ${hint}` : ''}`))
  },
})

const errorMessage = (err: unknown) =>
  !(err instanceof ApiError) ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    : err.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
      : err.status === 404 ? 'Dữ liệu không còn tồn tại. Danh sách đã được tải lại.'
        : err.status >= 500 ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
          : err.message

// Gắn lỗi backend vào ô của form: validation (errors theo field) hoặc lỗi nghiệp vụ chỉ có detail (trùng slug, vòng lặp cha).
function applyError<T>(form: ReturnType<typeof Form.useForm<T>>[0], err: unknown, fields: Record<string, keyof T>, detailField: (msg: string) => keyof T | undefined): string {
  if (err instanceof ApiError && err.errors) {
    form.setFields(Object.entries(err.errors).flatMap(([k, errors]) => (fields[k.toLowerCase()] ? [{ name: fields[k.toLowerCase()] as never, errors }] : [])))
    return ''
  }
  if (err instanceof ApiError && err.status === 400) {
    const f = detailField(err.message)
    if (f) return form.setFields([{ name: f as never, errors: [err.message] }]), ''
  }
  return errorMessage(err)
}

// Giữ chuyên mục khớp từ khóa và các chuyên mục cha của nó, để vẫn thấy vị trí trong cây.
function filterTree(nodes: Category[], q: string): Category[] {
  if (!q) return nodes
  return nodes.flatMap((n) => {
    const children = filterTree(n.children, q)
    return n.name.toLowerCase().includes(q) || children.length ? [{ ...n, children }] : []
  })
}

// antd Table hiện nút mở rộng khi có mảng children, kể cả rỗng.
type Row = Omit<Category, 'children'> & { children?: Row[]; hiddenByParent: boolean }
const toRows = (nodes: Category[], parentHidden = false): Row[] =>
  nodes.map((n) => ({ ...n, hiddenByParent: parentHidden, children: n.children.length ? toRows(n.children, parentHidden || !n.isVisible) : undefined }))

function CategoriesTab({ keyword }: { keyword: string }) {
  const { message, modal } = App.useApp()
  const list = useListParams()
  const [tree, setTree] = useState<Category[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    const ctrl = new AbortController()
    setError('')
    api<Category[]>('/api/admin/categories/tree', { signal: ctrl.signal })
      .then(setTree)
      .catch((err) => !ctrl.signal.aborted && setError(errorMessage(err)))
    return () => ctrl.abort()
  }, [reloadKey])

  const rows = useMemo(() => toRows(filterTree(tree ?? [], keyword.toLowerCase())), [tree, keyword])
  const expandKeys = useMemo(() => flatten(tree ?? []).filter((f) => f.node.children.length).map((f) => f.node.id), [tree])
  const [collapsed, setCollapsed] = useState<string[]>([])

  async function toggle(c: Category) {
    if (busy) return
    setBusy(true)
    try {
      // Backend chưa có API bật/tắt riêng: gửi lại đủ trường hiện có.
      await api(`/api/admin/categories/${c.id}`, { method: 'PUT', json: { name: c.name, slug: c.slug, description: c.description, parentId: c.parentId, sortOrder: c.sortOrder, isVisible: !c.isVisible } })
      message.success(c.isVisible ? `Đã ẩn "${c.name}" khỏi website.` : `Đã hiện "${c.name}" trên website.`)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setBusy(false)
      reload()
    }
  }

  function onDelete(c: Category) {
    // Còn bài hoặc chuyên mục con: phải chọn nơi nhận. Không thì xác nhận thường.
    if (c.postCount > 0 || c.children.length > 0) return setDeleting(c)
    modal.confirm({
      title: `Xóa chuyên mục "${c.name}"?`,
      content: 'Chuyên mục chưa có bài viết. Đây là xóa mềm: dữ liệu còn trong cơ sở dữ liệu nhưng giao diện không có nút khôi phục.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/api/admin/categories/${c.id}`, { method: 'DELETE' })
          message.success(`Đã xóa chuyên mục "${c.name}".`)
        } catch (err) {
          message.error(errorMessage(err))
        }
        reload()
      },
    })
  }

  const editing = list.action === 'edit' && list.id && tree ? findNode(tree, list.id) ?? null : null

  return (
    <>
      <Flex gap={8} align="center" className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 12 }}>
        <Info size={14} aria-hidden style={{ flex: 'none' }} />
        Chuyên mục cha bị ẩn thì chuyên mục con cũng không hiện ở trang công khai. Xóa chuyên mục đang có bài hoặc có con phải chọn nơi nhận.
      </Flex>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách chuyên mục" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      <Table<Row>
        rowKey="id"
        size="middle"
        loading={!tree && !error}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowKeys: keyword ? flatten(rows as Category[]).map((f) => f.node.id) : expandKeys.filter((k) => !collapsed.includes(k)),
          onExpand: (open, r) => setCollapsed((c) => (open ? c.filter((k) => k !== r.id) : [...c, r.id])),
          expandIcon: ({ expanded, onExpand, record }) =>
            record.children ? (
              <button type="button" className="tree-toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Thu gọn' : 'Mở'} "${record.name}"`} onClick={(e) => onExpand(record, e)}>
                {expanded ? <CaretDown size={14} aria-hidden /> : <CaretRight size={14} aria-hidden />}
              </button>
            ) : (
              <span className="tree-toggle" aria-hidden />
            ),
        }}
        locale={{
          emptyText: error ? ' ' : keyword ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có chuyên mục khớp từ khóa."><Button onClick={() => list.update({ keyword: null })}>Xóa từ khóa</Button></Empty>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có chuyên mục nào."><Button type="primary" onClick={() => list.update({ action: 'create', id: null, parent: null })}>Thêm chuyên mục đầu tiên</Button></Empty>
          ),
        }}
        columns={[
          {
            title: 'Tên chuyên mục',
            key: 'name',
            render: (_, c) => (
              <div className={!c.isVisible || c.hiddenByParent ? 'muted' : undefined} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <Space size={6} wrap>
                  <span style={{ fontWeight: c.parentId ? 400 : 600 }}>{c.name}</span>
                  {!c.isVisible && <Tag>Đang ẩn</Tag>}
                  {c.isVisible && c.hiddenByParent && <EyeSlash size={14} aria-label="không hiện công khai" />}
                </Space>
                {c.isVisible && c.hiddenByParent && <div style={{ fontSize: 'var(--text-xs)' }}>Không hiện công khai vì chuyên mục cha đang ẩn</div>}
              </div>
            ),
          },
          { title: 'Đường dẫn', dataIndex: 'slug', render: (s: string) => <span className="muted">/categories/{s}</span> },
          { title: 'Số bài', dataIndex: 'postCount', align: 'right', width: 90 },
          { title: 'Thứ tự', dataIndex: 'sortOrder', align: 'right', width: 80 },
          {
            title: 'Hiển thị',
            key: 'visible',
            width: 90,
            render: (_, c) => <Switch size="small" checked={c.isVisible} disabled={busy} onChange={() => toggle(findNode(tree!, c.id)!)} aria-label={`${c.isVisible ? 'Ẩn' : 'Hiện'} chuyên mục "${c.name}"`} />,
          },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 130,
            render: (_, c) => (
              <Space size={2}>
                <Button type="text" size="small" icon={<Plus size={16} />} title="Thêm chuyên mục con" aria-label={`Thêm chuyên mục con cho "${c.name}"`} onClick={() => list.update({ action: 'create', id: null, parent: c.id })} />
                <Button type="text" size="small" icon={<PencilSimple size={16} />} title="Sửa" aria-label={`Sửa "${c.name}"`} onClick={() => list.update({ action: 'edit', id: c.id, parent: null })} />
                <Button type="text" size="small" danger icon={<Trash size={16} />} title="Xóa" aria-label={`Xóa "${c.name}"`} disabled={busy} onClick={() => onDelete(findNode(tree!, c.id)!)} />
              </Space>
            ),
          },
        ]}
      />
      {tree && (
        <CategoryDrawer
          tree={tree}
          open={list.action === 'create' || !!editing}
          editing={editing}
          parentId={list.params.get('parent')}
          onClose={() => list.update({ action: null, id: null, parent: null })}
          onSaved={() => (list.update({ action: null, id: null, parent: null }), reload())}
        />
      )}
      {tree && <DeleteCategoryModal tree={tree} category={deleting} onClose={() => setDeleting(null)} onDone={() => (setDeleting(null), reload())} />}
    </>
  )
}

const CATEGORY_FIELDS: Record<string, keyof CategoryValues> = { name: 'name', slug: 'slug', description: 'description', parentid: 'parentId', sortorder: 'sortOrder' }

function CategoryDrawer({ tree, open, editing, parentId, onClose, onSaved }: { tree: Category[]; open: boolean; editing: Category | null; parentId: string | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<CategoryValues>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parentOpen, setParentOpen] = useState(false)
  const name = Form.useWatch('name', form)

  useEffect(() => {
    if (!open) return
    setError('')
    setParentOpen(false)
    if (editing) form.setFieldsValue({ name: editing.name, slug: editing.slug, description: editing.description ?? '', parentId: editing.parentId, sortOrder: editing.sortOrder, isVisible: editing.isVisible })
    else form.setFieldsValue({ name: '', slug: '', description: '', parentId: parentId ?? undefined, sortOrder: (parentId ? findNode(tree, parentId)?.children.length ?? 0 : tree.length) + 1, isVisible: true })
  }, [open, editing, parentId, tree, form])

  const blocked = editing ? subtreeIds(editing) : new Set<string>()
  const options = [
    { value: '', label: 'Không có (chuyên mục gốc)' },
    ...flatten(tree, (c) => c.name).filter((f) => !blocked.has(f.node.id)).map((f) => ({ value: f.node.id, label: f.path.join(' / ') })),
  ]

  async function onFinish(v: CategoryValues) {
    if (busy) return
    setBusy(true)
    setError('')
    const body = { name: v.name.trim(), slug: v.slug?.trim() || null, description: v.description?.trim() || null, parentId: v.parentId?.trim() || null, sortOrder: v.sortOrder, isVisible: v.isVisible }
    try {
      if (editing) await api(`/api/admin/categories/${editing.id}`, { method: 'PUT', json: body })
      else await api('/api/admin/categories', { method: 'POST', json: body })
      message.success(editing ? 'Đã lưu chuyên mục.' : `Đã thêm chuyên mục "${body.name}".`)
      onSaved()
    } catch (err) {
      setError(applyError(form, err, CATEGORY_FIELDS, (m) => (/slug/i.test(m) ? (body.slug ? 'slug' : 'name') : /cha|vòng lặp/i.test(m) ? 'parentId' : undefined)))
      if (err instanceof ApiError && err.status === 404) onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      title={editing ? `Sửa chuyên mục "${editing.name}"` : 'Thêm chuyên mục'}
      size={480}
      onClose={onClose}
      footer={<Flex justify="flex-end" gap={8}><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={busy} onClick={() => form.submit()}>Lưu</Button></Flex>}
    >
      {error && <Alert type="error" showIcon title="Chưa lưu được" description={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish} disabled={busy} requiredMark>
        <Form.Item name="name" label="Tên chuyên mục" rules={[{ required: true, whitespace: true, message: 'Nhập tên chuyên mục.' }, { max: 150, message: 'Tên tối đa 150 ký tự.' }]}>
          <Input maxLength={150} placeholder="Ví dụ: Thông báo học vụ" />
        </Form.Item>
        <Form.Item
          name="slug"
          label="Đường dẫn (slug)"
          rules={[slugRule(150)]}
          extra={editing ? 'Bỏ trống để tự tạo từ tên. Đổi đường dẫn làm link cũ không còn dùng được.' : `Bỏ trống để tự tạo từ tên${name ? `: ${slugify(name)}` : ''}.`}
        >
          <Input maxLength={150} placeholder={name ? slugify(name) : 'thong-bao-hoc-vu'} />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ max: 500, message: 'Mô tả tối đa 500 ký tự.' }]}>
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
        <Form.Item name="parentId" label="Chuyên mục cha" extra="Mặc định là chuyên mục gốc. Không chọn được chính chuyên mục này và các chuyên mục con của nó.">
          <Select
            allowClear
            showSearch
            open={parentOpen}
            onOpenChange={setParentOpen}
            onClick={() => setParentOpen(true)}
            filterOption={(input, option) => viSearchMatch(input, String(option?.label ?? ''))}
            placeholder="Không có (chuyên mục gốc)"
            options={options}
            onChange={(val) => {
              form.setFieldValue('parentId', val)
              setParentOpen(false)
            }}
          />
        </Form.Item>
        <Form.Item name="sortOrder" label="Thứ tự hiển thị" extra="Số nhỏ hiện trước, trong cùng chuyên mục cha." rules={[{ required: true, message: 'Nhập thứ tự.' }, { type: 'number', min: 0, message: 'Thứ tự từ 0 trở lên.' }]}>
          <InputNumber min={0} precision={0} style={{ width: 120 }} />
        </Form.Item>
        <Flex gap={12} align="start" style={{ marginTop: 8 }}>
          <Form.Item name="isVisible" valuePropName="checked" noStyle>
            <Switch id="category-visible" />
          </Form.Item>
          <label htmlFor="category-visible">
            Hiển thị trên website
            <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>Ẩn thì chuyên mục con cũng không hiện công khai.</div>
          </label>
        </Flex>
      </Form>
    </Drawer>
  )
}

// Xóa an toàn (FR-CAT-04): chọn chuyên mục nhận bài và chuyên mục con, backend chuyển rồi xóa mềm trong một transaction.
function DeleteCategoryModal({ tree, category, onClose, onDone }: { tree: Category[]; category: Category | null; onClose: () => void; onDone: () => void }) {
  const { message } = App.useApp()
  const [target, setTarget] = useState<string | undefined>()
  const [targetOpen, setTargetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTarget(undefined)
    setTargetOpen(false)
    setError('')
  }, [category])

  if (!category) return null
  const blocked = subtreeIds(category)
  const targetName = flatten(tree).find((f) => f.node.id === target)?.node.name
  const kids = category.children.length

  async function submit() {
    if (!target) return setError('Chọn chuyên mục nhận bài viết và chuyên mục con.')
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/admin/categories/${category!.id}?targetCategoryId=${target}`, { method: 'DELETE' })
      message.success(`Đã chuyển sang "${targetName}" và xóa "${category!.name}".`)
      onDone()
    } catch (err) {
      // Không đóng hộp thoại, không đổi danh sách: người dùng chọn lại hoặc hủy.
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={`Xóa chuyên mục "${category.name}"?`}
      onCancel={onClose}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button danger icon={<Trash size={14} />} loading={busy} onClick={submit}>Chuyển và xóa</Button>
        </Flex>
      }
    >
      <Alert
        type="warning"
        showIcon
        icon={<Warning size={16} />}
        style={{ marginBottom: 16 }}
        title={`Chuyên mục đang có ${category.postCount} bài viết${kids ? ` và ${kids} chuyên mục con` : ''}`}
        description="Chọn chuyên mục nhận lại trước khi xóa. Bài viết và chuyên mục con được chuyển sang trong cùng một lần xử lý."
      />
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" disabled={busy}>
        <Form.Item label="Chuyển bài viết và chuyên mục con sang" required extra={`Không chọn được "${category.name}" và các chuyên mục con của nó.`}>
          <Select
            showSearch
            open={targetOpen}
            onOpenChange={setTargetOpen}
            onClick={() => setTargetOpen(true)}
            filterOption={(input, option) => viSearchMatch(input, String(option?.label ?? ''))}
            placeholder="Chọn chuyên mục nhận"
            value={target}
            onChange={(val) => {
              setTarget(val)
              setTargetOpen(false)
            }}
            options={flatten(tree, (c) => c.name).filter((f) => !blocked.has(f.node.id)).map((f) => ({ value: f.node.id, label: f.path.join(' / ') }))}
          />
        </Form.Item>
      </Form>
      <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: 0 }}>
        Bài có chuyên mục chính là "{category.name}" sẽ đổi chuyên mục chính sang "{targetName ?? '...'}". Đây là xóa mềm: dữ liệu còn trong cơ sở dữ liệu nhưng giao diện không có nút khôi phục.
      </p>
    </Modal>
  )
}

const TAG_FIELDS: Record<string, keyof TagValues> = { name: 'name', slug: 'slug' }

function TagsTab({ keyword }: { keyword: string }) {
  const { message, modal } = App.useApp()
  const list = useListParams(20)
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    const ctrl = new AbortController()
    setError('')
    api<Tag[]>('/api/admin/tags', { signal: ctrl.signal })
      .then(setTags)
      .catch((err) => !ctrl.signal.aborted && setError(errorMessage(err)))
    return () => ctrl.abort()
  }, [reloadKey])

  // ponytail: API thẻ chưa phân trang, lọc và chia trang ở máy. Khi số thẻ lớn thì cần backend thêm page/pageSize (NFR-02).
  const rows = useMemo(() => (tags ?? []).filter((t) => t.name.toLowerCase().includes(keyword.toLowerCase())), [tags, keyword])
  const editing = list.action === 'edit' && list.id ? tags?.find((t) => t.id === list.id) ?? null : null

  async function remove(t: Tag) {
    if (busy) return
    setBusy(true)
    try {
      await api(`/api/admin/tags/${t.id}`, { method: 'DELETE' })
      message.success(`Đã xóa thẻ "${t.name}".`)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setBusy(false)
      reload()
    }
  }

  function confirmDeleteTag(t: Tag) {
    modal.confirm({
      title: `Xóa thẻ "${t.name}"?`,
      content: t.postCount ? `Thẻ đang gắn với ${t.postCount} bài. Xóa thẻ sẽ gỡ thẻ khỏi các bài đó, bài viết không bị xóa.` : 'Thẻ chưa gắn với bài nào.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () => remove(t),
    })
  }

  return (
    <>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách thẻ" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      <Table<Tag>
        rowKey="id"
        size="middle"
        loading={!tags && !error}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        pagination={{ current: list.page, pageSize: list.pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (t) => `Tổng ${t} thẻ`, onChange: (page, pageSize) => list.update(pageSize !== list.pageSize ? { pageSize, page: 1 } : { page }) }}
        locale={{
          emptyText: error ? ' ' : keyword ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thẻ khớp từ khóa."><Button onClick={() => list.update({ keyword: null })}>Xóa từ khóa</Button></Empty>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thẻ nào."><Button type="primary" onClick={list.openCreate}>Thêm thẻ đầu tiên</Button></Empty>
          ),
        }}
        columns={[
          { title: 'Tên thẻ', dataIndex: 'name', render: (n: string) => <Tag>{n}</Tag> },
          { title: 'Đường dẫn', dataIndex: 'slug', render: (s: string) => <span className="muted">{s}</span> },
          { title: 'Số bài', dataIndex: 'postCount', align: 'right', width: 90 },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 100,
            render: (_, t) => (
              <Space size={2}>
                <Button type="text" size="small" icon={<PencilSimple size={16} />} title="Sửa" aria-label={`Sửa thẻ "${t.name}"`} onClick={() => list.openEdit(t.id)} />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash size={16} />}
                  disabled={busy}
                  title="Xóa thẻ"
                  aria-label={`Xóa thẻ "${t.name}"`}
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmDeleteTag(t)
                  }}
                />
              </Space>
            ),
          },
        ]}
      />
      <TagDrawer open={list.action === 'create' || !!editing} editing={editing} onClose={list.closeDrawer} onSaved={() => (list.closeDrawer(), reload())} />
    </>
  )
}

function TagDrawer({ open, editing, onClose, onSaved }: { open: boolean; editing: Tag | null; onClose: () => void; onSaved: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<TagValues>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = Form.useWatch('name', form)

  useEffect(() => {
    if (!open) return
    setError('')
    form.setFieldsValue({ name: editing?.name ?? '', slug: editing?.slug ?? '' })
  }, [open, editing, form])

  async function onFinish(v: TagValues) {
    if (busy) return
    setBusy(true)
    setError('')
    const body = { name: v.name.trim(), slug: v.slug?.trim() || null }
    try {
      if (editing) await api(`/api/admin/tags/${editing.id}`, { method: 'PUT', json: body })
      else await api('/api/admin/tags', { method: 'POST', json: body })
      message.success(editing ? 'Đã lưu thẻ.' : `Đã thêm thẻ "${body.name}".`)
      onSaved()
    } catch (err) {
      // Trùng: backend báo trùng slug. Không nhập slug thì slug tạo từ tên, nên báo ở ô tên.
      const dup = err instanceof ApiError && err.status === 400 && /tồn tại/i.test(err.message)
      if (dup) form.setFields([{ name: body.slug ? 'slug' : 'name', errors: [`Đã có thẻ dùng đường dẫn "${body.slug ?? slugify(body.name)}". Dùng thẻ đó hoặc đổi tên khác.`] }])
      else setError(applyError(form, err, TAG_FIELDS, () => undefined))
      if (err instanceof ApiError && err.status === 404) onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      title={editing ? `Sửa thẻ "${editing.name}"` : 'Thêm thẻ'}
      size={420}
      onClose={onClose}
      footer={<Flex justify="flex-end" gap={8}><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={busy} onClick={() => form.submit()}>Lưu</Button></Flex>}
    >
      {error && <Alert type="error" showIcon title="Chưa lưu được" description={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish} disabled={busy} requiredMark>
        <Form.Item name="name" label="Tên thẻ" rules={[{ required: true, whitespace: true, message: 'Nhập tên thẻ.' }, { max: 100, message: 'Tên tối đa 100 ký tự.' }]}>
          <Input maxLength={100} placeholder="Ví dụ: Học bổng" />
        </Form.Item>
        <Form.Item name="slug" label="Đường dẫn (slug)" rules={[slugRule(100)]} extra={`Bỏ trống để tự tạo từ tên${name ? `: ${slugify(name)}` : ''}.`}>
          <Input maxLength={100} placeholder={name ? slugify(name) : 'hoc-bong'} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

function CategoriesContent() {
  const list = useListParams()
  const tab = list.params.get('tab') === 'tags' ? 'tags' : 'categories'
  const isTags = tab === 'tags'
  return (
    <>
      <h1 className="admin-page-title">Chuyên mục và thẻ</h1>
      <Card
        title={
          <Segmented
            value={tab}
            aria-label="Chọn danh sách"
            options={[{ value: 'categories', label: 'Chuyên mục' }, { value: 'tags', label: 'Thẻ' }]}
            onChange={(v) => list.update({ tab: v === 'tags' ? 'tags' : null, keyword: null, action: null, id: null, parent: null })}
          />
        }
        extra={
          <Space wrap>
            <Input.Search
              key={tab + list.keyword}
              allowClear
              defaultValue={list.keyword}
              placeholder={isTags ? 'Tìm theo tên thẻ' : 'Tìm theo tên chuyên mục'}
              aria-label={isTags ? 'Tìm thẻ' : 'Tìm chuyên mục'}
              onSearch={(v) => list.update({ keyword: v.trim() })}
              style={{ width: 220 }}
            />
            <Button type="primary" icon={<Plus size={16} />} onClick={() => list.update({ action: 'create', id: null, parent: null })}>
              {isTags ? 'Thêm thẻ' : 'Thêm chuyên mục'}
            </Button>
          </Space>
        }
      >
        {isTags ? <TagsTab keyword={list.keyword} /> : <CategoriesTab keyword={list.keyword} />}
      </Card>
    </>
  )
}

export default function Categories() {
  return (
    <RequireRole roles={['admin']}>
      <CategoriesContent />
    </RequireRole>
  )
}
