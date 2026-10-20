// Bảng màu cố định cho màu chữ và tô nền chữ trong bài viết (SCRUM-67, 68).
// Phải khớp backend Business/Services/RichTextContent.cs (TextColors, HighlightColors): màu ngoài danh sách bị server bỏ.
// Màu chữ đủ tương phản WCAG AA trên nền trắng; màu tô nền nhạt để chữ đen vẫn đọc được.
export const TEXT_COLORS = [
  { value: '#111827', label: 'Đen' },
  { value: '#4b5563', label: 'Xám' },
  { value: '#b91c1c', label: 'Đỏ' },
  { value: '#c2410c', label: 'Cam' },
  { value: '#15803d', label: 'Xanh lá' },
  { value: '#0041d9', label: 'Xanh UIT' },
] as const

export const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: 'Vàng' },
  { value: '#bbf7d0', label: 'Xanh lá nhạt' },
  { value: '#bfdbfe', label: 'Xanh dương nhạt' },
  { value: '#fecdd3', label: 'Hồng nhạt' },
] as const

const textSet = new Set<string>(TEXT_COLORS.map((c) => c.value))
const highlightSet = new Set<string>(HIGHLIGHT_COLORS.map((c) => c.value))

/**
 * Màu về dạng #rrggbb chữ thường, cùng quy tắc backend RichTextContent.NormalizeColor.
 * Nội dung dán từ Word/Google Docs có màu dạng rgb(...); xem trước trước khi lưu cũng phải nhận ra.
 */
export function normalizeColor(c: unknown): string | null {
  if (typeof c !== 'string') return null
  const v = c.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  const m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(?:1|1\.0+)\s*)?\)$/)
  if (!m) return null
  const rgb = m.slice(1, 4).map(Number)
  return rgb.every((n) => n <= 255) ? `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}` : null
}

/** Màu chữ hợp lệ hoặc null. Renderer kiểm tra lại dù server đã lọc. */
export const safeTextColor = (c: unknown) => {
  const v = normalizeColor(c)
  return v && textSet.has(v) ? v : null
}
/** Màu tô nền hợp lệ; không có màu thì dùng vàng mặc định. */
export const safeHighlight = (c: unknown) => {
  if (c == null) return HIGHLIGHT_COLORS[0].value
  const v = normalizeColor(c)
  return v && highlightSet.has(v) ? v : null
}
