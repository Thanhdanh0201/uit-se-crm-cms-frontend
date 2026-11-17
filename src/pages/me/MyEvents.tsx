import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCheck, MapPin } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { useDictionary } from '../../lib/locale'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button, { buttonClass } from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import { EmptyState, Skeleton } from '../../components/ui/States'
import { canCancel, eventErrorMessage, formatEventDateTime, type MyRegistration, type MyRegistrationPage } from '../public/events.data'
import '../../components/post-list.css'
import '../public/events.css'

export const meta = () => noIndex('Sự kiện đã đăng ký')

const PAGE_SIZE = 10

// GET /api/me/registrations (FR-EVT-03): mọi lượt đăng ký của tôi, gồm cả lượt đã hủy.
function MyEventsContent() {
  const { t, lPath } = useDictionary()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [data, setData] = useState<MyRegistrationPage | null>(null)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<MyRegistration | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const busy = useRef(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setError('')
    try {
      setData(await api<MyRegistrationPage>(`/api/me/registrations?page=${page}&pageSize=${PAGE_SIZE}`, { signal }))
    } catch {
      if (!signal?.aborted) setError('Chưa tải được danh sách. Kiểm tra mạng rồi tải lại trang.')
    }
  }, [page])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const goTo = (p: number) => setParams(p > 1 ? { page: String(p) } : {})

  async function cancel() {
    if (busy.current || !target) return // chống bấm lặp
    busy.current = true
    setCancelling(true)
    setNotice(null)
    try {
      await api(`/api/events/${target.event.id}/registrations/me`, { method: 'DELETE' })
      setNotice({ tone: 'success', text: `Đã hủy đăng ký "${target.event.title}".` })
    } catch (e) {
      setNotice({ tone: 'danger', text: eventErrorMessage(e, 'vi') })
    } finally {
      busy.current = false
      setCancelling(false)
      setTarget(null)
    }
    // Thành công hay lỗi nghiệp vụ đều tải lại để đồng bộ trạng thái với server.
    await load()
  }

  const now = new Date()

  return (
    <div className="list-page">
      <header className="list-page__head">
        <nav className="list-page__crumbs" aria-label="Vị trí trang">
          <Link to={lPath('/me')}>{t.myAccount}</Link>
        </nav>
        <h1>Sự kiện đã đăng ký</h1>
        {data && data.totalItems > 0 && <span className="list-page__count">{data.totalItems} lượt đăng ký</span>}
      </header>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {error ? (
        <Alert tone="danger" title="Có lỗi">{error}</Alert>
      ) : !data ? (
        <Skeleton lines={4} />
      ) : data.items.length ? (
        <>
          <ul className="my-events">
            {data.items.map((r) => {
              const cancellable = r.status === 'active' && canCancel({ ...r.event, myRegistration: 'active' }, now)
              return (
                <li key={r.event.id} className="my-event">
                  <div className="my-event__body">
                    <Link to={lPath(`/events/${r.event.id}`)}>{r.event.title}</Link>
                    <span className="muted">
                      <time dateTime={r.event.startAt}>{formatEventDateTime(r.event.startAt)}</time>
                    </span>
                    <span className="muted my-event__venue">
                      <MapPin size={14} aria-hidden /> {r.event.venue}
                    </span>
                  </div>
                  <div className="my-event__actions">
                    {r.status === 'active' ? <Badge tone="success">Đang đăng ký</Badge> : <Badge>Đã hủy</Badge>}
                    {r.status === 'active' && r.event.status === 'cancelled' && <Badge tone="danger">Sự kiện đã hủy</Badge>}
                    {cancellable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={cancelling && target?.event.id === r.event.id}
                        disabled={cancelling}
                        onClick={() => setTarget(r)}
                        aria-label={`Hủy đăng ký ${r.event.title}`}
                      >
                        Hủy đăng ký
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={goTo} />
        </>
      ) : (
        <EmptyState
          icon={<CalendarCheck size={32} />}
          title={page > 1 ? 'Trang này không có lượt đăng ký' : 'Bạn chưa đăng ký sự kiện nào'}
          action={<Link to={lPath('/events')} className={buttonClass('secondary')}>Xem sự kiện</Link>}
        >
          Các sự kiện bạn đăng ký sẽ hiện ở đây, kể cả lượt đã hủy.
        </EmptyState>
      )}

      <ConfirmDialog
        open={!!target}
        title="Hủy đăng ký sự kiện này?"
        confirmLabel="Hủy đăng ký"
        cancelLabel="Giữ đăng ký"
        danger
        loading={cancelling}
        onConfirm={cancel}
        onCancel={() => setTarget(null)}
      >
        {target && `"${target.event.title}". Bạn có thể đăng ký lại nếu sự kiện còn chỗ và còn hạn đăng ký.`}
      </ConfirmDialog>
    </div>
  )
}

export default function MyEvents() {
  return (
    <RequireRole roles={['student', 'editor', 'admin']}>
      <MyEventsContent />
    </RequireRole>
  )
}
