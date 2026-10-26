import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RichText, safeHref, type RichNode } from './PostArticle'

const media = {
  m1: { id: 'm1', kind: 'image', name: 'Ảnh', altText: 'Lễ trao học bổng', url: 'https://storage.test/a.png', videoId: null },
  v1: { id: 'v1', kind: 'video', name: 'Giới thiệu Khoa', altText: null, url: 'https://youtu.be/abc', videoId: 'abc123' },
}

test('render node trong allowlist, bỏ node lạ, link nguy hiểm thành chữ thường', () => {
  const doc: RichNode = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Hồ sơ' }] },
      { type: 'script', content: [{ type: 'text', text: 'alert(1)' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bấm', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          { type: 'text', text: ' trang khoa', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://se.uit.edu.vn' } }] },
        ],
      },
      { type: 'image', attrs: { mediaId: 'm1', alt: '' } },
      { type: 'video', attrs: { mediaId: 'v1' } },
      { type: 'image', attrs: { mediaId: 'khong-co' } },
    ],
  }
  const html = renderToStaticMarkup(<RichText doc={doc} media={media} />)
  expect(html).toContain('<h3>Hồ sơ</h3>')
  expect(html).not.toContain('alert')
  expect(html).not.toContain('javascript')
  expect(html).toContain('<a href="https://se.uit.edu.vn" target="_blank" rel="noopener noreferrer"><strong> trang khoa</strong></a>')
  expect(html).toContain('alt="Lễ trao học bổng"') // alt trống trong bài thì lấy alt của media
  expect(html).toContain('https://www.youtube-nocookie.com/embed/abc123')
  expect(html.match(/<img/g)).toHaveLength(1) // media không có trong danh sách thì không render
})

test('safeHref', () => {
  expect(safeHref('/posts/a')).toBe('/posts/a')
  expect(safeHref('mailto:khoa@uit.edu.vn')).toBe('mailto:khoa@uit.edu.vn')
  expect(safeHref('//evil.com')).toBeNull()
  expect(safeHref(' JavaScript:alert(1)')).toBeNull()
  expect(safeHref('data:text/html,x')).toBeNull()
})

test('video YouTube duoc nhung qua youtube-nocookie voi thuoc tinh bao mat va a11y', () => {
  const videoMedia = {
    v_ok: { id: 'v_ok', kind: 'video', name: 'Lễ tốt nghiệp 2026', altText: null, url: null, videoId: 'dQw4w9WgXcQ' },
    v_no_id: { id: 'v_no_id', kind: 'video', name: 'Video hỏng', altText: null, url: null, videoId: null },
  }
  const doc: RichNode = {
    type: 'doc',
    content: [
      { type: 'video', attrs: { mediaId: 'v_ok' } },
      { type: 'video', attrs: { mediaId: 'v_no_id' } },
      { type: 'video', attrs: { mediaId: 'v_deleted' } },
    ],
  }
  const html = renderToStaticMarkup(<RichText doc={doc} media={videoMedia} />)
  // Chỉ render đúng 1 video hợp lệ
  expect(html.match(/<iframe/g)).toHaveLength(1)
  expect(html).toContain('class="rich-text__video"')
  expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
  expect(html).toContain('title="Lễ tốt nghiệp 2026"')
  expect(html).toContain('loading="lazy"')
  expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"')
  expect(html).toContain('allow="encrypted-media; picture-in-picture; fullscreen"')
})

