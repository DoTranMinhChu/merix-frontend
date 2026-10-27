/**
 * "Con so nay dang noi ve cai gi" — noi DUY NHAT quyet dinh cach goi ten mot xac suat.
 *
 * # Loi goc cua ca chuong trinh
 *
 * Engine cap co phieu tung tra loi "co phieu co thang nganh khong?", con giao dien in con so do
 * duoi chu "xac suat tang". Co phieu giam 2% trong luc nganh giam 5% la du bao DUNG theo engine
 * va trong SAI theo nguoi dung. Moi cap tai san nay co hai engine voi `targetDefinition` khac
 * nhau, nen mot ky han co the xuat hien hai lan — va moi cho chon dong hay dat ten deu phai di
 * qua day, de khong cho nao tu y gan "tang" len mot con so tuong doi.
 *
 * # Quy tac
 *
 * - Mac dinh la muc tieu TUYET DOI. Muc tieu tuong doi chi la thong tin bo sung, co nhan rieng.
 * - Khong bao gio hien con so tuong doi duoi chu nghia la "xac suat tang".
 * - Ba trang thai phai phan biet duoc tren man hinh: tu choi / chua co co so / khong co tin hieu.
 *
 * Module nay khong cham DOM va khong goi API, nen test duoc bang gia tri cu the.
 */
import type {
    AbstainReason,
    HorizonForecast,
    SkillInterval,
    TargetDefinition,
    ValidationStatus,
} from './types';
import { ABSTAIN_LABELS, VALIDATION_LABELS } from './types';
import { percent } from './market';

/**
 * Ba gia tri cua `targetDefinition`.
 *
 * Hop dong (`contracts/openapi.json`, sinh tu backend) nay khai chung thanh mot `enum`, nen
 * `types.test.ts` doi chieu DUNG ba hang nay VA cac khoa cua `TARGET_LABELS` voi enum do. TypeScript
 * khong suy duoc kieu literal tu mot file JSON nhap vao, nen day van la ba literal viet tay — nhung
 * chung khong con co the troi ma khong ai thay.
 */
export const TARGET_ABSOLUTE: TargetDefinition = 'LOG_RETURN_ABSOLUTE_TOTAL_RETURN';
export const TARGET_RELATIVE_MARKET: TargetDefinition = 'LOG_RETURN_RELATIVE_TO_MARKET';
export const TARGET_RELATIVE_SECTOR: TargetDefinition = 'LOG_RETURN_RELATIVE_TO_SECTOR';

/**
 * Ky han (phien) ma man hinh tong quan hien mac dinh.
 *
 * Bang 5, dung bang `merix_forecast::market_api::DEFAULT_HORIZON` cua backend. Truoc day la 21,
 * va day la mot mau thuan that chu khong phai chuyen thi hieu:
 *
 * - Uu tien chu so huu phat bieu ro la "ngay mai va tuan nay". 21 phien la mot thang giao dich.
 * - Do phu khac nhau: o h=21 chi 996/1518 co phieu co mot con so; o h=5 la 1188. Ky han hien
 *   dau tien khong duoc dong thoi la ky han khong ai hoi VA ky han tra loi "khong" cho mot phan
 *   ba thi truong.
 *
 * Doi o day la doi MOI noi: `dashboard.ts`, `Probability.astro`, `asset.ts` va `index.astro` deu
 * doc hang nay. Con so 21 con lai trong ma nguon la do DAI BIEU DO (`PriceChart.astro`) va nhan
 * ky han (`types.ts`) — hai thu khac, khong phai mac dinh cua man hinh.
 */
export const DEFAULT_HORIZON = 5;

/**
 * Nua be rong cua dai "khong co tin hieu" quanh 50%, SUY TU SO DO cua chinh bo ba do.
 *
 * Giai doan 1 de lai o day mot hang so tam `NO_SIGNAL_BAND = 0.03` kem ghi chu "chua co co so
 * thong ke". Giai doan 2 do duoc khoang tin cay Brier skill cho tung o `(muc tieu, cap, ky han)`,
 * nen hang so do da bi xoa va thay bang ham nay.
 *
 * # Suy ra the nao
 *
 * Bon buoc, khong buoc nao la mot con so chon tay:
 *
 * 1. Brier skill la mot ty le tren Brier cua baseline: `skill = 1 − B/B₀`. Nen mot thay doi
 *    `w` diem phan tram cua skill ung voi mot thay doi `B₀·w/100` cua chinh Brier.
 * 2. Phan ra Murphy: mot du bao HIEU CHINH DUNG lech `d` khoi `0,5` cai thien Brier dung `d²`
 *    (phan "do phan giai"). Nen mot do lech `d` dang tuyen bo mot cai thien Brier co kich thuoc
 *    `d²`.
 * 3. Khoang tin cay skill rong `w` diem phan tram nghia la chinh phep do Brier chi biet toi do
 *    bat dinh `B₀·w/100`; nua be rong la `B₀·w/200`.
 * 4. Do lech `d` chim trong nhieu khi `d² ≤ B₀·w/200`, tuc `d ≤ √(B₀·w/200)`.
 *
 * # Vi sao thay `B₀` bang `0,25`, va vi sao phep thay the do an toan
 *
 * `B₀` khong di theo API (no la Brier cua baseline `history`, khong phai mot truong cua
 * `HorizonEvidence`). Thay no bang `0,25` KHONG phai mot con so chon tay: `0,25` la **can tren**
 * cua Brier moi baseline co hieu chinh dung, vi `p̄(1−p̄) ≤ 0,25` voi moi ty le nen `p̄`. Nen
 * phep thay the nay chi co the lam dai **rong hon** — tuc kho tuyen bo tin hieu hon — chu khong
 * bao gio hep hon. Do la huong duy nhat duoc phep di theo rang buoc cua giai doan 2.
 *
 * Ket qua: `band = 0,5·√(w/200)`.
 *
 * # Huong bien thien, va vi sao no la huong dung
 *
 * `w` lon hon — phep do kem chinh xac hon — cho dai RONG hon, tuc kho tuyen bo "co tin hieu"
 * hon. Mot phep do vo vong (`w ≥ 200` diem) cho dai `0,5`, tuc ca dai xac suat deu la nhieu.
 * Day khong con la mot nguong ai do chon; no la he qua cua chinh con so da do.
 *
 * # Khong do duoc thi KHONG CO DAI
 *
 * Tra `null`, va `classify` khi do tra "chua co co so" kem ly do. KHONG co gia tri roi ve: mot
 * dai mac dinh la dung lai hang so tam duoi mot cai ten khac, va no se noi "co tin hieu" cho mot
 * con so chua tung duoc do.
 */
export function noSignalBand(e: SkillInterval | null | undefined): number | null {
    const lo = e?.ciLow;
    const hi = e?.ciHigh;
    if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const rong = hi - lo;
    // `rong === 0` la khong co do bat dinh nao — khong the ra tu mot phep do that, nen no la du
    // lieu hong chu khong phai mot dai hep bang 0.
    if (!(rong > 0)) return null;
    return Math.min(0.5, 0.5 * Math.sqrt(rong / 200));
}

export interface TargetInfo {
    /** Ten ngan, hien trong huy hieu. */
    name: string;
    /** Cau hoi ma con so tra loi. */
    question: string;
    /** Ten cua con so — thay cho "Xac suat tang" o muc tieu tuong doi. */
    headline: string;
    /** Phan bu cua con so. */
    complement: string;
    /** Lop CSS cho huy hieu: ba muc tieu phai khac nhau bang mat. */
    css: 'target-absolute' | 'target-market' | 'target-sector' | 'target-unknown';
}

export const TARGET_LABELS: Record<TargetDefinition, TargetInfo> = {
    LOG_RETURN_ABSOLUTE_TOTAL_RETURN: {
        name: 'Giá tuyệt đối',
        question: 'Giá có tăng không?',
        headline: 'Xác suất tăng',
        complement: 'Không tăng',
        css: 'target-absolute',
    },
    LOG_RETURN_RELATIVE_TO_MARKET: {
        name: 'So với thị trường',
        question: 'Có vượt thị trường không?',
        headline: 'Xác suất vượt thị trường',
        complement: 'Không vượt thị trường',
        css: 'target-market',
    },
    LOG_RETURN_RELATIVE_TO_SECTOR: {
        name: 'So với ngành',
        question: 'Có vượt ngành không?',
        headline: 'Xác suất vượt ngành',
        complement: 'Không vượt ngành',
        css: 'target-sector',
    },
};

/** Dinh nghia la (backend them engine moi ma giao dien chua biet): noi that, khong doan. */
const TARGET_UNKNOWN: TargetInfo = {
    name: 'Mục tiêu chưa rõ',
    question: 'Chưa rõ con số này trả lời câu hỏi nào',
    headline: 'Xác suất (mục tiêu chưa rõ)',
    complement: 'Phần bù',
    css: 'target-unknown',
};

export function targetInfo(t: string): TargetInfo {
    return (TARGET_LABELS as Record<string, TargetInfo | undefined>)[t] ?? TARGET_UNKNOWN;
}

/**
 * Chon dong dung muc tieu cho mot ky han. `target` mac dinh la TUYET DOI.
 *
 * Tuong minh thay cho "dong dau tien khop ky han": truoc day dong tuyet doi duoc chon chi vi
 * `LOG_RETURN_ABSOLUTE...` xep truoc `LOG_RETURN_RELATIVE...` theo bang chu cai. Thieu dong
 * tuyet doi thi tra `undefined` — KHONG rot sang dong tuong doi.
 */
export function pickHorizon<T extends { horizonSessions: number; targetDefinition: string }>(
    horizons: readonly T[],
    horizon: number,
    target: TargetDefinition = TARGET_ABSOLUTE,
): T | undefined {
    return horizons.find((h) => h.horizonSessions === horizon && h.targetDefinition === target);
}

/** Cac dong KHAC muc tieu tuyet doi cua mot ky han, theo thu tu on dinh (thi truong roi nganh). */
export function relativeHorizons<T extends { horizonSessions: number; targetDefinition: string }>(
    horizons: readonly T[],
    horizon: number,
): T[] {
    const order: string[] = [TARGET_RELATIVE_MARKET, TARGET_RELATIVE_SECTOR];
    return horizons
        .filter((h) => h.horizonSessions === horizon && h.targetDefinition !== TARGET_ABSOLUTE)
        .sort((a, b) => order.indexOf(a.targetDefinition) - order.indexOf(b.targetDefinition));
}

/** Phan chung cua mot du bao ky han va mot du bao trong snapshot. */
export interface ForecastLike {
    targetDefinition: string;
    predictionStatus: HorizonForecast['predictionStatus'];
    probabilityUp: number | null;
    probabilityNotUp?: number | null;
    abstainReason: AbstainReason | null;
    validationStatus?: ValidationStatus;
    /** Bang chung cua chinh dong nay. Chi hai bien khoang tin cay duoc dung o day. */
    evidence?: SkillInterval | null;
}

export type DisplayState =
    /** Tu choi: engine noi ro khong phat du bao (co the co ly do). */
    | { kind: 'refused'; reason: AbstainReason | null }
    /**
     * Co con so nhung khong co co so de tin no. Hai duong vao, va chung phai phan biet duoc vi
     * cach xu ly giong nhau nhung ly do noi voi nguoi doc khac han:
     *
     * - `chua-kiem-chung` — mo hinh o trang thai khong cho phep tin con so.
     * - `khong-suy-duoc-dai` — da kiem chung, nhung khong co khoang tin cay nen khong biet dai
     *   "khong co tin hieu" rong bao nhieu. Khong co dai thi khong noi duoc con so nay co khac
     *   50% hay khong, nen khong duoc goi no la tin hieu.
     */
    | { kind: 'no-basis'; why: 'chua-kiem-chung' | 'khong-suy-duoc-dai' }
    /** Mo hinh da kiem chung, con so nam trong dai khong phan biet duoc voi tung dong xu. */
    | { kind: 'no-signal'; band: number }
    | { kind: 'signal'; band: number };

const VALIDATED: ReadonlySet<ValidationStatus> = new Set<ValidationStatus>([
    'VALIDATED_EXPLORATORY',
    'VALIDATED_PROSPECTIVE',
]);

/**
 * Phan loai theo thu tu uu tien: tu choi > chua co co so > khong co tin hieu > co tin hieu.
 *
 * `BASELINE_ONLY` va `DEGRADED` cung la "chua co co so": mot mo hinh khong hon tan suat lich su,
 * hoac dang troi hieu chuan, khong cho phep tin con so cua no. Thieu `validationStatus` duoc coi
 * la chua kiem chung (than trong).
 */
export function classify(f: ForecastLike, fallbackValidation?: ValidationStatus): DisplayState {
    const p = f.probabilityUp;
    if (
        f.predictionStatus === 'ABSTAINED' ||
        f.predictionStatus === 'UNAVAILABLE' ||
        p === null ||
        !Number.isFinite(p) ||
        p < 0 ||
        p > 1
    ) {
        return { kind: 'refused', reason: f.abstainReason };
    }
    const validation = f.validationStatus ?? fallbackValidation ?? 'NOT_VALIDATED';
    if (!VALIDATED.has(validation)) return { kind: 'no-basis', why: 'chua-kiem-chung' };
    const band = noSignalBand(f.evidence);
    if (band === null) return { kind: 'no-basis', why: 'khong-suy-duoc-dai' };
    if (Math.abs(p - 0.5) <= band) return { kind: 'no-signal', band };
    return { kind: 'signal', band };
}

export interface HorizonView {
    target: TargetInfo;
    state: DisplayState;
    /** Ten cua con so, vd "Xac suat tang" hoac "Xac suat vuot nganh". */
    headline: string;
    complementLabel: string;
    /** `null` khi tu choi. Voi hai trang thai "yeu" van co so, nhung giao dien phai lam mo no. */
    valueText: string | null;
    complementText: string | null;
    /** Nhan cua trang thai; rong khi `signal`. */
    stateLabel: string;
    /** Giai thich ngan cua trang thai. */
    stateNote: string;
}

export function describeHorizon(f: ForecastLike, fallbackValidation?: ValidationStatus): HorizonView {
    const target = targetInfo(f.targetDefinition);
    const state = classify(f, fallbackValidation);
    const validation = f.validationStatus ?? fallbackValidation ?? 'NOT_VALIDATED';
    let stateLabel = '';
    let stateNote = '';
    switch (state.kind) {
        case 'refused':
            stateLabel = 'Không phát dự báo';
            stateNote = state.reason ? ABSTAIN_LABELS[state.reason] : 'Không rõ lý do';
            break;
        case 'no-basis':
            stateLabel = 'Chưa có cơ sở';
            stateNote =
                state.why === 'khong-suy-duoc-dai'
                    ? 'Chưa đo được khoảng tin cậy cho kỳ hạn này, nên chưa biết con số phải lệch bao nhiêu khỏi 50% mới đáng kể. Không có dải thì không gọi được đây là tín hiệu.'
                    : `Mô hình ở trạng thái “${VALIDATION_LABELS[validation]}”: chưa có cơ sở để tin con số này.`;
            break;
        case 'no-signal':
            stateLabel = 'Không có tín hiệu';
            stateNote = `Con số nằm trong vùng ±${(state.band * 100).toFixed(1).replace('.', ',')} điểm quanh 50% — dải suy từ khoảng tin cậy đo được của chính kỳ hạn này, nên chưa phân biệt được với tung đồng xu.`;
            break;
        case 'signal':
            break;
    }
    const refused = state.kind === 'refused';
    return {
        target,
        state,
        headline: target.headline,
        complementLabel: target.complement,
        valueText: refused ? null : percent(f.probabilityUp),
        complementText: refused ? null : percent(f.probabilityNotUp ?? null),
        stateLabel,
        stateNote,
    };
}
