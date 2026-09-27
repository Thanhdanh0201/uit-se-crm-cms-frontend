import type { ReactNode } from 'react'
import {
  Article,
  CalendarDots,
  ChatCircleText,
  CheckSquareOffset,
  ClockCounterClockwise,
  File,
  FolderSimple,
  House,
  ImageSquare,
  ListBullets,
  SquaresFour,
  Users,
} from '@phosphor-icons/react'
import type { Role } from '../lib/auth'

export type MenuEntry = { path: string; label: string; icon: ReactNode; roles: Role[] }
export type MenuGroup = { label: string; items: MenuEntry[] }

const EA: Role[] = ['editor', 'admin']
const A: Role[] = ['admin']
const i = (Icon: typeof House) => <Icon size={18} aria-hidden />

// Menu quản trị theo SRS 8.1. Lọc theo role ở UI chỉ để gọn; server vẫn kiểm tra quyền.
export const ADMIN_MENU: MenuGroup[] = [
  {
    label: '',
    items: [{ path: '/admin', label: 'Tổng quan', icon: i(House), roles: EA }],
  },
  {
    label: 'Nội dung',
    items: [
      { path: '/admin/posts', label: 'Bài viết', icon: i(Article), roles: EA },
      { path: '/admin/review', label: 'Duyệt bài', icon: i(CheckSquareOffset), roles: A },
      { path: '/admin/pages', label: 'Trang tĩnh', icon: i(File), roles: A },
      { path: '/admin/media', label: 'Thư viện media', icon: i(ImageSquare), roles: EA },
    ],
  },
  {
    label: 'Cấu trúc website',
    items: [
      { path: '/admin/menus', label: 'Menu', icon: i(ListBullets), roles: A },
      { path: '/admin/categories', label: 'Chuyên mục và thẻ', icon: i(FolderSimple), roles: A },
      { path: '/admin/home-sections', label: 'Trang chủ', icon: i(SquaresFour), roles: A },
    ],
  },
  {
    label: 'Tương tác',
    items: [
      { path: '/admin/events', label: 'Sự kiện', icon: i(CalendarDots), roles: A },
      { path: '/admin/contacts', label: 'Liên hệ', icon: i(ChatCircleText), roles: A },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { path: '/admin/users', label: 'Người dùng', icon: i(Users), roles: A },
      { path: '/admin/activity-logs', label: 'Nhật ký', icon: i(ClockCounterClockwise), roles: A },
    ],
  },
]

export function menuFor(role: Role | undefined): MenuGroup[] {
  if (!role) return []
  return ADMIN_MENU.map((g) => ({ ...g, items: g.items.filter((m) => m.roles.includes(role)) })).filter((g) => g.items.length)
}

// Mục menu dài nhất khớp với URL hiện tại, để /admin/posts/123 vẫn sáng mục "Bài viết".
export function activePath(pathname: string): string {
  const all = ADMIN_MENU.flatMap((g) => g.items.map((m) => m.path))
  return all.filter((p) => pathname === p || pathname.startsWith(p + '/')).sort((a, b) => b.length - a.length)[0] ?? '/admin'
}
