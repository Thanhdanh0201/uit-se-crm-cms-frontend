// Thao tác thuần trên cây { id, children } dùng chung cho menu (SCRUM-35) và chuyên mục (SCRUM-36).
// Không sửa cây gốc: mọi hàm trả về cây mới.

export type TreeNode = { id: string; children: TreeNode[] }

export type FlatNode<T extends TreeNode> = { node: T; depth: number; parentId: string | null; path: string[] }

// Duyệt cây theo thứ tự hiển thị. depth tính từ 1 (mục gốc). path là nhãn từ gốc tới nút, để hiện "Tin tức / Học bổng".
export function flatten<T extends TreeNode>(tree: T[], label: (n: T) => string = () => ''): FlatNode<T>[] {
  const out: FlatNode<T>[] = []
  const walk = (nodes: T[], depth: number, parentId: string | null, path: string[]) => {
    for (const n of nodes) {
      const p = [...path, label(n)]
      out.push({ node: n, depth, parentId, path: p })
      walk(n.children as T[], depth + 1, n.id, p)
    }
  }
  walk(tree, 1, null, [])
  return out
}

// Chiều cao nhánh: lá = 1.
export function height(node: TreeNode): number {
  return 1 + Math.max(0, ...node.children.map(height))
}

// id của nút và toàn bộ con cháu (không được chọn làm cha của chính nó).
export function subtreeIds(node: TreeNode): Set<string> {
  const ids = new Set<string>([node.id])
  const walk = (n: TreeNode) => n.children.forEach((c) => (ids.add(c.id), walk(c)))
  walk(node)
  return ids
}

export function findNode<T extends TreeNode>(tree: T[], id: string): T | undefined {
  for (const n of tree) {
    if (n.id === id) return n
    const hit = findNode(n.children as T[], id)
    if (hit) return hit
  }
}

function remove<T extends TreeNode>(tree: T[], id: string): [T[], T | undefined] {
  let taken: T | undefined
  const walk = (nodes: T[]): T[] =>
    nodes.flatMap((n) => {
      if (n.id === id) return (taken = n), []
      return [{ ...n, children: walk(n.children as T[]) }]
    })
  return [walk(tree), taken]
}

function insert<T extends TreeNode>(tree: T[], node: T, parentId: string | null, index: number): T[] {
  if (parentId === null) return [...tree.slice(0, index), node, ...tree.slice(index)]
  return tree.map((n) =>
    n.id === parentId
      ? { ...n, children: [...n.children.slice(0, index), node, ...n.children.slice(index)] }
      : { ...n, children: insert(n.children as T[], node, parentId, index) },
  )
}

// Chuyển nút tới vị trí index trong danh sách con của parentId (null = cấp gốc), index tính sau khi đã gỡ nút ra.
// Trả null nếu vị trí không hợp lệ: làm con của chính nó/cây con, hoặc vượt maxDepth cấp.
export function moveNode<T extends TreeNode>(tree: T[], id: string, parentId: string | null, index: number, maxDepth = Infinity): T[] | null {
  const node = findNode(tree, id)
  if (!node || (parentId !== null && subtreeIds(node).has(parentId))) return null
  const parentDepth = parentId === null ? 0 : flatten(tree).find((f) => f.node.id === parentId)?.depth
  if (parentDepth === undefined || parentDepth + height(node) > maxDepth) return null
  const [rest] = remove(tree, id)
  return insert(rest, node, parentId, index)
}

// Kéo thả: đặt nút trước / sau / vào trong (làm con đầu) nút đích. Trả null nếu không hợp lệ.
export function dropNode<T extends TreeNode>(tree: T[], dragId: string, targetId: string, where: 'before' | 'after' | 'inside', maxDepth = Infinity): T[] | null {
  const node = findNode(tree, dragId)
  if (!node || subtreeIds(node).has(targetId)) return null
  const [rest] = remove(tree, dragId)
  const at = locate(rest, targetId)
  if (!at) return null
  const parentId = where === 'inside' ? targetId : at.parentId
  const parentDepth = parentId === null ? 0 : flatten(rest).find((f) => f.node.id === parentId)!.depth
  if (parentDepth + height(node) > maxDepth) return null
  return insert(rest, node, parentId, where === 'inside' ? 0 : at.index + (where === 'after' ? 1 : 0))
}

// Vị trí hiện tại: cha và thứ tự trong danh sách anh em.
export function locate<T extends TreeNode>(tree: T[], id: string): { parentId: string | null; index: number; siblings: T[] } | undefined {
  const f = flatten(tree).find((x) => x.node.id === id)
  if (!f) return
  const siblings = f.parentId === null ? tree : (findNode(tree, f.parentId)!.children as T[])
  return { parentId: f.parentId, index: siblings.findIndex((s) => s.id === id), siblings }
}

export type Move = 'up' | 'down' | 'in' | 'out'

// Các nút "Di chuyển" (thay cho kéo thả, dùng được bằng bàn phím). Trả null khi không làm được.
export function step<T extends TreeNode>(tree: T[], id: string, move: Move, maxDepth = Infinity): T[] | null {
  const at = locate(tree, id)
  if (!at) return null
  const { parentId, index, siblings } = at
  if (move === 'up') return index > 0 ? moveNode(tree, id, parentId, index - 1, maxDepth) : null
  if (move === 'down') return index < siblings.length - 1 ? moveNode(tree, id, parentId, index + 1, maxDepth) : null
  if (move === 'in') {
    // Làm mục con cuối của mục ngay phía trên.
    const prev = siblings[index - 1]
    return prev ? moveNode(tree, id, prev.id, prev.children.length, maxDepth) : null
  }
  // Ra ngoài: đứng ngay sau mục cha.
  if (parentId === null) return null
  const parent = locate(tree, parentId)!
  return moveNode(tree, id, parent.parentId, parent.index + 1, maxDepth)
}

// Body cho PUT /api/admin/menus/{id}/tree: mọi nút kèm cha và thứ tự mới.
export function toOrder(tree: TreeNode[]): { id: string; parentId: string | null; sortOrder: number }[] {
  const out: { id: string; parentId: string | null; sortOrder: number }[] = []
  const walk = (nodes: TreeNode[], parentId: string | null) =>
    nodes.forEach((n, i) => (out.push({ id: n.id, parentId, sortOrder: i + 1 }), walk(n.children, n.id)))
  walk(tree, null)
  return out
}

// Số nút đổi cha hoặc đổi thứ tự so với bản trên server, để hiện "Đã đổi thứ tự 2 mục".
export function changedCount(before: TreeNode[], after: TreeNode[]): number {
  const key = (o: { parentId: string | null; sortOrder: number }) => `${o.parentId}:${o.sortOrder}`
  const old = new Map(toOrder(before).map((o) => [o.id, key(o)]))
  return toOrder(after).filter((o) => old.get(o.id) !== key(o)).length
}
