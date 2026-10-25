/**
 * Test phan HIEN THI: cung mot du lieu, man hinh noi gi.
 *
 * Day la cho loi goc xay ra — con so tuong doi bi in duoi chu "xac suat tang" — nen test nhin
 * vao chinh chuoi HTML nguoi dung se doc, khong chi vao ham phan loai.
 */
import { describe, expect, it } from 'vitest';
import { compactProbabilityHtml, probabilityBodyHtml } from './probabilityView';
import {
    TARGET_ABSOLUTE,
    TARGET_RELATIVE_MARKET,
    TARGET_RELATIVE_SECTOR,
} from '../../core/api/target';
import type { ForecastResponse, HorizonForecast } from '../../core/api/types';

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

function h(over: Partial<HorizonForecast>): HorizonForecast {
    return {
        horizonSessions: 21,
        targetDefinition: TARGET_ABSOLUTE,
        predictionStatus: 'LIVE',
        probabilityUp: 0.62,
        probabilityNotUp: 0.38,
        targetDate: '2026-11-20',
        abstainReason: null,
        validationStatus: 'VALIDATED_PROSPECTIVE',
        dataThrough: '2026-10-23',
        modelVersion: 'equal_ensemble.v1',
        ...over,
    };
}
function fc(horizons: HorizonForecast[]): ForecastResponse {
    return {
        asset: { level: 'STOCK', symbol: 'FPT', name: 'FPT', exchange: 'HOSE' },
        asOf: '2026-10-23',
        dataThrough: '2026-10-23',
        modelVersion: 'equal_ensemble.v1',
        validationStatus: 'VALIDATED_PROSPECTIVE',
        disclaimer: '',
        horizons,
    };
}

describe('probabilityBodyHtml: muc tieu', () => {
    it('chi co dong tuong doi thi KHONG co chu "xac suat tang" va khong hien con so lam xac suat tang', () => {
        const html = probabilityBodyHtml(
            fc([h({ targetDefinition: TARGET_RELATIVE_SECTOR, probabilityUp: 0.6, probabilityNotUp: 0.4 })]),
            21,
        );
        expect(text(html).toLowerCase()).not.toContain('xác suất tăng');
        expect(text(html)).toMatch(/Chưa có dự báo tuyệt đối/);
    });
    it('dong tuyet doi la mac dinh du dong tuong doi dung truoc trong mang', () => {
        const html = probabilityBodyHtml(
            fc([
                h({ targetDefinition: TARGET_RELATIVE_SECTOR, probabilityUp: 0.31, probabilityNotUp: 0.69 }),
                h({ targetDefinition: TARGET_ABSOLUTE, probabilityUp: 0.62, probabilityNotUp: 0.38 }),
            ]),
            21,
        );
        const main = html.split('relative-block')[0];
        expect(text(main)).toContain('62,0%');
        expect(text(main)).toMatch(/Xác suất tăng/);
        expect(text(main)).not.toContain('31,0%');
    });
    it('phan tuong doi nam trong khoi rieng, co nhan, va khong dung chu "tang"', () => {
        const html = probabilityBodyHtml(
            fc([
                h({}),
                h({ targetDefinition: TARGET_RELATIVE_MARKET, probabilityUp: 0.7, probabilityNotUp: 0.3 }),
                h({ targetDefinition: TARGET_RELATIVE_SECTOR, probabilityUp: 0.2, probabilityNotUp: 0.8 }),
            ]),
            21,
        );
        const [, rel] = html.split('relative-block');
        expect(rel).toBeDefined();
        expect(text(rel).toLowerCase()).not.toContain('tăng');
        expect(text(rel)).toContain('So với thị trường');
        expect(text(rel)).toContain('So với ngành');
        expect(text(rel)).toContain('70,0%');
    });
    it('chi hien dong cua ky han dang chon', () => {
        const html = probabilityBodyHtml(fc([h({}), h({ horizonSessions: 5, probabilityUp: 0.9, probabilityNotUp: 0.1 })]), 21);
        expect(text(html)).not.toContain('90,0%');
    });
});

describe('probabilityBodyHtml: ba trang thai', () => {
    it('tu choi', () => {
        const html = probabilityBodyHtml(
            fc([h({ predictionStatus: 'ABSTAINED', abstainReason: 'LOW_COVERAGE', probabilityUp: null, probabilityNotUp: null })]),
            21,
        );
        expect(text(html)).toMatch(/Không phát dự báo/);
        expect(text(html)).toMatch(/Dữ liệu không đủ đầy đủ/);
        expect(html).not.toContain('probability-gauge');
    });
    it('chua co co so — co hien con so nhung khong ve dong ho do', () => {
        const html = probabilityBodyHtml(fc([h({ validationStatus: 'NOT_VALIDATED', probabilityUp: 0.58, probabilityNotUp: 0.42 })]), 21);
        expect(text(html)).toMatch(/Chưa có cơ sở/);
        expect(html).not.toContain('probability-gauge');
        expect(text(html)).toContain('58,0%');
    });
    it('khong co tin hieu', () => {
        const html = probabilityBodyHtml(
            fc([h({ validationStatus: 'VALIDATED_EXPLORATORY', probabilityUp: 0.51, probabilityNotUp: 0.49 })]),
            21,
        );
        expect(text(html)).toMatch(/Không có tín hiệu/);
        expect(html).not.toContain('probability-gauge');
    });
    it('co tin hieu thi ve dong ho', () => {
        expect(probabilityBodyHtml(fc([h({})]), 21)).toContain('probability-gauge');
    });
    it('hai ly do tu choi moi (NO_PARENT_SERIES, TARGET_AXIS_MISMATCH) co loi giai thich', () => {
        for (const r of ['NO_PARENT_SERIES', 'TARGET_AXIS_MISMATCH'] as const) {
            const html = probabilityBodyHtml(
                fc([
                    h({}),
                    h({ targetDefinition: TARGET_RELATIVE_SECTOR, predictionStatus: 'ABSTAINED', abstainReason: r, probabilityUp: null, probabilityNotUp: null }),
                ]),
                21,
            );
            expect(text(html)).not.toContain('undefined');
            expect(text(html)).toMatch(r === 'NO_PARENT_SERIES' ? /chuỗi đối chiếu/ : /lệch trục/);
        }
    });
    it('loi tai du lieu hien thong diep loi, khong hien 50%', () => {
        const html = probabilityBodyHtml(null, 21, 'Đang tải dự báo…');
        expect(text(html)).toContain('Đang tải dự báo…');
        expect(text(html)).not.toContain('50');
    });
    it('thoat HTML trong chuoi tu API', () => {
        const html = probabilityBodyHtml(fc([h({ modelVersion: '<img src=x onerror=alert(1)>' })]), 21);
        expect(html).not.toContain('<img');
    });
});

describe('compactProbabilityHtml (hang, the, o nganh)', () => {
    const snap = (o: object) =>
        ({
            targetDefinition: TARGET_ABSOLUTE,
            predictionStatus: 'LIVE',
            validationStatus: 'VALIDATED_PROSPECTIVE',
            probabilityUp: 0.62,
            probabilityNotUp: 0.38,
            abstainReason: null,
            ...o,
        }) as never;
    it('khong co dong tuyet doi va bi tu choi la HAI trang thai doc phan biet duoc bang chu', () => {
        const none = compactProbabilityHtml(null);
        const refused = compactProbabilityHtml(
            snap({ predictionStatus: 'ABSTAINED', probabilityUp: null, abstainReason: 'LOW_COVERAGE' }),
        );
        expect(text(none)).toMatch(/Chưa có dự báo/);
        expect(text(refused)).toMatch(/Không phát dự báo/);
        expect(text(refused)).toMatch(/Dữ liệu không đủ đầy đủ/);
        expect(refused).toContain('title="Dữ liệu không đủ đầy đủ"');
        expect(text(none)).not.toBe(text(refused));
        for (const t of [text(none), text(refused)]) expect(t).not.toMatch(/0%|50/);
    });
    it('tu choi khong ro ly do van noi la khong ro ly do', () => {
        const t = text(compactProbabilityHtml(snap({ predictionStatus: 'ABSTAINED', probabilityUp: null })));
        expect(t).toMatch(/Không rõ lý do/);
    });
    it('chua co co so va khong co tin hieu mang nhan rieng', () => {
        expect(text(compactProbabilityHtml(snap({ validationStatus: 'NOT_VALIDATED', probabilityUp: 0.58 })))).toMatch(/Chưa có cơ sở/);
        expect(text(compactProbabilityHtml(snap({ probabilityUp: 0.51 })))).toMatch(/Không có tín hiệu/);
    });
    it('co tin hieu hien so', () => {
        expect(text(compactProbabilityHtml(snap({})))).toContain('62,0%');
    });
    it('snapshot khong phai muc tieu tuyet doi thi khong bao gio duoc hien nhu xac suat tang', () => {
        const t = text(compactProbabilityHtml(snap({ targetDefinition: TARGET_RELATIVE_SECTOR })));
        expect(t).not.toContain('62,0%');
    });
});
