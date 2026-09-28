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

// Focus field sai đầu tiên theo thứ tự trong form (bàn phím và trình đọc màn hình đến thẳng chỗ cần sửa).
export function focusFirstError(form: HTMLFormElement, errors: Record<string, string | undefined>) {
  const first = [...form.elements].find((el) => el instanceof HTMLInputElement && errors[el.name])
  ;(first as HTMLInputElement | undefined)?.focus()
}
