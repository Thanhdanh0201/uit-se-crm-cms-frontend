import { expect, test } from 'vitest'
import { checkFile, mediaQuery, videoIdOf, MAX_BYTES, type MediaDto } from './media'

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

test('videoIdOf: trich xuat id video tu thumbnailUrl hoac externalUrl', () => {
  const base: MediaDto = {
    id: '1', kind: 'video', name: 'Video 1', description: null, altText: null, mimeType: null, sizeBytes: null,
    externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    url: null,
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    urlExpiresAt: null, usageCount: 0, createdAt: '2026-10-01', createdBy: { id: 'u1', fullName: 'User' },
  }
  expect(videoIdOf(base)).toBe('dQw4w9WgXcQ')
  expect(videoIdOf({ ...base, thumbnailUrl: null })).toBe('dQw4w9WgXcQ')
  expect(videoIdOf({ ...base, thumbnailUrl: 'https://i.ytimg.com/vi/xyz123abcde/default.jpg', externalUrl: null })).toBe('xyz123abcde')
  expect(videoIdOf({ ...base, kind: 'image' })).toBeNull()
  expect(videoIdOf({ ...base, thumbnailUrl: null, externalUrl: null })).toBeNull()
})

