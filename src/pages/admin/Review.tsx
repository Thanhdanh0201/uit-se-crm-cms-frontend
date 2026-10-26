import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, Card, Empty, Flex, Input, Segmented, Table, Tag } from 'antd'
import { api } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { LOCALES, localeColor, localeLabel, parseLocale } from '../../admin/locale'
import { formatDateTime, postErrorMessage, STATUS_COLOR, statusLabel, type PostListItem, type PostPage, type PostStatus } from '../../admin/posts'

export const meta = () => noIndex('Duyệt bài')

// Hàng chờ duyệt mặc định; xem thêm bài đã xuất bản, lưu trữ để gỡ hoặc xuất bản lại.
const TABS: { value: PostStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'archived', label: 'Lưu trữ' },
]

function ReviewList() {
  const list = useListParams(20)
  const locale = parseLocale(list.params.get('locale'))
  const status = (TABS.find((t) => t.value === list.params.get('status'))?.value ?? 'pending') as PostStatus
  const [data, setData] = useState<PostPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    const q = new URLSearchParams({ status, locale, page: String(list.page), pageSize: String(list.pageSize) })
    if (list.keyword) q.set('search', list.keyword)
    setLoading(true)
    setError('')
    api<PostPage>(`/api/posts?${q}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(postErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [status, locale, list.page, list.pageSize, list.keyword, reloadKey])

  return (
    <Card
      title={
        <Flex gap={12} align="center" wrap>
          <Segmented
            value={locale}
            options={LOCALES}
            aria-label="Lọc theo ngôn ngữ"
            onChange={(v) => list.update({ locale: v === 'vi' ? null : v, page: 1 })}
          />
          <Segmented
            value={status}
            options={TABS}
            aria-label="Lọc theo trạng thái"
            onChange={(v) => list.update({ status: v === 'pending' ? null : v, page: 1 })}
          />
        </Flex>
      }
      extra={
        <Input.Search
          key={list.keyword}
          allowClear
          defaultValue={list.keyword}
          placeholder="Tìm theo tiêu đề"
          aria-label="Tìm bài viết"
          onSearch={(v) => list.update({ keyword: v.trim() })}
          style={{ width: 240 }}
        />
      }
    >
      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách" description={error} action={<Button size="small" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>} />
      )}
      <Table<PostListItem>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: error ? ' ' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={status === 'pending' ? 'Không có bài nào chờ duyệt.' : 'Không có bài nào.'} />,
        }}
        pagination={{
          current: list.page,
          pageSize: list.pageSize,
          total: data?.totalItems ?? 0,
          showTotal: (t) => `Tổng ${t} bài`,
          onChange: (page) => list.update({ page }),
        }}
        columns={[
          {
            title: 'Tiêu đề',
            key: 'title',
            render: (_, p) => (
              <div>
                <Tag color={localeColor(p.locale)} style={{ marginInlineEnd: 6 }}>{localeLabel(p.locale)}</Tag>
                <Link to={`/admin/review/${p.id}`}>{p.title}</Link>
              </div>
            ),
          },
          { title: 'Tác giả', key: 'author', render: (_, p) => p.author.name },
          { title: 'Chuyên mục', key: 'category', render: (_, p) => p.primaryCategory.name },
          { title: 'Trạng thái', dataIndex: 'status', render: (s: PostStatus) => <Tag color={STATUS_COLOR[s]}>{statusLabel(s)}</Tag> },
          {
            title: status === 'published' ? 'Xuất bản' : 'Cập nhật',
            key: 'at',
            render: (_, p) => formatDateTime(status === 'published' && p.publishedAt ? p.publishedAt : p.updatedAt),
          },
        ]}
      />
    </Card>
  )
}

export default function Review() {
  return (
    <RequireRole roles={['admin']}>
      <ReviewList />
    </RequireRole>
  )
}
