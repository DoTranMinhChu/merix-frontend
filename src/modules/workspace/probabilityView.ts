/**
 * Dung HTML cho khoi xac suat. Thuan chuoi: khong cham DOM, nen chay duoc o ca may chu
 * (`Probability.astro`) lan trinh duyet (`charts.ts`) va test duoc bang gia tri cu the.
 *
 * Muc tieu TUYET DOI la khung chinh. Muc tieu tuong doi chi hien trong khoi `relative-block`
 * rieng, voi huy hieu rieng — khong bao gio duoi chu "xac suat tang". Xem `core/api/target.ts`.
 */
import { evidenceBlockHtml, outOfPopulationNoteHtml } from '../forecast/evidenceView';
import { escapeHtml as e, percent, stale, type SnapshotForecast } from '../../core/api/market';
import { describeHorizon, pickHorizon, relativeHorizons, TARGET_ABSOLUTE, type HorizonView } from '../../core/api/target';
import {
    VALIDATION_LABELS,
    type ForecastResponse,
    type HorizonForecast,
    type ValidationStatus,
} from '../../core/api/types';

const badge = (v: HorizonView) =>
    `<span class="target-badge ${v.target.css}" title="${e(v.target.question)}">${e(v.target.name)}</span>`;

function gauge(p: number, v: HorizonView) {
    return `<div class="probability-gauge"><svg viewBox="0 0 250 145" aria-hidden="true"><path d="M25 125 A100 100 0 0 1 225 125" class="gauge-track"/><path d="M25 125 A100 100 0 0 1 225 125" class="gauge-value" pathLength="100" stroke-dasharray="${p * 100} 100"/><text x="18" y="144">0%</text><text x="209" y="144">100%</text></svg><div><span>${percent(p)}</span><small>${e(v.headline)}</small></div></div><div class="probability-breakdown"><span>Tăng <strong>${percent(p)}</strong></span><span>${e(v.complementLabel)} <strong>${e(v.complementText ?? '—')}</strong></span></div>`;
}

/** Khung chinh cua mot dong, theo trang thai. Chi goi cho muc tieu TUYET DOI (dong ho noi "Tang"). */
function mainBlock(h: HorizonForecast, fallback: ValidationStatus): string {
    const v = describeHorizon(h, fallback);
    switch (v.state.kind) {
        case 'signal':
            return gauge(h.probabilityUp!, v);
        case 'refused':
            return `<p class="panel-empty state-refused"><strong>${e(v.stateLabel)}</strong><br>${e(v.stateNote)}</p>`;
        default:
            // Co con so nhung khong duoc de no trong nhu mot du bao: khong dong ho, so lam mo.
            return `<div class="state-block state-${v.state.kind}"><strong>${e(v.stateLabel)}</strong><p>${e(v.stateNote)}</p><small>Con số mô hình trả ra: <span class="state-number">${e(v.valueText ?? '—')}</span> (${e(v.headline.toLowerCase())})</small></div>`;
    }
}

function relativeBlock(rows: HorizonForecast[], fallback: ValidationStatus): string {
    if (!rows.length) return '';
    const items = rows
        .map((h) => {
            const v = describeHorizon(h, fallback);
            const body =
                v.state.kind === 'signal'
                    ? `${e(v.headline)} <strong>${e(v.valueText ?? '—')}</strong>`
                    : `<strong>${e(v.stateLabel)}</strong> <small>${e(v.stateNote)}${v.state.kind === 'refused' ? '' : ` (${e(v.valueText ?? '—')})`}</small>`;
            return `<li class="target-row state-${v.state.kind}">${badge(v)}<span>${body}</span></li>`;
        })
        .join('');
    return `<section class="relative-block" aria-label="So với thị trường hoặc ngành"><h3>So với đối chiếu</h3><p class="muted">Thông tin bổ sung. Không cho biết giá lên hay xuống, chỉ cho biết có vượt đối chiếu hay không.</p><ul>${items}</ul></section>`;
}

function modelNote(validation: ValidationStatus): string {
    return validation === 'VALIDATED_PROSPECTIVE'
        ? 'Đã kiểm chứng tiến cứu; vẫn có sai số.'
        : validation === 'BASELINE_ONLY'
          ? 'Mô hình không tốt hơn tần suất tăng trong quá khứ.'
          : 'Chưa có bằng chứng kiểm chứng tiến cứu đáng tin cậy. Xác suất không phải mức độ chắc chắn.';
}

/**
 * Noi dung `#probability-body`. `forecast = null` kem `error` la trang thai dang tai / loi.
 * `withDetailLink`: them lien ket "Xem du 5 ky han" (trang tong quan co, trang chi tiet khong).
 */
export function probabilityBodyHtml(
    forecast: ForecastResponse | null,
    horizon: number,
    error?: string,
    withDetailLink = true,
): string {
    const abs = forecast ? pickHorizon(forecast.horizons, horizon, TARGET_ABSOLUTE) : undefined;
    const fallback = forecast?.validationStatus ?? 'NOT_VALIDATED';
    let html: string;
    if (abs) {
        const v = describeHorizon(abs, fallback);
        // Bang chung di NGAY SAU con so, trong cung mot khoi, truoc moi thu khac. Bản thiết kế
        // §10: canh con so, khong o trang khac — va khong o cuoi trang, noi khong ai cuon toi.
        html = `<p class="target-line">${badge(v)}<small>${e(v.target.question)}</small></p>${mainBlock(abs, fallback)}${evidenceBlockHtml(abs.evidence)}`;
    } else {
        html = `<p class="panel-empty">${e(error ?? (forecast ? 'Chưa có dự báo tuyệt đối cho kỳ hạn này.' : 'Chưa có kết quả cho kỳ hạn này.'))}</p>`;
    }
    if (!forecast) return html;
    html += relativeBlock(relativeHorizons(forecast.horizons, horizon), fallback);
    const validation = abs?.validationStatus ?? forecast.validationStatus;
    const through = abs?.dataThrough ?? forecast.dataThrough;
    const old = stale(through) || abs?.predictionStatus === 'STALE';
    html += `<div class="model-note"><div><strong>${e(VALIDATION_LABELS[validation])}</strong><p>${e(modelNote(validation))}</p></div></div><p class="probability-meta">Dữ liệu tới ${e(through)}${old ? ' · Dữ liệu đã cũ' : ''}<br>Mô hình: ${e(abs?.modelVersion ?? forecast.modelVersion)}<br>Phiên đích: ${e(abs?.targetDate ?? 'Chưa xác định')}${withDetailLink ? `<br><a href="/asset/${encodeURIComponent(forecast.asset.symbol)}">Xem đủ 5 kỳ hạn ↗</a>` : ''}</p>`;
    return html;
}

/**
 * O xac suat gon (hang co phieu, the thi truong, o nganh). `snapshot` chi mang muc tieu tuyet
 * doi; neu backend tra muc tieu khac thi KHONG hien con so — thà trong con hon sai nhan.
 */
export function compactProbabilityHtml(f: SnapshotForecast | null): string {
    // Hai trang thai ma backend giu rieng: khong co dong tuyet doi (null) khac voi dong bi tu choi.
    // Khac nhau bang CHU (mau khong phai su khac biet ma nguoi doc goi ten duoc).
    if (!f) {
        return '<span class="state-label state-none" title="Chưa có dòng dự báo tuyệt đối cho tài sản này">Chưa có dự báo</span>';
    }
    if (f.targetDefinition !== TARGET_ABSOLUTE) {
        return '<span class="state-label state-refused">Không rõ mục tiêu</span>';
    }
    const v = describeHorizon(f);
    // Ban thiet ke §10: bang chung nam CANH con so — ke ca o day, noi con so chi rong mot o bang.
    //
    // Nguoi chu quet danh sach TRUOC, va hanh dong theo mot luat duy nhat ("bo qua duoi 70%, can
    // nhac tren 70%"). Mot ma nho doc 72% o day ma khong co dau hieu gi la mot quyet dinh da
    // xong truoc khi trang chi tiet kip noi "bang chung do tren nhom ma khac".
    //
    // Snapshot khong cho noi ca nhom (mot luot goi toi 100 dong), nhung no cho mot co — va cai
    // co do o day thanh mot CAU, khong phai mot mau.
    const canh_bao = outOfPopulationNoteHtml(f.evidence?.includesThisAsset);
    switch (v.state.kind) {
        case 'refused':
            return `<span class="state-label state-refused" title="${e(v.stateNote)}">${e(v.stateLabel)}</span><small class="state-number">${e(v.stateNote)}</small>`;
        case 'signal':
            return `<strong class="table-probability${f.probabilityUp! < 0.5 ? ' negative' : ''}">${e(v.valueText ?? '—')}</strong>${canh_bao}`;
        default:
            return `<span class="state-label state-${v.state.kind}">${e(v.stateLabel)}</span><small class="state-number">${e(v.valueText ?? '—')}</small>${canh_bao}`;
    }
}
