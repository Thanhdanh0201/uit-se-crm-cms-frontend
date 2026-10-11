import { useEffect, useState } from 'react'
import { Alert, App, Button, Drawer, Flex, Segmented, Space, Table, Tag, Upload } from 'antd'
import { DownloadSimple, FileXls, Info } from '@phosphor-icons/react'
import { download, upload, ApiError } from '../lib/api'
import { ROLE_LABEL } from './roles'
import type { Role } from '../lib/auth'

// DTO theo backend ImportUsersResultDto (POST /api/admin/users/import).
type RowStatus = 'valid' | 'invalid' | 'created' | 'failed'
export type ImportRow = { row: number; fullName: string; email: string; username: string; role: Role; status: RowStatus; errors: string[]; temporaryPassword: string | null }
type ImportResult = { dryRun: boolean; totalRows: number; validRows: number; createdRows: number; failedRows: number; rows: ImportRow[] }

const MAX_BYTES = 2 * 1024 * 1024 // cùng giới hạn backend UserImport.MaxFileBytes
const STATUS: Record<RowStatus, { label: string; color: string }> = {
  valid: { label: 'Hợp lệ', color: 'blue' },
  invalid: { label: 'Lỗi', color: 'red' },
  created: { label: 'Đã tạo', color: 'green' },
  failed: { label: 'Không tạo được', color: 'red' },
}

// File danh sách mật khẩu tạm: UTF-8 BOM để Excel đọc đúng tiếng Việt; ô bắt đầu bằng = + - @ thêm ' chống chèn công thức.
export function passwordsCsv(rows: ImportRow[]): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const lines = [['Họ và tên', 'Email', 'Tên đăng nhập', 'Mật khẩu tạm']]
  for (const r of rows) if (r.temporaryPassword) lines.push([r.fullName, r.email, r.username, r.temporaryPassword])
  return '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n'
}

const errorText = (err: unknown) =>
  !(err instanceof ApiError) ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    : err.status === 403 ? 'Bạn không có quyền nhập tài khoản.'
      : err.status >= 500 ? 'Máy chủ không xử lý được file lúc này. Vui lòng thử lại sau.'
        : err.message // invalid_file, invalid_template, too_many_rows, file_too_large: detail tiếng Việt từ server

export default function UserImportDrawer({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { modal } = App.useApp()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState<'check' | 'import' | 'template' | null>(null)
  const [error, setError] = useState('')
  const [onlyErrors, setOnlyErrors] = useState(false)
  const [savedPasswords, setSavedPasswords] = useState(false)

  useEffect(() => {
    if (open) return
    setFile(null)
    setResult(null)
    setError('')
    setOnlyErrors(false)
    setSavedPasswords(false)
  }, [open])

  const send = (f: File, dryRun: boolean) => {
    const form = new FormData()
    form.append('file', f)
    return upload<ImportResult>(`/api/admin/users/import?dryRun=${dryRun}`, form)
  }

  async function check(f: File) {
    setError('')
    setResult(null)
    if (!f.name.toLowerCase().endsWith('.xlsx')) return setError('Chỉ nhận file Excel .xlsx. File .xls hoặc .csv hãy mở bằng Excel rồi lưu lại dạng .xlsx.')
    if (f.size > MAX_BYTES) return setError('File nhập tài khoản tối đa 2 MB.')
    setFile(f)
    setBusy('check')
    try {
      setResult(await send(f, true))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  function confirmImport() {
    if (!file || !result) return
    modal.confirm({
      title: `Tạo ${result.validRows} tài khoản?`,
      content: result.totalRows > result.validRows ? `${result.totalRows - result.validRows} dòng lỗi sẽ bị bỏ qua. Sửa file rồi nhập lại các dòng đó sau.` : 'Tất cả dòng trong file đều hợp lệ.',
      okText: 'Tạo tài khoản',
      cancelText: 'Hủy',
      onOk: async () => {
        setBusy('import')
        setError('')
        try {
          const res = await send(file, false)
          setResult(res)
          setOnlyErrors(false)
          if (res.createdRows > 0) onImported()
        } catch (err) {
          setError(errorText(err))
        } finally {
          setBusy(null)
        }
      },
    })
  }

  const imported = result && !result.dryRun
  const passwords = imported ? result.rows.filter((r) => r.temporaryPassword).length : 0

  function savePasswords() {
    const url = URL.createObjectURL(new Blob([passwordsCsv(result!.rows)], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'mat-khau-tam.csv' })
    a.click()
    URL.revokeObjectURL(url)
    setSavedPasswords(true)
  }

  function close() {
    if (busy) return
    if (passwords > 0 && !savedPasswords) {
      modal.confirm({
        title: 'Chưa tải danh sách mật khẩu tạm',
        content: 'Đóng lại thì không xem lại được mật khẩu tạm. Khi cần, đặt lại mật khẩu từng người trong danh sách.',
        okText: 'Vẫn đóng',
        cancelText: 'Ở lại',
        okButtonProps: { danger: true },
        onOk: onClose,
      })
    } else onClose()
  }

  const rows = result ? (onlyErrors ? result.rows.filter((r) => r.errors.length > 0) : result.rows) : []

  return (
    <Drawer
      open={open}
      title="Nhập tài khoản từ Excel"
      size={960}
      onClose={close}
      maskClosable={!busy}
      footer={
        <Flex justify="flex-end" gap={8} wrap>
          {imported ? (
            <Button type="primary" onClick={close}>Xong</Button>
          ) : (
            <>
              <Button onClick={close} disabled={!!busy}>Hủy</Button>
              <Button type="primary" disabled={!result || result.validRows === 0 || !!busy} loading={busy === 'import'} onClick={confirmImport}>
                {result ? `Tạo ${result.validRows} tài khoản` : 'Tạo tài khoản'}
              </Button>
            </>
          )}
        </Flex>
      }
    >
      {!imported && (
        <>
          <Flex gap={8} align="start" className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 12 }}>
            <Info size={16} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <span>
              Mỗi dòng là một tài khoản: Họ và tên, Email, Tên đăng nhập (ví dụ mã số sinh viên), Vai trò (Sinh viên hoặc Biên tập viên, bỏ trống là Sinh viên), Mật khẩu (bỏ trống để hệ thống tạo mật khẩu tạm). Tối đa 300 dòng, 2 MB.
            </span>
          </Flex>
          <Button
            icon={<DownloadSimple size={16} />}
            loading={busy === 'template'}
            style={{ marginBottom: 16 }}
            onClick={async () => {
              setBusy('template')
              try {
                await download('/api/admin/users/import-template', 'mau-nhap-tai-khoan.xlsx')
              } catch (err) {
                setError(errorText(err))
              } finally {
                setBusy(null)
              }
            }}
          >
            Tải file mẫu
          </Button>
          <Upload.Dragger
            style={{ height: 'auto' }}
            accept=".xlsx"
            maxCount={1}
            showUploadList={false}
            disabled={!!busy}
            beforeUpload={(f) => (check(f), false)}
          >
            <p style={{ margin: 0 }}><FileXls size={32} aria-hidden /></p>
            <p style={{ margin: '4px 0' }}>{file ? `Đã chọn: ${file.name}. Bấm hoặc kéo file khác vào để thay.` : 'Bấm để chọn hoặc kéo file .xlsx vào đây'}</p>
            <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: 0 }}>Chưa tạo tài khoản nào cho tới khi bấm "Tạo tài khoản".</p>
          </Upload.Dragger>
        </>
      )}

      {busy === 'check' && <Alert type="info" showIcon style={{ marginTop: 16 }} title="Đang kiểm tra file..." />}
      {busy === 'import' && <Alert type="info" showIcon style={{ marginTop: 16 }} title={`Đang tạo ${result?.validRows} tài khoản, có thể mất khoảng một phút. Đừng đóng trang.`} />}
      {error && <Alert type="error" showIcon style={{ marginTop: 16 }} title="Không nhập được file" description={error} />}

      {result && (
        <div style={{ marginTop: 16 }}>
          {imported ? (
            <Alert
              type={result.failedRows || result.totalRows > result.createdRows ? 'warning' : 'success'}
              showIcon
              style={{ marginBottom: 12 }}
              title={`Đã tạo ${result.createdRows}/${result.totalRows} tài khoản.`}
              description={
                <>
                  {result.totalRows > result.createdRows && <div>{result.totalRows - result.createdRows} dòng không tạo được, xem lý do ở bảng dưới.</div>}
                  {passwords > 0 && (
                    <Space direction="vertical" size={4} style={{ marginTop: 4 }}>
                      <div>{passwords} tài khoản dùng mật khẩu tạm. Mật khẩu tạm chỉ tải được ngay lúc này; gửi riêng cho từng người.</div>
                      <Button type="primary" icon={<DownloadSimple size={16} />} onClick={savePasswords}>
                        {savedPasswords ? 'Tải lại danh sách mật khẩu tạm' : 'Tải danh sách mật khẩu tạm (.csv)'}
                      </Button>
                    </Space>
                  )}
                </>
              }
            />
          ) : (
            <Alert
              type={result.validRows === result.totalRows ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              title={`${result.totalRows} dòng: ${result.validRows} hợp lệ, ${result.totalRows - result.validRows} lỗi.`}
              description={result.validRows < result.totalRows ? 'Dòng lỗi sẽ bị bỏ qua khi tạo. Có thể sửa file rồi chọn lại.' : undefined}
            />
          )}
          <Segmented
            size="small"
            value={onlyErrors ? 'errors' : 'all'}
            aria-label="Lọc dòng"
            options={[{ value: 'all', label: 'Tất cả dòng' }, { value: 'errors', label: 'Chỉ dòng lỗi' }]}
            onChange={(v) => setOnlyErrors(v === 'errors')}
            style={{ marginBottom: 8 }}
          />
          <Table<ImportRow>
            rowKey="row"
            size="small"
            dataSource={rows}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
            columns={[
              { title: 'Dòng', dataIndex: 'row', width: 64 },
              { title: 'Họ và tên', dataIndex: 'fullName' },
              { title: 'Email', dataIndex: 'email' },
              { title: 'Tên đăng nhập', dataIndex: 'username' },
              { title: 'Vai trò', dataIndex: 'role', render: (r: Role) => ROLE_LABEL[r] ?? r },
              {
                title: 'Kết quả',
                key: 'status',
                render: (_, r) => (
                  <div>
                    <Tag color={STATUS[r.status].color}>{STATUS[r.status].label}</Tag>
                    {r.errors.map((e) => <div key={e} style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>{e}</div>)}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}
