import { afterEach, expect, test, vi } from 'vitest'
import dayjs from 'dayjs'
import { scheduleState, utcToVnPicker, vnPickerToUtc } from './vnTime'

afterEach(() => vi.unstubAllEnvs())

test('8:00 ngày 10/10/2026 giờ Việt Nam là 01:00 UTC, đổi qua lại không lệch', () => {
  const picked = dayjs(new Date(2026, 9, 10, 8, 0))
  expect(vnPickerToUtc(picked)).toBe('2026-10-10T01:00:00.000Z')
  const back = utcToVnPicker('2026-10-10T01:00:00.000Z')
  expect([back.year(), back.month(), back.date(), back.hour(), back.minute()]).toEqual([2026, 9, 10, 8, 0])
})

test('qua nửa đêm: 23:30 giờ Việt Nam ngày 1/1 là 16:30 UTC cùng ngày', () => {
  expect(vnPickerToUtc(dayjs(new Date(2027, 0, 1, 23, 30)))).toBe('2027-01-01T16:30:00.000Z')
  const back = utcToVnPicker('2026-12-31T20:00:00Z') // 03:00 ngày 1/1/2027 giờ Việt Nam
  expect([back.year(), back.month(), back.date(), back.hour()]).toEqual([2027, 0, 1, 3])
})

test('scheduleState', () => {
  const now = new Date('2026-10-06T03:00:00Z')
  expect(scheduleState({ status: 'draft', publishedAt: null }, now)).toBeNull()
  expect(scheduleState({ status: 'published', publishedAt: '2026-10-07T00:00:00Z' }, now)).toBe('scheduled')
  expect(scheduleState({ status: 'published', publishedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-05T00:00:00Z' }, now)).toBe('expired')
  expect(scheduleState({ status: 'published', publishedAt: '2026-10-01T00:00:00Z', expiresAt: null }, now)).toBe('live')
})
