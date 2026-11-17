import { expect, test } from 'vitest'
import { ApiError } from '../../lib/api'
import { canCancel, canRegister, eventErrorMessage, eventStatus, formatEventDateTime, type PublicEvent } from './events.data'

const now = new Date('2026-10-20T00:00:00Z')
const ev = (o: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'e1', title: 'Hội thảo AI-SE 2026', description: '', startAt: '2026-10-30T02:00:00Z', endAt: null, venue: 'Hội trường A',
  registrationDeadline: '2026-10-25T00:00:00Z', capacity: 50, registeredCount: 10, status: 'published', createdAt: '', updatedAt: '', myRegistration: null, ...o,
})

test('eventStatus: cancelled > closed > hết hạn > đủ chỗ > còn N chỗ', () => {
  expect(eventStatus(ev({ status: 'cancelled', registeredCount: 50 }), now).label).toBe('Sự kiện đã hủy')
  expect(eventStatus(ev({ status: 'closed' }), now).label).toBe('Ngừng nhận đăng ký')
  expect(eventStatus(ev({ registrationDeadline: '2026-10-19T00:00:00Z' }), now).label).toBe('Hết hạn đăng ký')
  // hết hạn thắng đủ chỗ
  expect(eventStatus(ev({ registrationDeadline: '2026-10-19T00:00:00Z', registeredCount: 50 }), now).label).toBe('Hết hạn đăng ký')
  expect(eventStatus(ev({ registeredCount: 50 }), now)).toEqual({ label: 'Đã đủ chỗ', tone: 'warning' })
  expect(eventStatus(ev({ registeredCount: 49 }), now)).toEqual({ label: 'Còn 1 chỗ', tone: 'success' })
  expect(eventStatus(ev(), now).label).toBe('Còn 40 chỗ')
})

test('eventStatus: nhãn tiếng Anh, số ít/số nhiều', () => {
  expect(eventStatus(ev({ status: 'cancelled' }), now, 'en').label).toBe('Event cancelled')
  expect(eventStatus(ev({ registeredCount: 49 }), now, 'en').label).toBe('1 seat left')
  expect(eventStatus(ev(), now, 'en').label).toBe('40 seats left')
  expect(eventStatus(ev({ registeredCount: 50 }), now, 'en').label).toBe('Fully booked')
})

test('canRegister: đúng hạn còn được, quá hạn 1 ms hết; đủ chỗ, đã đăng ký, closed thì không', () => {
  const deadline = new Date('2026-10-25T00:00:00Z')
  expect(canRegister(ev(), deadline)).toBe(true)
  expect(canRegister(ev(), new Date(deadline.getTime() + 1))).toBe(false)
  expect(canRegister(ev({ registeredCount: 49 }), now)).toBe(true)
  expect(canRegister(ev({ registeredCount: 50 }), now)).toBe(false)
  expect(canRegister(ev({ myRegistration: 'active' }), now)).toBe(false)
  expect(canRegister(ev({ myRegistration: 'cancelled' }), now)).toBe(true)
  expect(canRegister(ev({ status: 'closed' }), now)).toBe(false)
  expect(canRegister(ev({ status: 'cancelled' }), now)).toBe(false)
})

test('canCancel: chỉ khi đang đăng ký, chưa hủy sự kiện, chưa quá hạn (biên đúng hạn)', () => {
  const deadline = new Date('2026-10-25T00:00:00Z')
  const mine = ev({ myRegistration: 'active' })
  expect(canCancel(mine, deadline)).toBe(true)
  expect(canCancel(mine, new Date(deadline.getTime() + 1))).toBe(false)
  expect(canCancel(ev(), now)).toBe(false)
  expect(canCancel(ev({ myRegistration: 'cancelled' }), now)).toBe(false)
  expect(canCancel(ev({ myRegistration: 'active', status: 'cancelled' }), now)).toBe(false)
  // đủ chỗ hoặc closed vẫn hủy được trước hạn
  expect(canCancel(ev({ myRegistration: 'active', status: 'closed', registeredCount: 50 }), now)).toBe(true)
})

test('eventErrorMessage: từng mã, lỗi mạng, 5xx, 404, mã lạ', () => {
  const err = (status: number, code?: string, msg = 'Chi tiết từ server') => new ApiError(status, msg, undefined, code)
  expect(eventErrorMessage(err(422, 'event_full'))).toBe('Sự kiện đã đủ chỗ.')
  expect(eventErrorMessage(err(422, 'registration_closed'))).toBe('Sự kiện đã hết hạn đăng ký.')
  expect(eventErrorMessage(err(422, 'event_closed'))).toBe('Sự kiện đã ngừng nhận đăng ký.')
  expect(eventErrorMessage(err(409, 'already_registered'))).toBe('Bạn đã đăng ký sự kiện này rồi.')
  expect(eventErrorMessage(err(422, 'cancel_closed'))).toBe('Đã quá hạn hủy đăng ký sự kiện này.')
  expect(eventErrorMessage(err(404, 'not_registered'))).toBe('Bạn chưa đăng ký sự kiện này hoặc đã hủy trước đó.')
  expect(eventErrorMessage(err(422, 'event_full'), 'en')).toBe('This event is fully booked.')
  expect(eventErrorMessage(err(404))).toBe('Sự kiện không còn tồn tại.')
  expect(eventErrorMessage(err(404), 'en')).toBe('This event no longer exists.')
  expect(eventErrorMessage(err(422, 'ma_la', 'Thông điệp riêng'))).toBe('Thông điệp riêng')
  expect(eventErrorMessage(err(400))).toBe('Chi tiết từ server')
  expect(eventErrorMessage(new TypeError('Failed to fetch'))).toBe('Chưa gửi được, kiểm tra mạng rồi thử lại.')
  expect(eventErrorMessage(err(500, 'event_full'))).toBe('Chưa gửi được, kiểm tra mạng rồi thử lại.')
  expect(eventErrorMessage(new TypeError('x'), 'en')).toBe('Could not send. Check your connection and try again.')
})

test('formatEventDateTime: giờ Việt Nam, ISO sai trả rỗng', () => {
  expect(formatEventDateTime('2026-10-20T02:00:00Z')).toContain('09:00')
  expect(formatEventDateTime('2026-10-20T02:00:00Z')).toContain('20/10/2026')
  expect(formatEventDateTime('khong-phai-ngay')).toBe('')
})
