import type { ReactNode } from 'react'
import { CONTACT_STATUS_LABEL } from '../../admin/labels'

export type Tone = 'neutral' | 'brand' | 'solid' | 'success' | 'warning' | 'danger'

export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}

// Trạng thái bài viết (SRS 5.1). Một nguồn cho nhãn và màu, dùng ở mọi danh sách bài.
export type PostStatus = 'draft' | 'pending' | 'changes_requested' | 'published' | 'archived'

export const POST_STATUS: Record<PostStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Nháp', tone: 'neutral' },
  pending: { label: 'Chờ duyệt', tone: 'brand' },
  changes_requested: { label: 'Yêu cầu chỉnh sửa', tone: 'warning' },
  published: { label: 'Đã xuất bản', tone: 'success' },
  archived: { label: 'Lưu trữ', tone: 'neutral' },
}

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const s = POST_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

// Trạng thái yêu cầu liên hệ (FR-CON-02). Nhãn dùng chung với trang quản trị.
export type ContactStatus = keyof typeof CONTACT_STATUS_LABEL

export const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: Tone }> = {
  new: { label: CONTACT_STATUS_LABEL.new, tone: 'brand' },
  in_progress: { label: CONTACT_STATUS_LABEL.in_progress, tone: 'warning' },
  resolved: { label: CONTACT_STATUS_LABEL.resolved, tone: 'success' },
  closed: { label: CONTACT_STATUS_LABEL.closed, tone: 'neutral' },
}

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const s = CONTACT_STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return <Badge tone={s.tone}>{s.label}</Badge>
}
