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
  return 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

function ContactsContent() {
  const { message } = App.useApp()
  const list = useListParams(20)
  const status = list.params.get('status') ?? 'all'
  const classification = list.params.get('classification')
  const assigneeId = list.params.get('assignee')
  const [data, setData] = useState<ContactPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const [detail, setDetail] = useState<ContactDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [saving, setSaving] = useState(false)
  const [assignees, setAssignees] = useState<Ref[]>([])
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) })
    if (status !== 'all') q.set('status', status)
    if (classification) q.set('classification', classification)
    if (assigneeId) q.set('assigneeId', assigneeId)
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
  }, [status, classification, assigneeId, list.page, list.pageSize, list.keyword, reloadKey])

  // Admin đang hoạt động để giao việc (SCRUM-56). Lỗi thì chỉ mất bộ lọc/ô chọn, không chặn trang.
  useEffect(() => {
    api<Ref[]>('/api/admin/contact-requests/assignees').then(setAssignees).catch(() => setAssignees([]))
  }, [])

  useEffect(() => {
    setDetailError('')
    setNote('')
    setNoteError('')
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
  async function update(patch: { status?: ContactStatus; classification?: string; assigneeId?: string; clearAssignee?: boolean }, success: string) {
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

  // Ghi chú nội bộ: chỉ hiện sau khi server lưu, rồi hiện đúng danh sách từ server.
  async function addNote() {
    if (!detail || addingNote) return
    const text = note.trim()
    if (!text) return setNoteError('Nhập nội dung ghi chú.')
    if (text.length > 2000) return setNoteError('Ghi chú tối đa 2000 ký tự.')
    setAddingNote(true)
    setNoteError('')
    try {
      setDetail(await api<ContactDetail>(`/api/admin/contact-requests/${detail.id}/notes`, { method: 'POST', json: { note: text } }))
      setNote('')
      message.success('Đã thêm ghi chú.')
    } catch (err) {
      setNoteError(contactErrorMessage(err))
    } finally {
      setAddingNote(false)
    }
  }

  const filtered = Boolean(list.keyword || status !== 'all' || classification || assigneeId)

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
          <Select allowClear placeholder="Mọi người phụ trách" aria-label="Lọc theo người phụ trách" value={assigneeId ?? undefined} onChange={(v) => list.update({ assignee: v ?? null })} options={assignees.map((a) => ({ value: a.id, label: a.fullName }))} style={{ width: 190 }} />
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
        scroll={{ x: 1060 }}
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
          { title: 'Phụ trách', key: 'assignee', width: 160, render: (_, c) => c.assignee?.fullName ?? <span className="muted">Chưa giao</span> },
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
            <div>
              <label htmlFor="contact-assignee">Người phụ trách</label>
              <Select
                id="contact-assignee"
                style={{ width: '100%' }}
                allowClear
                placeholder="Chưa giao"
                value={detail.assignee?.id}
                disabled={saving}
                onChange={(v?: string) => update(v ? { assigneeId: v } : { clearAssignee: true }, v ? `Đã giao cho ${assignees.find((a) => a.id === v)?.fullName ?? 'người phụ trách'}.` : 'Đã bỏ người phụ trách.')}
                options={assignees.map((a) => ({ value: a.id, label: a.fullName }))}
              />
            </div>

            <div>
              <h3 style={{ fontSize: 'var(--text-base)', margin: '8px 0' }}>Ghi chú nội bộ</h3>
              <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 0 }}>Chỉ quản trị viên thấy, người gửi không thấy.</p>
              <label htmlFor="contact-note" className="visually-hidden">Nội dung ghi chú</label>
              <Input.TextArea
                id="contact-note"
                value={note}
                maxLength={2000}
                autoSize={{ minRows: 2, maxRows: 6 }}
                placeholder="Ví dụ: Đã gọi điện hướng dẫn nộp hồ sơ."
                status={noteError ? 'error' : undefined}
                aria-invalid={!!noteError}
                aria-describedby={noteError ? 'contact-note-error' : undefined}
                disabled={addingNote}
                onChange={(e) => { setNote(e.target.value); setNoteError('') }}
              />
              {noteError && <div id="contact-note-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{noteError}</div>}
              <Flex justify="flex-end" style={{ marginTop: 8 }}>
                <Button loading={addingNote} onClick={addNote}>Thêm ghi chú</Button>
              </Flex>
              {detail.notes.length === 0 ? (
                <p className="muted" style={{ marginBottom: 0 }}>Chưa có ghi chú.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Danh sách ghi chú">
                  {detail.notes.map((n) => (
                    <li key={n.id} style={{ padding: 10, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border)' }}>
                      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.note}</div>
                      <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>{n.author.fullName} · {formatDateTime(n.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
