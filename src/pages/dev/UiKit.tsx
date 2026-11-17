import { useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import Alert from '../../components/ui/Alert'
import Badge, { CONTACT_STATUS, ContactStatusBadge, POST_STATUS, PostStatusBadge, type ContactStatus, type PostStatus } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Checkbox, PasswordField, Select, TextArea, TextField } from '../../components/ui/Field'
import Pagination from '../../components/ui/Pagination'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/States'

// Style guide sống, chỉ có ở môi trường dev (/dev/ui). Thêm component mới thì thêm mẫu vào đây.
const SWATCHES = ['--blue-50', '--blue-100', '--blue-300', '--blue-500', '--blue-600', '--blue-700', '--blue-900', '--gray-50', '--gray-200', '--gray-500', '--gray-900']

export default function UiKit() {
  const [page, setPage] = useState(4)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <PageHeader
        title="Bộ component giao diện"
        description="Token màu, chữ và các component dùng chung của CMS Khoa CNPM."
        actions={<Button icon={<Plus size={16} aria-hidden />}>Tạo bài viết</Button>}
      />

      <Card title="Màu">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 'var(--space-3)' }}>
          {SWATCHES.map((v) => (
            <div key={v} className="stack" style={{ gap: 'var(--space-1)' }}>
              <span style={{ height: 48, borderRadius: 'var(--radius-control)', background: `var(${v})`, border: '1px solid var(--color-border)' }} />
              <code style={{ fontSize: 'var(--text-xs)' }}>{v}</code>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Nút">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Button>Xuất bản</Button>
          <Button variant="secondary">Lưu nháp</Button>
          <Button variant="ghost">Hủy</Button>
          <Button variant="danger" icon={<Trash size={16} aria-hidden />} onClick={() => setConfirm(true)}>Xóa bài</Button>
          <Button loading>Đang lưu</Button>
          <Button disabled>Không khả dụng</Button>
          <Button size="sm">Nhỏ</Button>
          <Button size="lg">Lớn</Button>
        </div>
      </Card>

      <Card title="Biểu mẫu">
        <form className="stack" onSubmit={(e) => e.preventDefault()} style={{ maxWidth: 520 }}>
          <TextField label="Tiêu đề bài viết" required hint="Tối đa 200 ký tự." maxLength={200} />
          <TextField label="Email liên hệ" type="email" defaultValue="sv@gm" error="Email chưa đúng định dạng." />
          <Select label="Chuyên mục" defaultValue="">
            <option value="" disabled>Chọn chuyên mục</option>
            <option>Tin tức</option>
            <option>Học bổng - Tuyển dụng</option>
            <option>Khoa học - Công nghệ</option>
          </Select>
          <PasswordField label="Mật khẩu mới" autoComplete="new-password" hint="Tối thiểu 6 ký tự." />
          <TextArea label="Tóm tắt" hint="Hiện trên danh sách bài và kết quả tìm kiếm." />
          <Checkbox label="Đánh dấu bài nổi bật" />
        </form>
      </Card>

      <Card title="Nhãn trạng thái">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {(Object.keys(POST_STATUS) as PostStatus[]).map((s) => <PostStatusBadge key={s} status={s} />)}
          {(Object.keys(CONTACT_STATUS) as ContactStatus[]).map((s) => <ContactStatusBadge key={`c-${s}`} status={s} />)}
          <Badge tone="solid">Tin mới</Badge>
          <Badge tone="danger">Đã khóa</Badge>
        </div>
      </Card>

      <Card title="Thông báo">
        <div className="stack">
          <Alert tone="info" title="Bài đang chờ duyệt">Admin sẽ xem và phản hồi trong thời gian sớm nhất.</Alert>
          <Alert tone="success">Đã lưu thay đổi.</Alert>
          <Alert tone="warning" title="Ảnh đang được sử dụng">Ảnh này nằm trong 3 bài viết. Gỡ khỏi bài trước khi xóa.</Alert>
          <Alert tone="danger">Tệp vượt quá 10 MB. Chọn tệp nhỏ hơn.</Alert>
        </div>
      </Card>

      <Card title="Bảng và phân trang">
        <div className="stack">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr><th>Tiêu đề</th><th>Tác giả</th><th>Trạng thái</th><th>Cập nhật</th></tr>
              </thead>
              <tbody>
                <tr><td>Thông báo lịch bảo vệ khóa luận học kỳ 1</td><td>Trần Minh Khoa</td><td><PostStatusBadge status="pending" /></td><td>27/09/2026</td></tr>
                <tr><td>Học bổng doanh nghiệp năm học 2026-2027</td><td>Lê Thu Hà</td><td><PostStatusBadge status="published" /></td><td>24/09/2026</td></tr>
                <tr><td>Tổng kết seminar học thuật tháng 9</td><td>Phạm Quốc Bảo</td><td><PostStatusBadge status="changes_requested" /></td><td>21/09/2026</td></tr>
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={12} onPageChange={setPage} />
        </div>
      </Card>

      <Card title="Trạng thái tải và rỗng">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-5)' }}>
          <Skeleton lines={4} />
          <EmptyState title="Chưa có bài viết" action={<Button size="sm">Tạo bài đầu tiên</Button>}>
            Bài bạn soạn sẽ hiện ở đây.
          </EmptyState>
        </div>
      </Card>

      <ConfirmDialog
        open={confirm}
        danger
        loading={busy}
        title="Xóa bài viết này?"
        confirmLabel="Xóa bài"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setBusy(true)
          setTimeout(() => (setBusy(false), setConfirm(false)), 800)
        }}
      >
        Bài sẽ chuyển vào mục đã xóa. Admin có thể khôi phục sau.
      </ConfirmDialog>
    </div>
  )
}
