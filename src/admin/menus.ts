import { ApiError } from '../lib/api'

export type MenuItemKind = 'page' | 'category' | 'external'

export type MenuDto = {
  id: string
  code: string
  name: string
  itemCount: number
  createdAt?: string
  updatedAt?: string
}

export type PublicMenuItemDto = {
  id: string
  label?: string
  title?: string
  kind?: MenuItemKind
  url?: string | null
  target?: string | null
  children?: PublicMenuItemDto[]
}

export type PublicMenuDto = {
  id: string
  code: string
  name: string
  items: PublicMenuItemDto[]
}

export type MenuItemTreeDto = {
  id: string
  menuId: string
  parentId: string | null
  label: string
  kind: MenuItemKind
  pageId: string | null
  pageSlug?: string | null
  pageTitle?: string | null
  categoryId: string | null
  categorySlug?: string | null
  categoryName?: string | null
  externalUrl: string | null
  resolvedUrl?: string | null
  sortOrder: number
  isVisible: boolean
  depth: number
  createdAt?: string
  updatedAt?: string
  children: MenuItemTreeDto[]
}

export type CreateMenuInput = {
  code: string
  name: string
}

export type UpdateMenuInput = {
  name: string
}

export type CreateMenuItemInput = {
  label: string
  kind: MenuItemKind
  parentId?: string | null
  pageId?: string | null
  categoryId?: string | null
  externalUrl?: string | null
  sortOrder?: number
  isVisible?: boolean
}

export type UpdateMenuItemInput = {
  label: string
  kind: MenuItemKind
  parentId?: string | null
  pageId?: string | null
  categoryId?: string | null
  externalUrl?: string | null
  sortOrder?: number
  isVisible?: boolean
}

export type ReorderMenuItemDto = {
  id: string
  parentId: string | null
  sortOrder: number
}

export function menuErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  if (err.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (err.status === 404) return 'Menu hoặc mục menu không tồn tại.'
  if (err.code === 'menu_depth_exceeded' || err.message?.includes('vượt quá') || err.message?.includes('cấp 4')) {
    return 'Máy chủ từ chối vì vượt quá 3 cấp. Chọn mục cha khác rồi lưu lại.'
  }
  if (err.code === 'invalid_parent' || err.message?.includes('chu kỳ') || err.message?.includes('vòng lặp')) {
    return 'Không thể chọn chính mục này hoặc mục con cháu làm mục cha.'
  }
  if (err.status === 400 && err.message) return err.message
  return err.message || 'Không thực hiện được lúc này. Vui lòng thử lại sau.'
}

// Đếm toàn bộ con cháu của một node
export function countDescendants(node: MenuItemTreeDto): number {
  if (!node.children || node.children.length === 0) return 0
  return node.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0)
}

// Tìm toàn bộ ID con cháu của một node
export function findMenuItemDescendantIds(tree: MenuItemTreeDto[], targetId: string): Set<string> {
  const result = new Set<string>()

  function collect(node: MenuItemTreeDto) {
    result.add(node.id)
    node.children?.forEach(collect)
  }

  function traverse(nodes: MenuItemTreeDto[]) {
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

// Chiều cao cây con (1 nếu không có con)
export function calculateSubtreeHeight(node: MenuItemTreeDto): number {
  if (!node.children || node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(calculateSubtreeHeight))
}

// Làm phẳng cây thành danh sách id, parentId, sortOrder để gửi API PUT /api/admin/menus/{id}/tree
export function flattenMenuTreeForReorder(tree: MenuItemTreeDto[]): ReorderMenuItemDto[] {
  const result: ReorderMenuItemDto[] = []

  function walk(items: MenuItemTreeDto[], parentId: string | null) {
    items.forEach((item, index) => {
      result.push({
        id: item.id,
        parentId,
        sortOrder: index + 1,
      })
      if (item.children?.length) {
        walk(item.children, item.id)
      }
    })
  }

  walk(tree, null)
  return result
}

// Cập nhật lại thuộc tính depth, parentId, sortOrder đệ quy cho cây trong state
export function recalculateTreeMetadata(items: MenuItemTreeDto[], parentId: string | null = null, currentDepth: number = 1): MenuItemTreeDto[] {
  return items.map((item, index) => {
    const updatedChildren = item.children?.length
      ? recalculateTreeMetadata(item.children, item.id, currentDepth + 1)
      : []
    return {
      ...item,
      parentId,
      depth: currentDepth,
      sortOrder: index + 1,
      children: updatedChildren,
    }
  })
}

// Hàm di chuyển vị trí node trên cây: 'up' | 'down' | 'in' | 'out'
export function moveMenuNode(
  tree: MenuItemTreeDto[],
  nodeId: string,
  direction: 'up' | 'down' | 'in' | 'out',
): { newTree: MenuItemTreeDto[]; success: boolean; error?: string } {
  // Deep clone cây để thao tác an toàn
  const cloned: MenuItemTreeDto[] = JSON.parse(JSON.stringify(tree))

  type ParentRef = { list: MenuItemTreeDto[]; index: number; parent: MenuItemTreeDto | null }

  function findNode(list: MenuItemTreeDto[], parent: MenuItemTreeDto | null): ParentRef | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === nodeId) {
        return { list, index: i, parent }
      }
      if (list[i].children?.length) {
        const found = findNode(list[i].children, list[i])
        if (found) return found
      }
    }
    return null
  }

  const found = findNode(cloned, null)
  if (!found) return { newTree: tree, success: false, error: 'Không tìm thấy mục menu.' }

  const { list, index, parent } = found
  const targetNode = list[index]

  if (direction === 'up') {
    if (index === 0) return { newTree: tree, success: false, error: 'Mục đã ở vị trí đầu tiên.' }
    // Hoán đổi với mục liền trước
    const temp = list[index - 1]
    list[index - 1] = targetNode
    list[index] = temp
  } else if (direction === 'down') {
    if (index === list.length - 1) return { newTree: tree, success: false, error: 'Mục đã ở vị trí cuối cùng.' }
    // Hoán đổi với mục liền sau
    const temp = list[index + 1]
    list[index + 1] = targetNode
    list[index] = temp
  } else if (direction === 'in') {
    if (index === 0) return { newTree: tree, success: false, error: 'Không có mục phía trên để làm con.' }
    const prevSibling = list[index - 1]
    // Kiểm tra độ sâu tối đa 3 cấp
    const targetSubtreeHeight = calculateSubtreeHeight(targetNode)
    const newDepth = prevSibling.depth + 1
    if (newDepth + targetSubtreeHeight - 1 > 3) {
      return { newTree: tree, success: false, error: 'Không thể thụt vào vì sẽ vượt quá giới hạn tối đa 3 cấp.' }
    }
    // Gỡ khỏi list hiện tại và gắn làm con cuối của prevSibling
    list.splice(index, 1)
    prevSibling.children = prevSibling.children || []
    prevSibling.children.push(targetNode)
  } else if (direction === 'out') {
    if (!parent) return { newTree: tree, success: false, error: 'Mục đã ở cấp 1 cao nhất.' }
    // Gỡ khỏi parent.children
    list.splice(index, 1)
    const parentId = parent.id
    // Ở đây ta tìm vị trí của parent để chèn ngay sau parent
    function insertAfterParent(curList: MenuItemTreeDto[]): boolean {
      for (let i = 0; i < curList.length; i++) {
        if (curList[i].id === parentId) {
          curList.splice(i + 1, 0, targetNode)
          return true
        }
        if (curList[i].children?.length && insertAfterParent(curList[i].children)) return true
      }
      return false
    }
    insertAfterParent(cloned)
  }

  const updatedTree = recalculateTreeMetadata(cloned)
  return { newTree: updatedTree, success: true }
}
