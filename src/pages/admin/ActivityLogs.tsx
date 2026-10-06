import { useEffect, useState } from 'react'
import { Alert, Button, Card, DatePicker, Empty, Flex, Select, Space, Table, Tag, Tooltip } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { formatDateTime } from '../../admin/posts'
import { vnPickerToUtc } from '../../admin/vnTime'

export const meta = () => noIndex('Nhật ký hoạt động')

// DTO theo backend Business/DTOs/Reports/ReportDtos.cs (SCRUM-23).
type LogRow = {
  id: number
  actor: { id: string; fullName: string; username: string } | null
  action: string
  actionLabel: string
  entityType: string
  entityLabel: string
  entityId: string
  changedFields: string[]
  createdAt: string
}
type LogPage = { items: LogRow[]; totalItems: number; page: number; pageSize: number }
type Option = { value: string; label: string }
type UserOption = { id: string; fullName: string; username: string }

// URL (ngày dạng YYYY-MM-DD theo giờ Việt Nam) -> query API (UTC). "Đến ngày" tính hết ngày đó.
export function logsQuery(p: URLSearchParams): string {
  const q = new URLSearchParams({ page: String(Number(p.get('page')) || 1), pageSize: String([20, 50].includes(Number(p.get('pageSize'))) ? p.get('pageSize') : 20) })
  for (const k of ['actorId', 'action', 'entityType']) if (p.get(k)) q.set(k, p.get(k)!)
  const from = p.get('from')
  const to = p.get('to')
  if (from && dayjs(from).isValid()) q.set('from', vnPickerToUtc(dayjs(from).startOf('day')))
  if (to && dayjs(to).isValid()) q.set('to', vnPickerToUtc(dayjs(to).startOf('day').add(1, 'day')))
  return q.toString()
}

// Nhật ký hoạt động (FR-LOG-02, AT-09, SCRUM-49). Chỉ đọc: không có nút sửa/xóa.
function ActivityLogsContent() {
  const list = useListParams(20)
  const p = list.params
  const query = logsQuery(p)
  const [data, setData] = useState<LogPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<{ actions: Option[]; entityTypes: Option[] }>({ actions: [], entityTypes: [] })
  const [users, setUsers] = useState<UserOption[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    api<LogPage>(`/api/admin/activity-logs?${query}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(err instanceof ApiError && err.status === 403 ? 'Bạn không có quyền xem nhật ký.' : 'Không tải được nhật ký. Kiểm tra kết nối rồi thử lại.')
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [query, reloadKey])

  // Bộ lọc tải riêng: lỗi chỉ làm trống ô chọn, bảng vẫn dùng được.
  useEffect(() => {
    api<{ actions: Option[]; entityTypes: Option[] }>('/api/admin/activity-logs/filters').then(setFilters).catch(() => {})
  }, [])

  function searchUsers(term: string) {
    const q = new URLSearchParams({ page: '1', pageSize: '20' })
    if (term.trim()) q.set('search', term.trim())
    api<{ items: UserOption[] }>(`/api/admin/users?${q}`).then((r) => setUsers(r.items)).catch(() => {})
  }
  useEffect(() => searchUsers(''), [])

  const range: [Dayjs | null, Dayjs | null] = [p.get('from') ? dayjs(p.get('from')) : null, p.get('to') ? dayjs(p.get('to')) : null]
  const filtered = ['actorId', 'action', 'entityType', 'from', 'to'].some((k) => p.get(k))

  return (
    <Card
      title="Nhật ký hoạt động"
      extra={
        <Space wrap>
          <Select
            allowClear
            showSearch={{ filterOption: false, onSearch: searchUsers }}
            placeholder="Người thực hiện"
            aria-label="Lọc theo người thực hiện"
            value={p.get('actorId') ?? undefined}
            onChange={(v) => list.update({ actorId: v ?? null })}
            options={users.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
            style={{ width: 220 }}
          />
          <Select allowClear placeholder="Hành động" aria-label="Lọc theo hành động" value={p.get('action') ?? undefined} onChange={(v) => list.update({ action: v ?? null })} options={filters.actions} style={{ width: 200 }} />
          <Select allowClear placeholder="Đối tượng" aria-label="Lọc theo đối tượng" value={p.get('entityType') ?? undefined} onChange={(v) => list.update({ entityType: v ?? null })} options={filters.entityTypes} style={{ width: 160 }} />
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={range}
            allowEmpty={[true, true]}
            placeholder={['Từ ngày', 'Đến ngày']}
            aria-label="Khoảng thời gian"
            onChange={(v) => list.update({ from: v?.[0]?.format('YYYY-MM-DD') ?? null, to: v?.[1]?.format('YYYY-MM-DD') ?? null })}
          />
          {filtered && <Button onClick={() => list.update({ actorId: null, action: null, entityType: null, from: null, to: null })}>Xóa bộ lọc</Button>}
        </Space>
      }
    >
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={error} action={<Button size="small" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>} />}
      <Table<LogRow>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 900 }}
        locale={{ emptyText: error ? ' ' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có nhật ký khớp bộ lọc.' : 'Chưa có nhật ký.'} /> }}
        pagination={{
          current: list.page,
          pageSize: list.pageSize,
          total: data?.totalItems ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [20, 50],
          showTotal: (t) => `Tổng ${t} bản ghi`,
          onChange: (page, pageSize) => list.update(pageSize !== list.pageSize ? { pageSize, page: 1 } : { page }),
        }}
        columns={[
          { title: 'Thời gian (giờ VN)', dataIndex: 'createdAt', width: 150, render: (v: string) => formatDateTime(v) },
          { title: 'Người thực hiện', key: 'actor', width: 200, render: (_, l) => (l.actor ? <span>{l.actor.fullName} <span className="muted">({l.actor.username})</span></span> : <span className="muted">Hệ thống</span>) },
          { title: 'Hành động', key: 'action', width: 200, render: (_, l) => <Tooltip title={l.action}><Tag color="blue">{l.actionLabel}</Tag></Tooltip> },
          {
            title: 'Đối tượng',
            key: 'entity',
            render: (_, l) => (
              <span>
                {l.entityLabel} <code className="muted" style={{ fontSize: 'var(--text-xs)' }}>{l.entityId.slice(0, 8)}</code>
              </span>
            ),
          },
          { title: 'Trường thay đổi', dataIndex: 'changedFields', render: (f: string[]) => (f.length ? <Flex wrap gap={4}>{f.map((x) => <Tag key={x}>{x}</Tag>)}</Flex> : <span className="muted">Không có</span>) },
        ]}
      />
    </Card>
  )
}

export default function ActivityLogs() {
  return (
    <RequireRole roles={['admin']}>
      <ActivityLogsContent />
    </RequireRole>
  )
}
