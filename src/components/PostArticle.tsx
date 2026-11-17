import { useState, type CSSProperties, type ReactNode } from 'react'
import { safeHighlight, safeTextColor } from './richTextPalette'
import './post.css'

// Kiểu tối thiểu, khớp DTO backend (PostViewDto / PostDetailDto). Khai báo ở đây để trang public không phụ thuộc src/admin.
export type RichNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: RichNode[] }
export type ContentMedia = { id: string; kind: string; name: string; altText: string | null; url: string | null; videoId: string | null }

export type ArticleData = {
  title: string
  summary: string | null
  content: RichNode
  cover: ContentMedia | null
  media: Record<string, ContentMedia>
  authorName: string | null
  categoryName: string | null
  publishedAt: string | null
  updatedAt?: string | null
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long' })
const updateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
})

// Bài viết dạng hiển thị công khai. Dùng chung cho trang chi tiết public, trang xem trước và xem trước trong trình soạn thảo,
// để "xem trước giống public" (SCRUM-40).
export function PostArticle({ post, footer }: { post: ArticleData; footer?: ReactNode }) {
  const showUpdated = Boolean(
    post.publishedAt &&
      post.updatedAt &&
      new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() >= 5 * 60 * 1000
  )

  return (
    <article className="post-article">
      <header className="post-article__header">
        {post.categoryName && <p className="post-article__category">{post.categoryName}</p>}
        <h1>{post.title || 'Chưa có tiêu đề'}</h1>
        <p className="muted">
          {post.publishedAt ? <time dateTime={post.publishedAt}>{dateFmt.format(new Date(post.publishedAt))}</time> : 'Chưa xuất bản'}
          {showUpdated && (
            <span className="post-article__updated">
              {' · '}Cập nhật: <time dateTime={post.updatedAt!}>{updateFmt.format(new Date(post.updatedAt!))}</time>
            </span>
          )}
          {post.authorName && `, ${post.authorName}`}
        </p>
      </header>
      {post.cover?.url && <Cover src={post.cover.url} alt={post.cover.altText ?? ''} />}
      {post.summary && <p className="post-article__summary">{post.summary}</p>}
      <RichText doc={post.content} media={post.media} />
      {footer}
    </article>
  )
}

// Ảnh bìa là signed URL có hạn: lỗi tải (hết hạn, file bị xóa) thì bỏ hẳn khung ảnh thay vì để ảnh vỡ.
function Cover({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  return failed ? null : <img className="post-article__cover" src={src} alt={alt} onError={() => setFailed(true)} />
}

// Renderer JSON Tiptap sang React. Chỉ hiểu các node/mark trong allowlist của backend (RichTextContent.cs), gồm bảng,
// căn lề, màu chữ, tô nền, chỉ số trên/dưới;
// node lạ bị bỏ qua. Không dùng dangerouslySetInnerHTML (NFR-05).
export function RichText({ doc, media }: { doc: RichNode; media: Record<string, ContentMedia> }) {
  return <div className="rich-text">{renderChildren(doc, media)}</div>
}

function renderChildren(node: RichNode, media: Record<string, ContentMedia>): ReactNode[] {
  return (node.content ?? []).map((child, i) => renderNode(child, media, i))
}

// Căn lề (SCRUM-68): chỉ nhận giá trị trong allowlist backend.
const ALIGNS = new Set(['center', 'right', 'justify'])
const alignStyle = (node: RichNode): CSSProperties | undefined =>
  typeof node.attrs?.textAlign === 'string' && ALIGNS.has(node.attrs.textAlign) ? { textAlign: node.attrs.textAlign as CSSProperties['textAlign'] } : undefined

const span = (v: unknown, max: number) => (typeof v === 'number' && v > 1 ? Math.min(Math.floor(v), max) : undefined)

function renderNode(node: RichNode, media: Record<string, ContentMedia>, key: number): ReactNode {
  const children = () => renderChildren(node, media)
  switch (node.type) {
    case 'paragraph':
      return <p key={key} style={alignStyle(node)}>{children()}</p>
    case 'heading': {
      const level = node.attrs?.level
      const Tag = level === 3 ? 'h3' : level === 4 ? 'h4' : 'h2'
      return <Tag key={key} style={alignStyle(node)}>{children()}</Tag>
    }
    case 'table':
      // Bảng rộng cuộn ngang trong khung riêng, không làm vỡ trang trên điện thoại. tabIndex để cuộn được bằng bàn phím.
      return (
        <div key={key} className="rich-text__table" role="region" aria-label="Bảng (cuộn ngang nếu không đủ chỗ)" tabIndex={0}>
          <table>
            <tbody>{children()}</tbody>
          </table>
        </div>
      )
    case 'tableRow':
      return <tr key={key}>{children()}</tr>
    case 'tableHeader':
    case 'tableCell': {
      const Tag = node.type === 'tableHeader' ? 'th' : 'td'
      const widths = Array.isArray(node.attrs?.colwidth) ? (node.attrs.colwidth as unknown[]).filter((w): w is number => typeof w === 'number') : []
      const width = widths.length ? widths.reduce((a, b) => a + b, 0) : undefined
      return (
        <Tag key={key} colSpan={span(node.attrs?.colspan, 20)} rowSpan={span(node.attrs?.rowspan, 50)} style={width ? { minWidth: width } : undefined} scope={Tag === 'th' ? 'col' : undefined}>
          {children()}
        </Tag>
      )
    }
    case 'bulletList':
      return <ul key={key}>{children()}</ul>
    case 'orderedList':
      return <ol key={key} start={typeof node.attrs?.start === 'number' ? node.attrs.start : undefined}>{children()}</ol>
    case 'listItem':
      return <li key={key}>{children()}</li>
    case 'blockquote':
      return <blockquote key={key}>{children()}</blockquote>
    case 'horizontalRule':
      return <hr key={key} />
    case 'hardBreak':
      return <br key={key} />
    case 'text':
      return <Marks key={key} node={node} />
    case 'image': {
      const m = media[String(node.attrs?.mediaId)]
      if (!m?.url) return null
      const alt = (typeof node.attrs?.alt === 'string' && node.attrs.alt) || m.altText || ''
      return (
        <figure key={key}>
          <img src={m.url} alt={alt} loading="lazy" decoding="async" />
        </figure>
      )
    }
    case 'video': {
      const m = media[String(node.attrs?.mediaId)]
      if (!m?.videoId) return null
      return (
        <figure key={key} className="rich-text__video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.videoId)}`}
            title={m.name}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture; fullscreen"
          />
        </figure>
      )
    }
    default:
      return null
  }
}

function Marks({ node }: { node: RichNode }) {
  let out: ReactNode = node.text
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>
    else if (mark.type === 'italic') out = <em>{out}</em>
    else if (mark.type === 'underline') out = <u>{out}</u>
    else if (mark.type === 'strike') out = <s>{out}</s>
    else if (mark.type === 'code') out = <code>{out}</code>
    else if (mark.type === 'subscript') out = <sub>{out}</sub>
    else if (mark.type === 'superscript') out = <sup>{out}</sup>
    else if (mark.type === 'textStyle' && safeTextColor(mark.attrs?.color)) out = <span style={{ color: safeTextColor(mark.attrs?.color)! }}>{out}</span>
    else if (mark.type === 'highlight' && safeHighlight(mark.attrs?.color)) out = <mark style={{ background: safeHighlight(mark.attrs?.color)! }}>{out}</mark>
    else if (mark.type === 'link') out = <SafeLink href={mark.attrs?.href}>{out}</SafeLink>
  }
  return <>{out}</>
}

// Backend đã lọc href; kiểm tra lại ở client vì đây là chỗ render ra trình duyệt.
export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null
  const h = href.trim()
  if (h.startsWith('/') && !h.startsWith('//')) return h
  return /^(https?:|mailto:)/i.test(h) ? h : null
}

function SafeLink({ href, children }: { href: unknown; children: ReactNode }) {
  const h = safeHref(href)
  if (!h) return <>{children}</>
  const external = !h.startsWith('/')
  return (
    <a href={h} {...(external && { target: '_blank', rel: 'noopener noreferrer' })}>
      {children}
    </a>
  )
}
