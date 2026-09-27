// DTO TẠM cho GET /api/public/home (đề xuất, backend chưa có). Chốt với backend rồi sửa lại.
// Gộp một request để SSR trang chủ nhanh: bài nổi bật (FR-POST-07), bài mới, nhóm nội dung theo home_sections (FR-PUB-02), sự kiện sắp tới.

export type PostCard = {
  slug: string
  title: string
  summary: string | null
  coverUrl: string | null
  publishedAt: string
  categoryName: string | null
}

export type HomeSection = { title: string; categorySlug: string; posts: PostCard[] }

export type EventCard = {
  id: string
  title: string
  startAt: string
  venue: string
  registrationDeadline: string
  capacity: number
  registeredCount: number
}

export type HomeData = {
  featured: PostCard[]
  latest: PostCard[]
  sections: HomeSection[]
  events: EventCard[]
}

export const EMPTY_HOME: HomeData = { featured: [], latest: [], sections: [], events: [] }

export type EventStatus = { label: string; tone: 'success' | 'warning' | 'neutral' }

// Tính ở loader (server) để HTML server và client giống nhau khi hydrate.
export function eventStatus(e: EventCard, now = new Date()): EventStatus {
  if (now > new Date(e.registrationDeadline)) return { label: 'Hết hạn đăng ký', tone: 'neutral' }
  const left = e.capacity - e.registeredCount
  if (left <= 0) return { label: 'Đã đủ chỗ', tone: 'warning' }
  return { label: `Còn ${left} chỗ`, tone: 'success' }
}
