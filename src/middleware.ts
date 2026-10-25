/**
 * Header bao mat cho moi phan hoi HTML tu SSR.
 *
 * # Vi sao CSP cua trang nay khac CSP cua API
 *
 * API chi tra JSON nen no dat duoc `default-src 'none'`. Trang nay la HTML that: no tai CSS va
 * JS cua chinh no tu `/_astro/`. Nen CSP o day la `'self'` — khat khe nhat con dung duoc.
 *
 * Diem dang noi: **khong co `unsafe-inline` cho script**. Astro voi `output: 'server'` sinh ra
 * the `<script type="module" src="...">` tro vao file, khong phai script inline, nen khong can
 * noi long. Neu mot ngay nao do them mot `<script>` inline, trang se vo — va do la dieu dung:
 * no bat nguoi viet phai chon giua inline script va mot CSP con bao ve duoc.
 *
 * `style-src` co `'unsafe-inline'` vi Astro dat `style` inline cho mot so component va cho
 * `transition:` cua view transitions. Day la danh doi that, khong phai su de dai: style inline
 * khong chay duoc ma, nen rui ro cua no thap hon han script inline.
 */
import type { MiddlewareHandler } from 'astro';

/** 2 nam, kem subdomain. Khong `preload` — xem ghi chu o `security_headers.rs` cua backend. */
const HSTS = 'max-age=63072000; includeSubDomains';

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // Trinh duyet KHONG goi backend truc tiep: moi lan goi API deu qua SSR. Nen `connect-src`
    // chi can `'self'`, va dieu do cung co nghia BACKEND_URL khong bao gio lo ra client.
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
].join('; ');

export const onRequest: MiddlewareHandler = async (context, next) => {
    const res = await next();

    // Chi gan cho HTML. Tai nguyen tinh (`/_astro/*.css`, `*.js`) khong can CSP, va gan CSP cho
    // chung lam trinh duyet phai parse mot header dai o moi file.
    const loai = res.headers.get('content-type') ?? '';
    if (!loai.includes('text/html')) return res;

    res.headers.set('content-security-policy', CSP);
    res.headers.set('x-content-type-options', 'nosniff');
    res.headers.set('x-frame-options', 'DENY');
    // `strict-origin-when-cross-origin` chu khong `no-referrer` nhu API: trang nguoi dung co lien
    // ket ra ngoai, va gui origin (khong gui duong dan) la muc vua du de khong ro ma chung tra.
    res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    res.headers.set(
        'permissions-policy',
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );
    res.headers.set('strict-transport-security', HSTS);

    // Khu vuc admin khong duoc nam trong bat ky cache nao: mot proxy giu lai trang /admin la mot
    // nguoi dung khac doc duoc danh sach job va canh bao.
    if (context.url.pathname.startsWith('/admin')) {
        res.headers.set('cache-control', 'no-store, no-cache, must-revalidate, private');
    }

    return res;
};
