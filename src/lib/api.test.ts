import { expect, test } from 'vitest'
import { toApiError } from './api'

test('đọc ProblemDetails', () => {
  const e = toApiError(400, { title: 'Validation', detail: 'Email sai', errors: { email: ['Sai'] } })
  expect([e.status, e.message, e.errors?.email[0]]).toEqual([400, 'Email sai', 'Sai'])
})

test('đọc { message } của login 401', () => {
  expect(toApiError(401, { message: 'Sai tài khoản' }).message).toBe('Sai tài khoản')
})

test('body rỗng vẫn có message', () => {
  expect(toApiError(500, undefined).message).toBe('Yêu cầu thất bại (500).')
})
