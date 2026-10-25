# MERIX frontend

Astro 5 (SSR) + SolidJS islands + Tailwind 4. Theo stack của
`boilerplate-astro-ddd-graphql-fe`, khác ở chỗ gọi **REST** thay vì GraphQL
([ADR-014](../docs/DECISIONS.md#adr-014)).

## Repo này nằm ở đâu

Repo `merix-frontend` (https://github.com/DoTranMinhChu/merix-frontend) là repo độc lập, commit và
deploy riêng. Backend ở repo `merix-backend` (https://github.com/DoTranMinhChu/merix-backend). Hai
repo chỉ gặp nhau ở **hợp đồng API**, xem mục "Hợp đồng API" bên dưới. Các liên kết `../docs/...`
chỉ đúng khi thư mục `docs/` nằm cạnh repo trên máy local.

## Chạy

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:4321
```

```bash
npm run build      # astro check + astro build
npm run check      # chỉ type-check
npm run lint       # oxlint
```

## Vì sao SSR cho user page, SPA cho admin

**User page** công khai, cần SEO, phải xem được nhanh → SSR từng request, không cần JS để đọc
được xác suất.

**Admin** nhiều màn hình có trạng thái, điều hướng qua lại liên tục → một island, Solid router
lo phần còn lại sau lần tải đầu. (Phase 5.)

## Cấu trúc

```
src/
  core/
    api/client.ts    gọi main-service (chỉ phía SSR)
    api/types.ts     kiểu khớp contracts/openapi.json
    styles/
  layouts/
    PublicLayout.astro
  pages/
    index.astro      SSR
    healthz.ts       liveness của chính frontend
  modules/
    forecast/        (Phase 4)
```

`BACKEND_URL` chỉ tồn tại phía server. Trình duyệt **không** gọi thẳng backend ở Phase 1 — nhờ
vậy không lộ URL nội bộ và user page không cần cấu hình CORS.

## Ba quy tắc giao diện không thương lượng

1. **Disclaimer trên mọi trang.** Trang có dự báo phải lấy từ trường `disclaimer` trong payload
   API, không hardcode — để ràng buộc được bảo đảm bởi dữ liệu chứ không bởi trí nhớ.
2. **`validationStatus` khác `VALIDATED_PROSPECTIVE` ⇒ cảnh báo nằm cạnh con số**, không phải ở
   chân trang. Hàm `requiresWarning()` trong `core/api/types.ts` khớp với
   `ValidationStatus::requires_warning` phía Rust.
3. **`predictionStatus = UNAVAILABLE` hiển thị là "chưa đủ dữ liệu" kèm lý do — KHÔNG vẽ thanh
   50%.** Không có đường nào để một ô trống trở thành một con số.

## Hợp đồng API

Hợp đồng là **`/openapi.json` do backend sinh từ code** (utoipa) — không còn file YAML viết tay.
Bản đã lấy về nằm ở `contracts/openapi.json` và **được commit**: test đọc nó, nên CI chạy được mà
không cần dựng backend (Rust + Postgres).

```bash
npm run gen:contract     # lấy /openapi.json từ backend đang chạy, ghi contracts/openapi.json
npm run check:contract   # không ghi; mã thoát 1 nếu bản đã commit lệch backend đang chạy
```

Backend mặc định ở `http://localhost:8080`; đổi bằng biến `BACKEND_URL`. Quy trình khi backend đổi
API: chạy backend, `npm run gen:contract`, xem diff, sửa kiểu trong `core/api/*.ts` cho khớp, chạy
`npm test`, commit cả file JSON lẫn kiểu. `check:contract` là phép kiểm lệch thật, chạy tay hoặc
trong môi trường có backend — không nằm trong CI mặc định.

## Kiểu dữ liệu

Viết tay trong `core/api/types.ts` và `admin-types.ts`; các test `*.test.ts` đối chiếu enum với
`contracts/openapi.json` nên hai bên không thể lệch nhau mà vẫn xanh.
