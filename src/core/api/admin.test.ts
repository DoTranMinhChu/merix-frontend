/**
 * Test cho lop admin.
 *
 * Ba thu duoc kiem o day, vi ca ba deu la cho ma mot loi im lang se tru lau:
 *
 * 1. `JOB_TYPES` khop `contracts/openapi.json` (sinh tu backend) — chep tay giua nhieu noi thi hai
 *    ben lech ma test van xanh.
 * 2. `duongDanAnToan` chan open redirect.
 * 3. `jobCanhBao` doc `stats` cua job THANH CONG — phat hien ADR-026.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOB_DESCRIPTIONS, JOB_TYPES, jobCanhBao, skillLabel, type JobRun } from './admin-types';
import { duongDanAnToan, nguonGocHopLe } from './session';

const OPENAPI = join(import.meta.dirname, '../../../contracts/openapi.json');

/**
 * Các giá trị của một schema enum trong hợp đồng sinh từ backend (`contracts/openapi.json`).
 *
 * Đọc JSON đã parse thay vì tách dòng YAML: không còn chỗ nào để một gạch đầu dòng trong
 * `description` bị tính nhầm là giá trị enum. Thiếu schema thì ném lỗi chứ không trả mảng rỗng —
 * một phép đối chiếu với tập rỗng chỉ báo đỏ vì chính nó sai.
 */
function enumValues(schemaName: string): string[] {
    const doc = JSON.parse(readFileSync(OPENAPI, 'utf8'));
    const schema = doc?.components?.schemas?.[schemaName];
    if (!schema) throw new Error(`openapi.json khong co schema ${schemaName} (chay: npm run gen:contract)`);
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
        throw new Error(`schema ${schemaName} khong co enum`);
    }
    return schema.enum.map(String);
}

describe('JOB_TYPES', () => {
    it('khop hai chieu voi openapi.json', () => {
        const declared = enumValues('JobType');
        expect(declared.length).toBeGreaterThanOrEqual(10);
        // Hai chieu: thieu o ben nao cung la lech hop dong.
        expect([...JOB_TYPES].sort()).toEqual([...declared].sort());
    });

    it('moi loai job deu co mo ta', () => {
        // Mot <option> chi co ten SCREAMING_SNAKE buoc nguoi van hanh phai doan.
        for (const t of JOB_TYPES) {
            expect(JOB_DESCRIPTIONS[t], `thieu mo ta cho ${t}`).toBeTruthy();
        }
    });

    it('dung SCREAMING_SNAKE theo ADR-019', () => {
        for (const t of JOB_TYPES) expect(t).toMatch(/^[A-Z][A-Z_]*$/);
    });
});

describe('duongDanAnToan', () => {
    it('nhan duong dan noi bo', () => {
        expect(duongDanAnToan('/admin/validation')).toBe('/admin/validation');
        expect(duongDanAnToan('/admin?x=1')).toBe('/admin?x=1');
    });

    it('chan URL tuyet doi — day la open redirect', () => {
        expect(duongDanAnToan('https://site-gia/')).toBe('/admin');
        expect(duongDanAnToan('http://site-gia/')).toBe('/admin');
    });

    it('chan `//host` — dau cheo doi cung la URL tuyet doi', () => {
        // `//evil.com` trong Location header duoc trinh duyet hieu la `https://evil.com`.
        expect(duongDanAnToan('//site-gia/')).toBe('/admin');
    });

    it('chan ky tu dieu khien dung de chen header', () => {
        expect(duongDanAnToan('/admin\r\nSet-Cookie: a=b')).toBe('/admin');
        expect(duongDanAnToan('/admin\\..\\x')).toBe('/admin');
    });

    it('rong hoac null thi ve mac dinh', () => {
        expect(duongDanAnToan(null)).toBe('/admin');
        expect(duongDanAnToan('')).toBe('/admin');
    });
});

function job(over: Partial<JobRun> = {}): JobRun {
    return {
        jobRunId: 1,
        jobType: 'INGEST_PRICE',
        status: 'SUCCEEDED',
        requestedAt: '2026-10-20T09:00:00Z',
        startedAt: '2026-10-20T09:00:01Z',
        finishedAt: '2026-10-20T09:28:24Z',
        attempts: 1,
        stats: null,
        lastError: null,
        ...over,
    };
}

describe('jobCanhBao', () => {
    it('keu lên khi job THANH CONG nhung co ma loi — ADR-026', () => {
        // Dung hinh dang cua su co that: 1.754 ma, 1.433 loi, job van SUCCEEDED.
        const c = jobCanhBao(job({ stats: { symbols: 1754, failed: 1433, inserted: 321 } }));
        expect(c).toContain('1433');
    });

    it('keu lên khi moi du bao deu abstain', () => {
        // 105/105 abstain tung la mot job "thanh cong" khong ra san pham nao.
        const c = jobCanhBao(job({ jobType: 'COMPUTE_FORECAST', stats: { abstained: 105, live: 0 } }));
        expect(c).toContain('abstain');
    });

    it('im lang khi job that su on', () => {
        expect(jobCanhBao(job({ stats: { inserted: 4918306, failed: 0 } }))).toBeNull();
        expect(jobCanhBao(job({ stats: { live: 2674, abstained: 105 } }))).toBeNull();
    });

    it('khong keu them khi job da FAILED', () => {
        // Trang thai FAILED da do san; mot canh bao vang ben canh chi lam nhieu.
        expect(jobCanhBao(job({ status: 'FAILED', stats: { failed: 9 } }))).toBeNull();
    });

    it('khong co stats thi khong doan', () => {
        expect(jobCanhBao(job({ stats: null }))).toBeNull();
    });

    it('bo qua gia tri khong phai so trong stats', () => {
        // `stats` la JSON tu do; mot chuoi o cho so khong duoc thanh "NaN ma loi".
        expect(jobCanhBao(job({ stats: { failed: 'nhieu' } }))).toBeNull();
    });
});

describe('skillLabel', () => {
    it('giu dau cua skill am — do la ket luan, khong phai loi', () => {
        // `logistic` do duoc -2,67%: te hon du bao khi hau.
        expect(skillLabel(-2.67)).toBe('-2.67%');
        expect(skillLabel(0.22)).toBe('+0.22%');
    });

    it('null thi tra null, KHONG tra 0%', () => {
        // 0% nghia la "khong hon khi hau" — mot ket luan that, khac han "chua do duoc".
        expect(skillLabel(null)).toBeNull();
        expect(skillLabel(Number.NaN)).toBeNull();
    });

    it('0 van hien thanh 0%', () => {
        expect(skillLabel(0)).toBe('0.00%');
    });
});

describe('nguonGocHopLe', () => {
    const url = new URL('http://localhost:4322/admin');
    const req = (h: Record<string, string>) => new Request(url, { method: 'POST', headers: h });

    it('nhan Origin cung nguon', () => {
        expect(nguonGocHopLe(req({ origin: 'http://localhost:4322' }), url)).toBe(true);
    });

    it('tu choi Origin khac nguon', () => {
        // Do duoc truoc khi co ham nay: POST nay di qua va chay handler.
        expect(nguonGocHopLe(req({ origin: 'https://site-gia.example' }), url)).toBe(false);
    });

    it('tu choi cung host khac cong hoac khac scheme', () => {
        // `url.origin` gom ca scheme va cong, nen hai truong hop nay khac nguon.
        expect(nguonGocHopLe(req({ origin: 'http://localhost:4321' }), url)).toBe(false);
        expect(nguonGocHopLe(req({ origin: 'https://localhost:4322' }), url)).toBe(false);
    });

    it('dung Referer khi khong co Origin', () => {
        expect(nguonGocHopLe(req({ referer: 'http://localhost:4322/admin' }), url)).toBe(true);
        expect(nguonGocHopLe(req({ referer: 'https://site-gia.example/x' }), url)).toBe(false);
    });

    it('Origin co mat thi KHONG xet Referer nua', () => {
        // Neu khong, mot Origin xau kem mot Referer dep se di qua.
        expect(
            nguonGocHopLe(
                req({ origin: 'https://site-gia.example', referer: 'http://localhost:4322/admin' }),
                url,
            ),
        ).toBe(false);
    });

    it('khong co ca hai thi tu choi', () => {
        expect(nguonGocHopLe(req({}), url)).toBe(false);
    });

    it('Referer rac thi tu choi, khong nem loi', () => {
        expect(nguonGocHopLe(req({ referer: 'khong-phai-url' }), url)).toBe(false);
    });
});
