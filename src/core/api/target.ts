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
import type { AbstainReason, HorizonForecast, TargetDefinition, ValidationStatus } from './types';
import { ABSTAIN_LABELS, VALIDATION_LABELS } from './types';
import { percent } from './market';

export const TARGET_ABSOLUTE: TargetDefinition = 'LOG_RETURN_ABSOLUTE_TOTAL_RETURN';
export const TARGET_RELATIVE_MARKET: TargetDefinition = 'LOG_RETURN_RELATIVE_TO_MARKET';
export const TARGET_RELATIVE_SECTOR: TargetDefinition = 'LOG_RETURN_RELATIVE_TO_SECTOR';

/** Ky han (phien) ma man hinh tong quan hien mac dinh. Ghi tuong minh vi backend mac dinh la 5. */
export const DEFAULT_HORIZON = 21;

/**
 * TAM THOI — nua be rong cua dai "khong co tin hieu" quanh 50%.
 *
 * Mot xac suat nam trong `[0.5 - NO_SIGNAL_BAND, 0.5 + NO_SIGNAL_BAND]` duoc coi la khong phan
 * biet duoc voi tung dong xu.
 *
 * Gia tri 0.03 CHUA CO CO SO THONG KE: no la mot con so de giao dien co the noi "khong co tin
 * hieu" ngay tu bay gio. Giai doan 2 se do duoc (vi du do phan giai thuc te cua cac cum xac
 * suat tren tap kiem chung) va thay hang so nay bang dai suy tu so do. Khi do chi sua DUY NHAT
 * o day — khong khai bao lai o cho khac.
 */
export const NO_SIGNAL_BAND = 0.03;

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
}

export type DisplayState =
    /** Tu choi: engine noi ro khong phat du bao (co the co ly do). */
    | { kind: 'refused'; reason: AbstainReason | null }
    /** Co con so nhung mo hinh chua duoc kiem chung: con so chua co co so. */
    | { kind: 'no-basis' }
    /** Mo hinh da kiem chung, con so nam trong dai khong phan biet duoc voi tung dong xu. */
    | { kind: 'no-signal' }
    | { kind: 'signal' };

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
    if (!VALIDATED.has(validation)) return { kind: 'no-basis' };
    if (Math.abs(p - 0.5) <= NO_SIGNAL_BAND) return { kind: 'no-signal' };
    return { kind: 'signal' };
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
            stateNote = `Mô hình ở trạng thái “${VALIDATION_LABELS[validation]}”: chưa có cơ sở để tin con số này.`;
            break;
        case 'no-signal':
            stateLabel = 'Không có tín hiệu';
            stateNote = `Con số nằm trong vùng ±${Math.round(NO_SIGNAL_BAND * 100)} điểm quanh 50%, không phân biệt được với tung đồng xu.`;
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
