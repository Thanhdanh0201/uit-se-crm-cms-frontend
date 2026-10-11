import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Descriptions, Drawer, Empty, Flex, Form, Input, Modal, Pagination, Segmented, Skeleton, Space, Table } from 'antd'
import { ListBullets, Plus, SquaresFour, Trash, YoutubeLogo } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { MediaGrid, Thumb } from '../../admin/MediaGrid'
import { MediaUploader } from '../../admin/MediaUploader'
import {
  fieldErrors,
  formatSize,
  KIND_LABEL,
  MEDIA_PAGE_SIZE,
  mediaErrorMessage,
  mediaQuery,
  type MediaDto,
  type MediaKind,
  type MediaPage,
  type MediaUsages,
} from '../../admin/media'

export const meta = () => noIndex('Thư viện media')

const KINDS = [{ value: 'all', label: 'Tất cả' }, ...(Object.keys(KIND_LABEL) as MediaKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))]
const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
const STATUS_LABEL: Record<string, string> = { draft: 'Nháp', pending: 'Chờ duyệt', changes_requested: 'Yêu cầu chỉnh sửa', published: 'Đã xuất bản', archived: 'Lưu trữ' }

type MetaValues = { name: string; altText?: string; description?: string }
type VideoValues = { url: string; name: string; description?: string }

export default function Media() {
  const { message, modal } = App.useApp()
  const { user: me } = useAuth()
  const list = useListParams(MEDIA_PAGE_SIZE)
  const kind = list.params.get('kind') ?? 'all'
  const mine = list.params.get('mine') === '1'
  const view = list.params.get('view') === 'list' ? 'list' : 'grid'
  const action = list.params.get('action')
  const query = mediaQuery({ kind, search: list.keyword, mine, page: list.page })

  const [data, setData] = useState<MediaPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  const [form] = Form.useForm<MetaValues>()
  const [videoForm] = Form.useForm<VideoValues>()
  const [detail, setDetail] = useState<MediaDto | null>(null)
  const [usages, setUsages] = useState<MediaUsages | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploaded, setUploaded] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    api<MediaPage>(`/api/media?${query}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(mediaErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [query, reloadKey])

  // Mở chi tiết: lấy bản mới nhất (URL ký mới). Đang được dùng thì tải luôn danh sách nơi dùng để cảnh báo trước khi xóa.
  useEffect(() => {
    setDrawerError('')
    setUsages(null)
    if (action !== 'edit' || !list.id) {
      setDetail(null)
      return
    }
    const ctrl = new AbortController()
    setDetailLoading(true)
    api<MediaDto>(`/api/media/${list.id}`, { signal: ctrl.signal })
      .then(async (m) => {
        setDetail(m)
        form.setFieldsValue({ name: m.name, altText: m.altText ?? '', description: m.description ?? '' })
        if (m.usageCount > 0) setUsages(await api<MediaUsages>(`/api/media/${m.id}/usages`, { signal: ctrl.signal }))
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setDrawerError(mediaErrorMessage(err))
        if (err instanceof ApiError && err.status === 404) reload()
      })
      .finally(() => !ctrl.signal.aborted && setDetailLoading(false))
    return () => ctrl.abort()
  }, [action, list.id, form])

  const canEdit = !!detail && (me?.role === 'admin' || detail.createdBy.id === me?.id)

  function closeDrawer() {
    list.update({ action: null, id: null })
    form.resetFields()
    if (uploaded) reload()
    setUploaded(0)
  }

  async function onSave(values: MetaValues) {
    if (saving || !detail) return
    setDrawerError('')
    setSaving(true)
    try {
      const res = await api<MediaDto>(`/api/media/${detail.id}`, {
        method: 'PUT',
        json: { name: values.name.trim(), altText: values.altText?.trim() || null, description: values.description?.trim() || null },
      })
      setDetail(res)
      message.success(`Đã lưu thông tin "${res.name}".`)
      reload()
    } catch (err) {
      const fields = fieldErrors(err)
      form.setFields(fields as { name: keyof MetaValues; errors: string[] }[])
      setDrawerError(fields.length ? '' : mediaErrorMessage(err))
      if (err instanceof ApiError && err.status === 404) reload()
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!detail) return
    setSaving(true)
    setDrawerError('')
    try {
      await api(`/api/media/${detail.id}`, { method: 'DELETE' })
      message.success(`Đã xóa "${detail.name}".`)
      list.update({ action: null, id: null })
      reload()
    } catch (err) {
      // 409 media_in_use: có nơi vừa dùng tài nguyên này. Hiện danh sách từ server.
      if (err instanceof ApiError && err.code === 'media_in_use' && err.body?.usages) setUsages(err.body.usages as MediaUsages)
      setDrawerError(mediaErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function confirmDeleteMedia() {
    if (!detail) return
    modal.confirm({
      title: `Xóa "${detail.name}"?`,
      content: 'Tài nguyên bị gỡ khỏi thư viện và không khôi phục được file.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: onDelete,
    })
  }


  async function onAddVideo(values: VideoValues) {
    if (saving) return
    setSaving(true)
    setDrawerError('')
    try {
      const res = await api<MediaDto>('/api/media/videos', {
        method: 'POST',
        json: { url: values.url.trim(), name: values.name.trim(), description: values.description?.trim() || null },
      })
      message.success(`Đã thêm video "${res.name}".`)
      videoForm.resetFields()
      list.update({ action: null, id: null })
      reload()
    } catch (err) {
      const fields = fieldErrors(err)
      videoForm.setFields(fields as { name: keyof VideoValues; errors: string[] }[])
      // 422 video_url_not_allowed gắn vào ô URL.
      if (err instanceof ApiError && err.code === 'video_url_not_allowed') videoForm.setFields([{ name: 'url', errors: [err.message] }])
      else setDrawerError(fields.length ? '' : mediaErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = Boolean(list.keyword || kind !== 'all' || mine)
  const items = data?.items ?? []
  const usageList = usages ? [...usages.coverOf.map((u) => ({ ...u, where: 'Ảnh đại diện bài' })), ...usages.posts.map((u) => ({ ...u, where: 'Nội dung bài' })), ...usages.pages.map((u) => ({ ...u, where: 'Trang' }))] : []

  return (
    <Card
      title={<Segmented value={kind} options={KINDS} aria-label="Lọc theo loại" onChange={(v) => list.update({ kind: v === 'all' ? null : v })} />}
      extra={
        <Space wrap>
          <Checkbox checked={mine} onChange={(e) => list.update({ mine: e.target.checked ? 1 : null })}>Của tôi</Checkbox>
          <Input.Search
            key={list.keyword}
            allowClear
            defaultValue={list.keyword}
            placeholder="Tìm theo tên"
            aria-label="Tìm tài nguyên"
            onSearch={(v) => list.update({ keyword: v.trim() })}
            style={{ width: 220 }}
          />
          <Segmented
            value={view}
            aria-label="Kiểu hiển thị"
            onChange={(v) => list.update({ view: v === 'list' ? 'list' : null, page: list.page })}
            options={[
              { value: 'grid', icon: <SquaresFour size={16} aria-hidden />, title: 'Dạng lưới' },
              { value: 'list', icon: <ListBullets size={16} aria-hidden />, title: 'Dạng danh sách' },
            ]}
          />
          <Button icon={<YoutubeLogo size={16} />} title="Thêm video YouTube" aria-label="Thêm video YouTube" onClick={() => list.update({ action: 'video', id: null })} />
          <Button type="primary" icon={<Plus size={16} />} title="Tải lên" aria-label="Tải lên" onClick={() => list.update({ action: 'create', id: null })} />
        </Space>
      }
    >
      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được thư viện media" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />
      )}

      {!error && !loading && items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có tài nguyên khớp bộ lọc.' : 'Thư viện chưa có tài nguyên nào.'}>
          {filtered ? (
            <Button onClick={() => list.update({ keyword: null, kind: null, mine: null })}>Xóa bộ lọc</Button>
          ) : (
            <Button type="primary" onClick={() => list.update({ action: 'create', id: null })}>Tải lên tài nguyên đầu tiên</Button>
          )}
        </Empty>
      ) : view === 'grid' ? (
        loading && !data ? <Skeleton active /> : <div aria-busy={loading}><MediaGrid items={items} onSelect={(m) => list.openEdit(m.id)} onExpired={reload} /></div>
      ) : (
        <Table<MediaDto>
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={false}
          scroll={{ x: 'max-content' }}
          onRow={(m) => ({ onClick: () => list.openEdit(m.id) })}
          columns={[
            {
              title: 'Tên',
              key: 'name',
              render: (_, m) => (
                <Button type="link" style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); list.openEdit(m.id) }}>
                  {m.name}
                </Button>
              ),
            },
            { title: 'Loại', dataIndex: 'kind', render: (k: MediaKind) => KIND_LABEL[k] },
            { title: 'Dung lượng', dataIndex: 'sizeBytes', render: (v: number | null) => formatSize(v) },
            { title: 'Đang dùng', dataIndex: 'usageCount', align: 'right' },
            { title: 'Người tải', key: 'by', render: (_, m) => m.createdBy.fullName },
            { title: 'Ngày tải', dataIndex: 'createdAt', render: (v: string) => dateFmt.format(new Date(v)) },
          ]}
        />
      )}

      <Pagination
        style={{ marginTop: 16, justifyContent: 'flex-end' }}
        current={list.page}
        pageSize={MEDIA_PAGE_SIZE}
        total={data?.totalItems ?? 0}
        showSizeChanger={false}
        hideOnSinglePage
        showTotal={(t) => `Tổng ${t} tài nguyên`}
        onChange={(page) => list.update({ page })}
      />

      <Drawer open={action === 'create'} title="Tải lên tài nguyên" size={560} onClose={closeDrawer} destroyOnHidden>
        <MediaUploader onUploaded={() => setUploaded((n) => n + 1)} />
      </Drawer>

      <Drawer
        open={action === 'edit'}
        title="Chi tiết tài nguyên"
        size={520}
        onClose={closeDrawer}
        footer={
          canEdit && (
            <Flex justify="space-between" gap={8}>
              <Button
                danger
                icon={<Trash size={16} />}
                disabled={saving || usageList.length > 0}
                onClick={confirmDeleteMedia}
              >
                Xóa
              </Button>
              <Space>
                <Button onClick={closeDrawer}>Đóng</Button>
                <Button type="primary" loading={saving} onClick={() => form.submit()}>Lưu</Button>
              </Space>
            </Flex>
          )
        }
      >
        {drawerError && <Alert type="error" showIcon title={drawerError} style={{ marginBottom: 16 }} />}
        {detailLoading && <Skeleton active />}
        {detail && !detailLoading && (
          <>
            <div className="media-preview">
              <Thumb item={detail} />
            </div>
            {usageList.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={`Đang được dùng ở ${usageList.length} nơi, chưa xóa được`}
                description={
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {usageList.map((u) => (
                      <li key={u.where + u.id}>
                        {u.where}: {u.title}
                        {u.status ? ` (${STATUS_LABEL[u.status] ?? u.status})` : ''}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
            <Descriptions
              size="small"
              column={1}
              style={{ marginBottom: 16 }}
              items={[
                { key: 'kind', label: 'Loại', children: `${KIND_LABEL[detail.kind]}${detail.mimeType ? ` (${detail.mimeType})` : ''}` },
                ...(detail.sizeBytes ? [{ key: 'size', label: 'Dung lượng', children: formatSize(detail.sizeBytes) }] : []),
                { key: 'by', label: 'Người tải', children: detail.createdBy.fullName },
                { key: 'at', label: 'Ngày tải', children: dateFmt.format(new Date(detail.createdAt)) },
                {
                  key: 'link',
                  label: 'Đường dẫn',
                  children: (
                    <a href={detail.externalUrl ?? detail.url ?? undefined} target="_blank" rel="noopener noreferrer">
                      {detail.kind === 'video' ? 'Mở trên YouTube' : 'Mở file'}
                    </a>
                  ),
                },
              ]}
            />
            {!canEdit && <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Bạn chỉ xem được. Biên tập viên chỉ sửa hoặc xóa tài nguyên do mình tải lên." />}
          </>
        )}
        <Form form={form} layout="vertical" onFinish={onSave} disabled={saving || !canEdit} hidden={detailLoading || !detail}>
          <Form.Item name="name" label="Tên hiển thị" rules={[{ required: true, whitespace: true, message: 'Nhập tên tài nguyên.' }, { max: 200, message: 'Tên tối đa 200 ký tự.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          {detail?.kind === 'image' && (
            <Form.Item
              name="altText"
              label="Văn bản thay thế"
              extra="Mô tả nội dung ảnh cho người dùng trình đọc màn hình."
              rules={[{ required: true, whitespace: true, message: 'Ảnh phải có văn bản thay thế.' }, { max: 250, message: 'Văn bản thay thế tối đa 250 ký tự.' }]}
            >
              <Input maxLength={250} />
            </Form.Item>
          )}
          <Form.Item name="description" label="Mô tả" rules={[{ max: 500, message: 'Mô tả tối đa 500 ký tự.' }]}>
            <Input.TextArea maxLength={500} autoSize={{ minRows: 2, maxRows: 5 }} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        open={action === 'video'}
        title="Thêm video YouTube"
        okText="Thêm"
        cancelText="Hủy"
        confirmLoading={saving}
        onOk={() => videoForm.submit()}
        onCancel={() => { list.update({ action: null }); videoForm.resetFields(); setDrawerError('') }}
        destroyOnHidden
      >
        {drawerError && <Alert type="error" showIcon title={drawerError} style={{ marginBottom: 16 }} />}
        <Form form={videoForm} layout="vertical" onFinish={onAddVideo} disabled={saving}>
          <Form.Item
            name="url"
            label="Đường dẫn video"
            extra="Ví dụ: https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
            rules={[{ required: true, whitespace: true, message: 'Nhập đường dẫn video.' }, { type: 'url', message: 'Đường dẫn chưa đúng định dạng.' }]}
          >
            <Input type="url" inputMode="url" />
          </Form.Item>
          <Form.Item name="name" label="Tên video" rules={[{ required: true, whitespace: true, message: 'Nhập tên video.' }, { max: 200, message: 'Tên tối đa 200 ký tự.' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả" rules={[{ max: 500, message: 'Mô tả tối đa 500 ký tự.' }]}>
            <Input.TextArea maxLength={500} autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
