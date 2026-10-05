import { ApiError } from '../lib/api'

export type CategoryTreeDto = {
  id: string
  parentId: string | null
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isVisible: boolean
  postCount: number
  children: CategoryTreeDto[]
}

export type CategoryListItemDto = {
  id: string
  parentId: string | null
  parentName?: string | null
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isVisible: boolean
  postCount: number
  createdAt: string
  updatedAt: string
}

export type CategoryDetailDto = {
  id: string
  parentId: string | null
  parentName?: string | null
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isVisible: boolean
  postCount: number
  childrenCount: number
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export type CreateCategoryInput = {
  name: string
  slug?: string
  description?: string
  parentId?: string | null
  sortOrder?: number
  isVisible?: boolean
}

export type UpdateCategoryInput = {
  name: string
  slug?: string
  description?: string
  parentId?: string | null
  sortOrder?: number
  isVisible?: boolean
}

export type TagDto = {
  id: string
  name: string
  slug: string
  postCount: number
}

export type CreateTagInput = {
  name: string
  slug?: string
}

export type UpdateTagInput = {
  name: string
  slug?: string
}

// Chuẩn hóa slug tiếng Việt tương thích SlugHelper backend.
export function generateSlug(input: string): string {
  if (!input) return ''
  return input
    .trim()
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function categoryErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Chuyên mục không tồn tại hoặc đã bị xóa.'
  if (err.code === 'category_in_use' || err.code === 'category_has_posts' || err.message?.includes('bài viết')) {
    return 'Chuyên mục đang có bài viết hoặc chuyên mục con. Vui lòng chọn chuyên mục đích để chuyển giao.'
  }
  if (err.code === 'slug_taken' || err.code === 'duplicate_slug') {
    return 'Đường dẫn (slug) đã tồn tại trong hệ thống. Vui lòng chọn đường dẫn khác.'
  }
  if (err.code === 'invalid_parent') return 'Không thể chọn chính nó hoặc cây con của nó làm chuyên mục cha.'
  if (err.status === 400 && err.message) return err.message
  return err.message || 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

export function tagErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Thẻ không tồn tại hoặc đã bị xóa.'
  if (err.code === 'slug_taken' || err.code === 'duplicate_slug') {
    return 'Đường dẫn (slug) của thẻ đã tồn tại. Vui lòng chọn đường dẫn khác.'
  }
  if (err.status === 400 && err.message) return err.message
  return err.message || 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

// Tìm toàn bộ ID con cháu của một node trong cây chuyên mục (dùng để chặn chọn làm cha hoặc nơi chuyển bài).
export function findCategoryDescendantIds(tree: CategoryTreeDto[], targetId: string): Set<string> {
  const result = new Set<string>()

  function collect(node: CategoryTreeDto) {
    result.add(node.id)
    node.children?.forEach(collect)
  }

  function traverse(nodes: CategoryTreeDto[]) {
    for (const node of nodes) {
      if (node.id === targetId) {
        node.children?.forEach(collect)
        return true
      }
      if (node.children?.length && traverse(node.children)) return true
    }
    return false
  }

  traverse(tree)
  return result
}

// Làm phẳng cây chuyên mục kèm depth
export function flattenCategoryTree(nodes: CategoryTreeDto[], currentDepth: number = 1): (CategoryTreeDto & { depth: number })[] {
  const list: (CategoryTreeDto & { depth: number })[] = []
  function walk(items: CategoryTreeDto[], depth: number) {
    for (const item of items) {
      list.push({ ...item, depth })
      if (item.children?.length) walk(item.children, depth + 1)
    }
  }
  walk(nodes, currentDepth)
  return list
}
