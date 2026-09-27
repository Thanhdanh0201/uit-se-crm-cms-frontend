import { expect, test } from 'vitest'
import { pageItems } from './Pagination'

test('ít trang thì hiện hết', () => {
  expect(pageItems(2, 3)).toEqual([1, 2, 3])
})

test('trang giữa có dấu ba chấm hai bên', () => {
  expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
})

test('trang đầu và cuối', () => {
  expect(pageItems(1, 10)).toEqual([1, 2, 'gap', 10])
  expect(pageItems(10, 10)).toEqual([1, 'gap', 9, 10])
})

test('không chèn gap khi chỉ cách 1', () => {
  expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5])
})
