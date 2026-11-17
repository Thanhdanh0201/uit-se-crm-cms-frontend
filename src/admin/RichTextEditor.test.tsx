// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RichTextEditor } from './RichTextEditor'
import type { RichNode } from '../components/PostArticle'

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  document.elementFromPoint ??= () => null
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})
afterEach(cleanup)

const find = (n: RichNode, type: string): RichNode[] => [...(n.type === type ? [n] : []), ...(n.content ?? []).flatMap((c) => find(c, type))]

test('chèn bảng có hàng tiêu đề; trong bảng hiện công cụ bảng, thêm hàng; không chèn bảng trong bảng', async () => {
  const onChange = vi.fn()
  render(<RichTextEditor initial={{ type: 'doc', content: [{ type: 'paragraph' }] }} onChange={onChange} onMediaAdded={() => {}} labelledBy="x" />)
  await userEvent.click(await screen.findByRole('button', { name: 'Chèn bảng' }))
  const pop = await screen.findByRole('tooltip').catch(() => document.body)
  await userEvent.tripleClick(within(pop).getByLabelText('Số hàng'))
  await userEvent.keyboard('2')
  await userEvent.tripleClick(within(pop).getByLabelText('Số cột'))
  await userEvent.keyboard('4')
  await userEvent.click(within(pop).getByRole('button', { name: 'Tạo bảng' }))

  await waitFor(() => expect(onChange).toHaveBeenCalled())
  const doc = onChange.mock.calls.at(-1)![0] as RichNode
  const rows = find(doc, 'tableRow')
  expect(rows).toHaveLength(2)
  expect(rows[0].content!.map((c) => c.type)).toEqual(['tableHeader', 'tableHeader', 'tableHeader', 'tableHeader'])

  // Con trỏ đang trong bảng: hiện nhóm công cụ bảng, nút chèn bảng bị khóa.
  const tools = await screen.findByRole('group', { name: 'Công cụ bảng' })
  expect((screen.getByRole('button', { name: 'Chèn bảng' }) as HTMLButtonElement).disabled).toBe(true)
  await userEvent.click(within(tools).getByRole('button', { name: 'Thêm hàng phía dưới' }))
  await waitFor(() => expect(find(onChange.mock.calls.at(-1)![0] as RichNode, 'tableRow')).toHaveLength(3))
})

test('màu chữ chỉ chọn trong bảng màu cố định', async () => {
  const onChange = vi.fn()
  render(<RichTextEditor initial={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hạn nộp hồ sơ' }] }] }} onChange={onChange} onMediaAdded={() => {}} labelledBy="x" />)
  await userEvent.click(await screen.findByRole('button', { name: 'Màu chữ' }))
  const swatches = await screen.findByRole('group', { name: 'Màu chữ' })
  expect(within(swatches).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(
    ['Màu chữ: Đen', 'Màu chữ: Xám', 'Màu chữ: Đỏ', 'Màu chữ: Cam', 'Màu chữ: Xanh lá', 'Màu chữ: Xanh UIT'],
  )
})
