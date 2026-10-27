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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evidenceBlockHtml, reliabilityCurveHtml, evidenceCellHtml, outOfPopulationNoteHtml } from './evidenceView';
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

    it('so phien doc lap dung TRUOC so lan cham, va cau dinh chinh di LIEN voi so lan cham', () => {
        const html = evidenceBlockHtml(evidence());
        const iSessions = html.indexOf('37');
        const iScored = html.indexOf('360');
        expect(iSessions).toBeGreaterThan(-1);
        expect(iScored).toBeGreaterThan(-1);
        // Thu tu doc duoc: luong bang chung that dung TRUOC con so de bi doc nham.
        expect(iSessions).toBeLessThan(iScored);

        // Cau dinh chinh phai di LIEN voi `360`, khong phai "co mat o dau do tren trang": mot
        // cau canh bao troi sang khoi khac la mot cau khong ai doc cung con so no noi ve.
        const sau = html.slice(iScored, iScored + 320);
        expect(sau, 'cau "chong lan" khong con di kem so lan cham').toMatch(/chồng lấn/);
        expect(sau).toMatch(/phải lượng bằng chứng/);
    });

    it('o co mau nhung KHONG co ty le thi khong duoc bia ra mot ty le', () => {
        // Backend cho phep dong nay: `n > 0` nhung `avg(realized_label)` la NULL.
        const html = reliabilityCurveHtml([
            { pLow: 0.4, pHigh: 0.5, n: 40, observedRate: null },
            { pLow: 0.5, pHigh: 0.6, n: 10, observedRate: 0.5 },
        ]);
        const o = html.slice(html.indexOf('<g data-bin="0.4-0.5"')).split('</g>')[0];
        expect(o).toContain('data-empty="true"');
        expect(o).not.toContain('<circle');
        expect(o).not.toContain('data-rate');
        // `null * 100` cho `0`: day la hinh dang cua con so bia ra, va no khong duoc xuat hien.
        expect(o).not.toMatch(/thực tế tăng 0,0%/);
        expect(o).toMatch(/40 lần chấm/);
    });

    it('cau canh bao gon la mot CAU, va chi hien khi biet chac la ngoai nhom', () => {
        expect(outOfPopulationNoteHtml(false)).toMatch(/không nói về mã này/);
        expect(outOfPopulationNoteHtml(false)).toContain('data-in-population="false"');
        expect(outOfPopulationNoteHtml(true)).toBe('');
        // Chua biet thi khong noi chac theo chieu nao.
        expect(outOfPopulationNoteHtml(null)).toBe('');
        expect(outOfPopulationNoteHtml(undefined)).toBe('');
    });
});

describe('o bang chung cua bang nam ky han', () => {
    it('dong chua do noi la chua do, khong muon so cua dong ben canh', () => {
        expect(evidenceCellHtml(null)).toMatch(/Chưa đo/);
        // Khong mot chu so nao: mot o "chua do" mang so la mot o da muon so cua cho khac.
        expect(evidenceCellHtml(null).replace(/[^0-9]/g, '')).toBe('');
        expect(evidenceCellHtml(undefined)).toMatch(/Chưa đo/);
    });

    it('dong co bang chung mang khoang, so quan sat doc lap va nhom ma', () => {
        const html = evidenceCellHtml({
            ...evidence(),
            population: { ...evidence().population, includesThisAsset: true },
        });
        expect(html).toContain('1,50%');
        expect(html).toContain('6,90%');
        expect(html).toMatch(/37 quan sát độc lập/);
        expect(html).toMatch(/100 mã/);
        expect(html).toMatch(/2018-01-02/);
        expect(html).not.toMatch(/không nói về mã này/);
    });

    it('dong cua mot ma ngoai nhom do mang cau canh bao ngay trong o', () => {
        expect(evidenceCellHtml(evidence())).toMatch(/không nói về mã này/);
    });

    /**
     * Bang `.astro` phai THAT SU goi o nay.
     *
     * Ba test tren kiem `evidenceCellHtml`, nhung khong test nao kiem rang template dung no —
     * dung cai lo da lam phep dot bien `F10` xanh o cho khac. Khong co harness nao render
     * `.astro`, nen khoa o muc ma nguon, giong `target.test.ts` da lam voi `renderProbability`.
     */
    it('ForecastTable.astro ve o bang `evidenceCellHtml`, khong tu dung markup rieng', () => {
        const src = readFileSync(
            fileURLToPath(new URL('./ForecastTable.astro', import.meta.url)),
            'utf8',
        );
        expect(src, 'template khong goi evidenceCellHtml').toContain(
            'set:html={evidenceCellHtml(',
        );
        // Khong con mot ban markup bang chung thu hai nam trong template.
        expect(src, 'markup bang chung viet tay da quay lai trong template').not.toMatch(
            /quan sát độc lập|Chưa đo|evidence-warning/,
        );
    });

    it('khong co bang chung thi noi la khong co, khong ve mot duong cong rong nhu that', () => {
        const html = evidenceBlockHtml(null);
        expect(html).toMatch(/Chưa có bằng chứng/);
        expect(html).not.toContain('<circle');
    });
});
