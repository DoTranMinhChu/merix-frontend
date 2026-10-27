/**
 * Test cho khoi bang chung ve CANH con so (ban thiet ke §10).
 *
 * Hai thu de sai mot cach im lang, nen ca hai deu co test rieng o day:
 *
 * 1. **O rong cua duong hieu chinh.** `n = 0` nghia la khong do duoc gi trong o do. Mot duong
 *    cong lien net di qua no la mot con so bia ra de hinh ve dep hon. (Trong tam ra soat #4)
 * 2. **Nhom ma da do.** Nguoi xem mot ma nho phai thay ngay rang bang chung khong noi ve no.
 */
import { describe, expect, it } from 'vitest';
import { evidenceBlockHtml, reliabilityCurveHtml } from './evidenceView';
import type { HorizonEvidence, ReliabilityBin } from '@core/api/types';

/** Mot the trong chuoi HTML, lay theo `data-bin`. Khong dung DOM: du an khong co jsdom. */
function binEl(html: string, bin: string): string {
    const i = html.indexOf(`data-bin="${bin}"`);
    expect(i, `khong thay o ${bin} trong ${html}`).toBeGreaterThan(-1);
    const start = html.lastIndexOf('<', i);
    // Het the `<g ...>...</g>` cua chinh o nay.
    const end = html.indexOf('</g>', i);
    expect(end, `o ${bin} khong dong the`).toBeGreaterThan(-1);
    return html.slice(start, end + 4);
}

function bins(over: Partial<Record<number, Partial<ReliabilityBin>>> = {}): ReliabilityBin[] {
    return Array.from({ length: 10 }, (_, i) => ({
        pLow: i / 10,
        pHigh: (i + 1) / 10,
        n: 0,
        observedRate: null,
        ...over[i],
    }));
}

function evidence(over: Partial<HorizonEvidence> = {}): HorizonEvidence {
    return {
        brierSkill: 4.2,
        ciLow: 1.5,
        ciHigh: 6.9,
        scoredCount: 360,
        independentSessions: 37,
        trialsBefore: 4,
        period: 'validation',
        reliabilityBins: bins({ 7: { n: 40, observedRate: 0.62 } }),
        population: {
            assetLevel: 'STOCK',
            assetCount: 100,
            from: '2018-01-02',
            to: '2020-12-31',
            includesThisAsset: false,
        },
        ...over,
    };
}

describe('duong hieu chinh', () => {
    it('o rong khong duoc noi suy', () => {
        const html = reliabilityCurveHtml(bins({ 7: { n: 0, observedRate: null } }));
        expect(binEl(html, '0.7-0.8')).toContain('data-empty="true"');
    });

    it('o rong ke giua hai o co mau van la o rong, khong co diem nao duoc ve', () => {
        // 0,5–0,6 va 0,7–0,8 co mau; 0,6–0,7 o giua — dung cho mot phep noi suy "cho lien net"
        // se chen vao.
        const html = reliabilityCurveHtml(
            bins({ 5: { n: 200, observedRate: 0.57 }, 7: { n: 40, observedRate: 0.62 } }),
        );
        const giua = binEl(html, '0.6-0.7');
        expect(giua).toContain('data-empty="true"');
        expect(giua).not.toContain('<circle');
        expect(giua).not.toMatch(/data-rate="[0-9]/);
        // Hai o co mau thi ngc lai: co diem va co ty le.
        expect(binEl(html, '0.5-0.6')).toContain('data-empty="false"');
        expect(binEl(html, '0.5-0.6')).toContain('<circle');
        expect(binEl(html, '0.7-0.8')).toContain('<circle');
    });

    it('ve du MUOI o, ke ca khi khong o nao co mau', () => {
        const html = reliabilityCurveHtml(bins());
        for (let i = 0; i < 10; i += 1) {
            expect(binEl(html, `${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}`)).toContain(
                'data-empty="true"',
            );
        }
        expect(html).not.toContain('<circle');
    });
});

describe('khoi bang chung', () => {
    it('noi ro bang chung do tren nhom ma nao, lay tu du lieu chu khong phai chuoi go cung', () => {
        const html = evidenceBlockHtml(evidence());
        expect(html).toContain('100');
        expect(html).toContain('2018-01-02');
        expect(html).toContain('2020-12-31');
    });

    it('ma KHONG nam trong nhom da do duoc canh bao bang CHU, khong chi bang mau', () => {
        const trong = evidenceBlockHtml(
            evidence({
                population: { ...evidence().population, includesThisAsset: true },
            }),
        );
        const ngoai = evidenceBlockHtml(evidence());
        expect(ngoai).toContain('data-in-population="false"');
        expect(trong).toContain('data-in-population="true"');
        // Khac nhau bang chu doc duoc, khong chi bang mot thuoc tinh CSS.
        expect(ngoai).toMatch(/không nằm trong|không bao gồm|không nói về/);
        expect(trong).not.toMatch(/không nằm trong|không bao gồm|không nói về/);
    });

    it('so phien doc lap duoc goi la luong bang chung; so lan cham thi khong', () => {
        const html = evidenceBlockHtml(evidence());
        const iSessions = html.indexOf('37');
        const iScored = html.indexOf('360');
        expect(iSessions).toBeGreaterThan(-1);
        expect(iScored).toBeGreaterThan(-1);
        // `scoredCount` chi duoc xuat hien kem chu "chồng lấn" — no KHONG phai luong bang chung.
        expect(html).toMatch(/chồng lấn/);
    });

    it('khong co bang chung thi noi la khong co, khong ve mot duong cong rong nhu that', () => {
        const html = evidenceBlockHtml(null);
        expect(html).toMatch(/Chưa có bằng chứng/);
        expect(html).not.toContain('<circle');
    });
});
