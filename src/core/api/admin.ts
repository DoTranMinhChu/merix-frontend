/**
 * Client goi cac endpoint admin.
 *
 * # Token khong bao gio di vao JavaScript cua trinh duyet
 *
 * Access token nam trong cookie `HttpOnly`, va **chi SSR doc duoc no**. Trinh duyet khong co
 * cach nao lay token ra, nen mot lo hong XSS o trang admin khong doi duoc thanh mot token bi
 * danh cap.
 *
 * Doi lai: moi lan goi API deu di qua SSR. Voi trang admin — vai nguoi dung, vai chuc request
 * moi phien — do la danh doi dung chieu.
 *
 * Kieu va logic thuan nam o `admin-types.ts`, va duoc re-export tu day de cho goi chi phai
 * import mot cho.
 */
import { BACKEND_URL } from 'astro:env/server';
import type { FetchState } from './client';
import type { TokenPair } from './admin-types';

export * from './admin-types';

/** GET co token. */
export async function adminGet<T>(
    path: string,
    token: string,
    timeoutMs = 8000,
): Promise<FetchState<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
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

/** POST co token. */
export async function adminPost<T>(
    path: string,
    token: string,
    body: unknown,
    timeoutMs = 15000,
): Promise<FetchState<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BACKEND_URL}${path}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const parsed = (await res.json().catch(() => null)) as
            | ({ code?: string; message?: string } & Record<string, unknown>)
            | null;
        if (!res.ok) {
            return {
                kind: 'error',
                status: res.status,
                code: parsed?.code ?? 'UNKNOWN',
                message: parsed?.message ?? `Backend tra ve ${res.status}`,
            };
        }
        return { kind: 'ok', data: parsed as T };
    } catch (e) {
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

/** Dang nhap. Tra ve cap token, hoac loi. */
export async function login(
    email: string,
    password: string,
): Promise<FetchState<TokenPair>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal: controller.signal,
        });
        if (!res.ok) {
            // Backend tra cung mot ma cho moi nhanh that bai (email sai, mat khau sai, bi khoa).
            // Khong doan them o day: doan se lam ro thong tin ma backend co y khong noi.
            return {
                kind: 'error',
                status: res.status,
                code: 'LOGIN_FAILED',
                message: 'Email hoac mat khau khong dung.',
            };
        }
        return { kind: 'ok', data: (await res.json()) as TokenPair };
    } catch (e) {
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

