import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, App, Button, Card, Empty, Input, Popconfirm, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import { ArrowSquareOut, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { formatDateTime } from '../../admin/posts'

export const meta = () => noIndex('Trang tĩnh')

// DTO theo backend Business/DTOs/Pages/PageDtos.cs (SCRUM-17).
export type PageStatus = 'draft' | 'published' | 'archived'
type PageRow = { id: string; title: string; slug: string; status: PageStatus; menuItemCount: number; publishedAt: string | null; updatedAt: string }
type PagesPage = { items: PageRow[]; totalItems: number; page: number; pageSize: number }
type MenuRef = { id: string; label: string; menuName: string }

export const PAGE_STATUS: Record<PageStatus, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'default' },
  published: { label: 'Đã xuất bản', color: 'green' },
  archived: { label: 'Lưu trữ', color: 'default' },
}

export function pageErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.code) return err.message // page_in_menu... có detail tiếng Việt
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Trang không còn tồn tại. Danh sách đã được tải lại.'
  if (err.status === 400) return err.errors ? Object.values(err.errors).flat().join(' ') : err.message
  return 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

function StaticPagesContent() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const list = useListParams(20)
  const status = list.params.get('status') ?? 'all'
  const [data, setData] = useState<PagesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    const ctrl = new AbortController()
    const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) })
    if (status !== 'all') q.set('status', status)
    if (list.keyword) q.set('search', list.keyword)
    setLoading(true)
    setError('')
    api<PagesPage>(`/api/admin/pages?${q}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(pageErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [status, list.page, list.pageSize, list.keyword, reloadKey])

  async function remove(row: PageRow) {
    setBusyId(row.id)
    try {
      await api(`/api/admin/pages/${row.id}`, { method: 'DELETE' })
      message.success(`Đã xóa trang "${row.title}".`)
      reload()
    } catch (err) {
      // 409 page_in_menu: liệt kê mục menu đang trỏ tới để admin đổi menu trước.
      const items = err instanceof ApiError && err.code === 'page_in_menu' ? (err.body?.menuItems as MenuRef[] | undefined) : undefined
      if (items?.length) {
        modal.warning({
          title: 'Chưa xóa được trang',
          content: (
            <div>
              <p>{pageErrorMessage(err)}</p>
              <ul style={{ paddingInlineStart: 18, margin: 0 }}>
                {items.map((m) => <li key={m.id}>{m.menuName}: {m.label}</li>)}
              </ul>
            </div>
          ),
          okText: 'Đã hiểu',
        })
      } else {
        message.error(pageErrorMessage(err))
        if (err instanceof ApiError && err.status === 404) reload()
      }
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
          options={[{ value: 'all', label: 'Tất cả' }, ...(Object.keys(PAGE_STATUS) as PageStatus[]).map((s) => ({ value: s, label: PAGE_STATUS[s].label }))]}
          onChange={(v) => list.update({ status: v === 'all' ? null : v })}
        />
      }
      extra={
        <Space wrap>
          <Input.Search
            key={list.keyword}
            allowClear
            defaultValue={list.keyword}
            placeholder="Tìm theo tiêu đề"
            aria-label="Tìm trang"
            onSearch={(v) => list.update({ keyword: v.trim() })}
            style={{ width: 240 }}
          />
          <Tooltip title="Thêm trang">
            <Button type="primary" icon={<Plus size={16} />} aria-label="Thêm trang" onClick={() => navigate('/admin/pages/new')} />
          </Tooltip>
        </Space>
      }
    >
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách trang" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      <Table<PageRow>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 760 }}
        locale={{
          emptyText: error ? ' ' : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có trang khớp bộ lọc.' : 'Chưa có trang tĩnh nào.'}>
              {!filtered && <Button type="primary" onClick={() => navigate('/admin/pages/new')}>Tạo trang đầu tiên</Button>}
            </Empty>
          ),
        }}
        pagination={{
          current: list.page,
          pageSize: list.pageSize,
          total: data?.totalItems ?? 0,
          showTotal: (t) => `Tổng ${t} trang`,
          onChange: (page) => list.update({ page }),
        }}
        columns={[
          {
            title: 'Tiêu đề',
            key: 'title',
            render: (_, p) => (
              <div>
                <Link to={`/admin/pages/${p.id}/edit`} style={{ fontWeight: 500 }}>{p.title}</Link>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>/pages/{p.slug}</div>
              </div>
            ),
          },
          { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (s: PageStatus) => <Tag color={PAGE_STATUS[s].color}>{PAGE_STATUS[s].label}</Tag> },
          {
            title: 'Trong menu',
            dataIndex: 'menuItemCount',
            width: 120,
            render: (n: number, p) =>
              n === 0 ? <span className="muted">Không</span> : p.status === 'published' ? `${n} mục` : (
                <Tooltip title="Trang chưa xuất bản nhưng có trong menu: người xem bấm vào sẽ gặp trang không tồn tại.">
                  <Tag color="orange">{n} mục, chưa xuất bản</Tag>
                </Tooltip>
              ),
          },
          { title: 'Cập nhật', dataIndex: 'updatedAt', width: 150, render: (v: string) => formatDateTime(v) },
          {
            title: '',
            key: 'actions',
            align: 'right',
            width: 132,
            render: (_, p) => (
              <Space size={4}>
                <Tooltip title="Sửa">
                  <Button type="text" icon={<PencilSimple size={16} />} aria-label={`Sửa ${p.title}`} onClick={() => navigate(`/admin/pages/${p.id}/edit`)} />
                </Tooltip>
                {p.status === 'published' && (
                  <Tooltip title="Mở trang công khai">
                    <Button type="text" icon={<ArrowSquareOut size={16} />} aria-label={`Mở trang công khai ${p.title}`} href={`/pages/${p.slug}`} target="_blank" rel="noopener noreferrer" />
                  </Tooltip>
                )}
                <Popconfirm
                  title={`Xóa trang "${p.title}"?`}
                  description={p.menuItemCount ? `Trang đang có trong ${p.menuItemCount} mục menu, cần đổi menu trước.` : 'Trang bị gỡ khỏi website.'}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove(p)}
                >
                  <Button type="text" danger icon={<Trash size={16} />} loading={busyId === p.id} aria-label={`Xóa ${p.title}`} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}

export default function StaticPages() {
  return (
    <RequireRole roles={['admin']}>
      <StaticPagesContent />
    </RequireRole>
  )
}
