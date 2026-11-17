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

test('bảng và định dạng kiểu Word: gộp ô, căn lề, màu trong bảng màu, chỉ số; màu lạ bị bỏ', () => {
  const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
  const doc: RichNode = {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1 }, content: [p('Môn')] }, { type: 'tableHeader', content: [p('Phòng')] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2, rowspan: 1, colwidth: [120, 200] }, content: [p('Nhập môn CNPM')] }] },
        ],
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          { type: 'text', text: 'đỏ', marks: [{ type: 'textStyle', attrs: { color: '#B91C1C' } }] },
          { type: 'text', text: 'tím', marks: [{ type: 'textStyle', attrs: { color: 'url(javascript:x)' } }] },
          { type: 'text', text: 'vàng', marks: [{ type: 'highlight' }] },
          { type: 'text', text: 'H' }, { type: 'text', text: '2', marks: [{ type: 'subscript' }] }, { type: 'text', text: 'O' },
          { type: 'text', text: 'm', marks: [{ type: 'superscript' }] },
        ],
      },
      { type: 'heading', attrs: { level: 2, textAlign: 'evil' }, content: [{ type: 'text', text: 'Lịch thi' }] },
    ],
  }
  const html = renderToStaticMarkup(<RichText doc={doc} media={{}} />)
  expect(html).toContain('<div class="rich-text__table" role="region"')
  expect(html).toContain('<th scope="col"><p>Môn</p></th>')
  expect(html).toContain('<td colSpan="2" style="min-width:320px"><p>Nhập môn CNPM</p></td>')
  expect(html).toContain('<p style="text-align:center">')
  expect(html).toContain('<span style="color:#b91c1c">đỏ</span>')
  expect(html).toContain('tím') // giữ chữ, bỏ màu lạ
  expect(html).not.toContain('javascript')
  expect(html).toContain('<mark style="background:#fef08a">vàng</mark>')
  expect(html).toContain('H<sub>2</sub>O<sup>m</sup>')
  expect(html).toContain('<h2>Lịch thi</h2>')
})

test('màu dán từ Word dạng rgb(...) cùng bảng màu vẫn hiện ở xem trước', async () => {
  const { normalizeColor } = await import('./richTextPalette')
  expect(['rgb(185, 28, 28)', '#FFF', 'rgba(1, 2, 3, 0.5)', 'rgb(300,0,0)', 'red'].map(normalizeColor)).toEqual(['#b91c1c', '#ffffff', null, null, null])
  const html = renderToStaticMarkup(<RichText doc={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'đỏ', marks: [{ type: 'textStyle', attrs: { color: 'rgb(185, 28, 28)' } }] }] }] }} media={{}} />)
  expect(html).toContain('<span style="color:#b91c1c">đỏ</span>')
})
