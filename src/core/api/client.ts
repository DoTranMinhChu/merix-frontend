/**
 * HTTP client goi main-service.
 *
 * Chi dung o phia SSR (Astro frontmatter). Trinh duyet khong bao gio goi thang backend o Phase 1
 * — nho vay BACKEND_URL khong lo ra client va khong can cau hinh CORS cho user page.
 */
import { BACKEND_URL } from 'astro:env/server';

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/** Trang thai duong truyen, tach biet voi trang thai du bao. */
export type FetchState<T> =
    | { kind: 'ok'; data: T }
    | { kind: 'error'; status: number; code: string; message: string };

export async function apiGet<T>(path: string, timeoutMs = 8000): Promise<FetchState<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = (await res.json().catch(() => null)) as
                | { code?: string; message?: string }
                | null;
            return {
                kind: 'error',
                status: res.status,
                code: body?.code ?? 'UNKNOWN',
                message: body?.message ?? `Backend tra ve ${res.status}`,
            };
        }
        return { kind: 'ok', data: (await res.json()) as T };
    } catch (e) {
        // Backend khong voi toi duoc. KHONG duoc im lang tra du lieu rong — trang phai noi ro.
        return {
            kind: 'error',
            status: 0,
            code: 'BACKEND_UNREACHABLE',
            message: e instanceof Error ? e.message : 'Khong ket noi duoc backend',
        };
    } finally {
        clearTimeout(timer);
    }
}
