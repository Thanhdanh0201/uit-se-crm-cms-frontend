# Đề xuất API và DTO Sprint 2: chuyên mục, thẻ, media, menu

Trạng thái: **bản nháp để thống nhất FE và BE**. Khi backend chốt, sửa file này rồi cập nhật `.kiro/steering/api-contract.md`.

| Task FE | Task BE | Nội dung |
|---|---|---|
| SCRUM-36 Chuyên mục và thẻ | SCRUM-12 | Mục 2, 3 |
| SCRUM-37 Thư viện media, SCRUM-38 Bộ chọn media | SCRUM-13 | Mục 4 |
| SCRUM-35 Quản lý menu | SCRUM-11 | Mục 5 |
| (Sprint 4) SCRUM-42 Điều hướng công khai | SCRUM-11 | Mục 5.4 |

Nguồn: entity EF Core trong `backend/Data/Entities` (`Categories`, `Tags`, `Media`, `Menus`, `MenuItems`), `backend/docs/DATABASE.md`, SRS 1.1 (FR-CAT, FR-MEDIA, FR-MENU, AT-01/05/06) và mô tả task Jira SCRUM-11..14, 35..38.

Ký hiệu: **[Xác nhận]** là điểm frontend không đọc được từ code (CHECK, trigger nằm trong Supabase, không có trong model EF). Backend trả lời trước khi frontend dựng mock.

---

## 1. Quy ước chung

Giữ nguyên quy ước đang chạy ở `/api/auth` và `/api/admin/users`:

- JSON camelCase. Thời gian ISO 8601 UTC. Id là UUID dạng chuỗi.
- Phân trang: query `page` (mặc định 1), `pageSize` (mặc định 20, **tối đa 50**, quá thì server tự cắt). Response:
  ```json
  { "items": [], "totalItems": 0, "page": 1, "pageSize": 20, "totalPages": 0 }
  ```
- Thành công khi tạo: `201` trả thẳng DTO vừa tạo. Sửa: `200` trả DTO sau khi sửa. Xóa: `204`.
  - Khác `/api/admin/users` (đang bọc `{ message, data }`). Đề xuất bỏ lớp bọc cho API mới: frontend tự viết thông báo tiếng Việt, không cần `message` từ server.
- Lỗi: `application/problem+json` (ProblemDetails). Thêm extension **`code`** để frontend phân biệt lỗi nghiệp vụ mà không phải so chuỗi `detail`:
  ```json
  { "status": 409, "title": "Chuyên mục đang được sử dụng", "detail": "Chuyên mục còn 12 bài viết và 2 chuyên mục con.", "code": "category_in_use", "postCount": 12, "childCount": 2 }
  ```
- Validation: `400` ValidationProblemDetails, `errors` theo field (key PascalCase như hiện tại, frontend đã xử lý).
- Bảng mã lỗi dùng chung:

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | (không có, dùng `errors`) | Sai định dạng, thiếu field |
| 404 | `not_found` | Không tồn tại hoặc đã xóa mềm |
| 409 | `slug_taken` | Slug trùng (chuyên mục, thẻ) |
| 409 | `category_in_use` | Xóa chuyên mục còn bài hoặc chuyên mục con mà không chọn nơi chuyển |
| 409 | `media_in_use` | Xóa media còn được bài, trang hoặc ảnh bìa dùng |
| 413 | `file_too_large` | File quá 10 MiB |
| 415 | `unsupported_type` | Đuôi file hoặc MIME thật không nằm trong allowlist |
| 422 | `invalid_parent` | Chọn chính nó hoặc cây con của nó làm cha, cha ở menu khác, cha đã xóa |
| 422 | `menu_depth_exceeded` | Menu vượt quá 3 cấp (tính cả cây con khi di chuyển) |
| 422 | `invalid_target` | Mục menu trỏ tới chuyên mục hoặc trang không còn hiệu lực |
| 422 | `video_url_not_allowed` | URL video không thuộc allowlist (YouTube) |

- Không cập nhật lạc quan: mọi thao tác thay đổi cây (di chuyển, sắp xếp, xóa) trả về **danh sách mới sau khi lưu**, frontend vẽ lại từ đó. Đáp ứng tiêu chí "không tự xóa UI khi API thất bại" và "reorder giữ sau reload".

## 2. Chuyên mục (FR-CAT-01..04, quyền: `admin`)

### 2.1 DTO

```ts
type CategoryDto = {
  id: string
  parentId: string | null
  name: string            // 1..100 ký tự
  slug: string            // xem 2.3
  description: string | null // tối đa 500 ký tự
  isVisible: boolean
  sortOrder: number       // thứ tự trong cùng cha, server quản lý
  postCount: number       // bài chưa xóa mềm có chuyên mục này (chính hoặc bổ sung)
  childCount: number      // chuyên mục con chưa xóa mềm
  createdAt: string
  updatedAt: string
}
```

### 2.2 Endpoint

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/admin/categories` | – | `CategoryDto[]` **dạng phẳng**, sắp theo `parentId`, `sortOrder`. Không phân trang (số chuyên mục nhỏ). Frontend tự dựng cây |
| POST | `/api/admin/categories` | `{ parentId?, name, slug?, description?, isVisible }` | `201 CategoryDto`. Thiếu `slug` thì server sinh từ `name`. Mục mới nằm cuối danh sách anh em |
| PUT | `/api/admin/categories/{id}` | `{ name, slug, description?, isVisible }` | `200 CategoryDto`. Không đổi cha ở đây |
| POST | `/api/admin/categories/{id}/move` | `{ parentId: string \| null, index: number }` | `200 CategoryDto[]` (toàn bộ danh sách sau khi lưu). Dùng cho kéo thả: đổi cha và vị trí trong một transaction |
| DELETE | `/api/admin/categories/{id}` | query `targetCategoryId?` | `204`. Xem 2.4 |
| GET | `/api/categories` | – | Cho `editor` và `admin` (form bài viết Sprint 3): `{ id, parentId, name, slug, isVisible }[]` |

### 2.3 Slug

- Định dạng: `^[a-z0-9]+(-[a-z0-9]+)*$`, tối đa 120 ký tự. Frontend gợi ý slug từ tên (bỏ dấu tiếng Việt, `đ` thành `d`, khoảng trắng thành `-`), người dùng sửa được.
- Server chuẩn hóa lại và trả `409 slug_taken` nếu trùng.
- **[Xác nhận]** Unique index `categories_slug_key` có tính cả bản ghi đã xóa mềm không. Tài liệu hướng dẫn dev ghi "slug duy nhất kể cả dữ liệu đã xóa mềm". Nếu đúng, `detail` nên nói rõ "slug đã được dùng bởi một chuyên mục đã xóa".

### 2.4 Xóa mềm và chuyển bài (FR-CAT-04)

1. Frontend mở dialog xóa, hiện `postCount` và `childCount` của chuyên mục.
2. Còn bài hoặc còn chuyên mục con: bắt buộc chọn **chuyên mục đích** (không cho chọn chính nó hoặc cây con của nó), gửi `DELETE ...?targetCategoryId=...`.
3. Server trong một transaction: chuyển bài (cả chuyên mục chính `primary_category_id` lẫn bổ sung `post_categories`) và chuyên mục con sang đích, rồi đặt `deleted_at`.
4. Không có `targetCategoryId` mà còn bài hoặc con: `409 category_in_use` kèm `postCount`, `childCount`.
5. Đích không hợp lệ: `422 invalid_parent`.

**[Xác nhận]** Chuyên mục có giới hạn số cấp không. SRS chỉ ghi "nhiều cấp". Đề xuất không giới hạn, chỉ chặn vòng lặp.

## 3. Thẻ (FR-CAT-03, quyền: `admin`)

Bảng `tags` chỉ có `id`, `name`, `slug`, không có `deleted_at`.

```ts
type TagDto = { id: string; name: string; slug: string; postCount: number }
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/admin/tags` | query `search?`, `page`, `pageSize` | Phân trang `TagDto`, sắp theo `name` |
| POST | `/api/admin/tags` | `{ name, slug? }` | `201 TagDto`. Tên 1..50 ký tự, slug cùng quy tắc 2.3 |
| PUT | `/api/admin/tags/{id}` | `{ name, slug }` | `200 TagDto` |
| DELETE | `/api/admin/tags/{id}` | – | `204`. Xóa hẳn, gỡ khỏi `post_tags`. Frontend cảnh báo `postCount` trước khi gọi |
| GET | `/api/tags` | query `search` | Cho `editor`, `admin` (gợi ý thẻ khi soạn bài Sprint 3): `{ id, name, slug }[]`, tối đa 20 |

**[Xác nhận]** Editor có được tạo thẻ mới khi soạn bài không, hay chỉ chọn thẻ có sẵn.

## 4. Media (FR-MEDIA-01..06, AT-05, AT-06, quyền: `editor`, `admin`)

### 4.1 DTO

```ts
type MediaKind = 'image' | 'document' | 'video' // [Xác nhận] giá trị CHECK của media.kind

type MediaDto = {
  id: string
  kind: MediaKind
  name: string               // 1..200 ký tự
  description: string | null // tối đa 500
  altText: string | null     // bắt buộc với image (FR-MEDIA-03)
  mimeType: string | null    // null với video
  sizeBytes: number | null   // null với video
  externalUrl: string | null // chỉ video: URL YouTube đã chuẩn hóa
  url: string | null         // signed URL để xem hoặc tải (image, document). null với video
  thumbnailUrl: string | null // image: bản thu nhỏ nếu có, không thì bằng url. video: ảnh YouTube
  urlExpiresAt: string | null // thời điểm signed URL hết hạn
  usageCount: number         // số bài, trang, ảnh bìa đang dùng
  createdAt: string
  createdBy: { id: string; fullName: string }
}
```

Không trả `bucketId`, `objectPath` ra client.

### 4.2 Endpoint

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/media` | query `kind?`, `search?` (tên, mô tả), `mine?` (chỉ của tôi), `page`, `pageSize` (mặc định 24) | Phân trang `MediaDto`, mới nhất trước. Thư viện (SCRUM-37) và bộ chọn (SCRUM-38) cùng dùng |
| GET | `/api/media/{id}` | – | `MediaDto` (lấy signed URL mới khi URL cũ hết hạn) |
| POST | `/api/media` | `multipart/form-data`: `file`, `name?`, `altText?`, `description?`. Header `Idempotency-Key: <uuid>` | `201 MediaDto`. Thiếu `name` thì lấy tên file |
| POST | `/api/media/videos` | `{ url, name, description? }` | `201 MediaDto` kind `video` |
| PUT | `/api/media/{id}` | `{ name, altText?, description? }` | `200 MediaDto` |
| GET | `/api/media/{id}/usages` | – | `{ posts: { id, title, status }[], pages: { id, title }[], coverOf: { id, title }[] }` |
| DELETE | `/api/media/{id}` | – | `204`, hoặc `409 media_in_use` kèm `usages` như endpoint trên |

### 4.3 Upload

- Allowlist (cùng ở client và server):

| kind | Đuôi | MIME |
|---|---|---|
| image | `.jpg`, `.jpeg`, `.png`, `.webp` | `image/jpeg`, `image/png`, `image/webp` |
| document | `.pdf`, `.docx`, `.xlsx` | `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

- Dung lượng tối đa **10 MiB = 10 485 760 byte**.
- Client kiểm tra đuôi và dung lượng trước để báo nhanh. Server **vẫn** kiểm tra MIME thật (magic bytes), trả `415 unsupported_type` hoặc `413 file_too_large`. `detail` viết tiếng Việt, frontend hiện nguyên văn (AT-05).
- Ảnh: `altText` bắt buộc khi upload. Thiếu thì `400 errors.AltText`. **[Xác nhận]** hay cho upload trước, bổ sung alt text sau.
- Chống upload trùng: frontend khóa nút khi đang gửi và gửi `Idempotency-Key` mới cho mỗi file. Server nhận lại cùng key trong 24 giờ thì trả lại media đã tạo, không tạo bản mới.
- Thanh tiến trình: frontend dùng `XMLHttpRequest` (`fetch` không báo tiến độ upload). Backend không cần làm gì thêm.
- Video: chỉ nhận `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`. Server chuẩn hóa về `https://www.youtube.com/watch?v=<id>`, sinh `thumbnailUrl` từ `img.youtube.com/vi/<id>/hqdefault.jpg`. URL khác: `422 video_url_not_allowed`. Server không tải nội dung từ URL người dùng nhập.

### 4.4 Xóa (FR-MEDIA-06, AT-06)

- Frontend gọi `GET /usages` trước khi mở dialog xóa. Đang được dùng thì hiện danh sách bài và trang, không cho xóa.
- Server vẫn kiểm tra lại: còn tham chiếu thì `409 media_in_use`, không xóa.
- **[Xác nhận]** Xóa là xóa mềm (`deleted_at`) rồi dọn object trong Storage bằng job, hay xóa hẳn ngay.
- **[Xác nhận]** Quyền xóa: đề xuất editor chỉ xóa media do mình tải lên, admin xóa mọi media.

### 4.5 Signed URL

- Theo tài liệu hướng dẫn dev, TTL khoảng 60 giây. Lưới ảnh hiển thị lâu sẽ hết hạn, nên trả kèm `urlExpiresAt`. Frontend tải lại danh sách khi ảnh lỗi do hết hạn.
- **[Xác nhận]** Đề xuất TTL 10 đến 15 phút cho thư viện admin (vẫn qua kiểm tra quyền), để lưới ảnh không phải tải lại liên tục.

### 4.6 Bộ chọn media (SCRUM-38)

Không cần endpoint riêng. Modal gọi `GET /api/media?kind=...`, chọn xong trả về `MediaDto` cho nơi gọi.

- Ô ảnh bìa: `kind=image` cố định.
- Trình soạn thảo: chọn `image`, `document` hoặc `video`.

## 5. Menu (FR-MENU-01..05, AT-01, quyền: `admin`)

### 5.1 DTO

```ts
type MenuDto = { id: string; code: string; name: string; itemCount: number }

type MenuItemKind = 'page' | 'category' | 'external' // [Xác nhận] giá trị CHECK của menu_items.kind

type MenuItemDto = {
  id: string
  parentId: string | null
  label: string               // 1..100 ký tự
  kind: MenuItemKind
  pageId: string | null       // kind = page
  categoryId: string | null   // kind = category
  externalUrl: string | null  // kind = external, chỉ http(s), tối đa 2048
  isVisible: boolean
  sortOrder: number
  depth: number               // 1, 2 hoặc 3
  target: { title: string; slug: string; isAvailable: boolean } | null
  // Server giải nghĩa page/category để admin thấy mục trỏ tới đâu. isAvailable = false khi đích đã xóa
  // hoặc bị ẩn (chuẩn bị cho FR-MENU-06 cảnh báo liên kết hỏng, Should)
}
```

### 5.2 Endpoint quản trị

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/admin/menus` | – | `MenuDto[]` |
| POST | `/api/admin/menus` | `{ code, name }` | `201 MenuDto`. `code`: `^[a-z0-9-]+$`, duy nhất (ví dụ `main`, `footer`) |
| PUT | `/api/admin/menus/{id}` | `{ name }` | `200 MenuDto`. Không đổi `code` (frontend public dựa vào nó) |
| DELETE | `/api/admin/menus/{id}` | – | `204`, xóa mềm menu và toàn bộ mục |
| GET | `/api/admin/menus/{id}/items` | – | `MenuItemDto[]` dạng phẳng, sắp theo `parentId`, `sortOrder` |
| POST | `/api/admin/menus/{id}/items` | `{ parentId?, label, kind, pageId?, categoryId?, externalUrl?, isVisible }` | `201 MenuItemDto[]` (cả danh sách) |
| PUT | `/api/admin/menu-items/{itemId}` | `{ label, kind, pageId?, categoryId?, externalUrl?, isVisible }` | `200 MenuItemDto[]` |
| POST | `/api/admin/menu-items/{itemId}/move` | `{ parentId: string \| null, index: number }` | `200 MenuItemDto[]`. Kéo thả, đổi cha và vị trí trong một transaction |
| DELETE | `/api/admin/menu-items/{itemId}` | – | `200 MenuItemDto[]`. Xóa mềm mục và cây con. Frontend xác nhận kèm số mục con trước khi gọi |

Đúng một trong `pageId`, `categoryId`, `externalUrl` có giá trị, khớp với `kind`. Sai thì `400`.

### 5.3 Ràng buộc server kiểm tra (theo SCRUM-11)

- Tối đa 3 cấp, tính cả cây con khi di chuyển: `422 menu_depth_exceeded`. Frontend chặn trước khi gửi (không cho thả vào chỗ vượt cấp) và vẫn hiện lỗi từ API nếu có.
- Không chọn chính nó hoặc cây con của nó làm cha, cha phải cùng menu: `422 invalid_parent`.
- Đích `page` hoặc `category` phải còn hiệu lực: `422 invalid_target`.
- Mục loại `page` cần API trang tĩnh (SCRUM-17, Sprint 3). Sprint 2 frontend làm `category` và `external`, loại `page` hiện "Sắp có".

### 5.4 Menu công khai (dùng ở SCRUM-42, Sprint 4)

| Method | Path | Response |
|---|---|---|
| GET | `/api/public/menus/{code}` | Cây lồng nhau, chỉ gồm mục hiển thị. Mục cha bị ẩn thì ẩn cả nhánh. `href` do server tính: `/categories/{slug}`, `/pages/{slug}` hoặc URL ngoài |

```ts
type PublicMenuItem = { label: string; href: string; external: boolean; children: PublicMenuItem[] }
```

Đây là cách kiểm tra tiêu chí "ẩn/hiện phản ánh public" của SCRUM-35: tắt một mục trong admin, header public không còn mục đó.

---

## 6. Cần backend trả lời

1. Giá trị CHECK của `media.kind` và `menu_items.kind`.
2. Slug chuyên mục có trùng với bản đã xóa mềm không (2.3).
3. Chuyên mục có giới hạn số cấp không (2.4).
4. Editor có tạo thẻ mới khi soạn bài không (3).
5. Alt text bắt buộc ngay lúc upload hay bổ sung sau (4.3).
6. Xóa media là mềm hay cứng, ai được xóa (4.4).
7. TTL signed URL cho thư viện admin (4.5).
8. Đồng ý bỏ lớp bọc `{ message, data }` và thêm `code` vào ProblemDetails cho API mới (1).

## 7. Frontend làm trước bằng mock thế nào

- Mock theo đúng DTO trong file này, đặt trong test (`mockApi()` ở `src/lib/test-utils.tsx`), không thêm mock server vào code chạy thật.
- Type TypeScript khai báo cạnh trang dùng (`src/pages/admin/Categories.tsx`, ...). Khi backend chốt, chỉ sửa type và test.
- Nghiệm thu (AT-01, AT-05, AT-06) chạy lại với API thật khi SCRUM-11, 12, 13 xong.
