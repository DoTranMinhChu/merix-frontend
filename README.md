# MERIX frontend

Astro 5 (SSR) + SolidJS islands + Tailwind 4. Theo stack của
`boilerplate-astro-ddd-graphql-fe`, khác ở chỗ gọi **REST** thay vì GraphQL
([ADR-014](../docs/DECISIONS.md#adr-014)).

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
    api/types.ts     kiểu khớp shared/contracts/openapi.yaml
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

## Kiểu dữ liệu

Phase 1 viết tay trong `core/api/types.ts`. Phase 4 sẽ sinh tự động từ
`shared/contracts/openapi.yaml` kèm kiểm tra drift trong CI — giống cách boilerplate làm với
GraphQL schema.
