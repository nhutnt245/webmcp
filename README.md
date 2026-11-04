# Demo flights · WebMCP cho người mới

Một website đặt vé máy bay giả lập (chỉ dùng HTML, CSS và JavaScript thuần) để học **hai cách** làm một website mà AI agent có thể dùng được, theo tài liệu gốc của WebMCP:

- **Declarative API**: thêm vài attribute (`toolname`, `tooldescription`, ...) vào `<form>` có sẵn.
- **Imperative API**: viết JavaScript gọi `document.modelContext.registerTool({ name, description, inputSchema, execute })`.

Cả hai cùng nằm trong **một app**: Search → Results (lọc, sắp xếp) → Summary. Mỗi form hoặc hành động chỉ thuộc về **một** API.

## Chạy thử

Cần Node 22+. Không cần cài gì để chạy app.

```bash
npm start            # mở http://127.0.0.1:4173 (đổi cổng bằng PORT=...)
npm install          # chỉ cần nếu muốn định dạng code với Prettier
npm run format       # định dạng code
npm run format:check # kiểm tra định dạng
```

Trong VS Code, cài extension Prettier (đã được gợi ý trong `.vscode/extensions.json`), code sẽ tự định dạng khi lưu.

Để thấy các tool WebMCP thật, dùng bản Chrome có bật WebMCP (ví dụ chạy Chrome với `--enable-features=WebMCP`) rồi gọi trong DevTools console:

```js
await document.modelContext.getTools();
```

Nếu trình duyệt không có `document.modelContext`, trang vẫn hoạt động như một website bình thường.

## Ai sở hữu cái gì

| Form / hành động                  | API         | Tool                 | Nơi xem                                     |
| --------------------------------- | ----------- | -------------------- | ------------------------------------------- |
| Form tìm chuyến bay               | Declarative | `search_flights`     | `public/index.html`, `js/search-page.js`    |
| Form lọc chuyến bay               | Declarative | `filter_flights`     | `public/results.html`, `js/results-page.js` |
| Form sắp xếp                      | Declarative | `sort_flights`       | `public/results.html`, `js/results-page.js` |
| Đọc danh sách chuyến bay hiện tại | Imperative  | `get_flight_results` | `js/imperative-tools.js`                    |
| Nút "Select flight"               | Imperative  | `select_flight`      | `js/imperative-tools.js`                    |
| Nút "Clear filters"               | Imperative  | `clear_filters`      | `js/imperative-tools.js`                    |
| Link "Edit search"                | Imperative  | `edit_search`        | `js/imperative-tools.js`                    |
| Link "Back to results" (summary)  | Imperative  | `back_to_results`    | `js/imperative-tools.js`                    |

Tên tool là duy nhất trong mỗi trang (mỗi trang là một document riêng), nên `edit_search` được đăng ký ở cả trang results và summary mà không bị trùng.

## Thứ tự đọc code

1. `public/index.html`: form tìm kiếm với các attribute declarative, có chú thích giải thích.
2. `public/js/search-page.js`: xử lý `submit` của form: `preventDefault`, `agentInvoked`, `respondWith`.
3. `public/results.html` + `public/js/results-page.js`: hai form declarative nữa (lọc, sắp xếp) và các hàm hành động dùng chung cho người và agent.
4. `public/js/imperative-tools.js`: các tool imperative viết đầy đủ `name`, `description`, `inputSchema`, `execute`.
5. `public/summary.html` + `public/js/summary-page.js`: trang tóm tắt.
6. Các file hỗ trợ nhỏ:
   - `js/flights.js`: dữ liệu chuyến bay giả lập và kiểm tra dữ liệu tìm kiếm
   - `js/flight-list.js`: lọc và sắp xếp
   - `js/page-url.js`: lưu trạng thái trong URL (không dùng storage)
   - `js/flight-card.js`: vẽ một thẻ chuyến bay
   - `js/messages.js`: dòng thông báo
7. `server.js`: server tĩnh rất nhỏ cho `npm start`.

## Ý chính cần nhớ

- Người dùng bấm nút và agent gọi tool đều chạy **cùng một hàm**, nên kết quả hiển thị trên trang giống nhau.
- Trạng thái (route, bộ lọc, sắp xếp, chuyến bay đã chọn) nằm trong URL, ví dụ `/results.html?from=SFO&to=JFK&date=2026-12-01&max_price=150`. Tải lại trang, nút Back hay chia sẻ link đều giữ nguyên trạng thái.
- Với form declarative, khi agent gọi tool, trình duyệt điền giá trị vào form rồi submit (`toolautosubmit`). Handler gọi `event.respondWith(Promise)` để trả kết quả. Lỗi cũng được trả bằng `Promise.resolve({ error })`; nếu reject thì agent chỉ nhận được "Tool execution failed".
- Với tool imperative, lỗi cũng được trả về dạng `{ error }` thay vì `throw`, vì lý do tương tự.
- Các ràng buộc native của form (`required`, `min`, option của `<select>`) được trình duyệt dùng để tạo schema và kiểm tra; giá trị agent gửi sai schema bị trình duyệt từ chối trước khi vào code của trang.

## Tài liệu gốc

- [WebMCP Declarative API (Chrome)](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [WebMCP Imperative API (Chrome)](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP draft của W3C Web Machine Learning Community Group](https://webmachinelearning.github.io/webmcp/)

Lưu ý: bản W3C là **draft** của Community Group và vẫn đang thay đổi, không phải W3C Standard. Chrome triển khai WebMCP dưới dạng thử nghiệm, nên code này nhắm vào cách Chrome hiện tại hoạt động và có thể cần cập nhật khi API thay đổi. Chrome chỉ dùng `document.modelContext` (không dùng `navigator.modelContext` hay polyfill).
