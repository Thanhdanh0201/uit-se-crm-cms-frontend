import type { ReactNode } from 'react'

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
