# TÀI LIỆU KẾT NỐI API CHO FRONTEND (FRONTEND INTEGRATION GUIDE)
**Hệ thống UIT SE CRM/CMS Backend (.NET 10 RESTful API)**  
*Dành cho đội ngũ phát triển Frontend (React / Next.js / TipTap WYSIWYG)*  
*Phạm vi: Toàn bộ các API đã hoàn thành từ T2 đến T10 (SCRUM-15, 16, 17)*  
*Cập nhật lần cuối: 2026-10-05*

---

## 1. QUY CHUẨN GIAO TIẾP VÀ ĐỊNH DẠNG DỮ LIỆU

### 1.1 Base URL & Môi trường
- **Local Dev**: `http://localhost:5179`
- **Docker Compose**: `http://localhost:5179` (Container `uit_se_crm_api`)
- **Swagger UI & OpenAPI Spec**:
  - Swagger UI: `http://localhost:5179/swagger`
  - OpenAPI Spec (Import Postman): `http://localhost:5179/swagger/v1/swagger.json`

### 1.2 Cơ chế Xác thực (Authentication) & Phân quyền (RBAC)
- **Token JWT**: Gửi kèm trong request header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **HttpOnly Cookie**: Backend tự động gán cookie `access_token` và `refresh_token` khi đăng nhập (`/api/auth/login`). Nếu Frontend gọi từ cùng domain hoặc qua Next.js Rewrite/Proxy, cookie sẽ tự động được gửi kèm mà không cần can thiệp JavaScript.
- **Các Vai trò (Roles)**:
  - `admin`: Quản trị viên hệ thống (quản lý user, duyệt xuất bản bài viết, trang tĩnh, khối trang chủ, menu).
  - `editor`: Biên tập viên Khoa (tải media, soạn thảo và quản lý bài nháp của mình, gửi duyệt).
  - `student`: Sinh viên / Người dùng thông thường (chỉ xem nội dung công khai, lưu bookmark, đăng ký sự kiện).

### 1.3 Định dạng phản hồi thành công (`ApiResponse<T>`)
Mọi endpoint trả về HTTP 200/201 đều được bọc trong cấu trúc chuẩn:
```json
{
  "success": true,
  "message": "Thông điệp phản hồi (tiếng Việt)",
  "data": { ... } // hoặc null / danh sách mảng []
}
```

### 1.4 Định dạng phản hồi lỗi (RFC 7807 `ProblemDetails`)
Mọi lỗi (400, 401, 403, 404, 409, 422, 500) đều trả về `Content-Type: application/problem+json`:
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Dữ liệu không hợp lệ",
  "status": 400,
  "detail": "Một hoặc nhiều trường dữ liệu bị lỗi.",
  "code": "ma_loi_he_thong", // Nếu là lỗi nghiệp vụ đặc thù
  "errors": {
    "Title": ["Tiêu đề không được để trống."],
    "PrimaryCategoryId": ["Chuyên mục chính không tồn tại."]
  }
}
```

---

## 2. MODULE T2: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (SCRUM-2, SCRUM-8)
*Quyền truy cập: `[Authorize(Roles = "admin")]`*

### 2.1 Lấy danh sách tài khoản
- **Endpoint**: `GET /api/admin/users`
- **Query Params**:
  - `page`: Số trang (mặc định: `1`)
  - `pageSize`: Số bản ghi / trang (mặc định: `20`, tối đa `100`)
  - `search`: Tìm kiếm theo username hoặc full_name (tùy chọn)
  - `role`: Lọc theo vai trò: `admin`, `editor`, `student` (tùy chọn)
  - `isActive`: Lọc theo trạng thái `true` / `false` (tùy chọn)
- **Response `data`**:
  ```json
  {
    "items": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "username": "ha.le",
        "email": "ha.le@uit.edu.vn",
        "fullName": "Lê Thu Hà",
        "role": "editor",
        "isActive": true,
        "createdAt": "2026-09-27T08:00:00Z"
      }
    ],
    "totalItems": 45,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
  ```

### 2.2 Xem chi tiết tài khoản
- **Endpoint**: `GET /api/admin/users/{id}`
- **Response `data`**: Object thông tin người dùng tương tự như trong `items`.

### 2.3 Cấp phát tài khoản mới
- **Endpoint**: `POST /api/admin/users`
- **Request Body**:
  ```json
  {
    "email": "bao.pham@uit.edu.vn",
    "password": "Password123!",
    "username": "bao.pham",
    "fullName": "Phạm Quốc Bảo",
    "role": "editor" // "admin" | "editor" | "student"
  }
  ```
- **Lưu ý FE**: Backend có cơ chế Retry & Compensation tự động; nếu email hoặc username đã tồn tại sẽ trả HTTP 400.

### 2.4 Cập nhật thông tin tài khoản
- **Endpoint**: `PUT /api/admin/users/{id}`
- **Request Body**:
  ```json
  {
    "username": "bao.pham.updated",
    "fullName": "Phạm Quốc Bảo",
    "role": "editor",
    "isActive": true
  }
  ```

### 2.5 Khóa hoặc Mở khóa tài khoản (Ban/Unban tức thì)
- **Endpoint**: `PATCH /api/admin/users/{id}/status`
- **Request Body**:
  ```json
  {
    "isActive": false // false: Khóa, true: Mở khóa
  }
  ```
- **Lưu ý FE**: Khi khóa tài khoản, toàn bộ phiên làm việc của user sẽ bị thu hồi ngay lập tức và các request kế tiếp của user đó sẽ nhận HTTP 403 Forbidden.

---

## 3. MODULE T4: QUẢN LÝ MENU & ĐIỀU HƯỚNG ĐA CẤP (SCRUM-9, SCRUM-10)

### 3.1 Public API: Cây Menu điều hướng (Navbar / Footer)
- **Endpoint**: `GET /api/public/menus/{code}`
- **Quyền**: Không yêu cầu đăng nhập (`[AllowAnonymous]`)
- **Ví dụ**: `GET /api/public/menus/main`
- **Quy tắc hiển thị (Cascade Hidden Rule)**: Backend tự động loại bỏ các mục bị ẩn (`isVisible = false`) và ẩn toàn bộ nhánh con nếu nhánh cha bị ẩn; dữ liệu trả về đã được sắp xếp sẵn theo `sortOrder`.
- **Response `data`**:
  ```json
  {
    "id": "11111111-1111-1111-1111-111111111111",
    "code": "main",
    "name": "Menu Chính",
    "items": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "label": "Giới thiệu",
        "kind": "page", // "page" | "category" | "external"
        "url": "/pages/gioi-thieu",
        "target": null,
        "children": [
          {
            "id": "33333333-3333-3333-3333-333333333333",
            "label": "Ban Chủ nhiệm Khoa",
            "kind": "page",
            "url": "/pages/ban-chu-nhiem",
            "target": null,
            "children": []
          }
        ]
      },
      {
        "id": "44444444-4444-4444-4444-444444444444",
        "label": "Tin tức & Thông báo",
        "kind": "category",
        "url": "/categories/tin-tuc",
        "children": []
      }
    ]
  }
  ```

### 3.2 Admin API: Quản trị Menu & Menu Items
*Quyền truy cập: `[Authorize(Roles = "admin")]`*

- **Danh sách Menu**: `GET /api/admin/menus`
- **Tạo Menu mới**: `POST /api/admin/menus` (Body: `{ "code": "footer", "name": "Menu Chân trang" }`)
- **Cây Menu đầy đủ (Bao gồm cả mục ẩn để Admin chỉnh sửa)**:
  - `GET /api/admin/menus/{menuId}/items` (hoặc `GET /api/admin/menus/{id}` trả về kèm `items`)
- **Thêm mục Menu**: `POST /api/admin/menus/{menuId}/items`
  - Body:
    ```json
    {
      "label": "Đào tạo Sau đại học",
      "kind": "page", // "page" | "category" | "external"
      "pageId": "guid...", // Bắt buộc nếu kind == 'page'
      "categoryId": null,  // Bắt buộc nếu kind == 'category'
      "externalUrl": null, // Bắt buộc nếu kind == 'external' (https://...)
      "parentId": "guid-cha...", // null nếu là mục gốc (Level 1)
      "sortOrder": 1,
      "isVisible": true
    }
    ```
  - **Ràng buộc Backend chặn**:
    - Giới hạn tối đa 3 cấp (Root -> Cấp 2 -> Cấp 3). Tạo cấp 4 sẽ nhận lỗi HTTP 400.
    - Chống vòng lặp phân cấp (Cycle Detection).
    - `parentId` bắt buộc phải thuộc cùng một `menuId`.
- **Cập nhật mục Menu**: `PUT /api/admin/menu-items/{id}` (Body tương tự như tạo).
- **Bật/Tắt hiển thị nhanh**: `PATCH /api/admin/menu-items/{id}/visibility` (Body: `{ "isVisible": true }`).
- **Sắp xếp & Tái cấu trúc cây Menu**: `PUT /api/admin/menus/{menuId}/tree`
  - Body danh sách các node với `parentId` và `sortOrder` mới để lưu đồng loạt trong 1 Transaction.

---

## 4. MODULE T5: QUẢN LÝ CHUYÊN MỤC (CATEGORIES) & THẺ (TAGS)

### 4.1 Public API: Chuyên mục & Thẻ
- **Lấy cây chuyên mục công khai**: `GET /api/public/categories/tree` (Tự động ẩn chuyên mục tắt).
- **Chi tiết chuyên mục theo slug**: `GET /api/public/categories/{slug}`
- **Danh sách thẻ kèm số lượng bài**: `GET /api/public/tags`

### 4.2 Admin API: Quản lý Chuyên mục & Safe-Delete
*Quyền truy cập: `[Authorize(Roles = "admin")]`*

- **Lấy danh sách cây chuyên mục**: `GET /api/admin/categories/tree`
- **Tạo chuyên mục mới**: `POST /api/admin/categories`
  ```json
  {
    "name": "Nghiên cứu Khoa học",
    "description": "Các đề tài và hội nghị khoa học",
    "parentId": null, // hoặc Guid của chuyên mục cha
    "sortOrder": 1,
    "isVisible": true
  }
  ```
  *(Backend tự động chuyển `name` thành slug duy nhất: `nghien-cuu-khoa-hoc`)*
- **Cập nhật chuyên mục**: `PUT /api/admin/categories/{id}`
- **Xóa an toàn chuyên mục (Safe Delete)**: `DELETE /api/admin/categories/{id}?targetCategoryId={targetId}`
  - **Quy tắc FE cần lưu ý**:
    - Nếu chuyên mục còn bài viết hoặc chuyên mục con, backend **bắt buộc** truyền `targetCategoryId` (chuyên mục đích chuyển giao). Nếu không truyền sẽ trả HTTP 400.
    - Không được truyền `targetCategoryId` là chính nó hoặc là con/cháu của nó.

### 4.3 Admin API: Quản lý Thẻ (Tags)
- **Tạo thẻ mới**: `POST /api/admin/tags` (Body: `{ "name": "Trí tuệ nhân tạo" }`)
- **Cập nhật thẻ**: `PUT /api/admin/tags/{id}` (Body: `{ "name": "AI & Data Science" }`)
- **Xóa thẻ**: `DELETE /api/admin/tags/{id}`

---

## 5. MODULE MEDIA: THƯ VIỆN MEDIA & TẢI NGUYÊN (SCRUM-13)
*Quyền truy cập: `[Authorize(Roles = "admin,editor")]`*

### 5.1 Danh sách Media
- **Endpoint**: `GET /api/media`
- **Query Params**:
  - `kind`: `image` | `document` | `video`
  - `search`: Tìm theo tên tài nguyên
  - `mine`: `true` (chỉ media của chính mình tải lên)
  - `page`: Số trang (mặc định: `1`)
  - `pageSize`: Mặc định: `24`
- **Response `data.items`**:
  ```json
  {
    "id": "99999999-9999-9999-9999-999999999999",
    "name": "anh-bia-hoi-nghi.png",
    "altText": "Lễ khai mạc hội nghị khoa học sinh viên",
    "kind": "image",
    "mimeType": "image/png",
    "sizeBytes": 204850,
    "url": "https://storage.../signed-token...", // Signed URL có hạn dùng
    "createdAt": "2026-10-04T10:00:00Z"
  }
  ```

### 5.2 Upload Ảnh hoặc Tài liệu
- **Endpoint**: `POST /api/media`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: File nhị phân (Ảnh: PNG, JPG, WEBP; Tài liệu: PDF, DOCX, XLSX). Giới hạn ảnh: 10MB; tài liệu: 25MB.
  - `altText`: **Bắt buộc đối với ảnh** (mô tả ngữ nghĩa trợ năng).
- **Lưu ý**: Backend kiểm tra Magic Bytes. File thực thi (`.exe`, `.sh`) đổi đuôi thành `.jpg` sẽ bị từ chối với HTTP 415 `unsupported_type`.

### 5.3 Thêm Video YouTube
- **Endpoint**: `POST /api/media/videos`
- **Request Body**:
  ```json
  {
    "url": "https://youtu.be/dQw4w9WgXcQ",
    "name": "Video giới thiệu Khoa CNPM"
  }
  ```

### 5.4 Kiểm tra nơi đang sử dụng Media & Xóa Media
- **Xem nơi sử dụng trước khi xóa**: `GET /api/media/{id}/usages`
  - Trả về danh sách bài viết / trang đang nhúng media này.
- **Xóa Media**: `DELETE /api/media/{id}`
  - Nếu media đang được sử dụng trong bài viết hoặc trang, backend từ chối xóa với HTTP 409 `media_in_use` kèm danh sách usages.

---

## 6. MODULE T8: SOẠN THẢO BÀI VIẾT, RICH-TEXT JSON & LƯU NHÁP (SCRUM-15)

### 6.1 Cấu trúc Rich-Text JSON (TipTap Standard Schema)
Nội dung bài viết gửi lên trường `content` bắt buộc là một JSON Object tuân thủ cấu trúc TipTap AST:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Quy chế Học vụ 2026" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Xem thông tin chi tiết tại " },
        {
          "type": "text",
          "text": "Cổng thông tin Đào tạo",
          "marks": [{ "type": "link", "attrs": { "href": "https://daotao.uit.edu.vn" } }]
        }
      ]
    },
    {
      "type": "image",
      "attrs": {
        "mediaId": "99999999-9999-9999-9999-999999999999",
        "alt": "Ảnh minh họa"
      }
    }
  ]
}
```
**Quy tắc Sanitization của Backend (Frontend cần biết)**:
1. **Không gửi signed URL trong nội dung**: Node `image` và `video` chỉ lưu thuộc tính `mediaId`. Backend sẽ bóc tách và ký URL tự động khi render.
2. **Link protocols hợp lệ**: Chỉ chấp nhận `http:`, `https:`, `mailto:` hoặc đường dẫn tương đối `/...`. Các link `javascript:...` hoặc `data:...` sẽ tự động bị lược bỏ.
3. Thẻ script, iframe không được phép, style lạ và thuộc tính nguy hiểm (`onclick`, `onerror`) sẽ bị xóa bỏ hoàn toàn.

### 6.2 Tạo bài viết mới (Luôn ở trạng thái Nháp)
- **Endpoint**: `POST /api/posts`
- **Quyền**: `[Authorize(Roles = "admin,editor")]`
- **Request Body**:
  ```json
  {
    "title": "Thông báo học bổng doanh nghiệp kỳ 1 năm học 2026-2027",
    "slug": "", // Bỏ trống: Backend tự sinh slug chuẩn SEO từ title
    "summary": "Doanh nghiệp trao tặng 20 suất học bổng cho sinh viên có thành tích xuất sắc.",
    "content": { "type": "doc", "content": [...] },
    "coverMediaId": "99999999-9999-9999-9999-999999999999", // Bắt buộc
    "primaryCategoryId": "guid-chuyen-muc-chinh", // Bắt buộc
    "categoryIds": ["guid-chuyen-muc-phu-1"],     // Chuyên mục phụ (tùy chọn)
    "tagIds": ["guid-the-1", "guid-the-2"]        // Thẻ (tùy chọn)
  }
  ```
- **Response**: Trả về `PostDetailDto` với `status: "draft"` và `version: 1`.

### 6.3 Lấy danh sách bài viết (Admin & Editor)
- **Endpoint**: `GET /api/posts`
- **Query Params**:
  - `status`: `draft` | `pending` | `published` | `changes_requested` | `archived`
  - `search`: Từ khóa tìm kiếm
  - `categoryId`: Lọc theo chuyên mục
  - `mine`: `true` (Admin lọc bài của chính mình; Editor luôn luôn chỉ thấy bài của mình)
  - `page`: Trang
  - `pageSize`: Số bài / trang
- **Lưu ý đặc biệt cho FE**: Mỗi item trả về có trường `allowedStatuses: string[]` chỉ định chính xác các trạng thái mà người dùng hiện tại có thể chuyển bài tới (dùng để render dropdown/action buttons trên giao diện).

### 6.4 Lấy chi tiết bài viết cho Trình soạn thảo (Editor Form)
- **Endpoint**: `GET /api/posts/{id}`
- **Response `data`**:
  - `content`: JSON TipTap đã sanitize.
  - `media`: Dictionary `{ [mediaId]: { id, name, altText, url, videoId } }` chứa đầy đủ signed URLs hợp lệ của tất cả các ảnh/video xuất hiện trong bài. Frontend chỉ cần map `mediaId` vào URL tương ứng để hiển thị trong editor.
  - `version`: Phiên bản hiện tại của bài (bắt buộc lưu lại để gửi khi cập nhật).

### 6.5 Cập nhật bài viết (Optimistic Concurrency Control)
- **Endpoint**: `PUT /api/posts/{id}`
- **Request Body**:
  ```json
  {
    "title": "Tiêu đề cập nhật",
    "summary": "Tóm tắt...",
    "content": { "type": "doc", "content": [...] },
    "coverMediaId": "guid...",
    "primaryCategoryId": "guid...",
    "categoryIds": [],
    "tagIds": [],
    "version": 1 // BẮT BUỘC: Gửi lên version vừa đọc được
  }
  ```
- **Xử lý xung đột tương tranh (HTTP 409)**:
  - Nếu bài viết đã bị sửa đổi ở một tab khác hoặc bởi người khác, backend sẽ trả về mã lỗi:
    ```json
    {
      "status": 409,
      "code": "version_conflict",
      "title": "Xung đột phiên bản",
      "detail": "Bài viết đã được chỉnh sửa ở nơi khác. Vui lòng tải lại bài viết trước khi lưu."
    }
    ```
  - **Frontend UI Behavior**: Hiển thị Modal thông báo người dùng tải lại bài viết để tránh ghi đè dữ liệu.
- **Quyền hạn Editor**: Editor chỉ sửa được bài khi bài ở trạng thái `draft` hoặc `changes_requested`. Nếu bài đang `pending` hoặc `published` sẽ nhận lỗi 422 `post_locked`.

### 6.6 Xem trước bài viết an toàn (Preview)
- **Endpoint**: `GET /api/posts/{id}/preview`
- **Quyền**: Yêu cầu xác thực JWT. Chỉ tác giả Editor hoặc Admin mới có quyền xem trước.
- **Response**: Trả về dữ liệu chuẩn bị sẵn sàng cho trang xem chi tiết (đã ký đầy đủ URL ảnh bìa và media).

---

## 7. MODULE T9: VÒNG ĐỜI BÀI VIẾT, QUY TRÌNH DUYỆT & XUẤT BẢN (SCRUM-16)

### 7.1 Ma trận Chuyển trạng thái Vòng đời
```text
  [draft] ──(Tác giả gửi duyệt)──> [pending]
    ▲                                    │
    │ (Tác giả rút lại)        ┌─────────┴─────────┐
    │                          │ (Admin duyệt)     │ (Admin yêu cầu sửa)
  [changes_requested] ◄────────┘                   ▼
    │                                         [published]
    │                                              │ (Admin lưu trữ)
    │                                              ▼
    └──────────────(Admin khôi phục)───────── [archived]
```

### 7.2 API Chuyển trạng thái Bài viết
- **Endpoint**: `POST /api/posts/{id}/status`
- **Quyền**: Phụ thuộc vai trò và quyền tác giả.
- **Request Body**:
  ```json
  {
    "toStatus": "pending", // "pending" | "changes_requested" | "published" | "archived" | "draft"
    "version": 2,          // BẮT BUỘC
    "reason": "Bổ sung thông tin địa điểm nộp hồ sơ.", // BẮT BUỘC nếu toStatus == "changes_requested"
    "publishedAt": "2026-10-10T08:00:00Z", // Tùy chọn: Thời điểm xuất bản (hẹn giờ trong tương lai)
    "expiresAt": null                      // Tùy chọn: Thời điểm hết hạn hiển thị
  }
  ```
- **Các trường hợp lỗi FE cần bắt**:
  - `403 forbidden_transition`: Editor tự bấm xuất bản bài của mình (`toStatus = "published"`).
  - `400 ValidationFailure`: Chuyển sang `changes_requested` nhưng bỏ trống `reason`.
  - `409 version_conflict`: Version không khớp.
  - `422 invalid_transition`: Chuyển trạng thái không theo quy trình (VD: từ `draft` nhảy thẳng lên `published`).

### 7.3 Đặt bài viết Nổi bật & Độ ưu tiên (Featured Post)
- **Endpoint**: `PUT /api/posts/{id}/featured`
- **Quyền**: `[Authorize(Roles = "admin")]`
- **Request Body**:
  ```json
  {
    "isFeatured": true,
    "priority": 10 // Số càng lớn, hiển thị càng trước trong khối nổi bật
  }
  ```

### 7.4 Xem lịch sử chuyển trạng thái
- **Endpoint**: `GET /api/posts/{id}/history`
- **Response `data`**: Danh sách các lần đổi trạng thái, ai thực hiện (`actor.name`), lý do (`reason`), thời gian (`createdAt`).

### 7.5 Public API: Xem chi tiết bài viết công khai
- **Endpoint**: `GET /api/public/posts/{slug}`
- **Quyền**: Công khai (`[AllowAnonymous]`)
- **Quy tắc**: Chỉ hiển thị bài viết thỏa mãn: `status == "published"` VÀ `publishedAt <= hiện tại` VÀ (`expiresAt` chưa đến hoặc là null). Các bài khác đều trả về HTTP 404 Not Found.

---

## 8. MODULE T10: TRANG TĨNH & CẤU HÌNH TRANG CHỦ ĐỘNG (SCRUM-17)

### 8.1 Admin API: Quản trị Trang tĩnh (Pages)
*Quyền truy cập: `[Authorize(Roles = "admin")]`*

- **Danh sách trang**: `GET /api/admin/pages` (kèm số lượng menu items đang liên kết `menuItemCount`).
- **Xem chi tiết trang**: `GET /api/admin/pages/{id}` (trả về danh sách chi tiết các menu đang trỏ tới trang này qua `menuItems: [{ id, label, menuName }]`).
- **Tạo trang mới**: `POST /api/admin/pages`
  ```json
  {
    "title": "Giới thiệu Khoa Công nghệ Phần mềm",
    "slug": "", // Bỏ trống: tự tạo slug
    "status": "published", // "draft" | "published" | "archived"
    "content": { "type": "doc", "content": [...] }
  }
  ```
- **Cập nhật trang**: `PUT /api/admin/pages/{id}`
- **Xóa trang tĩnh (Bảo vệ Dead-Link)**: `DELETE /api/admin/pages/{id}`
  - **Lưu ý FE**: Nếu trang đang được MenuItem trỏ tới, Backend sẽ từ chối xóa với HTTP 409:
    ```json
    {
      "status": 409,
      "code": "page_in_menu",
      "title": "Trang đang có trong menu",
      "detail": "Không thể xóa trang vì đang được liên kết trong 1 mục menu."
    }
    ```
  - **Frontend UI Behavior**: Hiển thị popup cảnh báo yêu cầu Admin gỡ bỏ liên kết menu trước khi xóa trang.

### 8.2 Public API: Xem Trang tĩnh công khai
- **Endpoint**: `GET /api/public/pages/{slug}`
- **Quy tắc**: Chỉ trả về trang có `status == "published"`. Trang nháp hoặc lưu trữ trả HTTP 404.

### 8.3 Admin API: Cấu hình Khối nội dung Trang chủ (Home Sections)
*Quyền truy cập: `[Authorize(Roles = "admin")]`*

- **Lấy danh sách các khối theo thứ tự**: `GET /api/admin/home-sections`
- **Thêm khối mới**: `POST /api/admin/home-sections`
  ```json
  {
    "title": "Thông báo Học bổng & Việc làm",
    "categoryId": "guid-category...", // Bỏ trống: hiện bài mới nhất mọi chuyên mục
    "itemLimit": 6,                    // Số lượng bài hiển thị trong khối
    "isVisible": true
  }
  ```
- **Cập nhật khối**: `PUT /api/admin/home-sections/{id}`
- **Xóa khối**: `DELETE /api/admin/home-sections/{id}`
- **Kéo thả sắp xếp lại thứ tự các khối**: `PUT /api/admin/home-sections/order`
  ```json
  {
    "ids": [
      "guid-khoi-1",
      "guid-khoi-2",
      "guid-khoi-3"
    ]
  }
  ```

### 8.4 Public API: Tổng hợp Server-Side Rendering (SSR) Trang chủ
- **Endpoint**: `GET /api/public/home`
- **Quyền**: Công khai (`[AllowAnonymous]`)
- **Mục đích**: Tối ưu hóa cho Next.js / React SSR: chỉ cần gọi **1 request duy nhất** để lấy toàn bộ dữ liệu dựng trang chủ.
- **Response `data`**:
  ```json
  {
    "featured": [
      {
        "slug": "hoi-nghi-khoa-hoc-2026",
        "title": "Hội nghị Khoa học Sinh viên 2026",
        "summary": "...",
        "coverUrl": "https://storage.../signed...",
        "coverAlt": "Ảnh hội nghị",
        "publishedAt": "2026-10-01T08:00:00Z",
        "categoryName": "Nghiên cứu Khoa học"
      }
    ],
    "latest": [
      // Danh sách bài mới nhất
    ],
    "sections": [
      {
        "title": "Thông báo Học bổng & Việc làm",
        "categorySlug": "hoc-bong-viec-lam",
        "posts": [
          // Tối đa itemLimit bài viết thuộc chuyên mục này
        ]
      }
    ]
  }
  ```

---

## 9. BẢNG TRA CỨU MÃ LỖI ĐẶC THÙ (BUSINESS ERROR CODES)

Khi nhận phản hồi HTTP lỗi, Frontend hãy kiểm tra trường `code` trong JSON trả về để hiển thị UI tương ứng:

| Mã `code` | HTTP Status | Ý nghĩa nghiệp vụ | Hành động khuyến nghị cho Frontend UI |
| :--- | :---: | :--- | :--- |
| `version_conflict` | 409 | Bài viết bị sửa đổi ở nơi khác | Bật thông báo: *"Dữ liệu đã bị thay đổi, vui lòng tải lại trang"* |
| `page_in_menu` | 409 | Trang đang được liên kết trong Menu Items | Hiển thị cảnh báo kèm danh sách Menu cần gỡ bỏ trước khi xóa trang |
| `media_in_use` | 409 | Media đang được nhúng trong bài viết/trang | Hiển thị modal danh sách bài viết đang dùng media này |
| `not_owner` | 403 | Editor cố tình thao tác trên bài viết của người khác | Điều hướng về danh sách bài viết cá nhân kèm Toast lỗi |
| `forbidden_transition` | 403 | Editor cố tình duyệt hoặc xuất bản bài viết | Ẩn hoặc disable nút "Xuất bản" đối với role Editor |
| `post_locked` | 422 | Bài đang chờ duyệt hoặc đã xuất bản nên Editor không sửa được | Khóa form soạn thảo ở chế độ chỉ đọc (Read-only) |
| `invalid_transition` | 422 | Bước chuyển trạng thái vi phạm quy trình State Machine | Tải lại chi tiết bài viết để lấy danh sách `allowedStatuses` mới nhất |
| `unsupported_type` | 415 | File tải lên không đúng định dạng cho phép hoặc giả mạo đuôi file | Báo lỗi tại dropzone: *"Định dạng tệp không được hỗ trợ"* |
