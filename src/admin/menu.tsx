import type { ReactNode } from 'react'
import {
  ChatsCircle,
  Gear,
  House,
  Newspaper,
  TreeStructure,
} from '@phosphor-icons/react'
import type { Role } from '../lib/auth'

// Mục con trong nhóm không có icon (giống menu dạng cây), chỉ mục cấp đầu và nhóm có icon.
export type MenuEntry = { path: string; label: string; icon?: ReactNode; roles: Role[] }
// Nhóm có label hiện thành mục cha thu gọn được (submenu), không label thì các mục nằm thẳng ở cấp đầu.
export type MenuGroup = { label: string; icon?: ReactNode; items: MenuEntry[] }

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
    icon: i(Newspaper),
    items: [
      { path: '/admin/posts', label: 'Bài viết', roles: EA },
      { path: '/admin/review', label: 'Duyệt bài', roles: A },
      { path: '/admin/pages', label: 'Trang tĩnh', roles: A },
      { path: '/admin/media', label: 'Thư viện media', roles: EA },
    ],
  },
  {
    label: 'Cấu trúc website',
    icon: i(TreeStructure),
    items: [
      { path: '/admin/menus', label: 'Menu', roles: A },
      { path: '/admin/categories', label: 'Chuyên mục và thẻ', roles: A },
      { path: '/admin/home-sections', label: 'Trang chủ', roles: A },
      { path: '/admin/home-slides', label: 'Slider trang chủ', roles: A },
    ],
  },
  {
    label: 'Tương tác',
    icon: i(ChatsCircle),
    items: [
      { path: '/admin/events', label: 'Sự kiện', roles: A },
      { path: '/admin/contacts', label: 'Liên hệ', roles: A },
    ],
  },
  {
    label: 'Hệ thống',
    icon: i(Gear),
    items: [
      { path: '/admin/users', label: 'Người dùng', roles: A },
      { path: '/admin/activity-logs', label: 'Nhật ký', roles: A },
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

// Nhóm chứa trang hiện tại, để mở sẵn nhóm đó khi vào thẳng URL hoặc F5.
export function activeGroup(pathname: string): string | undefined {
  const path = activePath(pathname)
  return ADMIN_MENU.find((g) => g.label && g.items.some((m) => m.path === path))?.label
}
