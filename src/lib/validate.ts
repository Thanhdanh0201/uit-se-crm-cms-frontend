// Validate ở client trước khi gửi, cùng quy tắc với FluentValidation của backend (server vẫn là quyết định cuối).
// Trả về lỗi theo tên field; rỗng nghĩa là hợp lệ.

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export const PASSWORD_MIN_LENGTH = 6 // ChangePasswordRequestValidator.MinimumLength(6)

export type LoginInput = { usernameOrEmail: string; password: string }

export function validateLogin({ usernameOrEmail, password }: LoginInput): FieldErrors<keyof LoginInput> {
  const errors: FieldErrors<keyof LoginInput> = {}
  if (!usernameOrEmail.trim()) errors.usernameOrEmail = 'Nhập tên đăng nhập hoặc email.'
  if (!password) errors.password = 'Nhập mật khẩu.'
  return errors
}

export type ChangePasswordInput = { currentPassword: string; newPassword: string; confirmNewPassword: string }

export function validateChangePassword({ currentPassword, newPassword, confirmNewPassword }: ChangePasswordInput): FieldErrors<keyof ChangePasswordInput> {
  const errors: FieldErrors<keyof ChangePasswordInput> = {}
  if (!currentPassword) errors.currentPassword = 'Nhập mật khẩu hiện tại.'
  if (!newPassword) errors.newPassword = 'Nhập mật khẩu mới.'
  else if (newPassword.length < PASSWORD_MIN_LENGTH) errors.newPassword = `Mật khẩu mới phải có tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`
  else if (newPassword === currentPassword) errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  if (!confirmNewPassword) errors.confirmNewPassword = 'Nhập lại mật khẩu mới.'
  else if (confirmNewPassword !== newPassword) errors.confirmNewPassword = 'Mật khẩu nhập lại không khớp với mật khẩu mới.'
  return errors
}

// Form liên hệ công khai: SubmitContactRequestValidator + ContactConstants của backend.
export const CONTACT_LIMITS = { senderName: 100, senderEmail: 254, subject: 200, message: 5000 } as const

export type ContactInput = { senderName: string; senderEmail: string; subject: string; message: string }

// Kiểm tra email chặt chẽ: có đúng 1 '@', không khoảng trắng, domain có ít nhất 1 dấu chấm và đuôi tên miền (TLD) tối thiểu 2 ký tự.
function isEmail(value: string) {
  const at = value.indexOf('@')
  if (at <= 0 || at !== value.lastIndexOf('@') || at >= value.length - 1) return false
  if (/\s/.test(value)) return false

  const domain = value.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  if (dot <= 0 || dot >= domain.length - 2) return false

  return true
}

export function validateContact({ senderName, senderEmail, subject, message }: ContactInput): FieldErrors<keyof ContactInput> {
  const errors: FieldErrors<keyof ContactInput> = {}
  const email = senderEmail.trim()
  if (!senderName.trim()) errors.senderName = 'Nhập họ và tên.'
  else if (senderName.length > CONTACT_LIMITS.senderName) errors.senderName = `Họ và tên tối đa ${CONTACT_LIMITS.senderName} ký tự.`
  if (!email) errors.senderEmail = 'Nhập email để Khoa phản hồi.'
  else if (email.length > CONTACT_LIMITS.senderEmail) errors.senderEmail = 'Email quá dài.'
  else if (!isEmail(email)) errors.senderEmail = 'Email chưa đúng định dạng.'
  if (!subject.trim()) errors.subject = 'Nhập chủ đề.'
  else if (subject.length > CONTACT_LIMITS.subject) errors.subject = `Chủ đề tối đa ${CONTACT_LIMITS.subject} ký tự.`
  if (!message.trim()) errors.message = 'Nhập nội dung.'
  else if (message.length > CONTACT_LIMITS.message) errors.message = `Nội dung tối đa ${CONTACT_LIMITS.message} ký tự.`
  return errors
}

// Focus field sai đầu tiên theo thứ tự trong form (bàn phím và trình đọc màn hình đến thẳng chỗ cần sửa).
export function focusFirstError(form: HTMLFormElement, errors: Record<string, string | undefined>) {
  const first = [...form.elements].find((el) => (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && errors[el.name])
  ;(first as HTMLInputElement | HTMLTextAreaElement | undefined)?.focus()
}
