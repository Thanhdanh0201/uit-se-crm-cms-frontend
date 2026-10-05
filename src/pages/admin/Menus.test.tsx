// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import Menus from './Menus'
import type { MenuDto, MenuItemTreeDto } from '../../admin/menus'
import { mockApi, ok, renderPage } from '../../lib/test-utils'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const me = {
  '/api/auth/me': () =>
    ok({ id: 'u1', username: 'admin', fullName: 'Quản trị viên', role: 'admin', email: 'admin@uit.edu.vn' }),
}

const MENUS: MenuDto[] = [
  { id: 'm1', code: 'main', name: 'Menu Chính', itemCount: 3 },
  { id: 'm2', code: 'footer', name: 'Menu Chân trang', itemCount: 1 },
]

const TREE_ITEMS: MenuItemTreeDto[] = [
  {
    id: 'item-1',
    menuId: 'm1',
    parentId: null,
    label: 'Giới thiệu',
    kind: 'page',
    pageId: 'p1',
    pageTitle: 'Giới thiệu Khoa',
    pageSlug: 'gioi-thieu',
    categoryId: null,
    externalUrl: null,
    resolvedUrl: '/pages/gioi-thieu',
    sortOrder: 1,
    isVisible: true,
    depth: 1,
    children: [
      {
        id: 'item-1-1',
        menuId: 'm1',
        parentId: 'item-1',
        label: 'Ban Chủ nhiệm',
        kind: 'page',
        pageId: 'p2',
        pageTitle: 'Ban Chủ nhiệm',
        pageSlug: 'ban-chu-nhiem',
        categoryId: null,
        externalUrl: null,
        resolvedUrl: '/pages/ban-chu-nhiem',
        sortOrder: 1,
        isVisible: true,
        depth: 2,
        children: [
          {
            id: 'item-1-1-1',
            menuId: 'm1',
            parentId: 'item-1-1',
            label: 'Trưởng Khoa',
            kind: 'page',
            pageId: 'p3',
            pageTitle: 'Trưởng Khoa',
            pageSlug: 'truong-khoa',
            categoryId: null,
            externalUrl: null,
            resolvedUrl: '/pages/truong-khoa',
            sortOrder: 1,
            isVisible: true,
            depth: 3,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'item-2',
    menuId: 'm1',
    parentId: null,
    label: 'Trang lỗi đích',
    kind: 'page',
    pageId: 'p-deleted',
    pageTitle: null,
    pageSlug: null, // Bị xóa
    categoryId: null,
    externalUrl: null,
    resolvedUrl: null,
    sortOrder: 2,
    isVisible: false,
    depth: 1,
    children: [],
  },
]

function open(path = '/admin/menus?menu=m1') {
  return renderPage(path, '/admin/menus', <App><Menus /></App>)
}

test('hiển thị danh sách menu và cây phân cấp', async () => {
  mockApi({
    ...me,
    '/api/admin/menus': () => ok({ items: MENUS }),
    '/api/admin/menus/m1/items': () => ok(TREE_ITEMS),
    '/api/admin/menus/m1/tree': () => ok(TREE_ITEMS),
    '/api/admin/categories/tree': () => ok([]),
    '/api/admin/pages': () => ok({ items: [] }),
  })

  open()
  expect((await screen.findAllByText('Menu Chính')).length).toBeGreaterThan(0)
  expect(await screen.findByText('Menu Chân trang')).toBeTruthy()
  expect(await screen.findByText('Giới thiệu')).toBeTruthy()
  expect(await screen.findByText('Trang lỗi đích')).toBeTruthy()
})

test('mục ở cấp 3 vô hiệu hóa nút thêm mục con kèm nhãn giải thích', async () => {
  mockApi({
    ...me,
    '/api/admin/menus': () => ok({ items: MENUS }),
    '/api/admin/menus/m1/items': () => ok(TREE_ITEMS),
    '/api/admin/menus/m1/tree': () => ok(TREE_ITEMS),
    '/api/admin/categories/tree': () => ok([]),
    '/api/admin/pages': () => ok({ items: [] }),
  })

  open()
  expect(await screen.findByText('Trưởng Khoa')).toBeTruthy()
  const disabledBtn = screen.getByRole('button', { name: 'Đã ở cấp 3, không thêm mục con được' })
  expect(disabledBtn).toBeTruthy()
  expect(disabledBtn.hasAttribute('disabled')).toBe(true)
})

test('hiển thị cảnh báo khi trang đích của mục menu bị xóa', async () => {
  mockApi({
    ...me,
    '/api/admin/menus': () => ok({ items: MENUS }),
    '/api/admin/menus/m1/items': () => ok(TREE_ITEMS),
    '/api/admin/menus/m1/tree': () => ok(TREE_ITEMS),
    '/api/admin/categories/tree': () => ok([]),
    '/api/admin/pages': () => ok({ items: [] }),
  })

  open()
  expect(await screen.findByText('Trang đích đã bị xóa, chọn trang khác')).toBeTruthy()
})

test('bật/tắt hiển thị nhanh gọi API PATCH /visibility', async () => {
  let patchCalled = false
  mockApi({
    ...me,
    '/api/admin/menus': () => ok({ items: MENUS }),
    '/api/admin/menus/m1/items': () => ok(TREE_ITEMS),
    '/api/admin/menus/m1/tree': () => ok(TREE_ITEMS),
    '/api/admin/categories/tree': () => ok([]),
    '/api/admin/pages': () => ok({ items: [] }),
    '/api/admin/menu-items/item-1/visibility': (_, init) => {
      patchCalled = true
      const body = JSON.parse(String(init?.body))
      expect(body.isVisible).toBe(false)
      return ok()
    },
  })

  open()
  const switchInput = await screen.findByRole('switch', { name: 'Hiển thị mục Giới thiệu' })
  expect(switchInput).toBeTruthy()
  fireEvent.click(switchInput)

  await waitFor(() => {
    expect(patchCalled).toBe(true)
  })
})
