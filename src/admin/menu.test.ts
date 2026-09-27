import { expect, test } from 'vitest'
import { activePath, menuFor } from './menu'

test('editor chỉ thấy mục được phép', () => {
  const paths = menuFor('editor').flatMap((g) => g.items.map((m) => m.path))
  expect(paths).toEqual(['/admin', '/admin/posts', '/admin/media'])
})

test('student và khách không có menu quản trị', () => {
  expect(menuFor('student')).toEqual([])
  expect(menuFor(undefined)).toEqual([])
})

test('trang con vẫn sáng mục cha', () => {
  expect(activePath('/admin/posts/abc/edit')).toBe('/admin/posts')
  expect(activePath('/admin')).toBe('/admin')
  expect(activePath('/admin/postsx')).toBe('/admin')
})
