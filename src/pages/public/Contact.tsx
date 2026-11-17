import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import type { Route } from './+types/Contact'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Locale } from '../../lib/dictionary'
import { getLocaleFromPath, useDictionary } from '../../lib/locale'
import { seo, siteUrl } from '../../lib/seo'
import { CONTACT_LIMITS, focusFirstError, validateContact, type ContactInput, type FieldErrors } from '../../lib/validate'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { TextArea, TextField } from '../../components/ui/Field'
import '../../styles/auth.css'

// POST /api/contact-requests (FR-CON-01, 02): khách và người đã đăng nhập đều gửi được.
// Server tự lấy userId từ phiên, giới hạn 5 lần/10 phút/IP (429), chống gửi trùng bằng Idempotency-Key.
type Submitted = { id: string; status: string; createdAt: string }
type Errors = FieldErrors<keyof ContactInput> & { form?: string }

const TEXT = {
  vi: {
    title: 'Liên hệ',
    description: 'Gửi câu hỏi hoặc góp ý tới Khoa Công nghệ Phần mềm, Trường Đại học Công nghệ Thông tin. Khoa phản hồi qua email bạn cung cấp.',
    intro: 'Gửi câu hỏi hoặc góp ý tới Khoa Công nghệ Phần mềm. Khoa sẽ phản hồi qua email bạn cung cấp.',
    senderName: 'Họ và tên',
    senderEmail: 'Email',
    subject: 'Chủ đề',
    message: 'Nội dung',
    submit: 'Gửi câu hỏi',
    sending: 'Đang gửi',
    success: 'Đã gửi câu hỏi. Khoa sẽ phản hồi qua email bạn cung cấp.',
    code: 'Mã yêu cầu',
    status: 'Trạng thái',
    createdAt: 'Thời điểm gửi',
    another: 'Gửi câu hỏi khác',
    statuses: { new: 'Mới', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đóng' } as Record<string, string>,
  },
  en: {
    title: 'Contact',
    description: 'Send a question or feedback to the Faculty of Software Engineering, University of Information Technology. The Faculty replies to the email you provide.',
    intro: 'Send a question or feedback to the Faculty of Software Engineering. The Faculty will reply to the email you provide.',
    senderName: 'Full name',
    senderEmail: 'Email',
    subject: 'Subject',
    message: 'Message',
    submit: 'Send question',
    sending: 'Sending',
    success: 'Your question has been sent. The Faculty will reply to the email you provided.',
    code: 'Request code',
    status: 'Status',
    createdAt: 'Submitted at',
    another: 'Send another question',
    statuses: { new: 'New', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' } as Record<string, string>,
  },
} satisfies Record<Locale, unknown>

const FORM_ERRORS = {
  vi: {
    network: 'Không kết nối được máy chủ. Kiểm tra mạng rồi gửi lại, nội dung bạn nhập vẫn còn.',
    invalid: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại rồi gửi.',
    conflict: 'Không gửi được, vui lòng gửi lại.',
    rateLimited: 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau ít phút.',
    server: 'Không gửi được lúc này. Vui lòng thử lại sau, nội dung bạn nhập vẫn còn.',
  },
  en: {
    network: 'Cannot reach the server. Check your connection and send again, your message is kept.',
    invalid: 'Some information is invalid. Please check and send again.',
    conflict: 'Could not send, please send again.',
    rateLimited: 'You have sent too many times. Please try again in a few minutes.',
    server: 'Could not send right now. Please try again later, your message is kept.',
  },
} satisfies Record<Locale, unknown>

// Lỗi từng ô lấy nguyên câu tiếng Việt của server (cùng câu với validateContact).
function contactErrors(err: unknown, locale: Locale = 'vi'): Errors {
  const m = FORM_ERRORS[locale]
  if (!(err instanceof ApiError)) return { form: m.network }
  if (err.status === 400) {
    const fields: Errors = {
      senderName: err.field('senderName'),
      senderEmail: err.field('senderEmail'),
      subject: err.field('subject'),
      message: err.field('message'),
    }
    return Object.values(fields).some(Boolean) ? fields : { form: m.invalid }
  }
  if (err.status === 409) return { form: m.conflict } // idempotency_conflict: lần sau dùng key mới
  if (err.status === 429) return { form: m.rateLimited }
  return { form: m.server }
}

export function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname)
  return { locale, url: `${siteUrl(request)}${locale === 'en' ? '/en/contact' : '/contact'}` }
}

export const meta: Route.MetaFunction = ({ loaderData: d }) => {
  const locale = d?.locale ?? 'vi'
  return seo({ title: TEXT[locale].title, description: TEXT[locale].description, url: d?.url, locale })
}

function formatTime(iso: string, locale: Locale) {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function Contact() {
  const { locale } = useDictionary()
  const t = TEXT[locale]
  const { user } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)
  const pendingRef = useRef(false) // chặn submit lặp trước khi React kịp render lại
  const keyRef = useRef<string | null>(null) // Idempotency-Key: giữ nguyên khi gửi lại đúng nội dung cũ sau lỗi
  const sentRef = useRef<string | null>(null) // JSON đúng body đã gửi kèm key hiện tại
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [result, setResult] = useState<Submitted | null>(null)

  // Đã đăng nhập: điền sẵn họ tên, email vào ô còn trống. Vẫn cho sửa.
  function prefill() {
    const form = formRef.current
    if (!form || !user) return
    for (const [name, value] of [['senderName', user.fullName], ['senderEmail', user.email]] as const) {
      const input = form.elements.namedItem(name)
      if (input instanceof HTMLInputElement && !input.value && value) input.value = value
    }
  }
  useEffect(prefill, [user])

  // Thông báo thành công/lỗi chung nằm đầu form: cuộn tới để người đang ở cuối form vẫn thấy.
  const noticeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (result || errors.form) noticeRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [result, errors.form])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pendingRef.current) return
    const form = e.currentTarget
    const data = new FormData(form)
    const input: ContactInput = {
      senderName: String(data.get('senderName') ?? '').trim(),
      senderEmail: String(data.get('senderEmail') ?? '').trim(),
      subject: String(data.get('subject') ?? '').trim(),
      message: String(data.get('message') ?? ''), // gửi nguyên văn, server lưu dạng text
    }

    setResult(null)
    const invalid = validateContact(input)
    setErrors(invalid)
    if (Object.keys(invalid).length) return focusFirstError(form, invalid)

    // Chỉ dùng lại key khi nội dung trùng hệt lần gửi trước: lần trước có thể đã lưu mà mất response,
    // còn nội dung đã sửa mà dùng key cũ thì server trả bản cũ, nội dung mới bị mất.
    // Không có randomUUID (ngữ cảnh không bảo mật) thì gửi không kèm key.
    const sent = JSON.stringify(input)
    if (sent !== sentRef.current) {
      keyRef.current = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null
      sentRef.current = sent
    }

    pendingRef.current = true
    setPending(true)
    try {
      const r = await api<Submitted>('/api/contact-requests', {
        method: 'POST',
        json: input,
        headers: keyRef.current ? { 'Idempotency-Key': keyRef.current } : undefined,
      })
      keyRef.current = null
      sentRef.current = null
      form.reset()
      prefill()
      setResult({ id: String(r.id), status: r.status, createdAt: r.createdAt })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        keyRef.current = null
        sentRef.current = null
      }
      const apiErrors = contactErrors(err, locale)
      // flushSync: fieldset phải hết disabled trong DOM thì mới focus được.
      flushSync(() => {
        setErrors(apiErrors)
        setPending(false)
      })
      pendingRef.current = false
      focusFirstError(form, apiErrors)
      return
    }
    pendingRef.current = false
    setPending(false)
  }

  function another() {
    setResult(null)
    const name = formRef.current?.elements.namedItem('senderName')
    if (name instanceof HTMLInputElement) name.focus()
  }

  const statusLabel = result ? t.statuses[result.status] : undefined
  const time = result ? formatTime(result.createdAt, locale) : ''

  return (
    <div className="auth auth--wide">
      <div className="auth__intro">
        <h1>{t.title}</h1>
        <p className="muted">{t.intro}</p>
      </div>

      <form ref={formRef} className="auth__card stack" onSubmit={onSubmit} noValidate aria-busy={pending || undefined}>
        <div ref={noticeRef} className="stack" hidden={!result && !errors.form}>
        {result && (
          <Alert tone="success" title={t.success}>
            <p>{t.code}: <strong>{result.id.slice(0, 8).toUpperCase()}</strong></p>
            {statusLabel && <p>{t.status}: {statusLabel}</p>}
            {time && <p>{t.createdAt}: <time dateTime={result.createdAt}>{time}</time></p>}
            <Button variant="secondary" size="sm" onClick={another}>{t.another}</Button>
          </Alert>
        )}
        {errors.form && <Alert tone="danger">{errors.form}</Alert>}
        </div>

        <fieldset className="auth__fields" disabled={pending}>
          <TextField label={t.senderName} name="senderName" autoComplete="name" maxLength={CONTACT_LIMITS.senderName} required error={errors.senderName} />
          <TextField
            label={t.senderEmail}
            name="senderEmail"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={CONTACT_LIMITS.senderEmail}
            required
            error={errors.senderEmail}
          />
          <TextField label={t.subject} name="subject" maxLength={CONTACT_LIMITS.subject} required error={errors.subject} />
          <TextArea label={t.message} name="message" rows={6} maxLength={CONTACT_LIMITS.message} required error={errors.message} />
        </fieldset>

        <Button type="submit" size="lg" block loading={pending}>{pending ? t.sending : t.submit}</Button>
      </form>
    </div>
  )
}
