import { FileDoc, FilePdf, FileXls, Play } from '@phosphor-icons/react'
import { formatSize, KIND_LABEL, type MediaDto } from './media'

// Lưới media dùng chung cho trang Thư viện media và bộ chọn media.
// Mỗi ô là một nút: Tab để di chuyển, Enter/Space để mở hoặc chọn.
export function MediaGrid({
  items,
  selectedId,
  onSelect,
  onExpired,
}: {
  items: MediaDto[]
  selectedId?: string
  onSelect: (item: MediaDto) => void
  // Signed URL hết hạn (ảnh không tải được): tải lại danh sách để lấy URL mới.
  onExpired?: () => void
}) {
  return (
    <ul className="media-grid">
      {items.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            className="media-grid__item"
            aria-pressed={selectedId ? m.id === selectedId : undefined}
            onClick={() => onSelect(m)}
          >
            <span className="media-grid__thumb">
              <Thumb item={m} onExpired={onExpired} />
              {m.kind === 'video' && <Play className="media-grid__play" size={28} weight="fill" aria-hidden />}
            </span>
            <span className="media-grid__name">{m.name}</span>
            <span className="media-grid__meta">
              {KIND_LABEL[m.kind]}
              {m.sizeBytes ? `, ${formatSize(m.sizeBytes)}` : ''}
              {m.usageCount > 0 ? `, đang dùng ${m.usageCount}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Thumb({ item, onExpired }: { item: MediaDto; onExpired?: () => void }) {
  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        // Ảnh trong ô đã có tên ngay bên dưới; alt mô tả nội dung cho người dùng trình đọc màn hình.
        alt={item.altText ?? ''}
        loading="lazy"
        decoding="async"
        onError={() => item.urlExpiresAt && new Date(item.urlExpiresAt) <= new Date() && onExpired?.()}
      />
    )
  }
  const Icon = item.mimeType?.includes('pdf') ? FilePdf : item.mimeType?.includes('sheet') ? FileXls : FileDoc
  return <Icon size={40} aria-hidden />
}
