import { expect, test } from 'vitest'
import { eventStatus, type EventCard } from './home.data'

const event: EventCard = {
  id: '1',
  title: 'Seminar',
  startAt: '2026-10-20T02:00:00Z',
  venue: 'E7.2',
  registrationDeadline: '2026-10-18T16:59:59Z',
  capacity: 80,
  registeredCount: 57,
}
const before = new Date('2026-10-01T00:00:00Z')

test('còn chỗ', () => {
  expect(eventStatus(event, before)).toEqual({ label: 'Còn 23 chỗ', tone: 'success' })
})

test('đủ chỗ', () => {
  expect(eventStatus({ ...event, registeredCount: 80 }, before).label).toBe('Đã đủ chỗ')
})

test('hết hạn thắng đủ chỗ', () => {
  expect(eventStatus({ ...event, registeredCount: 80 }, new Date('2026-10-19T00:00:00Z')).label).toBe('Hết hạn đăng ký')
})
