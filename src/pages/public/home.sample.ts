import type { HomeData, PostCard } from './home.data'

// DỮ LIỆU MẪU, chỉ dùng khi dev và API /api/public/home chưa chạy. Không vào bản build production.
// Ảnh picsum chỉ để xem bố cục; ảnh thật lấy từ thư viện media của CMS.

const post = (slug: string, title: string, categoryName: string, day: number, summary: string | null = null, cover = true): PostCard => ({
  slug,
  title,
  summary,
  categoryName,
  coverUrl: cover ? `https://picsum.photos/seed/${slug}/960/540` : null,
  publishedAt: new Date(Date.UTC(2026, 8, day, 2)).toISOString(),
})

export const SAMPLE_HOME: HomeData = {
  featured: [
    post(
      'dang-ky-de-tai-do-an-hk1-2026',
      'Đăng ký đề tài Đồ án 1 và Đồ án 2 học kỳ 1 năm học 2026-2027',
      'Thông báo học vụ',
      25,
      'Sinh viên đăng ký nhóm và đề tài với giảng viên hướng dẫn trước hạn. Danh sách đề tài và biểu mẫu đăng ký có trong bài.',
    ),
    post('hoc-bong-doanh-nghiep-2026', 'Học bổng doanh nghiệp năm học 2026-2027 cho sinh viên ngành Kỹ thuật Phần mềm', 'Học bổng - Tuyển dụng', 23),
    post('cap-nhat-thuc-tap-hk1-2026', 'Cập nhật thông tin thực tập doanh nghiệp học kỳ 1', 'Thông báo học vụ', 21),
    post('tong-ket-seminar-thang-9', 'Tổng kết seminar học thuật tháng 9: kiểm thử phần mềm trong dự án thực tế', 'Khoa học - Công nghệ', 19),
  ],
  latest: [
    post('lich-bao-ve-khoa-luan-hk1', 'Lịch bảo vệ khóa luận tốt nghiệp học kỳ 1', 'Thông báo học vụ', 27, null, false),
    post('dang-ky-de-tai-do-an-hk1-2026', 'Đăng ký đề tài Đồ án 1 và Đồ án 2 học kỳ 1 năm học 2026-2027', 'Thông báo học vụ', 25, null, false),
    post('xu-ly-hoc-vu-hk2-he', 'Kế hoạch xử lý học vụ học kỳ 2 và học kỳ hè', 'Thông báo học vụ', 22, null, false),
    post('cap-nhat-thuc-tap-hk1-2026', 'Cập nhật thông tin thực tập doanh nghiệp học kỳ 1', 'Thông báo học vụ', 21, null, false),
  ],
  sections: [
    {
      title: 'Học bổng - Tuyển dụng',
      categorySlug: 'hoc-bong-tuyen-dung',
      posts: [
        post('hoc-bong-doanh-nghiep-2026', 'Học bổng doanh nghiệp năm học 2026-2027', 'Học bổng - Tuyển dụng', 23, null, false),
        post('thuc-tap-frontend-q4', 'Tuyển thực tập sinh Frontend quý 4', 'Học bổng - Tuyển dụng', 20, null, false),
        post('fresher-kiem-thu', 'Chương trình Fresher Kiểm thử phần mềm', 'Học bổng - Tuyển dụng', 16, null, false),
        post('hoc-bong-vuot-kho', 'Học bổng vượt khó học kỳ 1', 'Học bổng - Tuyển dụng', 12, null, false),
      ],
    },
    {
      title: 'Khoa học - Công nghệ',
      categorySlug: 'khoa-hoc-cong-nghe',
      posts: [
        post('tong-ket-seminar-thang-9', 'Tổng kết seminar học thuật tháng 9', 'Khoa học - Công nghệ', 19, null, false),
        post('nhom-nghien-cuu-llm', 'Nhóm nghiên cứu mô hình ngôn ngữ lớn tuyển thành viên', 'Khoa học - Công nghệ', 14, null, false),
        post('huong-dan-viet-bai-bao', 'Hướng dẫn viết bài báo khoa học cho sinh viên', 'Khoa học - Công nghệ', 9, null, false),
        post('seminar-thang-8', 'Tổng kết seminar học thuật tháng 8', 'Khoa học - Công nghệ', 3, null, false),
      ],
    },
    {
      title: 'Hoạt động sinh viên',
      categorySlug: 'hoat-dong-sinh-vien',
      posts: [
        post('chao-tan-sinh-vien-2026', 'Chào tân sinh viên khóa 2026', 'Hoạt động sinh viên', 18, null, false),
        post('giai-bong-da-khoa', 'Giải bóng đá sinh viên Khoa mùa thu', 'Hoạt động sinh viên', 11, null, false),
        post('workshop-git', 'Workshop Git cho sinh viên năm nhất', 'Hoạt động sinh viên', 7, null, false),
        post('mua-he-xanh', 'Tổng kết chiến dịch Mùa hè xanh', 'Hoạt động sinh viên', 2, null, false),
      ],
    },
  ],
  events: [
    {
      id: 'e1',
      title: 'Seminar: Kiến trúc microservices cho hệ thống quy mô vừa',
      startAt: '2026-10-09T07:30:00Z',
      venue: 'Phòng E7.2, tòa nhà E',
      registrationDeadline: '2026-10-07T16:59:59Z',
      capacity: 80,
      registeredCount: 57,
    },
    {
      id: 'e2',
      title: 'Ngày hội việc làm Khoa Công nghệ Phần mềm',
      startAt: '2026-10-17T01:00:00Z',
      venue: 'Sảnh tòa nhà E',
      registrationDeadline: '2026-10-15T16:59:59Z',
      capacity: 300,
      registeredCount: 300,
    },
    {
      id: 'e3',
      title: 'Workshop viết CV và phỏng vấn kỹ thuật',
      startAt: '2026-10-24T08:00:00Z',
      venue: 'Hội trường A',
      registrationDeadline: '2026-10-22T16:59:59Z',
      capacity: 120,
      registeredCount: 41,
    },
  ],
}
