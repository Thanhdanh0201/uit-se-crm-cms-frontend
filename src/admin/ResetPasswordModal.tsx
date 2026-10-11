import { useEffect, useState } from 'react'
import { Alert, App, Button, Flex, Form, Input, Modal, Radio, Typography } from 'antd'
import { api, ApiError } from '../lib/api'

type Target = { id: string; fullName: string; username: string }

// FR-AUTH-04: admin đặt lại mật khẩu. Mật khẩu tạm do server tạo, chỉ hiện một lần ở đây.
export default function ResetPasswordModal({ user, onClose }: { user: Target | null; onClose: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ mode: 'auto' | 'manual'; newPassword?: string }>()
  const mode = Form.useWatch('mode', form)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [temporary, setTemporary] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    form.setFieldsValue({ mode: 'auto', newPassword: '' })
    setError('')
    setTemporary(null)
  }, [user, form])

  async function onFinish(v: { mode: 'auto' | 'manual'; newPassword?: string }) {
    if (busy || !user) return
    setBusy(true)
    setError('')
    try {
      const res = await api<{ temporaryPassword: string | null }>(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        json: { newPassword: v.mode === 'manual' ? v.newPassword : null },
      })
      if (res.temporaryPassword) setTemporary(res.temporaryPassword)
      else {
        message.success(`Đã đặt lại mật khẩu cho ${user.fullName}.`)
        onClose()
      }
    } catch (err) {
      if (err instanceof ApiError && err.field('newPassword')) form.setFields([{ name: 'newPassword', errors: [err.field('newPassword')!] }])
      else setError(
        !(err instanceof ApiError) ? 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
          : err.status === 404 ? 'Người dùng không còn tồn tại. Tải lại danh sách.'
            : err.status === 403 ? 'Bạn không có quyền đặt lại mật khẩu.'
              : err.status >= 500 ? 'Máy chủ không đặt lại được mật khẩu lúc này. Vui lòng thử lại sau.'
                : err.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!user}
      title={user ? `Đặt lại mật khẩu: ${user.fullName}` : ''}
      onCancel={busy ? undefined : onClose}
      maskClosable={!busy && !temporary}
      closable={!busy}
      destroyOnHidden
      footer={
        temporary ? (
          <Button type="primary" onClick={onClose}>Đã lưu mật khẩu, đóng</Button>
        ) : (
          <Flex justify="flex-end" gap={8}>
            <Button onClick={onClose} disabled={busy}>Hủy</Button>
            <Button type="primary" loading={busy} onClick={() => form.submit()}>Đặt lại mật khẩu</Button>
          </Flex>
        )
      }
    >
      {temporary ? (
        <>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="Mật khẩu tạm chỉ hiện một lần"
            description="Sao chép và gửi cho người dùng qua kênh riêng (không gửi trong nhóm chung). Người dùng nên đổi mật khẩu sau khi đăng nhập."
          />
          <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>Tên đăng nhập: {user?.username}</div>
          <Typography.Paragraph copyable={{ text: temporary, tooltips: ['Sao chép', 'Đã sao chép'] }} style={{ fontSize: 'var(--text-xl)', fontFamily: 'monospace', margin: '4px 0 0' }}>
            {temporary}
          </Typography.Paragraph>
        </>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish} disabled={busy} requiredMark={false}>
          {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
          <Form.Item name="mode" label="Mật khẩu mới">
            <Radio.Group
              options={[
                { value: 'auto', label: 'Tạo mật khẩu tạm ngẫu nhiên' },
                { value: 'manual', label: 'Tự đặt mật khẩu' },
              ]}
            />
          </Form.Item>
          {mode === 'manual' && (
            <Form.Item name="newPassword" label="Nhập mật khẩu mới" rules={[{ required: true, message: 'Nhập mật khẩu mới.' }, { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự.' }, { max: 72, message: 'Mật khẩu tối đa 72 ký tự.' }]}>
              <Input.Password autoComplete="new-password" maxLength={72} />
            </Form.Item>
          )}
          <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: 0 }}>
            Mật khẩu cũ hết dùng được ngay. Người dùng bị đăng xuất khỏi mọi thiết bị đang đăng nhập.
          </p>
        </Form>
      )}
    </Modal>
  )
}
