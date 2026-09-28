import { expect, test } from 'vitest'
import { safeNext } from './auth'
import { ApiError } from './api'
import { loginErrors } from '../pages/public/Login'

test('safeNext chỉ nhận đường dẫn nội bộ', () => {
  expect(safeNext('/admin/users?page=2')).toBe('/admin/users?page=2')
  expect(safeNext('//evil.com')).toBeNull()
  expect(safeNext('/\\evil.com')).toBeNull()
  expect(safeNext('https://evil.com')).toBeNull()
  expect(safeNext('javascript:alert(1)')).toBeNull()
  expect(safeNext(null)).toBeNull()
})

test('lỗi validation của backend gắn vào đúng field (key PascalCase)', () => {
  const err = new ApiError(400, 'One or more validation errors occurred.', { UsernameOrEmail: ['Tên đăng nhập hoặc email không được để trống.'] })
  expect(loginErrors(err)).toEqual({ usernameOrEmail: 'Tên đăng nhập hoặc email không được để trống.', password: undefined })
})

test('401 luôn là lỗi chung, không lộ message backend', () => {
  const err = new ApiError(401, 'Không thể tra cứu email từ Supabase Auth Admin API. Vui lòng kiểm tra lại cấu hình ServiceRoleSecret.')
  expect(loginErrors(err).form).toBe('Tên đăng nhập, email hoặc mật khẩu không đúng.')
})

test('mất mạng không hiện "Failed to fetch"', () => {
  expect(loginErrors(new TypeError('Failed to fetch')).form).toMatch(/Không kết nối được máy chủ/)
})
