// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import Users, { type UserRow } from './Users'
import { type ImportRow } from '../../admin/UserImportDrawer'
import { mockApi, ok, renderPage } from '../../lib/test-utils'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ME: UserRow = { id: 'me', email: 'admin@uit.edu.vn', username: 'admin.khoa', fullName: 'Quản trị Khoa', role: 'admin', isActive: true, createdAt: '2026-09-01T02:00:00Z' }
const AN: UserRow = { id: 'u2', email: 'an24520100@gm.uit.edu.vn', username: '24520100', fullName: 'Trần Minh An', role: 'student', isActive: true, createdAt: '2026-09-20T02:00:00Z' }
const base = {
  '/api/auth/me': () => ok({ id: 'me', username: ME.username, fullName: ME.fullName, role: 'admin', email: ME.email }),
  '/api/admin/users': () => ok({ items: [ME, AN], totalItems: 2, page: 1, pageSize: 10, totalPages: 1 }),
}
const open = (path = '/admin/users') => renderPage(path, '/admin/users', <App><Users /></App>)
const body = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body))

// XHR giả cho upload(): ghi lại URL (dryRun) và trả kết quả theo lượt gọi.
function mockXhr(handle: (url: string) => { status: number; body: unknown }) {
  const urls: string[] = []
  class FakeXhr {
    status = 0
    responseText = ''
    withCredentials = false
    upload = { onprogress: null as ((e: ProgressEvent) => void) | null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    private url = ''
    open(_method: string, url: string) { this.url = url }
    setRequestHeader() {}
    send() {
      urls.push(this.url)
      setTimeout(() => {
        const r = handle(this.url)
        this.status = r.status
        this.responseText = JSON.stringify(r.body)
        this.onload?.()
      })
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  return urls
}

const row = (n: number, extra: Partial<ImportRow> = {}): ImportRow => ({
  row: n, fullName: `Sinh viên ${n}`, email: `sv${n}@gm.uit.edu.vn`, username: `2452010${n}`, role: 'student', status: 'valid', errors: [], ...extra,
})

test('đặt lại mật khẩu tạm: gửi newPassword null, hiện mật khẩu một lần; không đặt lại được cho chính mình', async () => {
  const api = mockApi({ ...base, '/api/admin/users/u2/reset-password': () => ok({ temporaryPassword: 'Kx7mPq2rT9wa' }) })
  open()
  expect(((await screen.findByLabelText('Đổi mật khẩu của bạn ở trang Tài khoản')) as HTMLButtonElement).disabled).toBe(true)

  await userEvent.click(screen.getByLabelText('Đặt lại mật khẩu Trần Minh An'))
  const dialog = await screen.findByRole('dialog')
  await userEvent.click(within(dialog).getByText('Đặt lại mật khẩu').closest('button')!)
  expect(await within(dialog).findByText('Kx7mPq2rT9wa')).toBeTruthy()
  expect(within(dialog).getByText('Mật khẩu tạm chỉ hiện một lần')).toBeTruthy()
  expect(body(api.calls('/api/admin/users/u2/reset-password')[0])).toEqual({ newPassword: null })
})

test('tự đặt mật khẩu: kiểm tra độ dài trước khi gửi', async () => {
  const api = mockApi({ ...base, '/api/admin/users/u2/reset-password': () => ok({ temporaryPassword: null }) })
  open()
  await userEvent.click(await screen.findByLabelText('Đặt lại mật khẩu Trần Minh An'))
  const dialog = await screen.findByRole('dialog')
  await userEvent.click(within(dialog).getByText('Tự đặt mật khẩu'))
  await userEvent.type(await within(dialog).findByLabelText('Nhập mật khẩu mới'), '123')
  await userEvent.click(within(dialog).getByText('Đặt lại mật khẩu').closest('button')!)
  expect(await within(dialog).findByText('Mật khẩu tối thiểu 6 ký tự.')).toBeTruthy()
  expect(api.calls('/api/admin/users/u2/reset-password')).toHaveLength(0)

  await userEvent.type(within(dialog).getByLabelText('Nhập mật khẩu mới'), '456789')
  await userEvent.click(within(dialog).getByText('Đặt lại mật khẩu').closest('button')!)
  await waitFor(() => expect(api.calls('/api/admin/users/u2/reset-password')).toHaveLength(1))
  expect(body(api.calls('/api/admin/users/u2/reset-password')[0])).toEqual({ newPassword: '123456789' })
})

test('nhập Excel: xem trước báo lỗi từng dòng, chỉ tạo khi xác nhận, nhắc người dùng đổi mật khẩu lần đầu', async () => {
  const api = mockApi(base)
  const urls = mockXhr((url) =>
    url.includes('dryRun=true')
      ? { status: 200, body: { success: true, data: { dryRun: true, totalRows: 2, validRows: 1, createdRows: 0, failedRows: 0, rows: [row(1), row(2, { status: 'invalid', errors: ['Tên đăng nhập đã có tài khoản.'] })] } } }
      : { status: 200, body: { success: true, data: { dryRun: false, totalRows: 2, validRows: 1, createdRows: 1, failedRows: 0, rows: [row(1, { status: 'created' }), row(2, { status: 'invalid', errors: ['Tên đăng nhập đã có tài khoản.'] })] } } },
  )
  open('/admin/users?action=import')
  const drawer = await screen.findByRole('dialog')

  // Sai loại file: chặn ở client, không gửi.
  // antd tạo lại thẻ input sau mỗi lần chọn file: lấy lại trước mỗi lần upload.
  const input = () => drawer.querySelector('input[type=file]') as HTMLInputElement
  await userEvent.upload(input(), new File(['a,b'], 'danh-sach.csv', { type: 'text/csv' }), { applyAccept: false })
  expect(await within(drawer).findByText(/Chỉ nhận file Excel .xlsx/)).toBeTruthy()
  expect(urls).toHaveLength(0)

  await userEvent.upload(input(), new File(['PK'], 'lop-ktpm.xlsx'))
  expect(await within(drawer).findByText('2 dòng: 1 hợp lệ, 1 lỗi.')).toBeTruthy()
  expect(within(drawer).getByText('Tên đăng nhập đã có tài khoản.')).toBeTruthy()
  expect(urls).toEqual(['/api/admin/users/import?dryRun=true'])

  await userEvent.click(screen.getByText('Tạo 1 tài khoản').closest('button')!)
  const confirm = (await screen.findAllByText('Tạo 1 tài khoản?')).at(-1)!.closest('.ant-modal')! as HTMLElement
  await userEvent.click(within(confirm).getByText('Tạo tài khoản').closest('button')!)

  expect(await within(drawer).findByText('Đã tạo 1/2 tài khoản.')).toBeTruthy()
  expect(urls).toEqual(['/api/admin/users/import?dryRun=true', '/api/admin/users/import?dryRun=false'])
  expect(within(drawer).getByText(/Lần đăng nhập đầu, hệ thống bắt đổi mật khẩu/)).toBeTruthy()
  // Tạo xong thì tải lại danh sách người dùng.
  await waitFor(() => expect(api.calls('/api/admin/users').length).toBeGreaterThan(1))
})
