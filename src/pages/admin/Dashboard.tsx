import { Card, Typography } from 'antd'

export default function Dashboard() {
  return (
    <Card title="Tổng quan">
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Số bài theo trạng thái, bài chờ duyệt, người dùng, sự kiện và phản hồi (FR-REP-01) sẽ hiện ở đây khi có API dashboard.
      </Typography.Paragraph>
    </Card>
  )
}
