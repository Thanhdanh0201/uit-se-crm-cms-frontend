import { ApiError } from '../lib/api'

// DTO theo backend Business/DTOs/Media/MediaDtos.cs.
export type MediaKind = 'image' | 'document' | 'video'
export type MediaDto = {
  id: string
  kind: MediaKind
  name: string
  description: string | null
  altText: string | null
  mimeType: string | null
  sizeBytes: number | null
  externalUrl: string | null
  url: string | null
  thumbnailUrl: string | null
  urlExpiresAt: string | null
  usageCount: number
  createdAt: string
  createdBy: { id: string; fullName: string }
}
export type MediaPage = { items: MediaDto[]; totalItems: number; page: number; pageSize: number; totalPages: number }
export type MediaUsageItem = { id: string; title: string; status: string | null }
export type MediaUsages = { coverOf: MediaUsageItem[]; posts: MediaUsageItem[]; pages: MediaUsageItem[]; total: number }

export const KIND_LABEL: Record<MediaKind, string> = { image: 'Ảnh', document: 'Tài liệu', video: 'Video' }
export const MEDIA_PAGE_SIZE = 24

// Cùng danh sách với MediaConstants.AllowedExtensions của backend. Server vẫn kiểm tra lại cả nội dung file.
const EXT_KIND: Record<string, MediaKind> = {
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.pdf': 'document',
  '.docx': 'document',
  '.xlsx': 'document',
}
export const ACCEPT = Object.keys(EXT_KIND).join(',')
export const MAX_BYTES = 10 * 1024 * 1024

const sizeFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${sizeFmt.format(bytes / 1024)} KB`
  return `${sizeFmt.format(bytes / 1024 / 1024)} MB`
}

// Kiểm tra trước ở client cho UX (AT-05). Trả loại media hoặc lý do từ chối.
export function checkFile(file: { name: string; size: number }): { kind: MediaKind } | { error: string } {
  const dot = file.name.lastIndexOf('.')
  const kind = dot >= 0 ? EXT_KIND[file.name.slice(dot).toLowerCase()] : undefined
  if (!kind) return { error: 'Chỉ nhận ảnh JPG, PNG, WebP hoặc tài liệu PDF, DOCX, XLSX.' }
  if (file.size === 0) return { error: 'File rỗng, không có nội dung.' }
  if (file.size > MAX_BYTES) return { error: `File ${formatSize(file.size)}, vượt giới hạn 10 MB.` }
  return { kind }
}

// Tên mặc định lấy từ tên file, bỏ phần mở rộng.
export const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

export function mediaErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  // Lỗi nghiệp vụ của media (415, 413, 409, 422, 403 not_owner) có detail tiếng Việt rõ ràng từ backend.
  if (err.code) return err.message
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Tài nguyên không còn tồn tại. Danh sách đã được tải lại.'
  if (err.status === 413) return 'File vượt giới hạn 10 MB.'
  if (err.status === 400) return err.message
  return 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

// Lỗi validation backend (key PascalCase) -> lỗi dưới từng ô antd Form.
export function fieldErrors(err: unknown) {
  if (!(err instanceof ApiError) || !err.errors) return []
  return Object.entries(err.errors).map(([key, errors]) => ({ name: key[0].toLowerCase() + key.slice(1), errors }))
}

// Bộ lọc -> query của GET /api/media. Dùng chung cho trang Thư viện media và bộ chọn media.
export function mediaQuery(f: { kind?: string | null; search?: string | null; mine?: boolean; page?: number }): string {
  const q = new URLSearchParams({ page: String(f.page || 1), pageSize: String(MEDIA_PAGE_SIZE) })
  if (f.kind && f.kind in KIND_LABEL) q.set('kind', f.kind)
  if (f.search?.trim()) q.set('search', f.search.trim())
  if (f.mine) q.set('mine', 'true')
  return q.toString()
}
