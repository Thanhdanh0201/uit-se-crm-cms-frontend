import { expect, test } from 'vitest'
import { validateChangePassword, validateContact, validateLogin } from './validate'

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

const validContact = { senderName: 'Nguyễn Minh Anh', senderEmail: 'anh@gm.uit.edu.vn', subject: 'Hỏi về học bổng', message: 'Khoa cho em hỏi về học bổng.' }
const keys = (o: object) => Object.keys(o).sort()

test('liên hệ: hợp lệ thì không có lỗi', () => {
  expect(validateContact(validContact)).toEqual({})
})

test('liên hệ: ô trống và chỉ có khoảng trắng đều báo lỗi cả 4 ô', () => {
  const empty = { senderName: '', senderEmail: '', subject: '', message: '' }
  const blank = { senderName: '  ', senderEmail: ' ', subject: '\t', message: ' \n ' }
  expect(keys(validateContact(empty))).toEqual(['message', 'senderEmail', 'senderName', 'subject'])
  expect(keys(validateContact(blank))).toEqual(['message', 'senderEmail', 'senderName', 'subject'])
})

test('liên hệ: biên độ dài, đúng giới hạn thì qua, vượt 1 thì lỗi', () => {
  const email = (n: number) => 'a'.repeat(n - 8) + '@uit.edu' // n ký tự
  expect(email(254)).toHaveLength(254)
  expect(validateContact({ ...validContact, senderName: 'a'.repeat(100) })).toEqual({})
  expect(validateContact({ ...validContact, senderName: 'a'.repeat(101) }).senderName).toMatch(/tối đa 100/)
  expect(validateContact({ ...validContact, senderEmail: email(254) })).toEqual({})
  expect(validateContact({ ...validContact, senderEmail: email(255) }).senderEmail).toBe('Email quá dài.')
  expect(validateContact({ ...validContact, subject: 'a'.repeat(200) })).toEqual({})
  expect(validateContact({ ...validContact, subject: 'a'.repeat(201) }).subject).toMatch(/tối đa 200/)
  expect(validateContact({ ...validContact, message: 'a'.repeat(5000) })).toEqual({})
  expect(validateContact({ ...validContact, message: 'a'.repeat(5001) }).message).toMatch(/tối đa 5000/)
})

test('liên hệ: email thiếu @, @ ở đầu, @ ở cuối, hai @, hoặc domain thiếu TLD (như admin@g) đều sai định dạng', () => {
  for (const senderEmail of ['anhuit.edu.vn', '@uit.edu.vn', 'anh@', 'a@b@uit.edu.vn', 'admin@g', 'user@domain', 'test@.com']) {
    expect(validateContact({ ...validContact, senderEmail }).senderEmail, senderEmail).toBe('Email chưa đúng định dạng.')
  }
})
