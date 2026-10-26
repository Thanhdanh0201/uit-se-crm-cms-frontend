import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Flex, Input, Modal, Pagination, Segmented, Skeleton } from 'antd'
import { api } from '../lib/api'
import { MediaGrid } from './MediaGrid'
import { KIND_LABEL, MEDIA_PAGE_SIZE, mediaErrorMessage, mediaQuery, type MediaDto, type MediaKind, type MediaPage } from './media'

// Bộ chọn media dùng chung (SCRUM-38): trình soạn bài, ảnh đại diện, sự kiện...
// kinds giới hạn loại được chọn, ví dụ ảnh đại diện chỉ ['image']. Trả về cả object để nơi gọi lấy id, url, altText.
export function MediaPicker({
  open,
  kinds = ['image', 'document', 'video'],
  title = 'Chọn tài nguyên',
  onCancel,
  onSelect,
}: {
  open: boolean
  kinds?: MediaKind[]
  title?: string
  onCancel: () => void
  onSelect: (media: MediaDto) => void
}) {
  const [kind, setKind] = useState<MediaKind | 'all'>(kinds.length === 1 ? kinds[0] : 'all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MediaPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState<MediaDto | null>(null)

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    // Chỉ một loại thì lọc ở server; nhiều loại nhưng không đủ cả 3 thì lọc thêm ở client (backend nhận một kind).
    const query = mediaQuery({ kind: kind === 'all' ? null : kind, search, page })
    api<MediaPage>(`/api/media?${query}`, { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setError(mediaErrorMessage(err))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [open, kind, search, page, reloadKey])

  const kindsKey = kinds.join(',')

  // Mở lại hoặc đổi loại tài nguyên thì bắt đầu chọn mới và đồng bộ lại bộ lọc loại.
  useEffect(() => {
    if (open) {
      setSelected(null)
      setKind(kinds.length === 1 ? kinds[0] : 'all')
      setSearch('')
      setPage(1)
    }
  }, [open, kindsKey])

  // ponytail: lọc nhiều loại ở client làm trang có thể ít hơn pageSize; nâng cấp khi backend nhận kind=image,video.
  const items = (data?.items ?? []).filter((m) => kinds.includes(m.kind))
  const filters = [...(kinds.length > 1 ? [{ value: 'all', label: 'Tất cả' }] : []), ...kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))]

  return (
    <Modal
      open={open}
      title={title}
      width={880}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onCancel}>Hủy</Button>
          <Button type="primary" disabled={!selected} onClick={() => selected && onSelect(selected)}>
            Chọn
          </Button>
        </Flex>
      }
    >
      <Flex wrap gap={8} justify="space-between" style={{ marginBottom: 16 }}>
        {filters.length > 1 ? (
          <Segmented
            value={kind}
            options={filters}
            aria-label="Lọc theo loại"
            onChange={(v) => {
              setKind(v as MediaKind | 'all')
              setPage(1)
            }}
          />
        ) : (
          <span />
        )}
        <Input.Search
          allowClear
          placeholder="Tìm theo tên"
          aria-label="Tìm tài nguyên"
          onSearch={(v) => {
            setSearch(v.trim())
            setPage(1)
          }}
          style={{ width: 260 }}
        />
      </Flex>

      {error ? (
        <Alert
          type="error"
          showIcon
          title="Không tải được thư viện media"
          description={error}
          action={<Button size="small" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</Button>}
        />
      ) : loading && !data ? (
        <Skeleton active />
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={search ? 'Không có tài nguyên khớp từ khóa.' : 'Thư viện chưa có tài nguyên phù hợp. Tải lên ở trang Thư viện media.'}
        />
      ) : (
        <div aria-busy={loading}>
          <MediaGrid
            items={items}
            selectedId={selected?.id ?? ''}
            onSelect={setSelected}
            onExpired={() => setReloadKey((k) => k + 1)}
          />
          <Pagination
            style={{ marginTop: 16, justifyContent: 'flex-end' }}
            current={page}
            pageSize={MEDIA_PAGE_SIZE}
            total={data?.totalItems ?? 0}
            showSizeChanger={false}
            hideOnSinglePage
            onChange={setPage}
          />
        </div>
      )}
    </Modal>
  )
}
