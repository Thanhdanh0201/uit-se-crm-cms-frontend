import type { ReactNode } from 'react'
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
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long' })

// Bài viết dạng hiển thị công khai. Dùng chung cho trang chi tiết public, trang xem trước và xem trước trong trình soạn thảo,
// để "xem trước giống public" (SCRUM-40).
export function PostArticle({ post, footer }: { post: ArticleData; footer?: ReactNode }) {
  return (
    <article className="post-article">
      <header className="post-article__header">
        {post.categoryName && <p className="post-article__category">{post.categoryName}</p>}
        <h1>{post.title || 'Chưa có tiêu đề'}</h1>
        <p className="muted">
          {post.publishedAt ? <time dateTime={post.publishedAt}>{dateFmt.format(new Date(post.publishedAt))}</time> : 'Chưa xuất bản'}
          {post.authorName && `, ${post.authorName}`}
        </p>
      </header>
      {post.cover?.url && <img className="post-article__cover" src={post.cover.url} alt={post.cover.altText ?? ''} />}
      {post.summary && <p className="post-article__summary">{post.summary}</p>}
      <RichText doc={post.content} media={post.media} />
      {footer}
    </article>
  )
}

// Renderer JSON Tiptap sang React. Chỉ hiểu các node/mark trong allowlist của backend (RichTextContent.cs);
// node lạ bị bỏ qua. Không dùng dangerouslySetInnerHTML (NFR-05).
export function RichText({ doc, media }: { doc: RichNode; media: Record<string, ContentMedia> }) {
  return <div className="rich-text">{renderChildren(doc, media)}</div>
}

function renderChildren(node: RichNode, media: Record<string, ContentMedia>): ReactNode[] {
  return (node.content ?? []).map((child, i) => renderNode(child, media, i))
}

function renderNode(node: RichNode, media: Record<string, ContentMedia>, key: number): ReactNode {
  const children = () => renderChildren(node, media)
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{children()}</p>
    case 'heading': {
      const level = node.attrs?.level
      const Tag = level === 3 ? 'h3' : level === 4 ? 'h4' : 'h2'
      return <Tag key={key}>{children()}</Tag>
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
