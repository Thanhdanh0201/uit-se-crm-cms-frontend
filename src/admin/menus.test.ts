import { describe, expect, test } from 'vitest'
import {
  calculateSubtreeHeight,
  countDescendants,
  findMenuItemDescendantIds,
  flattenMenuTreeForReorder,
  menuErrorMessage,
  moveMenuNode,
  recalculateTreeMetadata,
  type MenuItemTreeDto,
} from './menus'
import { ApiError } from '../lib/api'

const sampleTree: MenuItemTreeDto[] = [
  {
    id: '1',
    menuId: 'm1',
    parentId: null,
    label: 'Trang chủ',
    kind: 'page',
    pageId: 'p1',
    categoryId: null,
    externalUrl: null,
    sortOrder: 1,
    isVisible: true,
    depth: 1,
    children: [],
  },
  {
    id: '2',
    menuId: 'm1',
    parentId: null,
    label: 'Giới thiệu',
    kind: 'page',
    pageId: 'p2',
    categoryId: null,
    externalUrl: null,
    sortOrder: 2,
    isVisible: true,
    depth: 1,
    children: [
      {
        id: '2-1',
        menuId: 'm1',
        parentId: '2',
        label: 'Ban chủ nhiệm',
        kind: 'page',
        pageId: 'p3',
        categoryId: null,
        externalUrl: null,
        sortOrder: 1,
        isVisible: true,
        depth: 2,
        children: [
          {
            id: '2-1-1',
            menuId: 'm1',
            parentId: '2-1',
            label: 'Trưởng khoa',
            kind: 'page',
            pageId: 'p4',
            categoryId: null,
            externalUrl: null,
            sortOrder: 1,
            isVisible: true,
            depth: 3,
            children: [],
          },
        ],
      },
      {
        id: '2-2',
        menuId: 'm1',
        parentId: '2',
        label: 'Giảng viên',
        kind: 'page',
        pageId: 'p5',
        categoryId: null,
        externalUrl: null,
        sortOrder: 2,
        isVisible: true,
        depth: 2,
        children: [],
      },
    ],
  },
]

describe('menus logic', () => {
  test('countDescendants đếm chính xác số con cháu', () => {
    expect(countDescendants(sampleTree[0])).toBe(0)
    expect(countDescendants(sampleTree[1])).toBe(3) // 2-1, 2-1-1, 2-2
    expect(countDescendants(sampleTree[1].children[0])).toBe(1) // 2-1-1
  })

  test('findMenuItemDescendantIds tìm tất cả ID con cháu', () => {
    const descIds = findMenuItemDescendantIds(sampleTree, '2')
    expect(descIds.has('2-1')).toBe(true)
    expect(descIds.has('2-1-1')).toBe(true)
    expect(descIds.has('2-2')).toBe(true)
    expect(descIds.has('1')).toBe(false)
    expect(descIds.has('2')).toBe(false) // Không chứa chính nó
  })

  test('calculateSubtreeHeight tính chiều cao cây con', () => {
    expect(calculateSubtreeHeight(sampleTree[0])).toBe(1)
    expect(calculateSubtreeHeight(sampleTree[1])).toBe(3)
  })

  test('flattenMenuTreeForReorder làm phẳng đúng sortOrder và parentId', () => {
    const flat = flattenMenuTreeForReorder(sampleTree)
    expect(flat).toEqual([
      { id: '1', parentId: null, sortOrder: 1 },
      { id: '2', parentId: null, sortOrder: 2 },
      { id: '2-1', parentId: '2', sortOrder: 1 },
      { id: '2-1-1', parentId: '2-1', sortOrder: 1 },
      { id: '2-2', parentId: '2', sortOrder: 2 },
    ])
  })

  test('recalculateTreeMetadata cập nhật lại depth và sortOrder', () => {
    const updated = recalculateTreeMetadata(sampleTree)
    expect(updated[0].depth).toBe(1)
    expect(updated[1].depth).toBe(1)
    expect(updated[1].children[0].depth).toBe(2)
    expect(updated[1].children[0].children[0].depth).toBe(3)
  })

  test('moveMenuNode up và down thay đổi thứ tự anh em', () => {
    const downResult = moveMenuNode(sampleTree, '1', 'down')
    expect(downResult.success).toBe(true)
    expect(downResult.newTree[0].id).toBe('2')
    expect(downResult.newTree[1].id).toBe('1')

    const upResult = moveMenuNode(downResult.newTree, '1', 'up')
    expect(upResult.success).toBe(true)
    expect(upResult.newTree[0].id).toBe('1')
    expect(upResult.newTree[1].id).toBe('2')
  })

  test('moveMenuNode in chặn nếu vượt quá 3 cấp', () => {
    // 2-2 đang ở cấp 2. Nếu lùi vào làm con của 2-1 (cấp 2), 2-2 sẽ lên cấp 3 -> hợp lệ.
    const inResult = moveMenuNode(sampleTree, '2-2', 'in')
    expect(inResult.success).toBe(true)

    // Thử lùi một node có con cháu sao cho tổng độ sâu > 3
    // 2 có cây con cao 3 cấp. Nếu 2 thụt vào làm con của 1, 2 sẽ ở cấp 2, 2-1 cấp 3, 2-1-1 cấp 4 -> Bị chặn!
    const invalidIn = moveMenuNode(sampleTree, '2', 'in')
    expect(invalidIn.success).toBe(false)
    expect(invalidIn.error).toContain('vượt quá giới hạn tối đa 3 cấp')
  })

  test('moveMenuNode out đẩy node con ra cấp cha', () => {
    const outResult = moveMenuNode(sampleTree, '2-2', 'out')
    expect(outResult.success).toBe(true)
    // 2-2 sẽ trở thành node cấp 1 đứng sau 2
    expect(outResult.newTree.length).toBe(3)
    expect(outResult.newTree[2].id).toBe('2-2')
    expect(outResult.newTree[2].depth).toBe(1)
  })

  test('menuErrorMessage xử lý lỗi chính xác', () => {
    expect(menuErrorMessage(new ApiError(400, 'Lỗi vượt cấp', {}, 'menu_depth_exceeded'))).toBe(
      'Máy chủ từ chối vì vượt quá 3 cấp. Chọn mục cha khác rồi lưu lại.'
    )
    expect(menuErrorMessage(new ApiError(400, 'Lỗi chu kỳ', {}, 'invalid_parent'))).toBe(
      'Không thể chọn chính mục này hoặc mục con cháu làm mục cha.'
    )
    expect(menuErrorMessage(new ApiError(403, 'Forbidden'))).toBe('Bạn không có quyền thực hiện thao tác này.')
    expect(menuErrorMessage(new ApiError(404, 'Not found'))).toBe('Menu hoặc mục menu không tồn tại.')
    expect(menuErrorMessage(new Error('Network error'))).toBe('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
  })
})

