import { useRef, useState } from 'react'
import { Alert, Button, Flex, Input, Progress, Tag, Upload } from 'antd'
import { CloudArrowUp, X } from '@phosphor-icons/react'
import { upload } from '../lib/api'
import { ACCEPT, baseName, checkFile, fieldErrors, formatSize, KIND_LABEL, mediaErrorMessage, type MediaDto, type MediaKind } from './media'

type Item = {
  uid: string
  file: File
  kind?: MediaKind
  name: string
  altText: string
  percent: number
  status: 'ready' | 'uploading' | 'done' | 'error'
  error?: string
  altError?: string
}

// Form upload nhiều file (FR-MEDIA-01, 03). Kiểm tra loại + dung lượng ở client trước, server kiểm tra lại.
// Upload lần lượt từng file để thấy tiến độ và lỗi riêng của từng file; khi đang gửi thì khóa nút để không gửi lặp.
export function MediaUploader({ onUploaded }: { onUploaded: (media: MediaDto) => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const patch = (uid: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.uid === uid ? { ...i, ...p } : i)))

  function add(file: File) {
    const check = checkFile(file)
    const item: Item = {
      uid: crypto.randomUUID(),
      file,
      name: baseName(file.name).slice(0, 200),
      altText: '',
      percent: 0,
      ...('error' in check ? { status: 'error', error: check.error } : { status: 'ready', kind: check.kind }),
    }
    setItems((list) => [...list, item])
  }

  async function start() {
    if (busyRef.current) return
    // Ảnh bắt buộc có alt text (cùng quy tắc với backend): báo ngay dưới ô, không gửi.
    const pending = items.filter((i) => i.kind && (i.status === 'ready' || (i.status === 'error' && i.percent === 0)))
    let invalid = false
    for (const i of pending) {
      const altError = i.kind === 'image' && !i.altText.trim() ? 'Nhập văn bản thay thế mô tả nội dung ảnh.' : undefined
      const error = !i.name.trim() ? 'Nhập tên tài nguyên.' : undefined
      if (altError || error) invalid = true
      patch(i.uid, { altError, ...(error && { status: 'error', error }) })
    }
    if (invalid || !pending.length) return

    busyRef.current = true
    setBusy(true)
    for (const i of pending) {
      patch(i.uid, { status: 'uploading', percent: 0, error: undefined, altError: undefined })
      const form = new FormData()
      form.append('file', i.file)
      form.append('name', i.name.trim())
      if (i.altText.trim()) form.append('altText', i.altText.trim())
      try {
        const media = await upload<MediaDto>('/api/media', form, (percent) => patch(i.uid, { percent }))
        patch(i.uid, { status: 'done', percent: 100 })
        onUploaded(media)
      } catch (err) {
        const fields = fieldErrors(err)
        const altError = fields.find((f) => f.name === 'altText')?.errors[0]
        // percent về 0 để lần bấm "Tải lên" sau gửi lại file này.
        patch(i.uid, { status: 'error', percent: 0, altError, error: altError ? undefined : (fields[0]?.errors[0] ?? mediaErrorMessage(err)) })
      }
    }
    busyRef.current = false
    setBusy(false)
  }

  const waiting = items.filter((i) => i.kind && i.status !== 'done' && i.status !== 'uploading').length

  return (
    <Flex vertical gap={16}>
      <Upload.Dragger
        multiple
        accept={ACCEPT}
        showUploadList={false}
        disabled={busy}
        beforeUpload={(file) => {
          add(file)
          return false // tự gửi bằng upload() để có tiến độ và refresh phiên
        }}
      >
        <CloudArrowUp size={36} aria-hidden style={{ color: 'var(--color-primary)' }} />
        <p style={{ margin: '8px 0 4px', fontWeight: 500 }}>Kéo thả file vào đây hoặc bấm để chọn</p>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Ảnh JPG, PNG, WebP; tài liệu PDF, DOCX, XLSX. Tối đa 10 MB mỗi file.</p>
      </Upload.Dragger>

      {items.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }} aria-label="File đã chọn">
          {items.map((i) => {
            const locked = busy || i.status === 'done' || !i.kind
            return (
              <li key={i.uid} style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}>
                <Flex justify="space-between" align="center" gap={8}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.file.name} <span className="muted">({formatSize(i.file.size)})</span>
                  </span>
                  <Flex align="center" gap={4}>
                    {i.kind && <Tag>{KIND_LABEL[i.kind]}</Tag>}
                    {i.status === 'done' && <Tag color="green">Đã tải lên</Tag>}
                    {i.status !== 'uploading' && !busy && (
                      <Button type="text" size="small" icon={<X size={14} />} aria-label={`Bỏ ${i.file.name}`} onClick={() => setItems((l) => l.filter((x) => x.uid !== i.uid))} />
                    )}
                  </Flex>
                </Flex>
                {i.kind && i.status !== 'done' && (
                  <Flex vertical gap={8} style={{ marginTop: 8 }}>
                    <div>
                      <label htmlFor={`name-${i.uid}`} style={{ fontSize: 'var(--text-sm)' }}>Tên hiển thị</label>
                      <Input id={`name-${i.uid}`} value={i.name} maxLength={200} disabled={locked} onChange={(e) => patch(i.uid, { name: e.target.value })} />
                    </div>
                    {i.kind === 'image' && (
                      <div>
                        <label htmlFor={`alt-${i.uid}`} style={{ fontSize: 'var(--text-sm)' }}>Văn bản thay thế (bắt buộc với ảnh)</label>
                        <Input
                          id={`alt-${i.uid}`}
                          value={i.altText}
                          maxLength={250}
                          disabled={locked}
                          status={i.altError ? 'error' : undefined}
                          aria-invalid={!!i.altError}
                          aria-describedby={i.altError ? `alt-err-${i.uid}` : undefined}
                          placeholder="Ví dụ: Sinh viên khoa CNPM nhận học bổng học kỳ 1"
                          onChange={(e) => patch(i.uid, { altText: e.target.value, altError: undefined })}
                        />
                        {i.altError && <div id={`alt-err-${i.uid}`} style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{i.altError}</div>}
                      </div>
                    )}
                  </Flex>
                )}
                {i.status === 'uploading' && <Progress percent={i.percent} size="small" aria-label={`Tiến độ tải ${i.file.name}`} />}
                {i.error && <Alert type="error" showIcon title={i.error} style={{ marginTop: 8 }} />}
              </li>
            )
          })}
        </ul>
      )}

      <Flex justify="flex-end">
        <Button type="primary" loading={busy} disabled={!waiting} onClick={start}>
          {waiting ? `Tải lên ${waiting} file` : 'Tải lên'}
        </Button>
      </Flex>
    </Flex>
  )
}
