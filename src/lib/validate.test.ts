import { expect, test } from 'vitest'
import { validateChangePassword, validateLogin } from './validate'

test('đăng nhập: trống và chỉ có khoảng trắng đều báo lỗi', () => {
  expect(validateLogin({ usernameOrEmail: '   ', password: '' })).toEqual({
    usernameOrEmail: 'Nhập tên đăng nhập hoặc email.',
    password: 'Nhập mật khẩu.',
  })
  expect(validateLogin({ usernameOrEmail: 'sv24520264', password: 'x' })).toEqual({})
})

test('đổi mật khẩu: độ dài, trùng mật khẩu cũ, nhập lại không khớp', () => {
  expect(validateChangePassword({ currentPassword: 'cu-123456', newPassword: '12345', confirmNewPassword: '12345' }).newPassword).toMatch(/tối thiểu 6/)
  expect(validateChangePassword({ currentPassword: 'cu-123456', newPassword: 'cu-123456', confirmNewPassword: 'cu-123456' }).newPassword).toMatch(/khác mật khẩu hiện tại/)
  expect(validateChangePassword({ currentPassword: 'cu-123456', newPassword: 'moi-123456', confirmNewPassword: 'moi-12345' }).confirmNewPassword).toMatch(/không khớp/)
  expect(validateChangePassword({ currentPassword: 'cu-123456', newPassword: 'moi-123456', confirmNewPassword: 'moi-123456' })).toEqual({})
})
