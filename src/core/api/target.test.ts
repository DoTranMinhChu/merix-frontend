/**
 * Test "con so nay dang noi ve cai gi".
 *
 * Loi goc cua ca chuong trinh: engine cap co phieu tra loi "co phieu co thang nganh khong?",
 * con giao dien in con so do duoi chu "xac suat tang". Cac test nay khoa de loi do khong quay lai.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    NO_SIGNAL_BAND,
    TARGET_ABSOLUTE,
    TARGET_LABELS,
    TARGET_RELATIVE_MARKET,
    TARGET_RELATIVE_SECTOR,
    classify,
    describeHorizon,
    pickHorizon,
} from './target';
import type { HorizonForecast } from './types';

const openapi = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../contracts/openapi.json', import.meta.url)), 'utf8'),
);

function h(over: Partial<HorizonForecast>): HorizonForecast {
    return {
        horizonSessions: 21,
        targetDefinition: TARGET_ABSOLUTE,
        predictionStatus: 'LIVE',
        probabilityUp: 0.6,
        probabilityNotUp: 0.4,
        targetDate: null,
        abstainReason: null,
        validationStatus: 'VALIDATED_PROSPECTIVE',
        ...over,
    };
}

describe('pickHorizon', () => {
    it('chon dung muc tieu, khong phu thuoc thu tu mang', () => {
        const abs = h({ probabilityUp: 0.7 });
        const rel = h({ targetDefinition: TARGET_RELATIVE_SECTOR, probabilityUp: 0.2 });
        // Thu tu dao: dong tuong doi dung truoc. Truoc day `find` theo ky han se chon nham no.
        expect(pickHorizon([rel, abs], 21)).toBe(abs);
        expect(pickHorizon([rel, abs], 21, TARGET_RELATIVE_SECTOR)).toBe(rel);
    });
    it('khong rot sang dong tuong doi khi thieu dong tuyet doi', () => {
        const rel = h({ targetDefinition: TARGET_RELATIVE_MARKET });
        expect(pickHorizon([rel], 21)).toBeUndefined();
    });
    it('khong khop ky han thi undefined', () => {
        expect(pickHorizon([h({})], 5)).toBeUndefined();
    });
});

describe('ba trang thai hien thi phan biet duoc', () => {
    it('tu choi: ABSTAINED co ly do', () => {
        const s = classify(h({ predictionStatus: 'ABSTAINED', abstainReason: 'LOW_COVERAGE', probabilityUp: null }));
        expect(s.kind).toBe('refused');
    });
    it('tu choi thang cuoc ca khi con so van con (khong de lot ra man hinh)', () => {
        expect(classify(h({ predictionStatus: 'ABSTAINED', probabilityUp: 0.9 })).kind).toBe('refused');
    });
    it('chua co co so: co con so nhung mo hinh chua kiem chung', () => {
        for (const v of ['NOT_VALIDATED', 'BASELINE_ONLY', 'DEGRADED'] as const) {
            expect(classify(h({ validationStatus: v, probabilityUp: 0.58 })).kind).toBe('no-basis');
        }
    });
    it('khong co tin hieu: mo hinh da kiem chung nhung con so nam trong dai', () => {
        expect(classify(h({ validationStatus: 'VALIDATED_EXPLORATORY', probabilityUp: 0.51 })).kind).toBe('no-signal');
        expect(classify(h({ probabilityUp: 0.5 - NO_SIGNAL_BAND + 0.001 })).kind).toBe('no-signal');
    });
    it('co tin hieu khi ra khoi dai, o ca hai phia', () => {
        expect(classify(h({ probabilityUp: 0.5 + NO_SIGNAL_BAND + 0.01 })).kind).toBe('signal');
        expect(classify(h({ probabilityUp: 0.5 - NO_SIGNAL_BAND - 0.01 })).kind).toBe('signal');
    });
    it('chua kiem chung thang "khong co tin hieu": 0.51 chua kiem chung la chua co co so', () => {
        expect(classify(h({ validationStatus: 'NOT_VALIDATED', probabilityUp: 0.51 })).kind).toBe('no-basis');
    });
    it('UNAVAILABLE hoac xac suat null deu la tu choi, khong bao gio la 50%', () => {
        expect(classify(h({ predictionStatus: 'UNAVAILABLE', probabilityUp: null })).kind).toBe('refused');
        expect(classify(h({ probabilityUp: null })).kind).toBe('refused');
    });
    it('ba nhan hien thi khac nhau tung doi mot', () => {
        const a = describeHorizon(h({ predictionStatus: 'ABSTAINED', abstainReason: 'LOW_COVERAGE', probabilityUp: null }));
        const b = describeHorizon(h({ validationStatus: 'NOT_VALIDATED', probabilityUp: 0.58 }));
        const c = describeHorizon(h({ validationStatus: 'VALIDATED_EXPLORATORY', probabilityUp: 0.51 }));
        expect(a.stateLabel).toMatch(/Không phát dự báo/);
        expect(b.stateLabel).toMatch(/Chưa có cơ sở/);
        expect(c.stateLabel).toMatch(/Không có tín hiệu/);
        expect(new Set([a.stateLabel, b.stateLabel, c.stateLabel]).size).toBe(3);
    });
});

describe('nhan muc tieu', () => {
    it('muc tieu tuyet doi duoc goi la xac suat tang', () => {
        expect(describeHorizon(h({})).headline).toBe('Xác suất tăng');
    });
    it('KHONG BAO GIO dung chu "tang" cho muc tieu tuong doi', () => {
        for (const t of [TARGET_RELATIVE_MARKET, TARGET_RELATIVE_SECTOR]) {
            const d = describeHorizon(h({ targetDefinition: t, probabilityUp: 0.6 }));
            const all = JSON.stringify(d).toLowerCase();
            expect(all).not.toContain('tăng');
            expect(d.headline.toLowerCase()).not.toContain('xác suất tăng');
        }
    });
    it('ba nhan khac nhau', () => {
        const names = [TARGET_ABSOLUTE, TARGET_RELATIVE_MARKET, TARGET_RELATIVE_SECTOR].map((t) => TARGET_LABELS[t].name);
        expect(new Set(names).size).toBe(3);
        const css = [TARGET_ABSOLUTE, TARGET_RELATIVE_MARKET, TARGET_RELATIVE_SECTOR].map((t) => TARGET_LABELS[t].css);
        expect(new Set(css).size).toBe(3);
    });
    it('dinh nghia muc tieu la mot dinh nghia la khong biet -> tu choi noi nang', () => {
        const d = describeHorizon(h({ targetDefinition: 'MYSTERY' as never }));
        expect(JSON.stringify(d).toLowerCase()).not.toContain('xác suất tăng');
    });
});

describe('khop hop dong sinh tu backend', () => {
    it('targetDefinition bat buoc o moi ky han va o snapshot', () => {
        const s = openapi.components.schemas;
        expect(s.HorizonForecast.required).toContain('targetDefinition');
        const snap = Object.entries<{ required?: string[]; properties?: object }>(s).filter(
            ([, v]) => v.properties && 'targetDefinition' in v.properties,
        );
        expect(snap.length).toBeGreaterThanOrEqual(2);
        for (const [, v] of snap) expect(v.required).toContain('targetDefinition');
    });
    it('market-snapshot nhan tham so horizon', () => {
        const params = openapi.paths['/api/v1/market-snapshot'].get.parameters.map((p: { name: string }) => p.name);
        expect(params).toContain('horizon');
    });
});
