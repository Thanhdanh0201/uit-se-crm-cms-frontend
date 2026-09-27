import { Link } from 'react-router'
import { Card, Result, Typography } from 'antd'

export function Dashboard() {
  return (
    <Card title="Tổng quan">
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Số bài theo trạng thái, bài chờ duyệt, người dùng, sự kiện và phản hồi (FR-REP-01) sẽ hiện ở đây khi có API dashboard.
      </Typography.Paragraph>
    </Card>
  )
}

export function ComingSoon() {
  return (
    <Card>
      <Result status="info" title="Chức năng đang được phát triển" subTitle="Màn hình này sẽ có trong các sprint tới." extra={<Link to="/admin">Về trang tổng quan</Link>} />
    </Card>
  )
}
