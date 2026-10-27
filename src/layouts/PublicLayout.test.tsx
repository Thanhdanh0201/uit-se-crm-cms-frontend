// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import PublicLayout, { loader, type NavItem } from './PublicLayout'
import { AuthProvider } from '../lib/auth'
import { mockApi, ok } from '../lib/test-utils'

beforeAll(() => {
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

const guest = { '/api/auth/me': () => ok(null) }

const MULTI_LEVEL_NAV: NavItem[] = [
  {
    id: 'dao-tao',
    label: 'Đào tạo',
    kind: 'category',
    url: '/categories/dao-tao',
    children: [
      {
        id: 'dai-hoc',
        label: 'Đại học',
        kind: 'category',
        url: '/categories/dai-hoc',
        children: [
          {
            id: 'chinh-quy',
            label: 'Chính quy',
            kind: 'category',
            url: '/categories/chinh-quy',
            children: [
              {
                id: 'ct-chuan',
                label: 'Chương trình Chuẩn',
                kind: 'page',
                url: '/pages/chuong-trinh-chuan',
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'sau-dai-hoc',
        label: 'Sau đại học',
        kind: 'category',
        url: '/categories/sau-dai-hoc',
        children: [],
      },
    ],
  },
  {
    id: 'tin-tuc',
    label: 'Tin tức',
    kind: 'route',
    url: '/search',
    children: [],
  },
]

function renderLayout(path = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        loader,
        element: <PublicLayout />,
        children: [{ index: true, element: <div>Nội dung trang chủ</div> }],
      },
      {
        path: '/en',
        loader,
        element: <PublicLayout />,
        children: [{ index: true, element: <div>English Home</div> }],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return router
}

test('hiển thị menu công khai đa tầng 4 cấp trên desktop navigation', async () => {
  mockApi({
    ...guest,
    '/api/public/menus/main': () => ok({ items: MULTI_LEVEL_NAV }),
  })

  renderLayout()

  const nav = await screen.findByRole('navigation', { name: 'Điều hướng chính' })
  expect(within(nav).getByRole('link', { name: 'Đào tạo' })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: 'Đại học' })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: 'Chính quy' })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: 'Chương trình Chuẩn' })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: 'Sau đại học' })).toBeTruthy()
  expect(within(nav).getByRole('link', { name: 'Tin tức' })).toBeTruthy()
})

test('nạp menu theo locale từ query param', async () => {
  let calledUrl = ''
  mockApi({
    ...guest,
    '/api/public/menus/main': (url) => {
      calledUrl = url
      return ok({ items: MULTI_LEVEL_NAV })
    },
  })

  renderLayout('/?locale=en')

  await screen.findByRole('navigation', { name: /Điều hướng chính|Main navigation/ })
  expect(calledUrl).toContain('locale=en')
})

test('nhấn phím Escape khi đang focus trong menu sẽ blur khỏi menu', async () => {
  mockApi({
    ...guest,
    '/api/public/menus/main': () => ok({ items: MULTI_LEVEL_NAV }),
  })

  renderLayout()

  const nav = await screen.findByRole('navigation', { name: 'Điều hướng chính' })
  const link = within(nav).getByRole('link', { name: 'Đại học' })
  link.focus()
  expect(document.activeElement).toBe(link)

  await userEvent.keyboard('{Escape}')
  expect(document.activeElement).not.toBe(link)
})

test('mobile menu: dạng cây thụt lề đóng/mở từng nhánh con độc lập', async () => {
  mockApi({
    ...guest,
    '/api/public/menus/main': () => ok({ items: MULTI_LEVEL_NAV }),
  })

  renderLayout()

  const mobileNav = await screen.findByRole('navigation', { name: 'Điều hướng chính trên di động' })
  expect(within(mobileNav).getByRole('link', { name: 'Đào tạo' })).toBeTruthy()

  // Ban đầu nhánh con cấp 2 chưa mở
  expect(within(mobileNav).queryByRole('link', { name: 'Đại học' })).toBeNull()

  // Bấm nút mở rộng nhánh "Đào tạo"
  const toggleDaoTao = within(mobileNav).getByRole('button', { name: 'Mở rộng Đào tạo' })
  expect(toggleDaoTao.getAttribute('aria-expanded')).toBe('false')
  await userEvent.click(toggleDaoTao)

  // Nhánh "Đào tạo" đã mở, hiện "Đại học" và "Sau đại học"
  expect(toggleDaoTao.getAttribute('aria-expanded')).toBe('true')
  expect(within(mobileNav).getByRole('link', { name: 'Đại học' })).toBeTruthy()
  expect(within(mobileNav).getByRole('link', { name: 'Sau đại học' })).toBeTruthy()

  // Bấm tiếp nút mở rộng nhánh "Đại học"
  const toggleDaiHoc = within(mobileNav).getByRole('button', { name: 'Mở rộng Đại học' })
  await userEvent.click(toggleDaiHoc)
  expect(within(mobileNav).getByRole('link', { name: 'Chính quy' })).toBeTruthy()

  // Bấm tiếp nút mở rộng nhánh "Chính quy" -> thấy cấp 4 "Chương trình Chuẩn"
  const toggleChinhQuy = within(mobileNav).getByRole('button', { name: 'Mở rộng Chính quy' })
  await userEvent.click(toggleChinhQuy)
  expect(within(mobileNav).getByRole('link', { name: 'Chương trình Chuẩn' })).toBeTruthy()

  // Bấm thu gọn "Đào tạo"
  await userEvent.click(within(mobileNav).getByRole('button', { name: 'Thu gọn Đào tạo' }))
  expect(within(mobileNav).queryByRole('link', { name: 'Đại học' })).toBeNull()
})

test('combobox ngôn ngữ hiển thị và chuyển hướng về trang chủ tương ứng khi đổi ngôn ngữ', async () => {
  mockApi({
    ...guest,
    '/api/public/menus/main': () => ok({ items: MULTI_LEVEL_NAV }),
  })

  const router = renderLayout('/')

  const comboboxes = await screen.findAllByRole('combobox', { name: 'Chọn ngôn ngữ' })
  const desktopCombobox = comboboxes[0]
  expect(desktopCombobox).toBeTruthy()
  expect((desktopCombobox as HTMLSelectElement).value).toBe('vi')

  // Đổi sang tiếng Anh -> chuyển hướng sang /en
  await userEvent.selectOptions(desktopCombobox, 'en')
  expect(router.state.location.pathname).toBe('/en')
})

test('site tiếng Anh hiển thị nhãn tiếng Anh và nạp menu locale=en', async () => {
  let calledUrl = ''
  mockApi({
    ...guest,
    '/api/public/menus/main': (url) => {
      calledUrl = url
      return ok({ items: MULTI_LEVEL_NAV })
    },
  })

  const router = createMemoryRouter(
    [
      {
        path: '/en',
        loader,
        element: <PublicLayout />,
        children: [{ index: true, element: <div>English Home</div> }],
      },
      {
        path: '/',
        loader,
        element: <PublicLayout />,
        children: [{ index: true, element: <div>Trang chủ</div> }],
      },
    ],
    { initialEntries: ['/en'] },
  )

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )

  const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
  expect(nav).toBeTruthy()
  expect(calledUrl).toContain('locale=en')

  // Combobox có aria-label tiếng Anh và value là en
  const comboboxes = await screen.findAllByRole('combobox', { name: 'Select language' })
  expect((comboboxes[0] as HTMLSelectElement).value).toBe('en')

  // Đổi từ en về vi -> chuyển về /
  await userEvent.selectOptions(comboboxes[0], 'vi')
  expect(router.state.location.pathname).toBe('/')
})

test('chuyển đổi ngôn ngữ cập nhật menu theo locale tương ứng', async () => {
  const EN_NAV: NavItem[] = [
    {
      id: 'en-home',
      label: 'Homepage',
      kind: 'external',
      url: '/en',
      children: [],
    },
  ]
  let lastLocale = ''
  mockApi({
    ...guest,
    '/api/public/menus/main': (url) => {
      if (url.includes('locale=en')) {
        lastLocale = 'en'
        return ok({ items: EN_NAV })
      }
      lastLocale = 'vi'
      return ok({ items: MULTI_LEVEL_NAV })
    },
  })

  renderLayout('/')

  const initialNav = await screen.findByRole('navigation', { name: 'Điều hướng chính' })
  expect(within(initialNav).getByRole('link', { name: 'Đào tạo' })).toBeTruthy()

  const comboboxes = await screen.findAllByRole('combobox', { name: 'Chọn ngôn ngữ' })
  await userEvent.selectOptions(comboboxes[0], 'en')

  const enNav = await screen.findByRole('navigation', { name: 'Main navigation' })
  expect(await within(enNav).findByRole('link', { name: 'Homepage' })).toBeTruthy()
  expect(lastLocale).toBe('en')
})

