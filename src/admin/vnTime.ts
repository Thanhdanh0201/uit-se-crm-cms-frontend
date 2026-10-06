import dayjs, { type Dayjs } from 'dayjs'

// Giờ Việt Nam (Asia/Ho_Chi_Minh) cố định UTC+7, không có giờ mùa hè. Backend lưu UTC.
// DatePicker của antd làm việc theo múi giờ của trình duyệt; hai hàm dưới coi giá trị trên picker là giờ Việt Nam
// để admin ở máy đặt múi giờ khác vẫn hẹn đúng giờ (SCRUM-54).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

/** Giá trị trên DatePicker (đọc như giờ Việt Nam) -> ISO UTC gửi API. */
export function vnPickerToUtc(v: Dayjs): string {
  return new Date(Date.UTC(v.year(), v.month(), v.date(), v.hour(), v.minute()) - VN_OFFSET_MS).toISOString()
}

/** ISO UTC từ API -> giá trị DatePicker hiển thị đúng giờ Việt Nam. */
export function utcToVnPicker(iso: string): Dayjs {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS)
  return dayjs(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()))
}

export type ScheduleState = 'scheduled' | 'live' | 'expired'

/** Trạng thái hiển thị công khai của nội dung đã xuất bản theo publishedAt/expiresAt. Null nếu chưa xuất bản. */
export function scheduleState(item: { status: string; publishedAt: string | null; expiresAt?: string | null }, now = new Date()): ScheduleState | null {
  if (item.status !== 'published') return null
  if (item.publishedAt && new Date(item.publishedAt) > now) return 'scheduled'
  if (item.expiresAt && new Date(item.expiresAt) <= now) return 'expired'
  return 'live'
}

export const SCHEDULE_LABEL: Record<ScheduleState, { label: string; color: string }> = {
  scheduled: { label: 'Hẹn giờ', color: 'blue' },
  live: { label: 'Đang hiện', color: 'green' },
  expired: { label: 'Đã hết hạn', color: 'default' },
}
