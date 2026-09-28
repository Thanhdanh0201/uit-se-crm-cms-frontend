import type { Role } from '../lib/auth'

// Nhãn và màu Tag của vai trò, dùng chung cho khung admin và trang người dùng.
export const ROLES: Role[] = ['student', 'editor', 'admin']

export const ROLE_LABEL: Record<Role, string> = { student: 'Sinh viên', editor: 'Biên tập viên', admin: 'Quản trị viên' }

export const ROLE_COLOR: Record<Role, string> = { student: 'default', editor: 'cyan', admin: 'blue' }
