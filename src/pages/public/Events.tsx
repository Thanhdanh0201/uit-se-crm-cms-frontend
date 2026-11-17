import { Link, useSearchParams } from 'react-router'
import { CalendarBlank, MapPin } from '@phosphor-icons/react'
import type { Route } from './+types/Events'
import { api } from '../../lib/api'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
import { seo, siteUrl } from '../../lib/seo'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import { EmptyState } from '../../components/ui/States'
import { eventDayMonth, eventStatus, formatEventDateTime, type EventPage } from './events.data'
import '../../components/post-list.css'
import './home.css'
import './events.css'

const PAGE_SIZE = 10

// GET /api/public/events (FR-EVT-01): chỉ sự kiện đã công bố hoặc ngừng nhận đăng ký.
// upcoming=true: chưa diễn ra, gần nhất trước; upcoming=false: đã diễn ra, mới nhất trước.
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const locale = getLocaleFromPath(url.pathname)
  const past = url.searchParams.get('past') === '1'
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const result = await api<EventPage>(`/api/public/events?upcoming=${!past}&page=${page}&pageSize=${PAGE_SIZE}`).catch(() => null)
  const now = new Date()
  const query = new URLSearchParams()
  if (past) query.set('past', '1')
  if (page > 1) query.set('page', String(page))
  return {
    locale,
    past,
    failed: !result,
    events: (result?.items ?? []).map((e) => ({ ...e, badge: eventStatus(e, now, locale) })),
    page: result?.page ?? page,
    totalPages: result?.totalPages ?? 0,
    totalItems: result?.totalItems ?? 0,
    url: `${siteUrl(request)}${locale === 'en' ? '/en' : ''}/events${query.size ? `?${query}` : ''}`,
  }
}

export const meta: Route.MetaFunction = ({ loaderData: d }) =>
  seo({
    title: d?.locale === 'en' ? 'Events' : 'Sự kiện',
    description:
      d?.locale === 'en'
        ? 'Seminars, workshops, and activities of the Faculty of Software Engineering, UIT. Register online before the deadline.'
        : 'Seminar, workshop và hoạt động của Khoa Công nghệ Phần mềm, Trường ĐH Công nghệ Thông tin. Đăng ký trực tuyến trước hạn.',
    url: d?.url,
    locale: d?.locale,
  })

export default function Events({ loaderData: d }: Route.ComponentProps) {
  const { locale, t, lPath } = useDictionary()
  const [, setParams] = useSearchParams()
  const goTo = (page: number) => {
    const next = new URLSearchParams()
    if (d.past) next.set('past', '1')
    if (page > 1) next.set('page', String(page))
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="list-page">
      <header className="list-page__head">
        <nav className="list-page__crumbs" aria-label={locale === 'en' ? 'Page location' : 'Vị trí trang'}>
          <Link to={lPath('/')}>{t.home}</Link>
        </nav>
        <h1>{t.events}</h1>
        <p>{t.eventsDesc}</p>
        {!d.failed && d.totalItems > 0 && <span className="list-page__count">{t.eventCount(d.totalItems)}</span>}
      </header>

      <nav className="event-tabs" aria-label={t.eventTabs}>
        <Link to={lPath('/events')} aria-current={!d.past ? 'page' : undefined}>{t.eventsUpcoming}</Link>
        <Link to={lPath('/events?past=1')} aria-current={d.past ? 'page' : undefined}>{t.eventsPast}</Link>
      </nav>

      {d.failed ? (
        <Alert tone="danger" title={t.loadErrorGeneric}>{t.loadErrorEvents}</Alert>
      ) : d.events.length ? (
        <>
          <ul className="home-events">
            {d.events.map((e) => {
              const { day, month } = eventDayMonth(e.startAt, locale)
              return (
                <li key={e.id}>
                  <Link to={lPath(`/events/${e.id}`)} className="home-event">
                    <span className="home-event__date" aria-hidden>
                      <strong>{day}</strong>
                      <small>{month}</small>
                    </span>
                    <span className="home-event__body">
                      <strong>{e.title}</strong>
                      <span className="muted">
                        <time dateTime={e.startAt}>{formatEventDateTime(e.startAt, locale)}</time>
                      </span>
                      <span className="muted home-event__venue">
                        <MapPin size={14} aria-hidden /> {e.venue}
                      </span>
                    </span>
                    <Badge tone={e.badge.tone}>{e.badge.label}</Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Pagination page={d.page} totalPages={d.totalPages} onPageChange={goTo} />
        </>
      ) : (
        <EmptyState
          icon={<CalendarBlank size={32} />}
          title={d.page > 1 ? t.emptyEventsPage : d.past ? t.noPastEvents : t.noUpcomingEvents}
        >
          {d.page > 1 ? <Link to={lPath(d.past ? '/events?past=1' : '/events')}>{t.backToFirstPage}</Link> : t.noEventsHint}
        </EmptyState>
      )}
    </div>
  )
}
