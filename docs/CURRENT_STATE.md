# Trạng thái frontend

## Đã hoàn thành (Sprint 1)
- Khởi tạo Vite + React 19 + TypeScript (strict), react-router 8, Vitest, oxlint.
- Vite proxy `/api` sang backend `http://localhost:5179` (backend chưa bật CORS).
- `src/lib/api.ts`: fetch wrapper gửi cookie, chuẩn hóa lỗi ProblemDetails và `{ message }` thành `ApiError`. Có test.
- `src/lib/auth.tsx`: `AuthProvider` khôi phục phiên qua `GET /api/auth/me`, `login`/`logout`, guard `RequireRole` (chỉ là UX).
- Đăng nhập hoàn chỉnh (FR-AUTH-01): lỗi theo field từ validation backend, lỗi chung cho 401, hiện/ẩn mật khẩu, về lại trang trước qua `?next=` (chặn open redirect), chuẩn hóa role, xử lý hết phiên (401 bất kỳ → về trạng thái khách + thông báo). Có test.
- Đăng nhập (FR-AUTH-01), đăng xuất (FR-AUTH-02), khung trang quản trị `/admin`, `/editor`, trang 403 và 404.

- Theme xanh/trắng theo se.uit.edu.vn (`src/styles/tokens.css`), font Be Vietnam Pro, icon Phosphor.
- Bộ component `src/components/ui`: Button, TextField/TextArea/Select/Checkbox, Card, Badge + PostStatusBadge, Alert, ConfirmDialog, Pagination (có test), Skeleton, EmptyState, PageHeader, class bảng `.ui-table`.
- Header/footer public và sidebar quản trị dùng theme mới; trang đăng nhập dùng component mới.
- Style guide `/dev/ui` (chỉ khi dev).
- Trang quản trị dùng Ant Design 6 (lazy-load, chỉ tải khi vào `/admin`), theme map từ token (`src/admin/theme.ts`).
- Khung quản trị `src/admin/AdminLayout.tsx`: header + sidebar xanh đậm thu gọn được, menu lọc theo role (`src/admin/menu.tsx`, có test), mobile trượt đè.
- Gộp `/editor` vào `/admin` (editor và admin cùng một khung, menu theo role).
- Chuyển sang React Router 8 framework mode, bật SSR: trang public trả HTML đầy đủ + thẻ `og:*`, canonical (`src/lib/seo.ts`). Trang không tồn tại trả HTTP 404. `/admin` chỉ render ở client (`clientLoader.hydrate` + `HydrateFallback`), trả `noindex`.
- Trang chủ (FR-PUB-01, FR-PUB-02): hero, khối Thông báo mới, truy cập nhanh, tin nổi bật, nhóm tin theo chuyên mục, sự kiện sắp diễn ra (trạng thái còn chỗ/đủ chỗ/hết hạn, có test), hỏi đáp. Dữ liệu từ `GET /api/public/home` (đề xuất), dev dùng dữ liệu mẫu khi API chưa có.
- Header public có menu chính, menu mobile (`<details>`), link tìm kiếm, skip link; footer có địa chỉ, điện thoại, email của Khoa.
- Khung trang chi tiết bài `/posts/:slug` (loader SSR + meta), dùng DTO tạm chờ backend.
- Mẫu trang danh sách `/dev/admin/users`: lọc, tìm kiếm, phân trang, drawer tạo/sửa, khóa có xác nhận, trạng thái trên URL (`src/lib/useListParams.ts`).

- Task [FE] Đăng nhập, đăng xuất, đổi mật khẩu (FR-AUTH-01, 02, 05): validate trước khi gửi (`lib/validate.ts`), pending và khóa form, chống submit lặp, lỗi API theo field và focus field sai; trang đổi mật khẩu `/me/password` (reauth bằng mật khẩu hiện tại), vào từ header public và dropdown admin; đăng xuất chống bấm lặp, luôn về `/login`, đồng bộ nhiều tab (`BroadcastChannel`); `PasswordField`. Test component bằng Testing Library + jsdom. Còn nghiệm thu với backend thật.

- Task [FE] Quản lý tài khoản (FR-AUTH-03, 04): `/admin/users` chỉ admin. Danh sách phân trang server, lọc trạng thái/vai trò, tìm kiếm, trạng thái trên URL; tạo/sửa trong drawer có validation cùng quy tắc backend; khóa/mở có xác nhận; đổi role và tạo admin có xác nhận; tải lại danh sách sau khi thành công; 403/404 không để UI thành công giả; chặn tự khóa/tự đổi role; loading/empty/error; responsive. 8 test component. Còn nghiệm thu với backend thật.

- Task SCRUM-32 [FE] Layout và điều hướng theo vai trò: trang từ chối `/403` (HTTP 403, nói rõ tài khoản và vai trò, "Đăng nhập tài khoản khác" quay lại đúng trang bị chặn); khu tài khoản `/me` cho mọi vai trò (đổi mật khẩu, lối vào trang quản trị cho editor/admin, các mục chưa có API ghi "Sắp có"); header public có link "Tài khoản", dropdown admin có "Tài khoản của tôi". Test nghiệm thu `src/routes.guard.test.tsx` (7 test) dùng route thật.

## Đã hoàn thành (Sprint 2), cập nhật 05/10/2026
- Task SCRUM-37 [FE] Thư viện media và form upload (FR-MEDIA-01..04, AT-05, AT-06): trang `/admin/media` cho editor và admin. Lọc theo loại, "Của tôi", tìm theo tên, dạng lưới hoặc bảng, phân trang server; mọi bộ lọc trên URL. Upload nhiều file trong drawer: kiểm tra đuôi và dung lượng 10 MB ở client, ảnh bắt buộc văn bản thay thế, tiến độ từng file (`upload()` trong `src/lib/api.ts` dùng XMLHttpRequest, có refresh phiên khi 401), lỗi server hiện riêng từng file, khóa nút khi đang gửi. Thêm video YouTube bằng URL. Drawer chi tiết: xem trước, sửa tên/alt/mô tả (chỉ người tải lên hoặc admin), cảnh báo nơi đang dùng và khóa nút xóa; nếu server trả 409 `media_in_use` thì hiện danh sách nơi dùng từ server. Signed URL hết hạn thì tự tải lại danh sách.
- Task SCRUM-38 [FE] Bộ chọn media dùng chung: `src/admin/MediaPicker.tsx` (Modal antd). Prop `kinds` giới hạn loại (ảnh đại diện truyền `['image']`), tìm kiếm, phân trang, chọn bằng bàn phím, trạng thái tải/rỗng/lỗi, trả về cả `MediaDto` (id, url, altText...). Chưa có màn hình dùng (chờ trình soạn bài Sprint 3).
- `ApiError` có thêm `code` và `body` để đọc mã lỗi nghiệp vụ và phần mở rộng của ProblemDetails.
- Xem giao diện không cần backend: `/dev/admin/media` (dữ liệu lấy từ API thật, không có mock).
- Test: `src/admin/media.test.ts`, `src/admin/MediaPicker.test.tsx`, `src/pages/admin/Media.test.tsx`. Còn nghiệm thu với backend thật (API media ở branch backend `feat/media-library`).

- Task SCRUM-59 Tối ưu hiệu năng trang quản trị (05/10/2026): link sidebar tải trước JS của trang khi rê chuột hoặc focus (`prefetch="intent"`). Backend (branch `perf/admin-users-list`): danh sách người dùng lấy email từ Supabase Auth song song (tối đa 8 request cùng lúc) thay vì tuần tự, `pageSize` giới hạn 50. Đã kiểm tra: trang public không tải antd; chunk antd dùng chung của Users/Media khoảng 110 KB gzip.

## Đã hoàn thành (Sprint 3), cập nhật 05/10/2026
- Task SCRUM-39 [FE] Danh sách bài viết (FR-POST-03..05): `/admin/posts`, lọc trạng thái, chuyên mục, từ khóa, "Của tôi" (admin), phân trang server, bộ lọc trên URL. Nút sửa theo quyền, nút chuyển trạng thái theo `allowedStatuses` của server (gửi duyệt, về nháp, lưu trữ có xác nhận). 409 báo bài đã đổi và tải lại; 403 và lỗi nghiệp vụ hiện rõ.
- Task SCRUM-40 [FE] Trình soạn thảo (FR-POST-01..04, 08; AT-02): `/admin/posts/new`, `/admin/posts/:id/edit` dùng Tiptap. Chèn ảnh/video từ thư viện media, ảnh đại diện qua `MediaPicker`, chuyên mục, thẻ, tóm tắt, đường dẫn. Lưu nháp kèm version, 409 hỏi tải lại; lỗi API giữ nội dung và sao lưu vào máy (khôi phục khi mở lại); cảnh báo rời trang chưa lưu; gửi duyệt từ trình soạn thảo. Xem trước dùng chung `PostArticle` với trang công khai (`/posts/:slug` nay gọi API thật). Trang `/admin/posts/:id/preview`.
- Task SCRUM-41 [FE] Duyệt bài: `/admin/review` (chờ duyệt, đã xuất bản, lưu trữ) và `/admin/review/:id` (chỉ admin). Xuất bản qua hộp thoại xác nhận, hẹn giờ và hết hạn tùy chọn; yêu cầu chỉnh sửa bắt buộc lý do; lưu trữ, về nháp có xác nhận; đặt bài nổi bật; lịch sử trạng thái tải lại sau mỗi thao tác thành công.
- Task SCRUM-35 [FE] Quản lý menu (FR-MENU-01..05, AT-01), làm lại theo Figma ngày 06/10/2026: `/admin/menus`, chỉ admin. Cột trái danh sách menu (thêm, sửa tên/mã, xóa có xác nhận), mobile đổi thành ô chọn. Cây mục 3 cấp bằng antd `Tree`: kéo thả hoặc nút Di chuyển (lên, xuống, vào trong, ra ngoài một cấp, dùng được bằng bàn phím), chặn vượt 3 cấp và thả vào cây con ngay ở client. Thứ tự sửa trên máy, thanh "Đã đổi thứ tự N mục, chưa lưu" với Hủy thay đổi / Lưu thứ tự (`PUT /api/admin/menus/{id}/tree`), lỗi thì giữ nguyên thứ tự đang sửa; khi đang có thứ tự chưa lưu thì khóa sửa/xóa/bật tắt và hỏi trước khi rời trang hoặc đổi menu. Drawer thêm/sửa mục: loại Trang / Chuyên mục / Liên kết ngoài, mục cha không có chính nó và cây con, báo vượt 3 cấp trước khi gửi và hiện lý do khi server từ chối. Mục trỏ đích đã xóa tô đỏ, mục ẩn và mục con của mục ẩn ghi rõ.
- Header public lấy menu mã `main` qua loader của `PublicLayout` (SSR, không tải lại mỗi lần chuyển trang). Mục có con mở dropdown khi rê chuột hoặc Tab vào; mobile hiện cấp con thụt lề. Lỗi API hoặc chưa có menu thì dùng menu dự phòng.
- Task SCRUM-36 [FE] Chuyên mục và thẻ (FR-CAT-01..04), làm lại theo Figma ngày 06/10/2026: `/admin/categories`, chỉ admin, tab Chuyên mục / Thẻ trên URL. Bảng cây chuyên mục (số bài, thứ tự, bật/tắt hiển thị), chuyên mục con của chuyên mục ẩn ghi "Không hiện công khai". Drawer thêm/sửa: kiểm tra đường dẫn cùng quy tắc backend kèm gợi ý bỏ dấu, chuyên mục cha không có chính nó và con cháu, lỗi trùng đường dẫn từ server gắn vào ô. Xóa an toàn: chuyên mục còn bài hoặc con phải chọn nơi nhận (bỏ chính nó và con cháu), lỗi thì giữ hộp thoại và danh sách, thành công mới tải lại. Thẻ: thêm/sửa/xóa, báo trùng dưới ô tên.
- Đã bỏ trang `/categories/:slug` của bản trước: dữ liệu bài lấy tạm từ `/api/public/home`, không đúng. Chờ backend có API công khai lấy bài theo chuyên mục (FR-PUB, Sprint 4).
- Giữ commit sửa giật thanh cuộn khi rê chuột (thay antd `Tooltip` bằng thuộc tính `title`, `scrollbar-gutter: stable`); trang menu và chuyên mục mới cũng dùng `title`, không dùng `Tooltip`.
- `Posts.tsx` và `PostEditor.tsx` (bản trước) gọi `/api/public/categories`, `/api/public/tags` khi API admin lỗi, để bộ lọc và trình soạn thảo vẫn có danh sách.
- Helper cây dùng chung `src/admin/tree.ts` (duyệt, di chuyển, kéo thả, chặn cấp, thứ tự gửi server) có test `tree.test.ts`.
- Test: `tree.test.ts`, `Menus.test.tsx`, `Categories.test.tsx`. Toàn bộ 107 test pass. Chưa chạy với backend thật (kiểm tra bằng API giả lập).

## Kế tiếp
- Các trang được trang chủ liên kết tới nhưng chưa có (đang trả 404): `/categories/:slug` (chờ API bài theo chuyên mục), `/events`, `/events/:id`, `/contact`, `/search`.
- FR-AUTH-05: màn hình đổi mật khẩu (`POST /api/auth/change-password`).
- Trang tĩnh và cấu hình trang chủ (backend đã có ở `feat/pages-home`, chưa có task FE).

## Ghi chú
- Refresh token và logout thu hồi session đã làm ở cả backend (chưa commit trong repo backend) và frontend (`api.ts` tự refresh khi 401).
- Còn lại: sau logout, access token (JWT) vẫn qua được kiểm tra chữ ký ở backend đến khi hết hạn. Nên giảm JWT expiry trong Supabase xuống 10-15 phút (đã có refresh nên người dùng không bị đăng xuất sớm).
- `docker-compose.yml` đặt `ASPNETCORE_ENVIRONMENT=Development`: `GlobalExceptionMiddleware` sẽ trả message lỗi 500 thật. Deploy thật phải đặt `Production`.
- Deploy frontend giờ cần server Node (`npm run build && npm start`) + nginx chia `/api` sang backend.
- Ảnh bìa bài public cần URL công khai không hết hạn để dùng cho `og:image` (báo nhóm backend).
- `GET /api/auth/me` chỉ trả `userId`, `role`, `email`; sau khi F5 chưa có `fullName`. Cần backend bổ sung nếu UI hiển thị tên.

## Cập nhật lần cuối
06/10/2026

