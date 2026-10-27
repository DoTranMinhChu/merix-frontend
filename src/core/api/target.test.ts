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
    DEFAULT_HORIZON,
    TARGET_ABSOLUTE,
    TARGET_LABELS,
    TARGET_RELATIVE_MARKET,
    TARGET_RELATIVE_SECTOR,
    classify,
    describeHorizon,
    noSignalBand,
    pickHorizon,
} from './target';
import type { HorizonEvidence, HorizonForecast } from './types';

const openapi = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../contracts/openapi.json', import.meta.url)), 'utf8'),
);

/** Bằng chứng mẫu: khoảng skill rộng 5,4 điểm, nên dải suy ra là 0,5·√(5,4/200) ≈ 0,0821. */
const BANG_CHUNG: HorizonEvidence = {
    brierSkill: 4.2,
    ciLow: 1.5,
    ciHigh: 6.9,
    scoredCount: 360,
    independentSessions: 37,
    trialsBefore: 4,
    period: 'validation',
    reliabilityBins: [],
    population: {
        assetLevel: 'STOCK',
        assetCount: 100,
        from: '2018-01-02',
        to: '2020-12-31',
        includesThisAsset: true,
    },
};

/** Dải suy từ `BANG_CHUNG` — tính lại tại chỗ, không chép một con số vào test. */
const DAI = noSignalBand(BANG_CHUNG) as number;

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
        evidence: BANG_CHUNG,
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
        expect(classify(h({ probabilityUp: 0.5 - DAI + 0.001 })).kind).toBe('no-signal');
    });
    it('co tin hieu khi ra khoi dai, o ca hai phia', () => {
        expect(classify(h({ probabilityUp: 0.5 + DAI + 0.01 })).kind).toBe('signal');
        expect(classify(h({ probabilityUp: 0.5 - DAI - 0.01 })).kind).toBe('signal');
    });
    it('thieu khoang tin cay thi KHONG roi ve mot dai go cung: khong co co so', () => {
        for (const e of [null, { ...BANG_CHUNG, ciLow: null }, { ...BANG_CHUNG, ciHigh: null }]) {
            const s = classify(h({ evidence: e, probabilityUp: 0.9 }));
            expect(s.kind).toBe('no-basis');
        }
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
    it('market-snapshot nhan tham so horizon, khai dung khoang 1..252', () => {
        const ps = openapi.paths['/api/v1/market-snapshot'].get.parameters as { name: string; schema: { minimum?: number; maximum?: number } }[];
        const horizon = ps.find((p) => p.name === 'horizon');
        expect(horizon).toBeDefined();
        expect(horizon!.schema.minimum).toBe(1);
        expect(horizon!.schema.maximum).toBe(252);
    });

    /**
     * Ky han mac dinh cua giao dien phai la ky han mac dinh cua backend.
     *
     * Giao dien tung mac dinh 21 trong khi backend mac dinh 5 va ghi ro do la "uu tien cua chu so
     * huu". Hai ly le mau thuan cung nam trong ma nguon, va ky han nguoi dung thay dau tien vua la
     * ky han khong ai hoi vua la ky han tra loi "khong" cho mot phan ba thi truong (996/1518 co
     * mot con so o h=21, 1188 o h=5).
     *
     * `utoipa` khong cho khai `default` cho tham so truy van, nen kenh duy nhat la phan
     * `description` do backend viet — doc no bang regex, va bat luon ca viec no doi cach viet.
     */
    it('ky han mac dinh cua giao dien bang mac dinh cua backend', () => {
        const ps = openapi.paths['/api/v1/market-snapshot'].get.parameters as {
            name: string;
            description?: string;
        }[];
        const mo_ta = ps.find((p) => p.name === 'horizon')?.description ?? '';
        const khop = /default (\d+)/.exec(mo_ta);
        expect(khop, `hop dong khong con ghi mac dinh cua horizon: "${mo_ta}"`).not.toBeNull();
        expect(DEFAULT_HORIZON).toBe(Number(khop![1]));
    });

    it('ky han mac dinh nam trong cac ky han backend that su tinh', () => {
        expect([1, 5, 21, 63, 252]).toContain(DEFAULT_HORIZON);
    });
});

/**
 * Khong module nao duoc go cung mot ky han du bao.
 *
 * `asset.ts` tung goi `renderProbability(initial.forecast, 21)` trong khi `Probability.astro` danh
 * dau nut `DEFAULT_HORIZON` la dang chon: nhan noi mot ky han, con so noi mot ky han khac. Loi
 * nay khong the thay bang test don vi vi hai ben o hai file khac loai, nen khoa o muc ma nguon.
 */
describe('khong go cung ky han', () => {
    it('moi lan goi renderProbability deu dung hang, khong dung so', () => {
        const src = readFileSync(
            fileURLToPath(new URL('../../modules/workspace/asset.ts', import.meta.url)),
            'utf8',
        );
        const goi = [...src.matchAll(/renderProbability\(([^)]*)\)/g)].map((m) => m[1]);
        expect(goi.length, 'asset.ts phai co it nhat mot lan render').toBeGreaterThan(0);
        for (const tham_so of goi) {
            expect(tham_so, `tham so ky han go cung: renderProbability(${tham_so})`).not.toMatch(
                /,\s*\d+\s*$/,
            );
        }
    });
});

/**
 * Dai "khong co tin hieu" suy tu khoang tin cay cua CHINH bo ba do, khong phai mot hang so.
 *
 * Giai doan 1 de lai `NO_SIGNAL_BAND = 0.03` voi ghi chu "chua co co so thong ke". Giai doan 2
 * do duoc khoang tin cay cua Brier skill cho tung o, nen dai nay nay suy duoc. Cac test duoi day
 * khoa ba dieu: cong thuc dung, huong bien thien dung, va hang so tam KHONG con song o dau ca.
 */
describe('dai khong co tin hieu suy tu so do', () => {
    it('dung dung cong thuc 0,5·sqrt(w/200) voi w la do rong khoang (diem phan tram)', () => {
        // w = 5,4 ⇒ 0,5·sqrt(0,027) = 0,0821583836…
        expect(noSignalBand({ ciLow: 1.5, ciHigh: 6.9 })).toBeCloseTo(0.0821583836, 9);
        // w = 1,8 ⇒ 0,5·sqrt(0,009) = 0,0474341649…
        expect(noSignalBand({ ciLow: 0.2, ciHigh: 2.0 })).toBeCloseTo(0.0474341649, 9);
    });

    it('khoang do cang kem chinh xac thi dai cang RONG — khong bao gio nguoc lai', () => {
        const hep = noSignalBand({ ciLow: 2.0, ciHigh: 3.0 }) as number;
        const rong = noSignalBand({ ciLow: 2.0, ciHigh: 9.0 }) as number;
        expect(rong).toBeGreaterThan(hep);
    });

    it('khong do duoc thi tra null — khong co dai mac dinh nao de roi ve', () => {
        expect(noSignalBand(null)).toBeNull();
        expect(noSignalBand(undefined)).toBeNull();
        expect(noSignalBand({ ciLow: null, ciHigh: 6.9 })).toBeNull();
        expect(noSignalBand({ ciLow: 1.5, ciHigh: null })).toBeNull();
        // Khoang rong bang 0 la khong co do bat dinh nao — khong the xay ra tu mot phep do that,
        // nen no la du lieu hong chu khong phai mot dai hep.
        expect(noSignalBand({ ciLow: 3.0, ciHigh: 3.0 })).toBeNull();
        expect(noSignalBand({ ciLow: 9.0, ciHigh: 1.0 })).toBeNull();
        expect(noSignalBand({ ciLow: Number.NaN, ciHigh: 1.0 })).toBeNull();
    });

    it('phep do vo vong thi CA dai xac suat la nhieu, khong vuot qua 0,5', () => {
        expect(noSignalBand({ ciLow: -500, ciHigh: 500 })).toBe(0.5);
    });

    it('hang so tam cua giai doan 1 da bi xoa khoi ma nguon', () => {
        const src = readFileSync(fileURLToPath(new URL('./target.ts', import.meta.url)), 'utf8');
        const ma = src.replace(/\/\*\*[\s\S]*?\*\//g, ' ');
        expect(ma).not.toContain('NO_SIGNAL_BAND');
        expect(ma, 'con mot dai go cung trong ma nguon').not.toMatch(/0\.03\b/);
    });
});
