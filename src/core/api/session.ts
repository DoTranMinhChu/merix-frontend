/**
 * Phien dang nhap admin, giu trong cookie `HttpOnly`.
 *
 * # Vi sao khong dung localStorage
 *
 * Token trong `localStorage` doc duoc bang JavaScript, nen mot lo hong XSS o bat ky dau trong
 * trang admin deu doi duoc thanh mot access token bi danh cap. Cookie `HttpOnly` thi trinh duyet
 * khong cho JS doc — SSR doc duoc, trang khong.
 *
 * # `SameSite=Strict` thay cho CSRF token
 *
 * Trang admin dung form POST that (khong fetch), nen neu khong lam gi thi no bi CSRF: mot trang
 * khac co the submit form sang `/admin` va trinh duyet se kem cookie theo. `SameSite=Strict` chan
 * dung dieu do — cookie khong duoc gui kem cho request khoi phat tu site khac, ke ca dieu huong
 * top-level. Doi lai: vao `/admin` tu mot link ngoai se thay trang dang nhap o lan dau. Voi khu
 * vuc admin, do la danh doi dung chieu.
 */
import type { AstroCookies } from 'astro';
import { REFRESH_COOKIE, TOKEN_COOKIE } from './admin-types';

/** Cookie chi gui qua HTTPS khi dang chay that. Local HTTP thi khong the bat `secure`. */
function cookieOpts(url: URL, maxAge: number) {
    return {
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'strict' as const,
        path: '/',
        maxAge,
    };
}

export function luuPhien(
    cookies: AstroCookies,
    url: URL,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
): void {
    // Tru 30 giay: cookie nen het han truoc token, de khong bao gio gui mot token da chet.
    const maxAge = Math.max(60, tokens.expiresIn - 30);
    cookies.set(TOKEN_COOKIE, tokens.accessToken, cookieOpts(url, maxAge));
    // Refresh token song lau hon; o day chi can du cho mot phien lam viec.
    cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOpts(url, 7 * 24 * 3600));
}

export function xoaPhien(cookies: AstroCookies): void {
    cookies.delete(TOKEN_COOKIE, { path: '/' });
    cookies.delete(REFRESH_COOKIE, { path: '/' });
}

/** Token hien tai, hoac `null`. */
export function layToken(cookies: AstroCookies): string | null {
    return cookies.get(TOKEN_COOKIE)?.value ?? null;
}

/**
 * Duong dan de quay lai sau khi dang nhap.
 *
 * Chi nhan duong dan **noi bo**: nhan URL tuyet doi o day la mot open redirect — ke tan cong gui
 * `?next=https://site-gia/` roi doi nguoi dung dang nhap xong bi day sang trang gia.
 */
export function duongDanAnToan(raw: string | null, macDinh = '/admin'): string {
    if (!raw) return macDinh;
    // Phai bat dau bang mot dau `/` va khong duoc bat dau bang `//` (`//host` la URL tuyet doi).
    if (!raw.startsWith('/') || raw.startsWith('//')) return macDinh;
    // Dấu `\` bị một số trình duyệt chuẩn hoá thành `/`, nên `/\evil.com` có thể thành `//evil.com`.
    // `\r`/`\n` là vật liệu để chèn header vào `Location`.
    if (/[\\\r\n]/.test(raw)) return macDinh;
    return raw;
}

/** URL dang nhap mang theo duong dan hien tai, de quay lai dung cho sau khi dang nhap. */
export function duongLogin(url: URL): string {
    const next = `${url.pathname}${url.search}`;
    return `/admin/login?next=${encodeURIComponent(duongDanAnToan(next))}`;
}

/**
 * Kiem nguon goc cua mot request ghi.
 *
 * # Vi sao tu viet thay vi tin `security.checkOrigin` cua Astro
 *
 * Do duoc tren dev server: `POST /admin` voi `Origin: https://site-gia.example` di qua va chay
 * handler. Hai request CSRF trong lan thu dau khong tao job that — nhung do la nho khoa chan
 * trung gom ca phut hien tai, khong phai nho mot lop phong thu nao.
 *
 * Cookie `SameSite=Strict` moi la lop chinh: trinh duyet that khong gui cookie kem mot form POST
 * khoi phat tu site khac, nen request se khong co phien va bi day ve trang dang nhap. Ham nay la
 * lop thu hai, va no o day vi no **test duoc** — khac voi mot mac dinh cua framework.
 *
 * Thieu ca `Origin` va `Referer` thi tu choi: moi trinh duyet deu gui `Origin` cho form POST khac
 * nguon, va cho cung nguon thi no cung gui. Mot request ghi khong co ca hai la mot cong cu dong
 * lenh, khong phai mot trang.
 */
export function nguonGocHopLe(request: Request, url: URL): boolean {
    const origin = request.headers.get('origin');
    if (origin !== null) return origin === url.origin;

    // Vai trinh duyet cu khong gui `Origin` cho same-origin POST; `Referer` thay the duoc.
    const referer = request.headers.get('referer');
    if (referer === null) return false;
    try {
        return new URL(referer).origin === url.origin;
    } catch {
        return false;
    }
}

/** 403 cho mot request ghi khac nguon. Khong tiet lo gi them. */
export function tuChoiKhacNguon(): Response {
    return new Response('Request bi tu choi: nguon goc khong khop.', {
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}
