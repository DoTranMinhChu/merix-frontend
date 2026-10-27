/**
 * Khoi bang chung ve CANH con so (ban thiet ke §10).
 *
 * # Vi sao no khong phai mot trang rieng
 *
 * Mot con so ma bang chung cua no cach mot cu nhap chuot la mot con so nguoi ta hanh dong theo
 * MA KHONG doc bang chung. Chu so huu cua he thong nay hanh dong theo mot luat: bo qua duoi 70%,
 * can nhac tren 70%. Neu "70%" va "do tren 100 ma khac, trong ba nam khac, voi 11 quan sat doc
 * lap" khong nam canh nhau tren man hinh thi chi con so dau tien duoc doc.
 *
 * # Thuan chuoi, khong cham DOM
 *
 * Cung ly do voi `workspace/probabilityView.ts`: chay duoc ca o may chu (SSR) lan trinh duyet
 * (ve lai khi doi ky han), va test duoc bang gia tri cu the.
 */
import { escapeHtml as e } from '../../core/api/market';
import type { HorizonEvidence, ReliabilityBin } from '../../core/api/types';

/** Nhan cua mot o, cung dang voi `data-bin`: `"0.7-0.8"`. */
function binKey(b: ReliabilityBin): string {
    return `${b.pLow.toFixed(1)}-${b.pHigh.toFixed(1)}`;
}

const KHUNG = { w: 260, h: 160, pad: 24 };

/**
 * Duong hieu chinh: truc ngang la xac suat mo hinh noi, truc dung la tan suat tang THAT.
 *
 * # O rong ve la o rong (Trong tam ra soat #4)
 *
 * `n === 0` nghia la chua do duoc gi trong o do. O nhu vay:
 *
 * - KHONG co `<circle>` — khong co diem nao de ve;
 * - KHONG co `data-rate` — khong co ty le nao de noi;
 * - mang `data-empty="true"` de nguoi doc (va test) goi ten duoc no.
 *
 * Va khong co `<polyline>` noi cac diem: mot duong lien net di qua o rong la mot con so bia ra
 * cho hinh ve dep hon, dung o cho nguoi doc tin nhat. Cac diem dung rieng tung cai.
 */
export function reliabilityCurveHtml(bins: readonly ReliabilityBin[]): string {
    const { w, h, pad } = KHUNG;
    const x = (p: number) => pad + p * (w - 2 * pad);
    const y = (p: number) => h - pad - p * (h - 2 * pad);
    const nMax = Math.max(1, ...bins.map((b) => b.n));

    const o = bins
        .map((b) => {
            const giua = (b.pLow + b.pHigh) / 2;
            const rong = b.n === 0 || b.observedRate === null;
            // NHÃN phải rẽ theo CÙNG `rong` với cái điểm. Rẽ theo `b.n === 0` một mình thì một
            // ô có `n > 0` nhưng `observedRate === null` — backend cho phép, vì
            // `avg(realized_label)` có thể là NULL — đọc ra `null * 100` và tooltip nói
            // "40 lần chấm, thực tế tăng 0,0%": đúng một con số bịa, ở đúng chỗ người đọc tin
            // nhất. Một `rong`, hai chỗ dùng.
            const nhan = `${binKey(b)}: ${
                rong
                    ? b.n === 0
                        ? 'không có lần chấm nào'
                        : `${b.n} lần chấm, nhưng không có tỷ lệ đo được`
                    : `${b.n} lần chấm, thực tế tăng ${(b.observedRate! * 100).toFixed(1).replace('.', ',')}%`
            }`;
            // Vach day cho biet o nay nang bao nhieu — o rong co vach cao 0, tuc khong co vach.
            const cao = (b.n / nMax) * 8;
            const vach =
                b.n === 0
                    ? ''
                    : `<rect x="${(x(b.pLow) + 1).toFixed(1)}" y="${(h - pad - cao).toFixed(1)}" width="${(x(b.pHigh) - x(b.pLow) - 2).toFixed(1)}" height="${cao.toFixed(1)}" class="reliability-weight"/>`;
            const diem = rong
                ? ''
                : `<circle cx="${x(giua).toFixed(1)}" cy="${y(b.observedRate!).toFixed(1)}" r="3.5" class="reliability-dot"/>`;
            return `<g data-bin="${binKey(b)}" data-empty="${rong}"${rong ? '' : ` data-rate="${b.observedRate}"`} class="reliability-bin"><title>${e(nhan)}</title>${vach}${diem}</g>`;
        })
        .join('');

    const soO = bins.filter((b) => b.n > 0).length;
    return `<figure class="reliability" data-filled-bins="${soO}"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Đường hiệu chỉnh: mô hình nói bao nhiêu phần trăm thì thực tế tăng bao nhiêu phần trăm. ${soO} trên ${bins.length} khoảng có dữ liệu."><line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" class="reliability-ideal"/><line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(0)}" class="reliability-axis"/><line x1="${x(0)}" y1="${y(0)}" x2="${x(0)}" y2="${y(1)}" class="reliability-axis"/>${o}</svg><figcaption>Đường chéo là hiệu chỉnh hoàn hảo. <strong>${soO}/${bins.length}</strong> khoảng có dữ liệu; khoảng rỗng để trống, không nối.</figcaption></figure>`;
}

/**
 * Câu cảnh báo gọn "bằng chứng không nói về mã này", cho những chỗ không chở nổi cả khối.
 *
 * Trả chuỗi rỗng khi mã CÓ trong nhóm đã đo, và khi **chưa biết** (`null`/vắng): một màn hình
 * chưa biết thì không được nói chắc theo chiều nào.
 *
 * Đây là một CÂU, không phải một màu. Trang danh sách là nơi người chủ quét trước và hành động
 * theo một luật duy nhất; một sắc đỏ nhạt ở đó không phải lời cảnh báo, nó là trang trí.
 */
export function outOfPopulationNoteHtml(includes: boolean | null | undefined): string {
    if (includes !== false) return '';
    return `<small class="evidence-warning" data-in-population="false">Bằng chứng không nói về mã này</small>`;
}

/**
 * Ô "bằng chứng" của bảng năm kỳ hạn: khoảng skill, số quan sát độc lập, nhóm mã, cảnh báo.
 *
 * Nằm ở đây chứ không trong `ForecastTable.astro` vì một biểu thức trong template `.astro`
 * không có chỗ nào kiểm được — và chính ô này là chỗ một dòng "chưa đo" có thể lặng lẽ mượn số
 * của dòng bên cạnh.
 */
export function evidenceCellHtml(ev: HorizonEvidence | null | undefined): string {
    if (!ev) return '<span class="evidence-chua-do">Chưa đo</span>';
    const p = ev.population;
    return (
        `<span class="tabular-nums">${diem(ev.ciLow)}% … ${diem(ev.ciHigh)}%</span>` +
        `<small class="table-status-date">${ev.independentSessions ?? '—'} quan sát độc lập · ` +
        `${p.assetCount} mã, ${e(p.from)} → ${e(p.to)}</small>` +
        outOfPopulationNoteHtml(p.includesThisAsset)
    );
}

/** `12,3%` hoặc `—`. Giữ dấu phẩy thập phân tiếng Việt. */
function diem(v: number | null | undefined): string {
    return v === null || v === undefined || !Number.isFinite(v)
        ? '—'
        : `${v.toFixed(2).replace('.', ',')}`;
}

/**
 * Khoi bang chung day du, cho trang chi tiet mot ma.
 *
 * `evidence = null` KHONG duoc ve mot duong cong rong trong nhu that: no noi thang la chua co.
 */
export function evidenceBlockHtml(ev: HorizonEvidence | null | undefined): string {
    if (!ev) {
        return `<section class="evidence evidence-empty" aria-label="Bằng chứng đo được"><h3>Bằng chứng</h3><p class="panel-empty">Chưa có bằng chứng đo được cho kỳ hạn này. Chưa đo thì chưa nói — không có con số nào ở đây được suy từ kỳ hạn khác.</p></section>`;
    }
    const p = ev.population;
    const trong = p.includesThisAsset;
    const canh_bao = trong
        ? `<p class="evidence-population" data-in-population="true">Mã này <strong>có</strong> trong nhóm đã đo.</p>`
        : `<p class="evidence-population evidence-warning" data-in-population="false"><strong>Bằng chứng không nói về mã này.</strong> Nhóm đã đo <strong>không bao gồm</strong> nó, nên mọi con số dưới đây là của nhóm khác.</p>`;

    const soPhien =
        ev.independentSessions === null
            ? '—'
            : `${ev.independentSessions}`;

    return `<section class="evidence" aria-label="Bằng chứng đo được"><h3>Bằng chứng của chính kỳ hạn này</h3>
<p class="evidence-scope">Đo trên <strong>${p.assetCount}</strong> mã (cấp ${e(p.assetLevel)}), từ <strong>${e(p.from)}</strong> đến <strong>${e(p.to)}</strong>, kỳ <strong>${e(ev.period)}</strong>.</p>
${canh_bao}
<dl class="evidence-figures"><div><dt>Brier skill</dt><dd>${diem(ev.brierSkill)}% <small>(khoảng tin cậy ${diem(ev.ciLow)}% … ${diem(ev.ciHigh)}%, đã nới theo ${ev.trialsBefore} cấu hình đã thử)</small></dd></div><div><dt>Quan sát độc lập</dt><dd>${soPhien} <small>— đây là lượng bằng chứng</small></dd></div><div><dt>Số lần chấm</dt><dd>${ev.scoredCount} <small>— các lần chấm chồng lấn nhau theo kỳ hạn, nên con số này <strong>không</strong> phải lượng bằng chứng</small></dd></div></dl>
${reliabilityCurveHtml(ev.reliabilityBins)}</section>`;
}
