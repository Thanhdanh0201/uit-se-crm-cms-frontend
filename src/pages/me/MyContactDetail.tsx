import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, ApiError } from '../../lib/api'
import { RequireRole } from '../../lib/auth'
import { noIndex } from '../../lib/seo'
import { formatDate } from '../../lib/dictionary'
import { useDictionary } from '../../lib/locale'
import Alert from '../../components/ui/Alert'
import { ContactStatusBadge } from '../../components/ui/Badge'
import { buttonClass } from '../../components/ui/Button'
import { EmptyState, Skeleton } from '../../components/ui/States'
import type { MyContact } from './MyContacts'
import '../../components/post-list.css'
import './me.css'

export const meta = () => noIndex('Chi tiết yêu cầu')

type State = { status: 'loading' } | { status: 'ok'; contact: MyContact } | { status: 'not_found' } | { status: 'error' }

function MyContactDetailContent() {
  const { id = '' } = useParams()
  const { t, lPath, locale } = useDictionary()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading' })
    api<MyContact>(`/api/me/contact-requests/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then((contact) => setState({ status: 'ok', contact }))
      .catch((e) => {
        if (ctrl.signal.aborted) return
        // 403/404: không lộ việc yêu cầu có tồn tại hay không.
        const missing = e instanceof ApiError && (e.status === 404 || e.status === 403)
        setState({ status: missing ? 'not_found' : 'error' })
      })
    return () => ctrl.abort()
  }, [id])

  const listPath = lPath('/me/contacts')

  return (
    <div className="list-page">
      <header className="list-page__head">
        <nav className="list-page__crumbs" aria-label="Vị trí trang">
          <Link to={lPath('/me')}>{t.myAccount}</Link>
          <span aria-hidden>/</span>
          <Link to={listPath}>Yêu cầu đã gửi</Link>
        </nav>
        <h1 className="me-contact__title">{state.status === 'ok' ? state.contact.subject : 'Chi tiết yêu cầu'}</h1>
      </header>

      {state.status === 'loading' ? (
        <Skeleton lines={5} />
      ) : state.status === 'error' ? (
        <Alert tone="danger" title="Có lỗi">Chưa tải được yêu cầu. Kiểm tra mạng rồi tải lại trang.</Alert>
      ) : state.status === 'not_found' ? (
        <EmptyState
          title="Không tìm thấy yêu cầu hoặc bạn không có quyền xem"
          action={<Link to={listPath} className={buttonClass('secondary')}>Về danh sách yêu cầu</Link>}
        />
      ) : (
        <article className="me-contact">
          <dl className="me-contact__meta">
            <div><dt>Trạng thái</dt><dd><ContactStatusBadge status={state.contact.status} /></dd></div>
            <div><dt>Ngày gửi</dt><dd>{formatDate(state.contact.createdAt, locale)}</dd></div>
            <div><dt>Cập nhật</dt><dd>{formatDate(state.contact.updatedAt, locale)}</dd></div>
          </dl>
          <p className="me-contact__body">{state.contact.message}</p>
        </article>
      )}
    </div>
  )
}

export default function MyContactDetail() {
  return (
    <RequireRole roles={['student', 'editor', 'admin']}>
      <MyContactDetailContent />
    </RequireRole>
  )
}
