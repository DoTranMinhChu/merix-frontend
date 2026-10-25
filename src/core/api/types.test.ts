/**
 * Test cac rang buoc nghiep vu o phia frontend, va doi chieu kieu voi hop dong OpenAPI.
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

const openapi = readFileSync(
    fileURLToPath(new URL('../../../contracts/openapi.yaml', import.meta.url)),
    'utf8',
);

/**
 * Cac gia tri cua mot enum trong openapi.yaml.
 *
 * Chi lay cac dong `- ` thuoc **khoi `enum:`**, va dung ngay khi ra khoi khoi do.
 *
 * Ban dau loc moi dong bat dau bang `- ` trong ca schema, nen no bat luon cac gach dau dong
 * trong `description:`. Mot phep doi chieu bat qua nhieu thi khong con la phep doi chieu — no
 * chi bao do vi chinh no sai.
 */
function enumValues(name: string): string[] {
    const lines = openapi.split('\n');
    const start = lines.findIndex((l) => l.trim() === `${name}:`);
    if (start < 0) throw new Error(`openapi.yaml khong co schema ${name}`);

    const enumAt = lines.findIndex((l, k) => k > start && l.trim() === 'enum:');
    if (enumAt < 0 || enumAt > start + 6) {
        throw new Error(`schema ${name} khong co khoi enum: dang nhieu dong`);
    }
    const indent = lines[enumAt].search(/\S/);

    const out: string[] = [];
    for (let k = enumAt + 1; k < lines.length; k += 1) {
        const line = lines[k];
        if (line.trim() === '') break;
        const col = line.search(/\S/);
        // Ra khoi khoi enum: thut le bang hoac nho hon, hoac khong con la mot muc danh sach.
        if (col <= indent || !line.trim().startsWith('- ')) break;
        out.push(line.trim().slice(2).trim());
    }
    if (out.length === 0) throw new Error(`schema ${name} co enum rong`);
    return out;
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

describe('doi chieu voi shared/contracts/openapi.yaml', () => {
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
