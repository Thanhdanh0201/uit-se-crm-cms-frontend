import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Empty, Flex, Input, Segmented, Select, Skeleton, Space, Table, Tag } from 'antd'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useListParams } from '../../lib/useListParams'
import { formatDateTime } from '../../admin/posts'

export const meta = () => noIndex('Liên hệ')

// DTO theo backend Business/DTOs/Contacts/ContactDtos.cs (SCRUM-22).
export type ContactStatus = 'new' | 'in_progress' | 'resolved' | 'closed'
type Ref = { id: string; fullName: string }
export type ContactRow = {
  id: string
  senderName: string
  senderEmail: string
  subject: string
  status: ContactStatus
  classification: string | null
  assignee: Ref | null
  userId: string | null
  createdAt: string
  updatedAt: string
}
export type ContactNote = { id: string; note: string; author: Ref; createdAt: string }
export type ContactDetail = ContactRow & { message: string; notes: ContactNote[] }
type ContactPage = { items: ContactRow[]; totalItems: number; page: number; pageSize: number }

export const CONTACT_STATUS: Record<ContactStatus, { label: string; color: string }> = {
  new: { label: 'Mới', color: 'blue' },
  in_progress: { label: 'Đang xử lý', color: 'orange' },
  resolved: { label: 'Đã giải quyết', color: 'green' },
  closed: { label: 'Đóng', color: 'default' },
}
export const CLASSIFICATION: Record<string, string> = {
  academic: 'Học vụ',
  admission: 'Tuyển sinh',
  event: 'Sự kiện',
  technical: 'Kỹ thuật, website',
  feedback: 'Góp ý',
  other: 'Khác',
}

export function contactErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Yêu cầu không còn tồn tại. Danh sách đã được tải lại.'
  if (err.status === 400) return err.errors ? Object.values(err.errors).flat().join(' ') : err.message
  return err.message || 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

function ContactsContent() {
  const { message } = App.useApp()
  const list = useListParams(20)
  const status = list.params.get('status') ?? 'all'
  const classification = list.params.get('classification')
  const [data, setData] = useState<ContactPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const [detail, setDetail] = useState<ContactDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) })
    if (status !== 'all') q.set('status', status)
    if (classification) q.set('classification', classification)
    if (list.keyword) q.set('search', list.keyword)
    setLoading(true)
    setError('')
    api<ContactPage>(`/api/admin/contact-requests?${q}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(contactErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [status, classification, list.page, list.pageSize, list.keyword, reloadKey])

  useEffect(() => {
    setDetailError('')
    if (list.action !== 'edit' || !list.id) {
      setDetail(null)
      return
    }
    const ctrl = new AbortController()
    setDetail(null)
    api<ContactDetail>(`/api/admin/contact-requests/${list.id}`, { signal: ctrl.signal })
      .then(setDetail)
      .catch((err) => !ctrl.signal.aborted && setDetailError(contactErrorMessage(err)))
    return () => ctrl.abort()
  }, [list.action, list.id])

  // Chỉ đổi giao diện sau khi server xác nhận; tải lại danh sách để cột trạng thái khớp.
  async function update(patch: { status?: ContactStatus; classification?: string }, success: string) {
    if (!detail || saving) return
    setSaving(true)
    try {
      setDetail(await api<ContactDetail>(`/api/admin/contact-requests/${detail.id}`, { method: 'PATCH', json: patch }))
      message.success(success)
      reload()
    } catch (err) {
      message.error(contactErrorMessage(err))
      if (err instanceof ApiError && err.status === 404) reload()
    } finally {
      setSaving(false)
    }
  }

  const filtered = Boolean(list.keyword || status !== 'all' || classification)

  return (
    <Card
      title={
        <Segmented
          value={status}
          aria-label="Lọc theo trạng thái"
          options={[{ value: 'all', label: 'Tất cả' }, ...(Object.keys(CONTACT_STATUS) as ContactStatus[]).map((s) => ({ value: s, label: CONTACT_STATUS[s].label }))]}
          onChange={(v) => list.update({ status: v === 'all' ? null : v })}
        />
      }
      extra={
        <Space wrap>
          <Select allowClear placeholder="Mọi phân loại" aria-label="Lọc theo phân loại" value={classification ?? undefined} onChange={(v) => list.update({ classification: v ?? null })} options={Object.entries(CLASSIFICATION).map(([value, label]) => ({ value, label }))} style={{ width: 170 }} />
          <Input.Search key={list.keyword} allowClear defaultValue={list.keyword} placeholder="Tìm theo người gửi, email, chủ đề" aria-label="Tìm liên hệ" onSearch={(v) => list.update({ keyword: v.trim() })} style={{ width: 260 }} />
        </Space>
      }
    >
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="Không tải được danh sách liên hệ" description={error} action={<Button size="small" onClick={reload}>Thử lại</Button>} />}
      <Table<ContactRow>
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        scroll={{ x: 900 }}
        onRow={(c) => ({ onClick: () => list.openEdit(c.id), style: { cursor: 'pointer' } })}
        locale={{ emptyText: error ? ' ' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có yêu cầu khớp bộ lọc.' : 'Chưa có yêu cầu liên hệ nào.'} /> }}
        pagination={{ current: list.page, pageSize: list.pageSize, total: data?.totalItems ?? 0, showTotal: (t) => `Tổng ${t} yêu cầu`, onChange: (page) => list.update({ page }) }}
        columns={[
          {
            title: 'Chủ đề',
            key: 'subject',
            render: (_, c) => (
              <div>
                <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 500 }} onClick={(e) => { e.stopPropagation(); list.openEdit(c.id) }}>{c.subject}</Button>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{c.senderName} · {c.senderEmail}{c.userId ? '' : ' · Khách'}</div>
              </div>
            ),
          },
          { title: 'Phân loại', dataIndex: 'classification', width: 150, render: (v: string | null) => (v ? CLASSIFICATION[v] ?? v : <span className="muted">Chưa phân loại</span>) },
          { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (s: ContactStatus) => <Tag color={CONTACT_STATUS[s].color}>{CONTACT_STATUS[s].label}</Tag> },
          { title: 'Gửi lúc', dataIndex: 'createdAt', width: 150, render: (v: string) => formatDateTime(v) },
        ]}
      />

      <Drawer open={list.action === 'edit'} title="Chi tiết liên hệ" size={560} onClose={list.closeDrawer}>
        {detailError && <Alert type="error" showIcon title={detailError} />}
        {!detail && !detailError && <Skeleton active />}
        {detail && (
          <Flex vertical gap={16}>
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'from', label: 'Người gửi', children: `${detail.senderName}${detail.userId ? '' : ' (khách)'}` },
                { key: 'email', label: 'Email', children: <a href={`mailto:${detail.senderEmail}`}>{detail.senderEmail}</a> },
                { key: 'at', label: 'Gửi lúc', children: formatDateTime(detail.createdAt) },
                { key: 'subject', label: 'Chủ đề', children: detail.subject },
              ]}
            />
            {/* Nội dung người dùng nhập: hiển thị dạng chữ (React tự mã hóa), giữ xuống dòng. */}
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 12, borderRadius: 'var(--radius-control)', background: 'var(--color-surface-muted)' }}>{detail.message}</div>
            <Flex gap={12} wrap>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="contact-status">Trạng thái xử lý</label>
                <Select id="contact-status" style={{ width: '100%' }} value={detail.status} disabled={saving} onChange={(v: ContactStatus) => update({ status: v }, `Đã chuyển sang ${CONTACT_STATUS[v].label}.`)} options={(Object.keys(CONTACT_STATUS) as ContactStatus[]).map((s) => ({ value: s, label: CONTACT_STATUS[s].label }))} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="contact-class">Phân loại</label>
                <Select id="contact-class" style={{ width: '100%' }} allowClear placeholder="Chưa phân loại" value={detail.classification ?? undefined} disabled={saving} onChange={(v?: string) => update({ classification: v ?? '' }, 'Đã cập nhật phân loại.')} options={Object.entries(CLASSIFICATION).map(([value, label]) => ({ value, label }))} />
              </div>
            </Flex>
          </Flex>
        )}
      </Drawer>
    </Card>
  )
}

export default function Contacts() {
  return (
    <RequireRole roles={['admin']}>
      <ContactsContent />
    </RequireRole>
  )
}
