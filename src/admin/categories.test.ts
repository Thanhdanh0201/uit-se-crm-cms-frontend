import { describe, expect, test } from 'vitest'
import {
  categoryErrorMessage,
  findCategoryDescendantIds,
  flattenCategoryTree,
  generateSlug,
  SLUG_PATTERN,
  type CategoryTreeDto,
} from './categories'
import { ApiError } from '../lib/api'

const sampleCategoryTree: CategoryTreeDto[] = [
  {
    id: 'c1',
    name: 'Tin tức & Sự kiện',
    slug: 'tin-tuc-su-kien',
    description: null,
    parentId: null,
    sortOrder: 1,
    isVisible: true,
    postCount: 5,
    children: [
      {
        id: 'c1-1',
        name: 'Hoạt động sinh viên',
        slug: 'hoat-dong-sinh-vien',
        description: null,
        parentId: 'c1',
        sortOrder: 1,
        isVisible: true,
        postCount: 2,
        children: [
          {
            id: 'c1-1-1',
            name: 'Câu lạc bộ',
            slug: 'cau-lac-bo',
            description: null,
            parentId: 'c1-1',
            sortOrder: 1,
            isVisible: true,
            postCount: 0,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'c2',
    name: 'Đào tạo',
    slug: 'dao-tao',
    description: null,
    parentId: null,
    sortOrder: 2,
    isVisible: true,
    postCount: 10,
    children: [],
  },
]

describe('categories logic', () => {
  test('generateSlug chuyển tiếng Việt có dấu thành slug hợp lệ', () => {
    expect(generateSlug('Nghiên Cứu Khoa Học & Công Nghệ')).toBe('nghien-cuu-khoa-hoc-cong-nghe')
    expect(generateSlug('Đào Tạo Sau Đại Học 2026!')).toBe('dao-tao-sau-dai-hoc-2026')
    expect(generateSlug('  Tuyển sinh -- ĐH CNTT  ')).toBe('tuyen-sinh-dh-cntt')
  })

  test('SLUG_PATTERN kiểm tra định dạng slug', () => {
    expect(SLUG_PATTERN.test('tin-tuc')).toBe(true)
    expect(SLUG_PATTERN.test('tin-tuc-2026')).toBe(true)
    expect(SLUG_PATTERN.test('Tin-Tuc')).toBe(false)
    expect(SLUG_PATTERN.test('tin_tuc')).toBe(false)
    expect(SLUG_PATTERN.test('-tin-tuc')).toBe(false)
    expect(SLUG_PATTERN.test('tin--tuc')).toBe(false)
  })

  test('findCategoryDescendantIds tìm tất cả id con cháu', () => {
    const descIds = findCategoryDescendantIds(sampleCategoryTree, 'c1')
    expect(descIds.has('c1-1')).toBe(true)
    expect(descIds.has('c1-1-1')).toBe(true)
    expect(descIds.has('c2')).toBe(false)
    expect(descIds.has('c1')).toBe(false)
  })

  test('flattenCategoryTree làm phẳng toàn bộ cây kèm depth', () => {
    const flat = flattenCategoryTree(sampleCategoryTree)
    expect(flat.length).toBe(4)
    expect(flat[0].id).toBe('c1')
    expect(flat[0].depth).toBe(1)
    expect(flat[1].id).toBe('c1-1')
    expect(flat[1].depth).toBe(2)
    expect(flat[2].id).toBe('c1-1-1')
    expect(flat[2].depth).toBe(3)
    expect(flat[3].id).toBe('c2')
    expect(flat[3].depth).toBe(1)
  })

  test('categoryErrorMessage hiển thị thông báo lỗi thân thiện', () => {
    expect(categoryErrorMessage(new ApiError(400, 'Lỗi', {}, 'category_has_posts'))).toBe(
      'Chuyên mục đang có bài viết hoặc chuyên mục con. Vui lòng chọn chuyên mục đích để chuyển giao.'
    )
    expect(categoryErrorMessage(new ApiError(409, 'Trùng slug', {}, 'duplicate_slug'))).toBe(
      'Đường dẫn (slug) đã tồn tại trong hệ thống. Vui lòng chọn đường dẫn khác.'
    )
    expect(categoryErrorMessage(new ApiError(400, 'Chu kỳ', {}, 'invalid_parent'))).toBe(
      'Không thể chọn chính nó hoặc cây con của nó làm chuyên mục cha.'
    )
  })
})
