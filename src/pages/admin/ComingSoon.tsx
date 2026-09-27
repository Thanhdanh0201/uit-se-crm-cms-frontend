import { Link } from 'react-router'
import { Card, Result } from 'antd'

export default function ComingSoon() {
  return (
    <Card>
      <Result status="info" title="Chức năng đang được phát triển" subTitle="Màn hình này sẽ có trong các sprint tới." extra={<Link to="/admin">Về trang tổng quan</Link>} />
    </Card>
  )
}
