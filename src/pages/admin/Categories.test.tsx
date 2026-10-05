// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import Categories from './Categories'
import type { CategoryTreeDto, TagDto } from '../../admin/categories'
import { mockApi, ok, renderPage, reply } from '../../lib/test-utils'

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

const CATEGORIES: CategoryTreeDto[] = [
  {
    id: 'c1',
    name: 'Tin tức & Hoạt động',
    slug: 'tin-tuc-hoat-dong',
    description: 'Tin tức chung của khoa',
    parentId: null,
    sortOrder: 1,
    isVisible: true,
    postCount: 5,
    children: [
      {
        id: 'c1-1',
        name: 'Hoạt động sinh viên',
        slug: 'hoat-dong-sinh-vien',
        description: null,
        parentId: 'c1',
        sortOrder: 1,
        isVisible: true,
        postCount: 2,
        children: [],
      },
    ],
  },
  {
    id: 'c2',
    name: 'Đào tạo',
    slug: 'dao-tao',
    description: null,
    parentId: null,
    sortOrder: 2,
    isVisible: true,
    postCount: 10,
    children: [],
  },
  {
    id: 'c3',
    name: 'Chuyên mục trống',
    slug: 'chuyen-muc-trong',
    description: null,
    parentId: null,
    sortOrder: 3,
    isVisible: true,
    postCount: 0,
    children: [],
  },
]

const TAGS: TagDto[] = [
  { id: 't1', name: 'Trí tuệ nhân tạo', slug: 'tri-tue-nhan-tao', postCount: 8 },
  { id: 't2', name: 'Công nghệ phần mềm', slug: 'cong-nghe-phan-mem', postCount: 14 },
]

function open(path = '/admin/categories') {
  return renderPage(path, '/admin/categories', <App><Categories /></App>)
}

test('hiển thị cây chuyên mục với slug và số bài viết', async () => {
  mockApi({
    ...me,
    '/api/admin/categories/tree': () => ok(CATEGORIES),
  })

  open()
  expect(await screen.findByText('Tin tức & Hoạt động')).toBeTruthy()
  expect(await screen.findByText('Hoạt động sinh viên')).toBeTruthy()
  expect(await screen.findByText('Đào tạo')).toBeTruthy()
  expect(await screen.findByText('/categories/tin-tuc-hoat-dong')).toBeTruthy()
})

test('chuyển sang tab Thẻ hiển thị danh sách thẻ', async () => {
  mockApi({
    ...me,
    '/api/admin/categories/tree': () => ok(CATEGORIES),
    '/api/admin/tags': () => ok(TAGS),
  })

  open('/admin/categories?tab=tags')
  expect(await screen.findByText('Trí tuệ nhân tạo')).toBeTruthy()
  expect(await screen.findByText('Công nghệ phần mềm')).toBeTruthy()
  expect(await screen.findByText('/tags/tri-tue-nhan-tao')).toBeTruthy()
})

test('xóa chuyên mục có bài mở modal Xóa an toàn và yêu cầu chọn nơi chuyển', async () => {
  mockApi({
    ...me,
    '/api/admin/categories/tree': () => ok(CATEGORIES),
  })

  open()
  expect(await screen.findByText('Tin tức & Hoạt động')).toBeTruthy()

  const deleteBtn = screen.getByRole('button', { name: 'Xóa Tin tức & Hoạt động' })
  fireEvent.click(deleteBtn)

  expect(await screen.findByText('Xóa chuyên mục "Tin tức & Hoạt động"?')).toBeTruthy()
  expect(screen.getByText(/đang có 5 bài viết/)).toBeTruthy()

  // Nút xác nhận xóa trong modal bị disable khi chưa chọn đích
  const confirmBtn = screen.getByRole('button', { name: 'Chuyển và xóa' })
  expect(confirmBtn.hasAttribute('disabled')).toBe(true)
})

test('xóa thất bại không tự động xóa chuyên mục trên giao diện (no optimistic delete)', async () => {
  let deleteCalled = false
  mockApi({
    ...me,
    '/api/admin/categories/tree': () => ok(CATEGORIES),
    '/api/admin/categories/c3': () => {
      deleteCalled = true
      return reply(500, { detail: 'Lỗi máy chủ' })
    },
  })

  open()
  expect(await screen.findByText('Chuyên mục trống')).toBeTruthy()

  const deleteBtn = screen.getByRole('button', { name: 'Xóa Chuyên mục trống' })
  fireEvent.click(deleteBtn)

  // Popconfirm hiện nút Xóa
  const confirmBtn = await screen.findByRole('button', { name: 'Xóa' })
  fireEvent.click(confirmBtn)

  await waitFor(() => {
    expect(deleteCalled).toBe(true)
  })

  // Vẫn tồn tại trên giao diện vì server lỗi
  expect(screen.getByText('Chuyên mục trống')).toBeTruthy()
})

