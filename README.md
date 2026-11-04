# Demo flights · WebMCP cho người mới

Một website đặt vé máy bay giả lập (chỉ dùng HTML, CSS và JavaScript thuần) để học **hai cách** làm một website mà AI agent có thể dùng được, theo tài liệu gốc của WebMCP:

- **Declarative API**: thêm vài attribute (`toolname`, `tooldescription`, ...) vào `<form>` có sẵn.
- **Imperative API**: viết JavaScript gọi `document.modelContext.registerTool({ name, description, inputSchema, execute })`.

Cả hai cùng nằm trong **một app**: Search → Results (lọc, sắp xếp) → Summary. Mỗi form hoặc hành động chỉ thuộc về **một** API.

## Chạy thử

Cần Node 22+. Không cần cài gì để chạy app.

```powershell
npm start            # app đặt vé: http://127.0.0.1:4173
npm run start:host   # trang iframe host: http://127.0.0.1:4174 (chạy ở terminal thứ hai, xem phần Permissions Policy)
npm install          # chỉ cần nếu muốn định dạng code với Prettier
npm run format       # định dạng code
npm run format:check # kiểm tra định dạng
```

Hai server chỉ lắng nghe trên `127.0.0.1` (loopback). Muốn đổi cổng app thì đặt biến môi trường `PORT` (PowerShell: `$env:PORT = 4180; npm start`) và sửa `src` của iframe trong `host/index.html` và `host/no-allow.html`.

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
7. `server.js`: server tĩnh rất nhỏ, dùng cho cả `npm start` (thư mục `public/`) và `npm run start:host` (thư mục `host/`).
8. `host/index.html`, `host/no-allow.html`: hai trang HTML tĩnh nhúng app bằng iframe (xem phần Permissions Policy bên dưới).

## Ý chính cần nhớ

- Người dùng bấm nút và agent gọi tool đều chạy **cùng một hàm**, nên kết quả hiển thị trên trang giống nhau.
- Trạng thái (route, bộ lọc, sắp xếp, chuyến bay đã chọn) nằm trong URL, ví dụ `/results.html?from=SFO&to=JFK&date=2026-12-01&max_price=150`. Tải lại trang, nút Back hay chia sẻ link đều giữ nguyên trạng thái.
- Với form declarative, khi agent gọi tool, trình duyệt điền giá trị vào form rồi submit (`toolautosubmit`). Handler gọi `event.respondWith(Promise)` để trả kết quả. Lỗi cũng được trả bằng `Promise.resolve({ error })`; nếu reject thì agent chỉ nhận được "Tool execution failed".
- Với tool imperative, lỗi cũng được trả về dạng `{ error }` thay vì `throw`, vì lý do tương tự.
- Các ràng buộc native của form (`required`, `min`, option của `<select>`) được trình duyệt dùng để tạo schema và kiểm tra; giá trị agent gửi sai schema bị trình duyệt từ chối trước khi vào code của trang.

## Thử Permissions Policy với iframe (`allow="tools"`)

Hai server chạy riêng, ở hai terminal:

```powershell
# Terminal 1: app (trang con)
npm start

# Terminal 2: trang host (trang cha) nhúng app bằng iframe
npm run start:host
```

| Trang                               | Vai trò                     | Nội dung                               |
| ----------------------------------- | --------------------------- | -------------------------------------- |
| http://127.0.0.1:4173/              | app, đứng riêng (top-level) | Trường hợp gốc, không có iframe        |
| http://127.0.0.1:4174/              | cha                         | Nhúng app **có** `allow="tools"`       |
| http://127.0.0.1:4174/no-allow.html | cha                         | Nhúng đúng app đó **không có** `allow` |

### Origin là gì và vì sao hai cổng đủ để thành cross-origin

Origin = scheme + host + port. `http://127.0.0.1:4173` và `http://127.0.0.1:4174` cùng scheme (`http`) và host (`127.0.0.1`) nhưng khác port, nên là **hai origin khác nhau**. Vì vậy iframe trong trang host là cross-origin. Cả hai trang đều dùng `127.0.0.1` (không trộn với `localhost`) để chỉ có port tạo ra sự khác biệt.

### Quy tắc

Cả Declarative API và Imperative API đều bị chặn bởi Permissions Policy `tools`. Mặc định của `tools` là `self`: được dùng ở top-level và trong iframe cùng origin; **iframe cross-origin bị tắt** trừ khi trang cha ủy quyền:

```html
<iframe src="http://127.0.0.1:4173/" allow="tools"></iframe>
```

So sánh: cùng app, cùng iframe, nhưng không ủy quyền:

```html
<iframe src="http://127.0.0.1:4173/"></iframe>
```

Mỗi trang host là một trang HTML riêng, nên đổi giữa hai trường hợp sẽ tải lại iframe từ đầu. Đừng đổi `allow` bằng JavaScript trên iframe đã tải xong và mong policy của document đang chạy đổi theo: policy được tính khi document trong iframe được tạo.

Header của trang cha cũng có thể chặn: nếu trang cha trả `Permissions-Policy: tools=(self)` thì `allow="tools"` không còn tác dụng. Server trong repo này không gửi header đó, nên đây chỉ là quy tắc để biết (xem kết quả đo bên dưới).

### Cách kiểm tra (cần Chrome có bật WebMCP)

Chạy Chrome với `--enable-features=WebMCP` (hoặc bật WebMCP theo tài liệu Chrome), mở DevTools và **chọn đúng frame**:

1. Mở http://127.0.0.1:4174/ và bấm F12.
2. Trong tab Console, mở ô chọn execution context (mặc định ghi `top`) và chọn frame **con**, có địa chỉ `127.0.0.1:4173`. Nếu để `top`, bạn đang chạy code trong trang **cha**, không phải trong app.
3. Chạy:

```js
({ origin: location.origin, allowsTools: document.featurePolicy.allowsFeature('tools') });
await document.modelContext.getTools();
```

Có `allow="tools"`: `origin` là `http://127.0.0.1:4173`, `allowsTools` là `true`, và `getTools()` trả về các tool native (`search_flights` ở trang tìm kiếm). Gọi thử một tool:

```js
const tools = await document.modelContext.getTools();
await document.modelContext.executeTool(
  tools.find((tool) => tool.name === 'search_flights'),
  {
    from: 'SFO',
    to: 'JFK',
    date: '2026-12-01',
  },
);
```

Trang con tự chuyển sang results; trang cha vẫn ở `http://127.0.0.1:4174/`. Làm lại bước 2 và 3 ở trang results: bạn thấy `filter_flights`, `sort_flights` (declarative) và `get_flight_results`, `select_flight`, `clear_filters`, `edit_search` (imperative). Thử `get_flight_results`, rồi `select_flight` với một `flight_id` lấy từ kết quả (ví dụ `DM101`).

Không có `allow` (`/no-allow.html`): `allowsTools` là `false`, `getTools()` và `registerTool()` bị reject với `NotAllowedError: Access to the feature "tools" is disallowed by permissions policy.` Đây là kết quả mong đợi. Trang con vẫn dùng bình thường bằng chuột: tìm chuyến bay, lọc, sắp xếp, chọn chuyến bay. Console của frame con có dòng cảnh báo `Could not register the WebMCP tools: NotAllowedError ...` từ `public/js/imperative-tools.js` (đã được `try/catch`, không phải lỗi chưa xử lý).

Thấy iframe hiển thị hay bấm chuột được **không chứng minh** gì về WebMCP. Bằng chứng là `allowsTools`, danh sách tool và kết quả `executeTool` trong **frame con**.

### Kết quả đã đo

Đo bằng Chrome for Testing 158.0.8127.2 với `--enable-features=WebMCP`, điều khiển qua DevTools Protocol trong từng frame:

| Trường hợp                                                   | `allowsTools` (frame con) | Tool native trong frame con                                                          | Kết quả gọi                                                                                  |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| App mở trực tiếp (top-level)                                 | `true`                    | `search_flights`                                                                     | không đổi so với trước                                                                       |
| iframe cross-origin, **có** `allow="tools"`                  | `true`                    | search: `search_flights`; results: 6 tool; summary: `back_to_results`, `edit_search` | `search_flights` tìm được 6 chuyến; `get_flight_results` và `select_flight` chạy, summary mở |
| iframe cross-origin, **không có** `allow`                    | `false`                   | không có (`getTools()` reject `NotAllowedError`)                                     | `registerTool()` reject `NotAllowedError`; UI thường vẫn chạy                                |
| Cha gửi `Permissions-Policy: tools=(self)` + `allow="tools"` | `false`                   | không có                                                                             | `registerTool()` reject `NotAllowedError` (đo bằng server tạm, không nằm trong repo)         |

Trong cả hai trường hợp iframe, `document.modelContext` vẫn tồn tại ở frame con, và trang cha vẫn ở `http://127.0.0.1:4174/...` khi frame con chuyển trang. Chrome không in cảnh báo declarative nào trong các lần đo này.

### `allow="tools"` không có nghĩa là trang cha điều khiển được trang con

`allow="tools"` chỉ cho phép **frame con tự dùng/đăng ký** WebMCP. Nó **không**:

- cho JavaScript của trang cha đọc DOM của trang con (same-origin policy vẫn áp dụng);
- đảm bảo `document.modelContext.getTools()` ở trang cha liệt kê tool của trang con. Trong lần đo ở trên, `getTools()` ở **trang cha** trả về `[]` dù con đã đăng ký tool. Kết quả rỗng đó không có nghĩa là con bị chặn; hãy chạy lệnh ở frame con;
- thay thế các cơ chế khác. Draft của W3C có hai bước opt-in riêng cho truy cập cross-origin trong cùng trang: tool phải khai báo `exposedTo` khi đăng ký và bên gọi phải truyền `fromOrigins` cho `getTools()`. Việc browser agent (AI của trình duyệt) quan sát tool là một cơ chế riêng, do trình duyệt quyết định. Demo này **không** dùng `exposedTo`, `fromOrigins`, `postMessage`, CORS hay `--disable-web-security`.

Giới hạn: WebMCP vẫn đang thử nghiệm. Chrome docs nói origin trial bắt đầu từ Chrome 149 và có flag `chrome://flags/#enable-webmcp-testing` để phát triển local; W3C draft là bản của Community Group và có thể thay đổi. Kết quả trên chỉ đo ở Chrome 158.0.8127.2; phiên bản khác có thể khác. Nếu trình duyệt không có WebMCP, cả hai trang vẫn hiển thị và dùng được bình thường, chỉ không có tool nào.

## Tài liệu gốc

- [WebMCP Declarative API (Chrome)](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [WebMCP Imperative API (Chrome)](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP: Permissions Policy (Chrome)](https://developer.chrome.com/docs/ai/webmcp#permissions-policy)
- [WebMCP draft của W3C Web Machine Learning Community Group](https://webmachinelearning.github.io/webmcp/)
- [Permissions Policy integration trong draft](https://webmachinelearning.github.io/webmcp/#permissions-policy-integration)

Lưu ý: bản W3C là **draft** của Community Group và vẫn đang thay đổi, không phải W3C Standard. Chrome triển khai WebMCP dưới dạng thử nghiệm, nên code này nhắm vào cách Chrome hiện tại hoạt động và có thể cần cập nhật khi API thay đổi. Chrome chỉ dùng `document.modelContext` (không dùng `navigator.modelContext` hay polyfill).
