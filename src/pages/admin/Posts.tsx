import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, App, Button, Card, Checkbox, Empty, Input, Popconfirm, Segmented, Select, Space, Table, Tag } from 'antd'
import { CheckSquareOffset, Eye, PencilSimple, Plus, Star } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { viSearchMatch } from '../../admin/tree'
import { SCHEDULE_LABEL, scheduleState } from '../../admin/vnTime'
import {
  ACTION_LABEL,
  canEdit,
  formatDateTime,
  postErrorMessage,
  STATUS_COLOR,
  statusLabel,
  STATUSES,
  type PostListItem,
  type PostPage,
  type PostStatus,
  type Ref,
} from '../../admin/posts'

export const meta = () => noIndex('Bài viết')

const PAGE_SIZES = [10, 20, 50]
// Chuyển trạng thái làm ngay trong danh sách được. Xuất bản (hẹn giờ) và yêu cầu chỉnh sửa (lý do) làm ở trang duyệt.
const QUICK: PostStatus[] = ['pending', 'draft', 'archived']

// URL của trang -> query của GET /api/posts.
export function postsQuery(params: URLSearchParams): string {
  const q = new URLSearchParams()
  q.set('page', String(Number(params.get('page')) || 1))
  const size = Number(params.get('pageSize'))
  q.set('pageSize', String(PAGE_SIZES.includes(size) ? size : 20))
  const status = params.get('status')
  if (status && (STATUSES as string[]).includes(status)) q.set('status', status)
  const keyword = params.get('keyword')?.trim()
  if (keyword) q.set('search', keyword)
  const category = params.get('category')
  if (category) q.set('categoryId', category)
  if (params.get('mine') === '1') q.set('mine', 'true')
  return q.toString()
}

export default function Posts() {
  const { message } = App.useApp()
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const isAdmin = me?.role === 'admin'
  const list = useListParams(20)
  const status = list.params.get('status') ?? 'all'
  const category = list.params.get('category')
  const mine = list.params.get('mine') === '1'
  const query = postsQuery(list.params)

  const [data, setData] = useState<PostPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Ref[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    api<PostPage>(`/api/posts?${query}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(postErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [query, reloadKey])

  // Danh sách chuyên mục cho bộ lọc. Lỗi thì chỉ mất bộ lọc, danh sách bài vẫn dùng được.
  useEffect(() => {
    api<Ref[]>('/api/admin/categories')
      .catch(() => api<Ref[]>('/api/public/categories'))
      .then((items) => setCategories(items.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCategories([]))
  }, [])

  async function changeStatus(post: PostListItem, toStatus: PostStatus) {
    setBusyId(post.id)
    try {
      await api(`/api/posts/${post.id}/status`, { method: 'POST', json: { toStatus, version: post.version } })
      message.success(toStatus === 'pending' ? `Đã gửi duyệt "${post.title}".` : `Đã chuyển "${post.title}" sang ${statusLabel(toStatus)}.`)
      reload()
    } catch (err) {
      message.error(postErrorMessage(err))
      // Bài đã đổi ở nơi khác hoặc không còn: tải lại để thấy trạng thái thật.
      if (err instanceof ApiError && (err.status === 409 || err.status === 404 || err.code === 'invalid_transition')) reload()
    } finally {
      setBusyId(null)
    }
  }

  const filtered = Boolean(list.keyword || status !== 'all' || category || mine)

  return (
    <Card
      title={
        <Segmented
          value={status}
          aria-label="Lọc theo trạng thái"
          options={[{ value: 'all', label: 'Tất cả' }, ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]}
          onChange={(v) => list.update({ status: v === 'all' ? null : v })}
        />
      }
      extra={
        <Space wrap>
          {isAdmin && (
            <Checkbox checked={mine} onChange={(e) => list.update({ mine: e.target.checked ? 1 : null })}>
              Của tôi
            </Checkbox>
          )}
          <Select
            allowClear
            showSearch
            filterOption={(input, option) => viSearchMatch(input, String(option?.label ?? ''))}
            placeholder="Mọi chuyên mục"
            aria-label="Lọc theo chuyên mục"
            value={category ?? undefined}
            onChange={(v) => list.update({ category: v ?? null })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            style={{ width: 180 }}
          />
          <Input.Search
            key={list.keyword}
            allowClear
            defaultValue={list.keyword}
            placeholder="Tìm theo tiêu đề"
            aria-label="Tìm bài viết"
            onSearch={(v) => list.update({ keyword: v.trim() })}
            style={{ width: 220 }}
          />
          <Button type="primary" icon={<Plus size={16} />} title="Viết bài mới" aria-label="Viết bài mới" onClick={() => navigate('/admin/posts/new')} />
        </Space>
      }
    >
      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách bài viết" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />
      )}

      <Table<PostListItem>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: error ? ' ' : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có bài viết khớp bộ lọc.' : 'Chưa có bài viết nào.'}>
              {filtered ? (
                <Button onClick={() => list.update({ keyword: null, status: null, category: null, mine: null })}>Xóa bộ lọc</Button>
              ) : (
                <Button type="primary" onClick={() => navigate('/admin/posts/new')}>Viết bài đầu tiên</Button>
              )}
            </Empty>
          ),
        }}
        pagination={{
          current: list.page,
          pageSize: list.pageSize,
          total: data?.totalItems ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZES,
          showTotal: (t) => `Tổng ${t} bài viết`,
          onChange: (page, pageSize) => list.update(pageSize !== list.pageSize ? { pageSize, page: 1 } : { page }),
        }}
        columns={[
          {
            title: 'Tiêu đề',
            key: 'title',
            render: (_, p) => (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {p.isFeatured && <Star size={14} weight="fill" aria-label="Nổi bật" style={{ color: 'var(--color-warning)', marginInlineEnd: 4 }} />}
                  {canEdit(p, me) ? <Link to={`/admin/posts/${p.id}/edit`}>{p.title}</Link> : p.title}
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>/{p.slug}</div>
              </div>
            ),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 170,
            render: (s: PostStatus, p) => (
              <Space orientation="vertical" size={2}>
                <Tag color={STATUS_COLOR[s]}>{statusLabel(s)}</Tag>
                {(() => {
                  const st = scheduleState(p)
                  if (st === 'scheduled') return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>Hẹn giờ {formatDateTime(p.publishedAt!)}</span>
                  if (st === 'expired') return <Tag>{SCHEDULE_LABEL.expired.label}</Tag>
                  return null
                })()}
                {s === 'changes_requested' && p.reviewReason && (
                  <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>Lý do: {p.reviewReason}</span>
                )}
              </Space>
            ),
          },
          { title: 'Chuyên mục', key: 'category', render: (_, p) => p.primaryCategory.name },
          ...(isAdmin ? [{ title: 'Tác giả', key: 'author', render: (_: unknown, p: PostListItem) => p.author.name }] : []),
          { title: 'Cập nhật', dataIndex: 'updatedAt', width: 140, render: (v: string) => formatDateTime(v) },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 220,
            render: (_, p) => (
              <Space size={4} wrap>
                {canEdit(p, me) && (
                  <Button type="text" icon={<PencilSimple size={16} />} title="Sửa" aria-label={`Sửa ${p.title}`} onClick={() => navigate(`/admin/posts/${p.id}/edit`)} />
                )}
                <Button type="text" icon={<Eye size={16} />} title="Xem trước" aria-label={`Xem trước ${p.title}`} onClick={() => navigate(`/admin/posts/${p.id}/preview`)} />
                {isAdmin && (p.status === 'pending' || p.status === 'archived' || p.status === 'published') && (
                  <Button type="text" icon={<CheckSquareOffset size={16} />} title="Duyệt, xuất bản" aria-label={`Duyệt ${p.title}`} onClick={() => navigate(`/admin/review/${p.id}`)} />
                )}
                {p.allowedStatuses.filter((s) => QUICK.includes(s)).map((s) => (
                  <Popconfirm
                    key={s}
                    title={`${ACTION_LABEL[s]} "${p.title}"?`}
                    description={
                      s === 'pending'
                        ? 'Bài chuyển cho Quản trị viên duyệt. Trong lúc chờ duyệt bạn không sửa được bài.'
                        : s === 'archived'
                          ? 'Bài bị gỡ khỏi trang công khai.'
                          : 'Bài về trạng thái nháp để tiếp tục chỉnh sửa.'
                    }
                    okText={ACTION_LABEL[s]}
                    cancelText="Hủy"
                    okButtonProps={{ danger: s === 'archived' }}
                    onConfirm={() => changeStatus(p, s)}
                  >
                    <Button size="small" danger={s === 'archived'} loading={busyId === p.id}>
                      {ACTION_LABEL[s]}
                    </Button>
                  </Popconfirm>
                ))}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
