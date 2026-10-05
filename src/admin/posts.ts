import { ApiError } from '../lib/api'
import type { Role } from '../lib/auth'
import { POST_STATUS, type PostStatus } from '../components/ui/Badge'

// DTO theo backend Business/DTOs/Posts/PostDtos.cs (SCRUM-15, 16).
export type { PostStatus }
export type Ref = { id: string; name: string }
// JSON Tiptap đã được backend lọc theo allowlist (Business/Services/RichTextContent.cs). Type dùng chung với renderer public.
export type { RichNode, ContentMedia as PostMedia } from '../components/PostArticle'
import type { RichNode, ContentMedia as PostMedia } from '../components/PostArticle'

export type PostListItem = {
  id: string
  title: string
  slug: string
  status: PostStatus
  author: Ref
  primaryCategory: Ref
  isFeatured: boolean
  priority: number
  reviewReason: string | null
  version: number
  publishedAt: string | null
  updatedAt: string
  allowedStatuses: PostStatus[]
}
export type PostPage = { items: PostListItem[]; totalItems: number; page: number; pageSize: number; totalPages: number }

export type PostDetail = Omit<PostListItem, 'primaryCategory'> & {
  summary: string
  content: RichNode
  primaryCategoryId: string
  categories: Ref[]
  tags: Ref[]
  cover: PostMedia | null
  media: Record<string, PostMedia>
  expiresAt: string | null
  createdAt: string
}

// Cùng dạng với trang chi tiết công khai: xem trước và trang public dùng chung một DTO.
export type PostView = {
  id: string
  slug: string
  title: string
  summary: string
  content: RichNode
  status: PostStatus
  cover: PostMedia | null
  media: Record<string, PostMedia>
  authorName: string
  category: Ref
  tags: Ref[]
  publishedAt: string | null
}

export type PostHistoryItem = { id: string; fromStatus: PostStatus | null; toStatus: PostStatus; reason: string | null; actor: Ref | null; createdAt: string }

export const STATUSES = Object.keys(POST_STATUS) as PostStatus[]
export const statusLabel = (s: PostStatus) => POST_STATUS[s].label
// Preset màu antd (design.md): không dùng success/error.
export const STATUS_COLOR: Record<PostStatus, string> = { draft: 'default', pending: 'blue', changes_requested: 'orange', published: 'green', archived: 'default' }

// Tên nút cho từng trạng thái đích. Danh sách trạng thái được phép lấy từ server (allowedStatuses).
export const ACTION_LABEL: Record<PostStatus, string> = {
  pending: 'Gửi duyệt',
  draft: 'Chuyển về nháp',
  published: 'Xuất bản',
  changes_requested: 'Yêu cầu chỉnh sửa',
  archived: 'Lưu trữ',
}

// Editor chỉ sửa bài của mình khi nháp hoặc yêu cầu chỉnh sửa; Admin sửa mọi bài. Server vẫn kiểm tra lại.
export function canEdit(post: { status: PostStatus; author: Ref }, me: { id: string; role: Role } | null): boolean {
  if (!me) return false
  if (me.role === 'admin') return true
  return post.author.id === me.id && (post.status === 'draft' || post.status === 'changes_requested')
}

const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))

export function postErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.code === 'version_conflict') return 'Bài đã được sửa ở nơi khác sau khi bạn mở. Tải lại để xem bản mới nhất.'
  // Lỗi nghiệp vụ (not_owner, post_locked, forbidden_transition, invalid_transition) có detail tiếng Việt rõ ràng.
  if (err.code) return err.message
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Bài viết không còn tồn tại.'
  if (err.status === 400 && err.errors) return Object.values(err.errors).flat().join(' ')
  if (err.status === 400) return err.message
  return 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}
