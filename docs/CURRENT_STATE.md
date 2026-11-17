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

## Đã hoàn thành (Sprint 5, phần quản trị), cập nhật 06/10/2026
- Task SCRUM-47 [FE] Quản trị sự kiện (FR-EVT): `/admin/events` (branch `feat/admin-events`). Lọc trạng thái, tìm theo tên/địa điểm, phân trang trên URL, thanh số đăng ký/sức chứa. Drawer tạo/sửa nhập giờ Việt Nam, gửi UTC; kiểm tra kết thúc sau bắt đầu, hạn đăng ký không sau bắt đầu; sức chứa không nhỏ hơn số đã đăng ký (422 `capacity_below_registered` gắn vào ô). Xóa có xác nhận.
- Task SCRUM-57 [FE] Danh sách đăng ký và xuất CSV: `/admin/events/:id` (branch `feat/event-registrations`, merge sau `feat/admin-events`). Lọc trạng thái, tìm kiếm, phân trang, nút Xuất CSV dùng `download()` mới trong `src/lib/api.ts`.
- Task SCRUM-48 [FE] Phản hồi liên hệ, phần quản trị: `/admin/contacts` (branch `feat/admin-contacts`). Lọc trạng thái, phân loại, từ khóa; drawer chi tiết đổi trạng thái và phân loại. Form liên hệ công khai `/contact` chưa làm.
- Task SCRUM-56 [FE] Người phụ trách và ghi chú nội bộ (branch `feat/contact-notes`, merge sau `feat/admin-contacts`): lọc và chọn người phụ trách, thêm/xem ghi chú nội bộ.
- Task SCRUM-49 [FE] Dashboard và nhật ký (FR-REP, FR-LOG): `/admin` thống kê bài viết, liên hệ, người dùng, sự kiện, bài chờ duyệt, mỗi khối tải riêng; `/admin/activity-logs` lọc người thực hiện, hành động, đối tượng, khoảng ngày (branch `feat/dashboard-logs`).
- Backend Sprint 5 (branch `feat/events`, `feat/registrations-csv`, `feat/contacts`, `feat/dashboard-logs`): SCRUM-21, 22, 23, 28.
- Test: `Events.test.tsx`, `EventRegistrations.test.tsx`, `Contacts.test.tsx`, `DashboardLogs.test.tsx`. Còn nghiệm thu với backend thật.

## Sửa lỗi nghiệm thu SCRUM-32/33/34, cập nhật 07/10/2026
- **Bug 1 (Delay trắng màn hình ~28s khi truy cập /admin trái phép)**: Thêm server `loader` và `clientLoader` trong `src/admin/AdminRoute.tsx` kiểm tra session và quyền ngay tại tầng routing của React Router. Khách bị 302 về `/login?next=...`, tài khoản sinh viên bị 302 về `/403` ngay lập tức (~10ms) mà không tải bất kỳ script/chunk nào của `AdminLayout`, `Users`, `Dashboard` hay thư viện `antd`.
- **Bug 2 (Multi-tab leo quyền & trắng màn hình /admin)**:
  - Bỏ `window.location.reload()` gây loop và trắng màn hình; `BroadcastChannel` đồng bộ trực tiếp qua `loadMe()` và `cachedUser`.
  - Trong `src/pages/public/Login.tsx`, bổ sung hàm `targetFor()`: nếu `user.role === 'student'` mà tham số `next` trỏ vào `/admin/*` thì tự động chuyển hướng an toàn về `/403` kèm state thay vì đưa người dùng vào trang quản trị rồi sập giao diện.
  - Trong `src/pages/public/Forbidden.tsx`, bỏ `{ replace: true }` tại `switchAccount()` để nút Back trên trình duyệt quay lại được `/403` ở trạng thái khách, không bị văng về trang trước đó.
- **Bug 3 (Chuẩn hóa URL parameters bẩn)**: Trang `/admin/users` tự động chuẩn hóa query params khi mount bằng `useEffect`: ép `page` âm về 1, `pageSize` lạ về 10, loại bỏ role/status không hợp lệ, trim keyword. Thêm method `replace()` trong `src/lib/useListParams.ts`.
## Sửa lỗi và cải tiến nghiệm thu Sprint 2 (SCRUM-35, 36, 37), cập nhật 09/10/2026
- **SCRUM-35 Quản lý menu**:
  - **Nút xóa menu hoạt động tin cậy**: Chuyển từ Popconfirm sang `modal.confirm` với `e.stopPropagation()`. Hộp thoại xác nhận rõ ràng, gọi DELETE API và tải lại danh sách menu sau khi xóa.
  - **Chọn mục cha trong Drawer**: Mặc định là cấp 1 / mục gốc (`undefined`), thêm tùy chọn hiển thị rõ ràng "Không có (cấp 1 / mục gốc)". Tích hợp tìm kiếm tiếng Việt không dấu (`viSearchMatch`) khi tìm kiếm trang đích, chuyên mục và mục cha.
- **SCRUM-36 Chuyên mục và thẻ**:
  - **Nút xóa thẻ hoạt động tin cậy**: Chuyển sang `modal.confirm` với `e.stopPropagation()`, đồng bộ trải nghiệm người dùng với menu.
  - **Chọn chuyên mục cha**: Mặc định là chuyên mục gốc, thêm tùy chọn "Không có (chuyên mục gốc)". Tích hợp `viSearchMatch` cho ô chọn chuyên mục cha và ô chọn chuyên mục đích khi chuyển bài viết để xóa chuyên mục.
- **SCRUM-37 Thư viện media**:
  - **Nút xóa media hoạt động tin cậy**: Dùng `modal.confirm` chuẩn thay cho Popconfirm trong drawer footer.
  - **Tìm kiếm tiếng Việt không phân biệt dấu**: Bổ sung hàm `viSearchMatch(input, label)` trong `src/admin/tree.ts` (có unit test đầy đủ) và áp dụng cho các bộ chọn chuyên mục, thẻ trong bài viết (`Posts.tsx`, `PostEditor.tsx`) và trang chủ (`HomeSections.tsx`).
- **Khắc phục lỗi dropdown của Select component không hiển thị danh sách trong Drawer/Modal và trang quản trị**:
  - Cấu hình `zIndexPopup: 3000` và `zIndexPopupBase: 2500` trong `adminTheme` (`src/admin/theme.ts`) để popup của Select luôn nổi lên trên Drawer và Modal.
  - Bổ sung `virtual={false}` và `getPopupContainer={(trigger) => trigger.parentElement}` cho các Select trong `Menus.tsx`, `Categories.tsx`, `Posts.tsx`, `PostEditor.tsx`, `HomeSections.tsx`, `Users.tsx`, `Events.tsx`, `Contacts.tsx` để render trực tiếp danh sách đầy đủ bên trong container của Form.Item, không bị phụ thuộc tính toán chiều cao virtual list và không bị ẩn sau Drawer.
- Toàn bộ 131/131 tests pass trên 28 file test.

## Sửa lỗi popup Select trong trang quản trị, cập nhật 10/10/2026
- FR-MENU-01..05, FR-CAT-01..04: Đã xác định nguyên nhân popup Select không hiện khi bật `prefers-reduced-motion: reduce`. Luật CSS giảm chuyển động toàn cục ép transition của popup Ant Design xuống `0.01ms`, khiến `rc-trigger` giữ popup ở tọa độ ẩn `-1000vw/-1000vh`.
- Giới hạn luật giảm chuyển động vào `#root`, không áp dụng lên popup Ant Design được portal trực tiếp vào `body`. Tắt motion Ant Design trong theme quản trị để giữ giao diện ít chuyển động.
- Đã kiểm tra bằng `npm run dev` với backend thật và chế độ giảm chuyển động: Select trong Drawer mở bằng chuột, chọn được mục và mở lại bình thường.
- Test liên quan: 22/22 pass. `npm run typecheck` còn lỗi có sẵn: `src/pages/admin/Media.tsx` import `Popconfirm` nhưng không sử dụng.

## Bổ sung nghiệm thu Sprint 1 (11/10/2026)
- Admin xóa tài khoản (SCRUM-34, FR-AUTH-04): nút thùng rác ở mỗi dòng `/admin/users` (Popconfirm) và chọn nhiều dòng rồi "Xóa N tài khoản". Server chỉ xóa tài khoản chưa có dữ liệu; tài khoản bị từ chối liệt kê kèm lý do (gợi ý khóa). Không xóa/chọn được chính mình. Test `UsersDelete.test.tsx`. Backend branch `feat/admin-delete-user`.
- SCRUM-61 (sửa sau khi test): nhập Excel bắt buộc đủ 5 cột kể cả Mật khẩu, bỏ mật khẩu tự sinh và file mật khẩu tạm (tải lại trang lúc đang nhập từng làm mất hết mật khẩu); cảnh báo khi tải lại/đóng tab lúc đang tạo. Bắt đổi mật khẩu lần đầu: `mustChangePassword` từ backend, đăng nhập xong hoặc gặp 403 `password_change_required` thì chuyển tới `/me/password?next=`, đổi xong quay lại trang định vào. Test: `routes.guard.test.tsx`, `ChangePassword.test.tsx`, `Login.test.tsx`, `UsersImportReset.test.tsx`.
- SCRUM-34 (FR-AUTH-03, 04): nút Đặt lại mật khẩu ở mỗi dòng `/admin/users` (tạo mật khẩu tạm hiện một lần kèm nút sao chép, hoặc admin tự đặt; người dùng bị đăng xuất khỏi mọi thiết bị; không áp dụng cho chính mình). Nút Nhập từ Excel (`?action=import`): tải file mẫu, chọn .xlsx, xem trước lỗi từng dòng, xác nhận rồi tạo các dòng hợp lệ, tải danh sách mật khẩu tạm (.csv, UTF-8 BOM, chống chèn công thức); đóng khi chưa tải thì hỏi lại. Test `UsersImportReset.test.tsx`.
- Sửa lỗi typecheck trên main: import thừa `Popconfirm` trong `Media.tsx`.

## Nghiệm thu Sprint 3 với backend thật (12/10/2026)
- Chạy backend main bằng Docker (Colima) và frontend main, tài khoản quản trị viên thật trên Supabase. Đạt: SCRUM-15, 16, 17, 39, 41 (đã chuyển Done). Vai trò biên tập viên mới kiểm bằng test tự động, chưa test tay.
- SCRUM-40: sửa lỗi trình soạn thảo báo "Chưa lưu" và chặn rời trang ngay khi mở bài hoặc vừa tạo nháp. Backend trả node rich text theo thứ tự key khác Tiptap, so sánh `JSON.stringify` phụ thuộc thứ tự key. Thêm `docSnapshot()` trong `src/admin/RichTextEditor.tsx` (sắp key, bỏ đoạn trống cuối), dùng cho cả `PostEditor` và `PageEditor`. Test mới trong `PostEditor.test.tsx`. Branch `fix/editor-dirty-key-order`, chờ merge rồi chuyển Done.
- Góp ý nhỏ còn mở: hộp thoại Yêu cầu chỉnh sửa có dòng gợi ý đè lên bộ đếm ký tự; backend nhận xuất bản với `expiresAt` đã qua.

## Sprint 4 website công khai (12/10/2026)
- SCRUM-42 trang chủ và điều hướng: Truy cập nhanh lấy chuyên mục cấp 1 đang hiện, nút giới thiệu và footer lấy từ menu chính, bỏ slug cố định và dữ liệu mẫu `home.sample.ts`; lỗi API báo lỗi, chưa có bài hiện trạng thái rỗng. Branch `feat/public-home-nav`.
- SCRUM-43 `/categories/:slug` (SSR, phân trang trên URL, 404 khi chuyên mục ẩn) và chi tiết bài (thẻ, lượt xem ghi một lần mỗi bài, link bài cùng chuyên mục, ảnh lỗi có ô thay thế). Component dùng chung `src/components/PostList.tsx`. Branch `feat/category-post-detail`.
- SCRUM-44 `/search`: từ khóa, chuyên mục, thẻ, khoảng ngày; lọc/phân trang ở server; tiêu chí trên URL, Back/Forward giữ tiêu chí; hủy request cũ khi đổi tiêu chí. Branch `feat/public-search`.
- SCRUM-53 lưu bài: nút Lưu bài ở cuối bài (khách được mời đăng nhập rồi quay lại), chống bấm lặp; trang `/me/saved` có phân trang và bỏ lưu. Cần backend `feat/post-card-id` (thêm `id` vào `PostCardDto`). Branch `feat/bookmarks`.
- Test: `src/pages/public/public.test.tsx` (router thật với loader layout và trang), `src/pages/me/SavedPosts.test.tsx`.
- Branch xếp chồng theo thứ tự trên, merge lần lượt.

## Slider trang chủ (SCRUM-65, 20/10/2026)
- Trang `/admin/home-slides` (chỉ admin, menu Cấu trúc website > Slider trang chủ): tab Đầu trang / Cuối trang trên URL, danh sách có ảnh thu nhỏ và trạng thái (đang hiện, hẹn giờ, hết hạn, đang ẩn), bật/tắt, lên/xuống, xóa có xác nhận. Drawer tạo/sửa: chọn ảnh từ thư viện (bắt buộc alt), tiêu đề, mô tả, link an toàn, chữ nút, vị trí, hẹn giờ theo giờ Việt Nam. Tối đa 10 slide đang bật mỗi vị trí.
- Trang chủ: slider đầu trang thay phần giới thiệu khi có slide (giữ h1 ẩn cho SEO), slider cuối trang rộng 21:9 trên khối Có câu hỏi cho Khoa. `src/pages/public/HomeSlider.tsx`: CSS scroll-snap, tự chuyển 6 giây, dừng khi rê chuột/focus, nút tạm dừng, không tự chuyển khi giảm chuyển động, slide ẩn dùng `inert`.
- Thư viện media: ảnh đang làm slide hiện trong danh sách nơi đang dùng.
- Test: `src/pages/admin/HomeSlides.test.tsx`, `src/pages/public/public.test.tsx`. Cần backend branch `feat/home-slides`.

## Sự kiện cho người dùng (SCRUM-46, FR-EVT-01..03, AT-07, 17/11/2026)
- `/events` và `/en/events` (`src/pages/public/Events.tsx`): SSR, phân trang 10 mục, tab Sắp diễn ra / Đã diễn ra trên URL (`?past=1`, `?page=`), ngày giờ theo giờ Việt Nam, địa điểm, nhãn trạng thái (Còn N chỗ, Đã đủ chỗ, Hết hạn đăng ký, Ngừng nhận đăng ký, Sự kiện đã hủy). Rỗng hiện trạng thái rỗng, API lỗi hiện thông báo lỗi mà không vỡ trang.
- `/events/:id` và `/en/events/:id` (`src/pages/public/EventDetail.tsx`): SSR, 404 khi sự kiện nháp hoặc không tồn tại. Mô tả hiển thị dạng text thuần (`white-space: pre-line`). Khách thấy link "Đăng nhập để đăng ký" (`/login?next=<trang đang xem>`). Đã đăng nhập: client gọi lại chi tiết để biết trạng thái đăng ký của mình; Đăng ký / Hủy đăng ký (có xác nhận) chống bấm lặp, chỉ đổi giao diện theo response của server; lỗi `event_full`, `registration_closed`, `event_closed`, `already_registered`, `cancel_closed`, `not_registered` có thông báo riêng rồi đồng bộ lại; lỗi mạng/5xx không tự gửi lại.
- `/me/events` và `/en/me/events` (`src/pages/me/MyEvents.tsx`): danh sách lượt đăng ký (cả lượt đã hủy) có phân trang, hủy đăng ký có xác nhận khi còn hạn. Mục "Sự kiện đã đăng ký" ở `/me` đã là link.
- Logic dùng chung: `src/pages/public/events.data.ts` (type `PublicEvent`, `eventStatus`, `canRegister`, `canCancel`, `eventErrorMessage`, định dạng ngày giờ). `home.data.ts` re-export `eventStatus` cho trang chủ.
- Hạn chế: dữ liệu sự kiện chưa song ngữ (API không có tham số locale, site `/en` hiện nội dung sự kiện như site Việt); khối sự kiện trang chủ backend chưa đổ dữ liệu (`events: []`); `PostDetail` tạo link `/en/login` không tồn tại cho khách trên site Anh (cần task riêng).
- Hạn chế: `GET /api/public/events/{id}` là `AllowAnonymous`, nên khi access token đã hết hạn server vẫn trả 200 với `myRegistration: null` (không 401, `api.ts` không refresh). Người đã đăng ký có thể thấy nút Đăng ký; bấm vào thì nhận 401, `api.ts` refresh rồi gửi lại, server trả 409 `already_registered`, trang báo "Bạn đã đăng ký sự kiện này rồi" và tự đồng bộ lại.
- Hạn chế: `/me/events` chưa song ngữ, nội dung vẫn tiếng Việt trên `/en/me/events` (giống `/me/saved`).

## Kế tiếp
- Sprint 5 còn lại: form liên hệ công khai `/contact` (SCRUM-48), yêu cầu đã gửi (SCRUM-55).
- Các trang được trang chủ liên kết tới nhưng chưa có (đang trả 404): `/contact`.
- FR-AUTH-05: màn hình đổi mật khẩu (`POST /api/auth/change-password`).
- Trang tĩnh và cấu hình trang chủ (backend đã có ở `feat/pages-home`, chưa có task FE).

## Nhúng video YouTube trong bài viết (SCRUM-66, 26/10/2026)
- Thư viện media (`src/pages/admin/Media.tsx`): ô nhập video chấp nhận cả URL (`youtube.com`, `youtu.be`, `/shorts/`) lẫn mã nhúng `<iframe>`. Nhận lỗi 422 `video_url_not_allowed` từ server và hiển thị trực tiếp dưới ô nhập.
- Trình soạn thảo (`PostEditor.tsx`, `PageEditor.tsx`): hàm `videoIdOf` (trong `src/admin/media.ts`) trích xuất `videoId` từ `thumbnailUrl` hoặc `externalUrl` của media khi chèn vào bài (`onMediaAdded`), khắc phục lỗi video không hiển thị trong phần xem trước (do `videoId: null`).
- Hiển thị video (`src/components/PostArticle.tsx`): render `<figure className="rich-text__video">` với `aspect-ratio: 16 / 9`, `<iframe>` nhúng an toàn qua `https://www.youtube-nocookie.com/embed/{id}`, thuộc tính `loading="lazy"`, `referrerPolicy="strict-origin-when-cross-origin"`, `title` từ tên media phục vụ a11y, không dùng `dangerouslySetInnerHTML`. Bỏ qua không render nếu media bị xóa hoặc thiếu videoId.
- Test: `media.test.ts`, `PostArticle.test.tsx`, `PostEditor.test.tsx`, `Media.test.tsx`. Toàn bộ 172/172 tests pass trên 33 file test.

## Soạn bài song ngữ Việt - Anh (SCRUM-70, 26/10/2026)
- Mô hình kiến trúc: 2 website độc lập theo cột `locale` (`vi` | `en`), không fallback sang tiếng Việt, không dùng bảng `*_translations`, không tab song ngữ trong cùng 1 bài. Toàn bộ giao diện `/admin` giữ bằng tiếng Việt. Thẻ (`cms.tags`) dùng chung 2 website, không có bộ lọc `locale`.
- Helper `src/admin/locale.ts`: quản lý `LOCALES` (`vi` / `en`), `parseLocale`, `localeLabel`, `localeColor`, `slugify` (chuẩn SEO không dấu, gạch ngang).
- Bài viết (`Posts.tsx`, `PostEditor.tsx`):
  - Danh sách bài: Segmented lọc theo ngôn ngữ đồng bộ URL `?locale=`, nạp danh mục lọc theo locale, Tag ngôn ngữ trên từng hàng bài viết, nút "Viết bài mới" truyền kèm `?locale=`.
  - Trình soạn bài: Card "Ngôn ngữ bài viết", khóa chọn locale khi sửa bài, tự động nạp lại danh mục theo locale và xóa chọn cũ khi đổi ngôn ngữ lúc tạo mới, tiêu đề `onBlur` tự sinh slug bằng `slugify`, gửi `locale` trong POST body.
- Duyệt bài (`Review.tsx`, `ReviewDetail.tsx`): Segmented lọc theo ngôn ngữ, Tag ngôn ngữ trên từng dòng danh sách và cạnh Tag trạng thái trên trang chi tiết duyệt.
- Trang tĩnh (`StaticPages.tsx`, `PageEditor.tsx`): Segmented lọc theo ngôn ngữ, Tag ngôn ngữ, Card chọn ngôn ngữ khóa khi sửa, tự sinh slug khi blur tiêu đề, gửi `locale` khi tạo trang mới.
- Chuyên mục (`Categories.tsx`): tab Chuyên mục có Segmented lọc theo ngôn ngữ, nạp cây theo locale, thêm chuyên mục gửi kèm `locale`; tab Thẻ dùng chung không có bộ lọc ngôn ngữ.
- Menu website (`Menus.tsx`): Segmented lọc menu theo ngôn ngữ, tạo menu mới gửi kèm `locale`, Tag ngôn ngữ hiển thị trên tên menu và modal, nạp danh sách Trang và Chuyên mục đích theo locale của menu để ngăn ngừa lỗi 422 `locale_mismatch`.
- Khối trang chủ (`HomeSections.tsx`): Segmented lọc khối theo ngôn ngữ, nạp danh mục theo locale, gửi kèm `locale` khi tạo khối mới, Tag ngôn ngữ hiển thị trên từng hàng khối và Drawer.
- Slider trang chủ (`HomeSlides.tsx`): Segmented lọc slide theo ngôn ngữ kết hợp cùng bộ lọc vị trí (đầu/cuối trang), gửi kèm `locale` khi tạo slide mới, Tag ngôn ngữ trên từng hàng slide và Drawer.
- Test: Cập nhật và bổ sung test case đa ngôn ngữ cho toàn bộ các module admin (`Posts.test.tsx`, `PostEditor.test.tsx`, `Review.test.tsx`, `ReviewDetail.test.tsx`, `pagesHome.test.tsx`, `Categories.test.tsx`, `Menus.test.tsx`, `HomeSlides.test.tsx`). Toàn bộ 182/182 tests pass trên 34 file test.

## Menu nhiều cấp: chỉnh số cấp và hiển thị n cấp trên website (SCRUM-63, 26/10/2026)
- Quản trị Menu (`src/pages/admin/Menus.tsx`):
  - Form tạo/sửa menu (`MenuModal`): bổ sung ô nhập "Số cấp tối đa" (1..10, `maxDepth`, mặc định 3 khi tạo mới); gửi `maxDepth` khi POST/PUT menu.
  - Bỏ hoàn toàn hardcode `MAX_DEPTH = 3`, đọc giới hạn động từ menu đang chọn: `const maxDepth = menu?.maxDepth ?? 3`.
  - Cây kéo thả (`allowDrop`, `onDrop`) và nút Di chuyển (`step`, `can(m)`): kiểm tra trước ở client theo `maxDepth` của menu; thông báo ghi đúng số cấp cho phép (`Đã ở cấp ${maxDepth}, không thêm mục con được`, `Tối đa ${maxDepth} cấp.`).
  - Drawer thêm/sửa mục (`ItemDrawer`): nhận `maxDepth` từ menu; validator `parentId` kiểm tra `p.depth + ownHeight <= maxDepth`, báo lỗi trực quan đúng số cấp cho phép.
  - Xử lý lỗi 422 ProblemDetails `menu_depth_exceeded` khi giảm số cấp tối đa: hiển thị Alert trực quan trong modal kèm danh sách `invalidItems: [{ id, label, depth }]` cần điều chỉnh; không đóng modal để người dùng điều chỉnh.
- Giao diện người dùng công khai (`src/layouts/PublicLayout.tsx`, `layout.css`):
  - Menu nạp qua `GET /api/public/menus/main?locale={vi|en}` theo locale của trang đang xem.
  - Desktop: Dropdown n tầng (cấp 1 ngang, cấp 2 xổ xuống, cấp 3 trở đi mở sang bên cạnh `left: 100%; top: 0;`), tự động đảo hướng sang trái (`right: 100%; left: auto;`) khi chạm mép màn hình (`rect.right > window.innerWidth - 16`).
  - Điều hướng bàn phím: `Tab` để duyệt liên tục qua các mục con, `Escape` để đóng dropdown.
  - Mobile: Dạng cây thụt lề đóng/mở độc lập từng nhánh con qua nút toggle riêng biệt, hiển thị tối ưu và không tràn ngang ở màn hình 360px (`max-width: calc(100vw - 32px)`).
- Test: Cập nhật `Menus.test.tsx` (kiểm tra giới hạn động theo menu `maxDepth: 2`, `maxDepth: 4`, bắt lỗi 422 `menu_depth_exceeded`) và tạo mới `src/layouts/PublicLayout.test.tsx` (kiểm tra menu 4 cấp, query locale, phím Escape, đóng/mở nhánh mobile). Toàn bộ 189/189 tests pass trên 35 file test.

## Website song ngữ và nút chuyển ngôn ngữ (SCRUM-71, 26/10/2026)
- Kiến trúc độc lập theo tiền tố URL: Tiếng Việt (`/`) và Tiếng Anh (`/en`). Locale suy ra trực tiếp từ URL pathname, không phụ thuộc cookie để F5 hoặc chia sẻ link luôn hiển thị đúng ngôn ngữ. Mọi link nội bộ (breadcrumb, phân trang, liên kết bài viết, chuyên mục, danh mục con) bảo toàn tiền tố `/en` khi đang ở website tiếng Anh.
- Không fallback: Bài viết hoặc trang tiếng Anh không tồn tại trên `/en` trả về HTTP 404 thật; trang 404/lỗi ở `/en` hiển thị thông điệp tiếng Anh.
- Combobox chuyển ngôn ngữ (`PublicLayout.tsx`, `layout.css`):
  - Hiển thị trên thanh Header desktop và trong menu di động (`<select>` với nhãn a11y `aria-label="Chọn ngôn ngữ"` / `"Select language"`, icon quả địa cầu `Globe`).
  - Hỗ trợ thao tác hoàn toàn bằng bàn phím (Tab, mũi tên lên/xuống, Enter) và focus outline rõ ràng theo NFR-07.
  - Khi người dùng đổi ngôn ngữ, chuyển hướng trực tiếp về trang chủ của website tương ứng (`/` cho Tiếng Việt, `/en` cho Tiếng Anh).
  - Khu vực `/me` nằm trong layout công khai nên có combobox chuyển ngôn ngữ; khu vực quản trị `/admin` giữ nguyên tiếng Việt.
- Từ điển tĩnh (`src/lib/dictionary.ts`):
  - Chứa toàn bộ chuỗi giao diện dùng chung (nhãn header/footer, tìm kiếm, nút bấm, bộ lọc, phân trang, đếm bài, trạng thái rỗng/lỗi, trang 404). Không phụ thuộc thư viện i18n bên ngoài.
  - Hàm `formatDate(iso, locale, style)` định dạng ngày tháng chuẩn hóa theo `Intl.DateTimeFormat` (`vi-VN` và `en-US`).
- Định tuyến và SEO (`src/routes.ts`, `src/root.tsx`, `src/lib/seo.ts`):
  - Định tuyến React Router 8 với prefix route `en` cho toàn bộ các trang công khai (`en-home`, `en-category`, `en-post-detail`, `en-search`, `en-static-page`, `en-me`, `en-403`, `en-not-found`).
  - Thẻ `<html lang="vi">` hoặc `<html lang="en">` đọc động từ URL pathname. ErrorBoundary tự động hiển thị thông báo lỗi tiếng Anh khi gặp lỗi ở site `/en`.
  - SEO meta: sinh thẻ canonical URL đúng prefix `/en`, thẻ `og:locale` (`vi_VN` hoặc `en_US`), thẻ alternate hreflang (`vi`, `en`, `x-default`) cho trang chủ của cả hai website.
- Tích hợp và dịch toàn diện các trang công khai:
  - `Home.tsx`: Loader nạp dữ liệu trang chủ và cây danh mục kèm `?locale=`.
  - `Category.tsx`: Loader nạp danh mục và danh sách bài viết theo locale; breadcrumb và link bảo toàn tiền tố locale.
  - `PostDetail.tsx`: Loader nạp bài viết theo locale; link chuyên mục, breadcrumbs, thẻ, nút lưu bài dùng từ điển tĩnh.
  - `Search.tsx`: Form tìm kiếm lọc bài viết và chuyên mục theo locale; nhãn, placeholder, thông báo lỗi ngày tháng và empty state được bản địa hóa.
  - `StaticPage.tsx`: Loader nạp trang đơn kèm `?locale=`; hiển thị ngày cập nhật và nút về trang chủ theo ngôn ngữ.
  - `NotFound.tsx`: Trả HTTP 404 thật và hiển thị thông điệp theo locale từ URL pathname.
  - `Account.tsx`, `ChangePassword.tsx`, `SavedPosts.tsx`: Link nội bộ bảo toàn locale khi truy cập từ `/en/me`.
- Test: Cập nhật `PublicLayout.test.tsx` (kiểm tra combobox chuyển đổi `/` <-> `/en`, thao tác bàn phím, nạp menu theo locale) và tạo mới `src/pages/public/Bilingual.test.tsx` (kiểm tra `getLocaleFromPath`, `localePath`, `formatDate`, thẻ SEO hreflang & og:locale, link bài viết PostList bảo toàn `/en`, trang 404 song ngữ). Toàn bộ 197/197 tests pass trên 36 file test.

## Ghi chú
- Refresh token và logout thu hồi session đã làm ở cả backend (chưa commit trong repo backend) và frontend (`api.ts` tự refresh khi 401).
- Còn lại: sau logout, access token (JWT) vẫn qua được kiểm tra chữ ký ở backend đến khi hết hạn. Nên giảm JWT expiry trong Supabase xuống 10-15 phút (đã có refresh nên người dùng không bị đăng xuất sớm).
- `docker-compose.yml` đặt `ASPNETCORE_ENVIRONMENT=Development`: `GlobalExceptionMiddleware` sẽ trả message lỗi 500 thật. Deploy thật phải đặt `Production`.
- Deploy frontend giờ cần server Node (`npm run build && npm start`) + nginx chia `/api` sang backend.
- Ảnh bìa bài public cần URL công khai không hết hạn để dùng cho `og:image` (báo nhóm backend).
- `GET /api/auth/me` chỉ trả `userId`, `role`, `email`; sau khi F5 chưa có `fullName`. Cần backend bổ sung nếu UI hiển thị tên.

## Cập nhật lần cuối
17/11/2026 (SCRUM-46)

