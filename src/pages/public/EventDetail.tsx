import { useEffect, useRef, useState } from 'react'
import { data, Link, useLocation } from 'react-router'
import { CalendarBlank, CheckCircle, Clock, MapPin, UsersThree } from '@phosphor-icons/react'
import type { Route } from './+types/EventDetail'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { getDictionary } from '../../lib/dictionary'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
import { noIndex, seo, siteUrl } from '../../lib/seo'
import Badge from '../../components/ui/Badge'
import Button, { buttonClass } from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { canCancel, canRegister, eventErrorMessage, eventStatus, formatEventDateTime, isOpen, type PublicEvent } from './events.data'
import '../../components/post-list.css'
import './events.css'

// GET /api/public/events/{id} (PublicEventDto). Sự kiện nháp hoặc không tồn tại: 404.
// Loader SSR không mang cookie nên myRegistration luôn null; RegistrationBox gọi lại khi đã đăng nhập.
export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const locale = getLocaleFromPath(url.pathname)
  try {
    const event = await api<PublicEvent>(`/api/public/events/${encodeURIComponent(params.id)}`)
    return {
      event,
      badge: eventStatus(event, new Date(), locale),
      locale,
      url: `${siteUrl(request)}${locale === 'en' ? '/en' : ''}/events/${event.id}`,
    }
  } catch (e) {
    // 400: id sai định dạng, coi như không tồn tại.
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) throw data(null, { status: 404 })
    throw e
  }
}

const excerpt = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 160 ? `${flat.slice(0, 157).trimEnd()}...` : flat
}

export const meta: Route.MetaFunction = ({ loaderData: d, location }) => {
  if (d) return seo({ title: d.event.title, description: excerpt(d.event.description) || undefined, url: d.url, locale: d.locale })
  const locale = getLocaleFromPath(location.pathname)
  return noIndex(getDictionary(locale).eventNotFound, locale)
}

// Đăng ký / hủy đăng ký (FR-EVT-02, 03; AT-07). Không cập nhật lạc quan: chỉ đổi UI theo response của server.
function RegistrationBox({ event, onChange }: { event: PublicEvent; onChange: (e: PublicEvent) => void }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const { locale, t } = useDictionary()
  const [synced, setSynced] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const busyRef = useRef(false)
  const id = event.id

  // Lấy myRegistration của người đang đăng nhập (loader SSR không có cookie).
  useEffect(() => {
    if (!user) return
    let alive = true
    api<PublicEvent>(`/api/public/events/${id}`)
      .then((e) => alive && onChange(e))
      .catch(() => {})
      .finally(() => alive && setSynced(id))
    return () => {
      alive = false
    }
    // onChange đổi mỗi lần render của cha; chỉ cần gọi lại khi đổi người dùng hoặc sự kiện.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id])

  async function resync() {
    try {
      onChange(await api<PublicEvent>(`/api/public/events/${id}`))
    } catch {
      // Giữ dữ liệu cũ; thông báo lỗi đã hiện.
    }
  }

  async function run(method: 'POST' | 'DELETE') {
    if (busyRef.current) return // chống bấm lặp khi request trước chưa xong
    busyRef.current = true
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const path = method === 'POST' ? `/api/events/${id}/registrations` : `/api/events/${id}/registrations/me`
      onChange(await api<PublicEvent>(path, { method }))
      setSuccess(method === 'POST' ? t.registerSuccess : t.cancelSuccess)
    } catch (e) {
      setError(eventErrorMessage(e, locale))
      // Lỗi nghiệp vụ (đủ chỗ, hết hạn, đã đăng ký...): đồng bộ lại số chỗ và trạng thái. Lỗi mạng/5xx: không gửi lại.
      if (e instanceof ApiError && e.status < 500) await resync()
    } finally {
      busyRef.current = false
      setBusy(false)
      setConfirming(false)
    }
  }

  if (loading) return null

  const now = new Date()
  const status = eventStatus(event, now, locale)

  if (!user)
    return (
      <div className="event-box">
        {isOpen(event, now) ? (
          // /en/login không tồn tại: trang đăng nhập dùng chung, next giữ đúng trang đang xem.
          <Link to={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClass('primary')}>
            {t.signInToRegister}
          </Link>
        ) : (
          <p className="event-box__reason">{status.label}</p>
        )}
      </div>
    )

  const active = event.myRegistration === 'active'
  const ready = synced === id

  // Vùng role="status" nằm ngoài hộp flex và luôn có trong cây accessibility, để trình đọc màn hình đọc thông báo thành công.
  return (
    <div>
      <div className="event-box">
        {active && (
          <Badge tone="success">
            <CheckCircle size={14} weight="fill" aria-hidden /> {t.registered}
          </Badge>
        )}
        {active ? (
          canCancel(event, now) ? (
            <Button variant="secondary" loading={busy} onClick={() => setConfirming(true)}>{t.cancelRegistration}</Button>
          ) : (
            <p className="event-box__reason">{t.cancelClosedHint}</p>
          )
        ) : canRegister(event, now) ? (
          <Button loading={busy} disabled={!ready} onClick={() => run('POST')}>{t.register}</Button>
        ) : (
          <p className="event-box__reason">{status.label}</p>
        )}
        {error && <p role="alert" className="ui-error">{error}</p>}
      </div>
      <p role="status" className="event-box__success">
        {success && <><CheckCircle size={16} weight="fill" aria-hidden /> {success}</>}
      </p>
      <ConfirmDialog
        open={confirming}
        title={t.cancelConfirmTitle}
        confirmLabel={t.cancelRegistration}
        cancelLabel={t.keepRegistration}
        danger
        loading={busy}
        onConfirm={() => run('DELETE')}
        onCancel={() => setConfirming(false)}
      >
        {t.cancelConfirmBody}
      </ConfirmDialog>
    </div>
  )
}

export default function EventDetail({ loaderData }: Route.ComponentProps) {
  const { locale, t, lPath } = useDictionary()
  // Bản mới nhất từ server sau khi đăng ký/hủy/đồng bộ; chỉ dùng khi còn đúng sự kiện đang mở.
  const [latest, setLatest] = useState<PublicEvent | null>(null)
  const event = latest?.id === loaderData.event.id ? latest : loaderData.event
  const badge = latest?.id === loaderData.event.id ? eventStatus(latest, new Date(), locale) : loaderData.badge

  return (
    <article className="event-detail">
      <nav className="list-page__crumbs" aria-label={locale === 'en' ? 'Page location' : 'Vị trí trang'}>
        <Link to={lPath('/events')}>{t.events}</Link>
      </nav>
      <header className="event-detail__head">
        <h1>{event.title}</h1>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </header>

      <div className="event-detail__layout">
        <dl className="event-detail__facts">
          <div>
            <dt><Clock size={16} aria-hidden /> {t.eventTime}</dt>
            <dd>
              <time dateTime={event.startAt}>{formatEventDateTime(event.startAt, locale)}</time>
              {event.endAt && <> - <time dateTime={event.endAt}>{formatEventDateTime(event.endAt, locale)}</time></>}
            </dd>
          </div>
          <div>
            <dt><MapPin size={16} aria-hidden /> {t.eventVenue}</dt>
            <dd>{event.venue}</dd>
          </div>
          <div>
            <dt><CalendarBlank size={16} aria-hidden /> {t.eventDeadline}</dt>
            <dd><time dateTime={event.registrationDeadline}>{formatEventDateTime(event.registrationDeadline, locale)}</time></dd>
          </div>
          <div>
            <dt><UsersThree size={16} aria-hidden /> {t.eventSeats}</dt>
            <dd>{event.registeredCount}/{event.capacity}</dd>
          </div>
        </dl>
        <RegistrationBox event={event} onChange={setLatest} />
      </div>

      {/* Mô tả là text thuần: hiển thị như text, giữ xuống dòng bằng CSS, không dùng innerHTML. */}
      {event.description && <div className="event-detail__desc">{event.description}</div>}
    </article>
  )
}
