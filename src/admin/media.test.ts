import { expect, test } from 'vitest'
import { checkFile, mediaQuery, MAX_BYTES } from './media'

test('checkFile: nhận đúng đuôi, phân loại ảnh/tài liệu, không phân biệt hoa thường', () => {
  expect(checkFile({ name: 'Anh-Bia.JPG', size: 1000 })).toEqual({ kind: 'image' })
  expect(checkFile({ name: 'lich-thi.xlsx', size: 1000 })).toEqual({ kind: 'document' })
})

test('checkFile: từ chối đuôi lạ, file rỗng, file quá 10 MB', () => {
  expect(checkFile({ name: 'setup.exe', size: 10 })).toHaveProperty('error')
  expect(checkFile({ name: 'khong-duoi', size: 10 })).toHaveProperty('error')
  expect(checkFile({ name: 'a.png', size: 0 })).toHaveProperty('error')
  expect(checkFile({ name: 'a.pdf', size: MAX_BYTES })).toEqual({ kind: 'document' })
  expect(checkFile({ name: 'a.pdf', size: MAX_BYTES + 1 })).toEqual({ error: expect.stringContaining('10 MB') })
})

test('mediaQuery: bỏ loại lạ, cắt khoảng trắng từ khóa', () => {
  expect(mediaQuery({ kind: 'image', search: ' học bổng ', mine: true, page: 2 })).toBe('page=2&pageSize=24&kind=image&search=h%E1%BB%8Dc+b%E1%BB%95ng&mine=true')
  expect(mediaQuery({ kind: 'exe' })).toBe('page=1&pageSize=24')
})
