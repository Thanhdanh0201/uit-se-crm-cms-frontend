// Sự kiện phía người dùng (SCRUM-46, FR-EVT-01..03). DTO theo backend PublicEventDto (EventController/EventService).
// Dùng chung cho trang chủ (khối Sự kiện sắp diễn ra), /events, /events/:id và /me/events.

import { ApiError } from '../../lib/api'
import type { Locale } from '../../lib/dictionary'

// Phần tối thiểu để tính nhãn trạng thái (khối sự kiện trang chủ chỉ có các trường này).
export type EventCard = {
  id: string
  title: string
  startAt: string
  venue: string
  registrationDeadline: string
  capacity: number
  registeredCount: number
  status?: PublicEventStatus
}

export type PublicEventStatus = 'published' | 'closed' | 'cancelled'
export type RegistrationStatus = 'active' | 'cancelled'

// GET /api/public/events/{id}. description là text thuần (không phải rich text). myRegistration chỉ có khi gọi kèm cookie
// (loader SSR không mang cookie nên luôn null; client gọi lại khi đã đăng nhập).
export type PublicEvent = EventCard & {
  description: string
  endAt: string | null
  status: PublicEventStatus
  createdAt: string
  updatedAt: string
  myRegistration: RegistrationStatus | null
}

export type EventPage = { items: PublicEvent[]; totalItems: number; page: number; pageSize: number; totalPages: number }

// GET /api/me/registrations: gồm cả lượt đã hủy.
export type MyRegistration = { event: PublicEvent; status: RegistrationStatus; registeredAt: string; cancelledAt: string | null }
export type MyRegistrationPage = { items: MyRegistration[]; totalItems: number; page: number; pageSize: number; totalPages: number }

export type EventStatus = { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }

const deadlinePassed = (e: EventCard, now: Date) => now > new Date(e.registrationDeadline)

// Nhãn trạng thái đăng ký. Ưu tiên: trạng thái sự kiện > hết hạn > đủ chỗ > còn chỗ.
// Tính ở loader (server) để HTML server và client giống nhau khi hydrate.
export function eventStatus(e: EventCard, now = new Date(), locale: Locale = 'vi'): EventStatus {
  const en = locale === 'en'
  if (e.status === 'cancelled') return { label: en ? 'Event cancelled' : 'Sự kiện đã hủy', tone: 'danger' }
  if (e.status === 'closed') return { label: en ? 'Registration stopped' : 'Ngừng nhận đăng ký', tone: 'neutral' }
  if (deadlinePassed(e, now)) return { label: en ? 'Registration deadline passed' : 'Hết hạn đăng ký', tone: 'neutral' }
  const left = e.capacity - e.registeredCount
  if (left <= 0) return { label: en ? 'Fully booked' : 'Đã đủ chỗ', tone: 'warning' }
  return { label: en ? `${left} seat${left === 1 ? '' : 's'} left` : `Còn ${left} chỗ`, tone: 'success' }
}

// Còn nhận đăng ký (không xét người dùng): đang mở, chưa qua hạn, còn chỗ.
export function isOpen(e: EventCard, now = new Date()): boolean {
  return (e.status ?? 'published') === 'published' && !deadlinePassed(e, now) && e.registeredCount < e.capacity
}

export function canRegister(e: PublicEvent, now = new Date()): boolean {
  return e.myRegistration !== 'active' && isOpen(e, now)
}

// Backend chặn hủy sau hạn đăng ký (422 cancel_closed).
export function canCancel(e: PublicEvent, now = new Date()): boolean {
  return e.myRegistration === 'active' && e.status !== 'cancelled' && !deadlinePassed(e, now)
}

const MESSAGES: Record<string, { vi: string; en: string }> = {
  event_full: { vi: 'Sự kiện đã đủ chỗ.', en: 'This event is fully booked.' },
  registration_closed: { vi: 'Sự kiện đã hết hạn đăng ký.', en: 'The registration deadline has passed.' },
  event_closed: { vi: 'Sự kiện đã ngừng nhận đăng ký.', en: 'This event is no longer accepting registrations.' },
  already_registered: { vi: 'Bạn đã đăng ký sự kiện này rồi.', en: 'You have already registered for this event.' },
  cancel_closed: { vi: 'Đã quá hạn hủy đăng ký sự kiện này.', en: 'The cancellation deadline for this event has passed.' },
  not_registered: { vi: 'Bạn chưa đăng ký sự kiện này hoặc đã hủy trước đó.', en: 'You are not registered for this event or have already cancelled.' },
}

// Thông báo lỗi khi đăng ký/hủy. Lỗi mạng hoặc 5xx: không tự gửi lại (có thể server đã ghi), mời người dùng thử lại.
export function eventErrorMessage(err: unknown, locale: Locale = 'vi'): string {
  const en = locale === 'en'
  if (!(err instanceof ApiError) || err.status >= 500) return en ? 'Could not send. Check your connection and try again.' : 'Chưa gửi được, kiểm tra mạng rồi thử lại.'
  const known = err.code ? MESSAGES[err.code] : undefined
  if (known) return known[locale]
  if (err.status === 404) return en ? 'This event no longer exists.' : 'Sự kiện không còn tồn tại.'
  return err.message
}

const intlLocale = (locale: Locale) => (locale === 'en' ? 'en-US' : 'vi-VN')

// Ngày giờ đầy đủ theo giờ Việt Nam, ví dụ "thứ Hai, 20/10/2026, 09:00".
export function formatEventDateTime(iso: string, locale: Locale = 'vi'): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// Ô ngày trên thẻ sự kiện: ngày và tháng viết tắt.
export function eventDayMonth(iso: string, locale: Locale = 'vi'): { day: string; month: string } {
  const d = new Date(iso)
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'Asia/Ho_Chi_Minh', ...o }).format(d)
  return { day: fmt({ day: '2-digit' }), month: fmt({ month: 'short' }) }
}
