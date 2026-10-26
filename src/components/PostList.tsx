import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Newspaper } from '@phosphor-icons/react'
import { formatDate } from '../lib/dictionary'
import { useDictionary } from '../lib/locale'
import './post-list.css'

// Thẻ bài công khai (backend PostCardDto): trang chủ, chuyên mục, tìm kiếm, bài đã lưu.
export type PostCard = {
  id: string
  slug: string
  title: string
  summary: string | null
  coverUrl: string | null
  coverAlt?: string | null
  publishedAt: string
  categoryName: string | null
  categorySlug?: string | null
}

// Ảnh bìa là signed URL có hạn: hết hạn hoặc lỗi tải thì hiện ô thay thế, không để ảnh vỡ.
export function CoverThumb({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <span className={`${className} post-thumb--empty`} aria-hidden>
        <Newspaper size={28} />
      </span>
    )
  // alt rỗng: tiêu đề bài đã nằm ngay cạnh, đọc lại tên ảnh chỉ gây nhiễu cho trình đọc màn hình.
  return <img className={className} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
}

// Danh sách bài dạng hàng: ảnh trái, tiêu đề, tóm tắt, ngày. action: nút thao tác cuối mỗi hàng (bỏ lưu).
export function PostList({ posts, action }: { posts: PostCard[]; action?: (post: PostCard) => ReactNode }) {
  const { locale, lPath } = useDictionary()

  return (
    <ul className="post-list">
      {posts.map((p) => (
        <li key={p.id} className="post-row">
          <Link to={lPath(`/posts/${p.slug}`)} className="post-row__link" tabIndex={-1} aria-hidden>
            <CoverThumb src={p.coverUrl} className="post-row__thumb" />
          </Link>
          <div className="post-row__body">
            {p.categoryName && <span className="post-row__category">{p.categoryName}</span>}
            <h2 className="post-row__title">
              <Link to={lPath(`/posts/${p.slug}`)}>{p.title}</Link>
            </h2>
            {p.summary && <p className="post-row__summary">{p.summary}</p>}
            <time className="post-row__date" dateTime={p.publishedAt}>
              {formatDate(p.publishedAt, locale)}
            </time>
          </div>
          {action && <div className="post-row__action">{action(p)}</div>}
        </li>
      ))}
    </ul>
  )
}
