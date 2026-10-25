# MERIX — Brand kit v.01

Ngày: 2026-10-21. Mở `preview.html` để xem bộ nhận diện trong trình duyệt.

## File nên dùng

| Nhu cầu | File |
| --- | --- |
| Logo trên nền tối | `merix-logo-on-dark.svg` |
| Logo trên nền sáng | `merix-logo-on-light.svg` |
| Logo đơn sắc trắng | `merix-logo-on-white.svg` (màu logo là trắng; đặt trên nền tối) |
| Logo đơn sắc đen | `merix-logo-on-black.svg` (màu logo là đen; đặt trên nền sáng) |
| Chỉ phần chữ MERIX | `merix-wordmark-on-*.svg` |
| Biểu tượng không nền | `merix-mark-mint.svg`, `merix-mark-dark.svg`, `merix-mark-white.svg`, `merix-mark-black.svg` |
| Avatar / app icon | `icon-512.png`, `icon-1024.png` |
| App icon nền sáng | `icon-light-512.png` |
| App icon 192 px | `icon-192.png` |
| Icon có vùng an toàn cho mask | `icon-maskable-512.png` |
| Apple touch icon | `apple-touch-icon.png` (180 × 180, nền đặc, để hệ điều hành cắt góc) |
| Favicon | `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png` |
| Ảnh chia sẻ Open Graph | `merix-social.png` (1200 × 630) |
| Nguồn ảnh chia sẻ chỉnh sửa được | `merix-social.svg` |
| Bảng màu | `palette.json` |
| Cấu hình HTML tham khảo | `metadata.example.html` |
| Cấu hình ứng dụng tham khảo | `manifest.example.webmanifest` |

Logo ngang có thêm PNG nền trong suốt ở 1376 × 384 px. Biểu tượng rời có PNG nền trong suốt ở 840 × 800 px. SVG logo và wordmark là đường vector hoàn toàn, không phụ thuộc font hoặc ảnh bên ngoài. SVG ảnh chia sẻ sử dụng Segoe UI/Arial cho nội dung; PNG đi kèm đã chốt cách hiển thị.

## Hướng thiết kế

Ba nét nghiêng song song lấy từ dấu hiệu MERIX trong bản mẫu dashboard: nhịp dữ liệu và chữ M trừu tượng. Wordmark được vẽ riêng bằng path hình học. Không dùng ký hiệu đăng ký nhãn hiệu.

- Nền tối: mint `#69E6BE`, chữ `#EDF1F6`, nền `#0D1117`.
- Nền sáng: biểu tượng `#087B61`, chữ `#182E37`.
- Logo ngang: nên dùng từ 120 px chiều rộng; nhỏ hơn nên dùng biểu tượng riêng.
- Khoảng trống ngoài vùng artwork: tối thiểu bằng độ rộng một nét biểu tượng.
- Giữ tỷ lệ; không thêm viền, hiệu ứng nổi hoặc thay đổi độ nghiêng.
- Favicon dùng hình rút gọn; không ép toàn bộ chữ MERIX vào icon 16 px.

## Gắn vào website và nhận diện tìm kiếm

Các file đang ở `frontend/public/brand/`, nên khi Astro phục vụ website chúng có URL `/brand/...`.

Dán các thẻ phù hợp trong `metadata.example.html` vào `<head>` của layout, thay `https://example.com` bằng domain thật. Các tiêu đề, mô tả và `og:url` cần phù hợp từng trang. Bộ kit chỉ chuẩn bị tài nguyên và mẫu cấu hình; chưa tự thêm vào layout ứng dụng hoặc khai báo domain.

Google có thể sử dụng favicon của trang chủ trong kết quả tìm kiếm; URL cần truy cập được và duy trì ổn định. Icon SVG và PNG vuông được cung cấp sẵn. Hiển thị favicon trong kết quả tìm kiếm không được đảm bảo.

Nguồn: https://developers.google.com/search/docs/appearance/favicon-in-search

Open Graph dùng tiêu đề, loại trang, URL trang và URL ảnh để mô tả nội dung khi chia sẻ. Dùng PNG 1200 × 630 đi kèm cho `og:image`, với URL tuyệt đối trên domain đã triển khai.

Nguồn: https://ogp.me/

Nếu sau này khai báo dữ liệu có cấu trúc Organization, chỉ dùng khi MERIX thực sự đại diện cho tổ chức tương ứng. Có thể tham chiếu icon PNG 512 px làm logo; các thuộc tính tổ chức khác phải là thông tin thật.

Nguồn: https://developers.google.com/search/docs/appearance/structured-data/organization

## Tái xuất từ repo

Tại thư mục gốc:

```powershell
node docs/design/merix-brand/generate.mjs
node docs/design/merix-brand/render.mjs
```

Script render dùng Chrome/Edge headless qua helper CDP có sẵn, không tải thêm thư viện. SVG là nguồn vector; PNG và ICO là bản xuất. Bộ kit có thể được dùng độc lập với backend và database.
