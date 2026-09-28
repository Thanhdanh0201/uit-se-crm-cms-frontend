---
title: Product, CMS Khoa CNPM
inclusion: always
---

# Sản phẩm: CMS & tương tác Khoa Công nghệ Phần mềm (UIT)

Đồ án 1, SRS 1.1 (16/09/2026). Nhóm 2–4 sinh viên. Hạn cuối: 15/12/2026.
Phạm vi: **CMS + tương tác cơ bản**. KHÔNG phải CRM tuyển sinh, KHÔNG quản lý đào tạo (điểm, học phí, lớp, TKB), KHÔNG app mobile, chat, SSO, đa ngôn ngữ, AI.

## Vai trò (giá trị trong API: chữ thường)

| Thao tác | Khách | `student` | `editor` | `admin` |
|---|---|---|---|---|
| Xem / tìm nội dung công khai | Có | Có | Có | Có |
| Gửi liên hệ | Có | Có | Có | Có |
| Lưu bài, đăng ký sự kiện | Không | Của mình | Của mình | Của mình |
| Soạn & gửi duyệt bài | Không | Không | Bài mình | Có |
| Duyệt, xuất bản, cấu hình, menu, chuyên mục | Không | Không | Không | Có |
| Quản lý user, xem contact & nhật ký | Không | Không | Không | Có |

Ẩn nút trên UI **không** phải bảo mật (NFR-03). Server luôn là người quyết định; UI chỉ ẩn/disable cho UX.

## Nhóm chức năng (mã FR)

- **FR-AUTH**: đăng nhập email/username, đăng xuất, đổi mật khẩu; Admin tạo/sửa/khóa/gán role/reset mật khẩu.
- **FR-MENU**: menu nhiều cấp (tối đa 3), mục loại page/category/external, sắp xếp, bật/tắt.
- **FR-CAT**: chuyên mục cây, slug, xóa mềm, chuyển bài khi xóa; thẻ (tags).
- **FR-POST**: soạn bài (tiêu đề, tóm tắt, rich text, ảnh đại diện), nháp, xem trước, gửi duyệt, nổi bật.
- **FR-MEDIA**: upload JPEG/PNG/WebP/PDF/DOCX/XLSX ≤ 10 MiB, video bằng URL, cảnh báo đang dùng khi xóa.
- **FR-PUB**: trang chủ, chuyên mục, chi tiết bài, tìm kiếm, lọc category/tag/thời gian, phân trang mới nhất trước.
- **FR-EVT**: sự kiện, đăng ký/hủy trước hạn, chặn khi đầy/hết hạn, xuất CSV (Should).
- **FR-CON**: form liên hệ; Admin phân loại, trạng thái Mới / Đang xử lý / Đã giải quyết / Đóng.
- **FR-REP / FR-LOG**: dashboard thống kê, nhật ký hoạt động có lọc.

Ưu tiên: Must trước. Should chỉ khi Must ổn. Could (khôi phục phiên bản bài) ngoài lịch.

## Vòng đời bài viết

`draft` → `pending` → `published` | `changes_requested` | `archived`.
`changes_requested` → `draft` | `pending`. `published` → `archived`. `archived` → `draft` | `published`.
Editor chỉ sửa bài mình khi `draft` / `changes_requested`. Chỉ Admin xuất bản. Yêu cầu chỉnh sửa bắt buộc có lý do.

## Màn hình (SRS 8.1)

- **Public**: Trang chủ, danh sách chuyên mục, chi tiết bài, tìm kiếm, sự kiện, liên hệ, đăng nhập.
- **Student**: Hồ sơ, bài đã lưu, sự kiện đã đăng ký, yêu cầu đã gửi.
- **Editor**: Dashboard cá nhân, danh sách bài, trình soạn thảo, thư viện media.
- **Admin**: Dashboard, duyệt bài, menu, chuyên mục, người dùng, sự kiện, phản hồi, nhật ký, cấu hình.

## Sprint

| Sprint | Thời gian 2026 | Nội dung |
|---|---|---|
| 1 | 23/09–27/09 | Auth, tài khoản, RBAC, khung trang quản trị |
| 2 | 28/09–11/10 | Menu, chuyên mục/thẻ, media |
| 3 | 12/10–18/10 | Soạn bài, duyệt bài, pages/home |
| 4 | 04/11–17/11 | Website công khai, tìm kiếm, responsive |
| 5 | 18/11–01/12 | Sự kiện, liên hệ, dashboard, nhật ký |
| 6 | 02/12–15/12 | Đóng băng tính năng; test, deploy, docs, demo |

Jira: Epic SCRUM-7, task SCRUM-8 → SCRUM-31 (https://crmuitda1.atlassian.net/browse/SCRUM-7).

Tiêu chí nghiệm thu AT-01 → AT-10: xem SRS mục 9. Mỗi màn hình phải map về FR/AT tương ứng.
