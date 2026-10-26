import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, App, Button, Card, Col, DatePicker, Empty, Flex, Form, Input, InputNumber, Modal, Popconfirm, Row, Skeleton, Switch, Tag, Timeline } from 'antd'
import { ArrowLeft } from '@phosphor-icons/react'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import type { Dayjs } from 'dayjs'
import { PostArticle } from '../../components/PostArticle'
import { SCHEDULE_LABEL, scheduleState, vnPickerToUtc } from '../../admin/vnTime'
import {
  ACTION_LABEL,
  formatDateTime,
  postErrorMessage,
  STATUS_COLOR,
  statusLabel,
  type PostDetail,
  type PostHistoryItem,
  type PostStatus,
} from '../../admin/posts'
import { localeColor, localeLabel } from '../../admin/locale'

export const meta = () => noIndex('Duyệt bài')

type PublishValues = { publishedAt?: Dayjs | null; expiresAt?: Dayjs | null }

function ReviewDetailContent() {
  const { id } = useParams()
  const { message } = App.useApp()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [history, setHistory] = useState<PostHistoryItem[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [dialog, setDialog] = useState<'publish' | 'changes' | null>(null)
  const [publishForm] = Form.useForm<PublishValues>()
  const [reasonForm] = Form.useForm<{ reason: string }>()
  const [featured, setFeatured] = useState({ isFeatured: false, priority: 0 })

  const load = useCallback(async () => {
    setError('')
    try {
      const [p, h] = await Promise.all([api<PostDetail>(`/api/posts/${id}`), api<PostHistoryItem[]>(`/api/posts/${id}/history`)])
      setPost(p)
      setHistory(h)
      setFeatured({ isFeatured: p.isFeatured, priority: p.priority })
    } catch (err) {
      setError(postErrorMessage(err))
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function change(toStatus: PostStatus, extra: { reason?: string; publishedAt?: string; expiresAt?: string } = {}) {
    if (!post || busy) return false
    setBusy(true)
    setActionError('')
    try {
      await api(`/api/posts/${post.id}/status`, { method: 'POST', json: { toStatus, version: post.version, ...extra } })
      message.success(
        toStatus === 'published' ? `Đã xuất bản "${post.title}".`
          : toStatus === 'changes_requested' ? `Đã gửi yêu cầu chỉnh sửa cho tác giả.`
            : `Đã chuyển "${post.title}" sang ${statusLabel(toStatus)}.`,
      )
      // Tải lại bài và lịch sử sau khi server xác nhận (không cập nhật lạc quan).
      await load()
      return true
    } catch (err) {
      setActionError(postErrorMessage(err))
      if (err instanceof ApiError && (err.status === 409 || err.code === 'invalid_transition')) await load()
      return false
    } finally {
      setBusy(false)
    }
  }

  async function onPublish(values: PublishValues) {
    const ok = await change('published', {
      ...(values.publishedAt && { publishedAt: vnPickerToUtc(values.publishedAt) }),
      ...(values.expiresAt && { expiresAt: vnPickerToUtc(values.expiresAt) }),
    })
    if (ok) {
      setDialog(null)
      publishForm.resetFields()
    }
  }

  async function onRequestChanges({ reason }: { reason: string }) {
    if (await change('changes_requested', { reason: reason.trim() })) {
      setDialog(null)
      reasonForm.resetFields()
    }
  }

  async function saveFeatured() {
    if (!post) return
    setBusy(true)
    try {
      await api(`/api/posts/${post.id}/featured`, { method: 'PUT', json: featured })
      message.success(featured.isFeatured ? 'Đã đặt bài nổi bật.' : 'Đã bỏ bài khỏi mục nổi bật.')
      await load()
    } catch (err) {
      message.error(postErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <Card><Alert type="error" showIcon title="Không mở được bài viết" description={error} action={<Button size="small" onClick={load}>Thử lại</Button>} /></Card>
  }
  if (!post || !history) return <Card><Skeleton active /></Card>

  const allowed = post.allowedStatuses
  const featuredChanged = featured.isFeatured !== post.isFeatured || featured.priority !== post.priority

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          title={
            <Flex align="center" gap={8} wrap>
              <Link to="/admin/review" aria-label="Về danh sách duyệt bài"><ArrowLeft size={18} aria-hidden /></Link>
              <span>Nội dung bài</span>
              <Tag color={localeColor(post.locale)}>{localeLabel(post.locale)}</Tag>
              <Tag color={STATUS_COLOR[post.status]}>{statusLabel(post.status)}</Tag>
            </Flex>
          }
        >
          <PostArticle
            post={{
              title: post.title,
              summary: post.summary || null,
              content: post.content,
              cover: post.cover,
              media: post.media,
              authorName: post.author.name,
              categoryName: post.categories.find((c) => c.id === post.primaryCategoryId)?.name ?? null,
              publishedAt: post.publishedAt,
            }}
          />
        </Card>
      </Col>

      <Col xs={24} lg={8}>
        <Flex vertical gap={16}>
          <Card title="Duyệt bài" size="small">
            {actionError && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={actionError} />}
            {post.status === 'changes_requested' && post.reviewReason && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Đã yêu cầu chỉnh sửa" description={post.reviewReason} />
            )}
            {allowed.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {post.status === 'draft' || post.status === 'changes_requested' ? 'Bài đang ở phía tác giả, chưa gửi duyệt.' : 'Không có thao tác nào cho trạng thái này.'}
              </p>
            ) : (
              <Flex wrap gap={8}>
                {allowed.includes('published') && (
                  <Button type="primary" loading={busy} onClick={() => setDialog('publish')}>{ACTION_LABEL.published}</Button>
                )}
                {allowed.includes('changes_requested') && (
                  <Button loading={busy} onClick={() => setDialog('changes')}>{ACTION_LABEL.changes_requested}</Button>
                )}
                {allowed.includes('archived') && (
                  <Popconfirm
                    title={`Lưu trữ "${post.title}"?`}
                    description="Bài bị gỡ khỏi trang công khai. Có thể xuất bản lại sau."
                    okText="Lưu trữ"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => change('archived')}
                  >
                    <Button danger loading={busy}>{ACTION_LABEL.archived}</Button>
                  </Popconfirm>
                )}
                {allowed.includes('draft') && (
                  <Popconfirm title="Chuyển bài về nháp?" description="Tác giả sửa tiếp được bài." okText="Chuyển về nháp" cancelText="Hủy" onConfirm={() => change('draft')}>
                    <Button loading={busy}>{ACTION_LABEL.draft}</Button>
                  </Popconfirm>
                )}
              </Flex>
            )}
          </Card>

          {post.publishedAt && (
            <Card title="Lịch hiển thị" size="small">
              <Flex vertical gap={6}>
                {scheduleState(post) && <div><Tag color={SCHEDULE_LABEL[scheduleState(post)!].color}>{SCHEDULE_LABEL[scheduleState(post)!].label}</Tag></div>}
                <div>Xuất bản: {formatDateTime(post.publishedAt)}</div>
                <div>Hết hạn: {post.expiresAt ? formatDateTime(post.expiresAt) : 'Không hết hạn'}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>Giờ Việt Nam (UTC+7)</div>
              </Flex>
            </Card>
          )}

          <Card title="Bài nổi bật" size="small">
            <Flex vertical gap={8}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch checked={featured.isFeatured} onChange={(v) => setFeatured((f) => ({ ...f, isFeatured: v }))} disabled={busy} />
                Hiện ở mục Tin nổi bật trên trang chủ
              </label>
              <label htmlFor="priority">Độ ưu tiên (số lớn hiện trước)</label>
              <InputNumber id="priority" min={0} max={1000} value={featured.priority} disabled={busy || !featured.isFeatured} onChange={(v) => setFeatured((f) => ({ ...f, priority: v ?? 0 }))} />
              <Button disabled={!featuredChanged} loading={busy} onClick={saveFeatured}>Lưu</Button>
            </Flex>
          </Card>

          <Card title="Lịch sử trạng thái" size="small">
            {history.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử." />
            ) : (
              <Timeline
                items={history.map((h) => ({
                  key: h.id,
                  color: h.toStatus === 'published' ? 'green' : h.toStatus === 'changes_requested' ? 'orange' : 'blue',
                  content: (
                    <div>
                      <div>
                        <strong>{h.actor?.name ?? 'Hệ thống'}</strong>{' '}
                        {h.fromStatus ? `chuyển từ ${statusLabel(h.fromStatus)} sang ${statusLabel(h.toStatus)}` : `tạo bài (${statusLabel(h.toStatus)})`}
                      </div>
                      {h.reason && <div>Lý do: {h.reason}</div>}
                      <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(h.createdAt)}</div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Flex>
      </Col>

      <Modal
        open={dialog === 'publish'}
        title={`Xuất bản "${post.title}"?`}
        okText="Xuất bản"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={() => publishForm.submit()}
        onCancel={() => setDialog(null)}
        destroyOnHidden
      >
        <p>Bài hiện trên trang công khai từ thời điểm xuất bản. Bỏ trống để xuất bản ngay. Giờ nhập là giờ Việt Nam (UTC+7).</p>
        <Form form={publishForm} layout="vertical" onFinish={onPublish}>
          <Form.Item name="publishedAt" label="Hẹn giờ xuất bản (giờ Việt Nam)">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Xuất bản ngay" />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="Hết hiển thị lúc (giờ Việt Nam)"
            dependencies={['publishedAt']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, v: Dayjs | null) => {
                  const pub = getFieldValue('publishedAt') as Dayjs | null
                  const from = pub ? vnPickerToUtc(pub) : new Date().toISOString()
                  return !v || vnPickerToUtc(v) > from ? Promise.resolve() : Promise.reject(new Error('Thời điểm hết hạn phải sau thời điểm xuất bản.'))
                },
              }),
            ]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Không hết hạn" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={dialog === 'changes'}
        title="Yêu cầu chỉnh sửa"
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={() => reasonForm.submit()}
        onCancel={() => setDialog(null)}
        destroyOnHidden
      >
        <Form form={reasonForm} layout="vertical" onFinish={onRequestChanges}>
          <Form.Item
            name="reason"
            label="Lý do"
            extra="Tác giả thấy lý do này ở danh sách bài và trong trình soạn thảo."
            rules={[{ required: true, whitespace: true, message: 'Nhập lý do để tác giả biết cần sửa gì.' }, { max: 1000, message: 'Lý do tối đa 1000 ký tự.' }]}
          >
            <Input.TextArea maxLength={1000} showCount autoSize={{ minRows: 3, maxRows: 8 }} placeholder="Ví dụ: Bổ sung địa điểm và thời hạn nộp hồ sơ." />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  )
}

export default function ReviewDetail() {
  return (
    <RequireRole roles={['admin']}>
      <ReviewDetailContent />
    </RequireRole>
  )
}
