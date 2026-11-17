// DTO của GET /api/public/home (backend HomeViewDto, SCRUM-17). events để trống cho tới khi có API sự kiện.
// Gộp một request để SSR trang chủ nhanh: bài nổi bật (FR-POST-07), bài mới, nhóm nội dung theo home_sections (FR-PUB-02), sự kiện sắp tới.

import type { PostCard } from '../../components/PostList'
export type { PostCard }

// Slide đầu trang chủ (backend HomeSlideViewDto, SCRUM-64): chỉ slide đang hiện, đã sắp xếp. imageUrl là signed URL có hạn.
export type HomeSlide = { id: string; title: string; caption: string | null; imageUrl: string; imageAlt: string; linkUrl: string | null; buttonLabel: string | null }

export type HomeSection = { title: string; categorySlug: string | null; posts: PostCard[] }

// Sự kiện: type và nhãn trạng thái nằm ở events.data.ts (SCRUM-46), giữ export cũ cho nơi đang dùng.
import type { EventCard } from './events.data'
export { eventStatus, type EventCard, type EventStatus } from './events.data'

export type HomeData = {
  slides?: HomeSlide[]
  bottomSlides?: HomeSlide[]
  featured: PostCard[]
  latest: PostCard[]
  sections: HomeSection[]
  events: EventCard[]
}

export const EMPTY_HOME: HomeData = { slides: [], bottomSlides: [], featured: [], latest: [], sections: [], events: [] }
