import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, App, Button, Card, Descriptions, Empty, Flex, Input, Segmented, Skeleton, Space, Table, Tag } from 'antd'
import { ArrowLeft, DownloadSimple } from '@phosphor-icons/react'
import { api, download } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { formatDateTime } from '../../admin/posts'
import { EVENT_STATUS, eventErrorMessage, type EventDetail } from './Events'

export const meta = () => noIndex('Danh sách đăng ký')

// DTO theo backend RegistrationDto (SCRUM-21).
type Registration = { id: string; userId: string; fullName: string; username: string; status: 'active' | 'cancelled'; registeredAt: string; cancelledAt: string | null }
type RegPage = { items: Registration[]; totalItems: number; page: number; pageSize: number }

const STATUS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang đăng ký' },
  { value: 'cancelled', label: 'Đã hủy' },
]

// Danh sách đăng ký của một sự kiện (FR-EVT-04, SCRUM-57): tìm kiếm, lọc, xuất CSV từ server.
function EventRegistrationsContent() {
  const { id } = useParams()
  const { message } = App.useApp()
  const list = useListParams(20)
  const status = list.params.get('status') ?? 'all'
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [eventError, setEventError] = useState('')
  const [data, setData] = useState<RegPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    api<EventDetail>(`/api/admin/events/${id}`, { signal: ctrl.signal }).then(setEvent).catch((err) => !ctrl.signal.aborted && setEventError(eventErrorMessage(err)))
    return () => ctrl.abort()
  }, [id])

  useEffect(() => {
    const ctrl = new AbortController()
    const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) })
    if (status !== 'all') q.set('status', status)
    if (list.keyword) q.set('search', list.keyword)
    setLoading(true)
    setError('')
    api<RegPage>(`/api/admin/events/${id}/registrations?${q}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(eventErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [id, status, list.page, list.pageSize, list.keyword, reloadKey])

  // Xuất toàn bộ danh sách từ server, không ghép từ trang đang xem.
  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      const name = await download(`/api/admin/events/${id}/registrations/export`, 'dang-ky-su-kien.csv')
      message.success(`Đã tải ${name}.`)
    } catch (err) {
      setExportError(eventErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  if (eventError) return <Card><Alert type="error" showIcon title="Không mở được sự kiện" description={eventError} /></Card>

  return (
    <Flex vertical gap={16}>
      <Card
        title={
          <Flex align="center" gap={8}>
            <Link to="/admin/events" aria-label="Về danh sách sự kiện"><ArrowLeft size={18} aria-hidden /></Link>
            <span>{event?.title ?? 'Sự kiện'}</span>
            {event && <Tag color={EVENT_STATUS[event.status].color}>{EVENT_STATUS[event.status].label}</Tag>}
          </Flex>
        }
        extra={<Button type="primary" icon={<DownloadSimple size={16} />} loading={exporting} disabled={!event} onClick={exportCsv}>Xuất CSV</Button>}
      >
        {!event ? <Skeleton active paragraph={{ rows: 2 }} /> : (
          <Descriptions
            size="small"
            column={{ xs: 1, md: 3 }}
            items={[
              { key: 'start', label: 'Bắt đầu', children: formatDateTime(event.startAt) },
              { key: 'deadline', label: 'Hạn đăng ký', children: formatDateTime(event.registrationDeadline) },
              { key: 'count', label: 'Đã đăng ký', children: `${event.registeredCount}/${event.capacity}` },
            ]}
          />
        )}
        {exportError && <Alert type="error" showIcon style={{ marginTop: 12 }} title="Chưa xuất được CSV" description={exportError} closable={{ onClose: () => setExportError('') }} />}
      </Card>

      <Card
        title={<Segmented value={status} options={STATUS} aria-label="Lọc theo trạng thái đăng ký" onChange={(v) => list.update({ status: v === 'all' ? null : v })} />}
        extra={
          <Space>
            <Input.Search key={list.keyword} allowClear defaultValue={list.keyword} placeholder="Tìm theo họ tên, tên đăng nhập" aria-label="Tìm người đăng ký" onSearch={(v) => list.update({ keyword: v.trim() })} style={{ width: 260 }} />
          </Space>
        }
      >
        {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách đăng ký" description={error} action={<Button size="small" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>} />}
        <Table<Registration>
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          scroll={{ x: 680 }}
          locale={{ emptyText: error ? ' ' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={list.keyword || status !== 'all' ? 'Không có người đăng ký khớp bộ lọc.' : 'Chưa có ai đăng ký.'} /> }}
          pagination={{ current: list.page, pageSize: list.pageSize, total: data?.totalItems ?? 0, showTotal: (t) => `Tổng ${t} lượt đăng ký`, onChange: (page) => list.update({ page }) }}
          columns={[
            { title: 'Họ và tên', dataIndex: 'fullName' },
            { title: 'Tên đăng nhập', dataIndex: 'username' },
            { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (s: Registration['status']) => (s === 'active' ? <Tag color="green">Đang đăng ký</Tag> : <Tag>Đã hủy</Tag>) },
            { title: 'Đăng ký lúc', dataIndex: 'registeredAt', width: 150, render: (v: string) => formatDateTime(v) },
            { title: 'Hủy lúc', dataIndex: 'cancelledAt', width: 150, render: (v: string | null) => (v ? formatDateTime(v) : '') },
          ]}
        />
      </Card>
    </Flex>
  )
}

export default function EventRegistrations() {
  return (
    <RequireRole roles={['admin']}>
      <EventRegistrationsContent />
    </RequireRole>
  )
}
