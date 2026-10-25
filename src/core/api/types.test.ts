/**
 * Test cac rang buoc nghiep vu o phia frontend, va doi chieu kieu voi hop dong OpenAPI sinh tu backend.
 *
 * # Vi sao frontend can test rieng cho nhung dieu nay
 *
 * Backend da bao dam `probabilityNotUp = 1 - probabilityUp` va `null` khi abstain. Nhung cach
 * **hien thi** chung lai la quyet dinh cua frontend, va do la cho rang buoc de bi pha nhat:
 * mot `?? 0` hay `|| 50` vo tinh se bien "khong biet" thanh mot con so.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    ABSTAIN_LABELS,
    LEVEL_LABELS,
    STALE_LAG_DAYS,
    VALIDATION_LABELS,
    formatProbability,
    horizonLabel,
    requiresWarning,
    type ValidationStatus,
} from './types';
import {
    TARGET_ABSOLUTE,
    TARGET_LABELS,
    TARGET_RELATIVE_MARKET,
    TARGET_RELATIVE_SECTOR,
} from './target';

const openapi = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../contracts/openapi.json', import.meta.url)), 'utf8'),
);

/**
 * Các giá trị của một schema enum trong hợp đồng sinh từ backend (`contracts/openapi.json`).
 *
 * Thiếu schema hoặc enum rỗng thì ném lỗi chứ không trả mảng rỗng: một phép đối chiếu với tập
 * rỗng không còn là đối chiếu — nó chỉ báo đỏ vì chính nó sai.
 */
function enumValues(name: string): string[] {
    const schema = openapi?.components?.schemas?.[name];
    if (!schema) throw new Error(`openapi.json khong co schema ${name} (chay: npm run gen:contract)`);
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
        throw new Error(`schema ${name} co enum rong`);
    }
    return schema.enum.map(String);
}

describe('formatProbability', () => {
    it('null KHONG duoc hien thanh 0% hay 50%', () => {
        // Day la rang buoc trung tam: 50% la mot du bao CO NOI DUNG (can bang that), khac han
        // "khong biet". Tra null de cho goi phai tu quyet dinh cach noi.
        expect(formatProbability(null)).toBeNull();
    });

    it('gia tri khong huu han cung tra null', () => {
        expect(formatProbability(Number.NaN)).toBeNull();
        expect(formatProbability(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('lam tron mot chu so thap phan', () => {
        expect(formatProbability(0.5219954695)).toBe('52.2%');
        expect(formatProbability(0)).toBe('0.0%');
        expect(formatProbability(1)).toBe('100.0%');
    });

    it('0 thuc su khac null', () => {
        // Mot mo hinh phat p = 0.00001 (bien kep) khong giong mot mo hinh khong phat gi.
        expect(formatProbability(0.00001)).toBe('0.0%');
        expect(formatProbability(null)).toBeNull();
    });
});

describe('requiresWarning', () => {
    it('chi VALIDATED_PROSPECTIVE duoc mien canh bao', () => {
        expect(requiresWarning('VALIDATED_PROSPECTIVE')).toBe(false);
        for (const s of [
            'NOT_VALIDATED',
            'BASELINE_ONLY',
            'VALIDATED_EXPLORATORY',
            'DEGRADED',
        ] as ValidationStatus[]) {
            expect(requiresWarning(s)).toBe(true);
        }
    });
});

describe('horizonLabel', () => {
    it('luon ghi ro so PHIEN', () => {
        // "1 thang" khong phai mot thang duong lich. Khong ghi so phien la mo duong cho hieu sai.
        expect(horizonLabel(21)).toContain('21 phiên');
        expect(horizonLabel(252)).toContain('252 phiên');
    });

    it('ky han la khong co nhan san thi van hien duoc', () => {
        expect(horizonLabel(7)).toBe('7 phiên');
    });

    it('moi ky han cua MERIX deu co nhan tieng Viet', () => {
        for (const h of [1, 5, 21, 63, 252]) {
            expect(horizonLabel(h)).toMatch(/[A-Za-zÀ-ỹ]/);
            expect(horizonLabel(h)).toContain(`${h} phiên`);
        }
    });
});

describe('doi chieu voi contracts/openapi.json', () => {
    it('ValidationStatus khop hop dong', () => {
        const want = enumValues('ValidationStatus').sort();
        const got = Object.keys(VALIDATION_LABELS).sort();
        expect(got).toEqual(want);
    });

    it('AbstainReason khop hop dong', () => {
        const want = enumValues('AbstainReason').sort();
        const got = Object.keys(ABSTAIN_LABELS).sort();
        expect(got).toEqual(want);
    });

    it('TargetDefinition khop hop dong', () => {
        // Truong dau de cua ca he: no noi con so dang tra loi cau hoi nao. Hop dong tung khai no
        // la chuoi tu do, nen mot lan doi ten o backend khong lam gi do — phep so hinh dang cua
        // `check:contract` khong thay gi doi, va ba literal duoi day van "hop le" ve kieu.
        const want = enumValues('TargetDefinition').sort();
        expect(Object.keys(TARGET_LABELS).sort(), 'TARGET_LABELS lech hop dong').toEqual(want);
        expect(
            [TARGET_ABSOLUTE, TARGET_RELATIVE_MARKET, TARGET_RELATIVE_SECTOR].sort(),
            'hang muc tieu trong target.ts lech hop dong',
        ).toEqual(want);
    });

    it('AssetLevel khop hop dong', () => {
        const want = enumValues('AssetLevel').sort();
        const got = Object.keys(LEVEL_LABELS).sort();
        expect(got).toEqual(want);
    });

    it('moi nhan deu co noi dung, khong de trong', () => {
        for (const m of [VALIDATION_LABELS, ABSTAIN_LABELS, LEVEL_LABELS]) {
            for (const [k, v] of Object.entries(m)) {
                expect(v.trim().length, `nhan cua ${k} de trong`).toBeGreaterThan(0);
            }
        }
    });
});

describe('nguong du lieu cu', () => {
    it('duong va du nho de phat hien duoc tre thuc te', () => {
        expect(STALE_LAG_DAYS).toBeGreaterThan(0);
        // Nghi Tet dai nhat o VN khoang 9 ngay lich. Nguong tren muc do se khong bao gio bao.
        expect(STALE_LAG_DAYS).toBeLessThanOrEqual(10);
    });
});
