/**
 * `POST /admin/logout` — xoa cookie phien.
 *
 * Chi nhan POST. Dang xuat bang GET nghia la mot the `<img src="/admin/logout">` o bat ky trang
 * nao cung day duoc nguoi dung ra khoi phien.
 */
import type { APIRoute } from 'astro';
import { nguonGocHopLe, tuChoiKhacNguon, xoaPhien } from '@core/api/session';

export const POST: APIRoute = ({ cookies, redirect, request, url }) => {
    // Đăng xuất cưỡng bức từ site khác không gây mất dữ liệu, nhưng nó là một cách làm người
    // vận hành mất phiên giữa lúc đang xử lý sự cố. Không có lý do gì để cho phép.
    if (!nguonGocHopLe(request, url)) return tuChoiKhacNguon();

    xoaPhien(cookies);
    return redirect('/admin/login', 303);
};

export const GET: APIRoute = () =>
    new Response('Dang xuat phai dung POST.', {
        status: 405,
        headers: { Allow: 'POST' },
    });
