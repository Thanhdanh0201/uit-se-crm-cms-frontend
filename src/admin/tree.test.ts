import { expect, test } from 'vitest'
import { changedCount, dropNode, flatten, moveNode, step, subtreeIds, toOrder, viSearchMatch, type TreeNode } from './tree'

const n = (id: string, children: TreeNode[] = []): TreeNode => ({ id, children })
// a
//   a1
//     a1x
// b
// c
const tree = () => [n('a', [n('a1', [n('a1x')])]), n('b'), n('c')]
const ids = (t: TreeNode[] | null) => (t ? flatten(t).map((f) => `${'.'.repeat(f.depth - 1)}${f.node.id}`) : null)

test('flatten: thứ tự hiển thị, cấp và đường dẫn', () => {
  const f = flatten(tree(), (x) => x.id.toUpperCase())
  expect(f.map((x) => [x.node.id, x.depth, x.parentId])).toEqual([['a', 1, null], ['a1', 2, 'a'], ['a1x', 3, 'a1'], ['b', 1, null], ['c', 1, null]])
  expect(f[2].path).toEqual(['A', 'A1', 'A1X'])
})

test('lên, xuống trong cùng cấp; đầu và cuối danh sách thì không làm được', () => {
  expect(ids(step(tree(), 'c', 'up'))).toEqual(['a', '.a1', '..a1x', 'c', 'b'])
  expect(ids(step(tree(), 'a', 'down'))).toEqual(['b', 'a', '.a1', '..a1x', 'c'])
  expect(step(tree(), 'a', 'up')).toBeNull()
  expect(step(tree(), 'c', 'down')).toBeNull()
})

test('vào trong làm con cuối của mục trên; ra ngoài đứng ngay sau mục cha', () => {
  expect(ids(step(tree(), 'c', 'in'))).toEqual(['a', '.a1', '..a1x', 'b', '.c'])
  expect(ids(step(tree(), 'a1', 'out'))).toEqual(['a', 'a1', '.a1x', 'b', 'c'])
  expect(step(tree(), 'a', 'out')).toBeNull()
})

test('chặn vượt 3 cấp, kể cả khi kéo cả nhánh', () => {
  // b vào trong a1 thành cấp 3: được. a1x đã ở cấp 3 nên không nhận con.
  expect(ids(moveNode(tree(), 'b', 'a1', 1, 3))).toEqual(['a', '.a1', '..a1x', '..b', 'c'])
  expect(moveNode(tree(), 'b', 'a1x', 0, 3)).toBeNull()
  // Nhánh a1 (cao 2) chuyển vào dưới b (cấp 1): a1x thành cấp 3, được. Vào dưới a1x thì là chính cây con: không được.
  expect(ids(moveNode(tree(), 'a1', 'b', 0, 3))).toEqual(['a', 'b', '.a1', '..a1x', 'c'])
  expect(moveNode(tree(), 'a', 'a1x', 0, 3)).toBeNull()
  // Nhánh a (cao 3) không làm con của ai được.
  expect(moveNode(tree(), 'a', 'b', 0, 3)).toBeNull()
  expect(moveNode(tree(), 'a1', 'a1', 0, 3)).toBeNull()
})

test('subtreeIds gồm chính nó và con cháu', () => {
  expect([...subtreeIds(tree()[0])]).toEqual(['a', 'a1', 'a1x'])
})

test('toOrder và changedCount: chỉ đếm mục đổi cha hoặc thứ tự', () => {
  expect(toOrder(tree())).toEqual([
    { id: 'a', parentId: null, sortOrder: 1 },
    { id: 'a1', parentId: 'a', sortOrder: 1 },
    { id: 'a1x', parentId: 'a1', sortOrder: 1 },
    { id: 'b', parentId: null, sortOrder: 2 },
    { id: 'c', parentId: null, sortOrder: 3 },
  ])
  expect(changedCount(tree(), step(tree(), 'c', 'up')!)).toBe(2)
  expect(changedCount(tree(), tree())).toBe(0)
})

test('kéo thả: trước, sau, vào trong; chặn thả vào cây con và vượt cấp', () => {
  expect(ids(dropNode(tree(), 'c', 'a', 'before', 3))).toEqual(['c', 'a', '.a1', '..a1x', 'b'])
  // Kéo a xuống sau b: vị trí tính sau khi gỡ a ra.
  expect(ids(dropNode(tree(), 'a', 'b', 'after', 3))).toEqual(['b', 'a', '.a1', '..a1x', 'c'])
  expect(ids(dropNode(tree(), 'c', 'a', 'inside', 3))).toEqual(['a', '.c', '.a1', '..a1x', 'b'])
  expect(dropNode(tree(), 'a', 'a1', 'inside', 3)).toBeNull()
  expect(dropNode(tree(), 'c', 'a1x', 'inside', 3)).toBeNull()
  expect(ids(dropNode(tree(), 'c', 'a1x', 'after', 3))).toEqual(['a', '.a1', '..a1x', '..c', 'b'])
})

test('viSearchMatch: tìm kiếm tiếng Việt không dấu, có dấu và không phân biệt hoa thường', () => {
  expect(viSearchMatch('tin tuc', 'Tin tức')).toBe(true)
  expect(viSearchMatch('TIN TUC', 'Tin tức')).toBe(true)
  expect(viSearchMatch('thong bao', 'Tin tức / Thông báo học vụ')).toBe(true)
  expect(viSearchMatch('hoc vu', 'Tin tức / Thông báo học vụ')).toBe(true)
  expect(viSearchMatch('dao tao', 'Đào tạo')).toBe(true)
})
