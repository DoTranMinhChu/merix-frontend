/**
 * Kieu du lieu khop API THAT cua main-service.
 *
 * # Phase 1 viet bang phong doan, Phase 4 sua theo thuc te
 *
 * Ban Phase 1 doan `asset` la ban ghi day du va `level` la chu thuong; API that tra mot tham
 * chieu gon (`AssetRef`) voi `level` SCREAMING_SNAKE theo ADR-019. `DataStatus` cung khac han.
 * Giu lai ghi chu nay de lan sau nho: kieu viet tay theo phong doan se lech, va cho no lech im
 * lang la cach de trang hien `undefined`.
 *
 * Doi chieu that nam o `src/core/api/types.test.ts` — no doc truc tiep
 * `contracts/openapi.json` (sinh tu backend) nen hai ben khong the lech nhau ma van xanh.
 */

/** Cap tai san. SCREAMING_SNAKE theo ADR-019, khop enum `asset_level` cua Postgres. */
export type AssetLevel = 'MARKET' | 'SECTOR' | 'STOCK';

export type ValidationStatus =
    | 'NOT_VALIDATED'
    | 'BASELINE_ONLY'
    | 'VALIDATED_EXPLORATORY'
    | 'VALIDATED_PROSPECTIVE'
    | 'DEGRADED';

export type PredictionStatus = 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'ABSTAINED';

export type AbstainReason =
    | 'INSUFFICIENT_HISTORY'
    | 'LOW_COVERAGE'
    | 'INSUFFICIENT_TRAINING_DATA'
    | 'PENDING_CORPORATE_ACTION'
    | 'CALIBRATION_DEGRADED'
    | 'TARGET_SESSION_UNKNOWN'
    | 'NO_PARENT_SERIES'
    | 'TARGET_AXIS_MISMATCH';

/**
 * Con so `probabilityUp` tra loi cau hoi nao. Chuoi chinh xac cua backend (`merix_plugins::engines`).
 * Hop dong khai no la `string` tu do, nen day la kieu viet tay; gia tri la khong biet thi
 * `describeHorizon` (target.ts) khong duoc noi "xac suat tang".
 */
export type TargetDefinition =
    | 'LOG_RETURN_ABSOLUTE_TOTAL_RETURN'
    | 'LOG_RETURN_RELATIVE_TO_MARKET'
    | 'LOG_RETURN_RELATIVE_TO_SECTOR';

/** Tham chieu tai san trong phan hoi du bao. Gon hon ban ghi `asset` day du. */
export interface AssetRef {
    level: AssetLevel;
    symbol: string;
    name: string;
    exchange: string | null;
}

export interface HorizonForecast {
    horizonSessions: number;
    /** Mot ky han co the xuat hien HAI lan voi muc tieu khac nhau; luon chon theo ca hai. */
    targetDefinition: TargetDefinition;
    /** Per-horizon evidence; optional while older API servers are upgraded. */
    asOf?: string;
    dataThrough?: string;
    modelVersion?: string;
    validationStatus?: ValidationStatus;
    predictionStatus: PredictionStatus;
    /** `null` khi khong phat duoc. KHONG BAO GIO la 0.5 de thay cho "khong biet". */
    probabilityUp: number | null;
    /** PHAN BU cua `probabilityUp`, **gom ca gia di ngang**. Khong phai xac suat giam. */
    probabilityNotUp: number | null;
    targetDate: string | null;
    abstainReason: AbstainReason | null;
}

export interface ForecastResponse {
    asset: AssetRef;
    asOf: string;
    dataThrough: string;
    /** `{ho mo hinh}.{phien ban tap feature}` — phan dung chung cho moi ky han. */
    modelVersion: string;
    validationStatus: ValidationStatus;
    disclaimer: string;
    horizons: HorizonForecast[];
}

export interface DataStatus {
    latestTradingDate: string | null;
    /** So ngay lich tu phien moi nhat toi hom nay. Lon nghia la du lieu dang cu. */
    lagDays: number | null;
    assetsWithPrices: number;
    priceRows: number;
    latestForecastAt: string | null;
    liveForecasts: number;
    abstainedForecasts: number;
    /** Dang `"229/1754"` — ty le that, khong phai phan tram lam tron. */
    corporateActionCoverage: string;
    featureSetVersion: string;
    disclaimer: string;
}

/** Du lieu cu hon nguong nay thi trang phai noi ro. */
export const STALE_LAG_DAYS = 5;

/** Nhan tieng Viet cho ky han, tinh bang PHIEN chu khong phai ngay lich. */
export const HORIZON_LABELS: Record<number, string> = {
    1: 'Phiên tới',
    5: '1 tuần',
    21: '1 tháng',
    63: '1 quý',
    252: '1 năm',
};

/**
 * Chi `VALIDATED_PROSPECTIVE` moi duoc mien canh bao.
 *
 * Khop `ValidationStatus::requires_warning` o Rust. Moi trang thai khac deu phai co canh bao
 * nhin thay duoc — rang buoc "khong hien xac suat tu tin khi chua kiem chung" cua de bai.
 */
export function requiresWarning(s: ValidationStatus): boolean {
    return s !== 'VALIDATED_PROSPECTIVE';
}

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
    NOT_VALIDATED: 'Chưa kiểm chứng',
    BASELINE_ONLY: 'Không hơn baseline',
    VALIDATED_EXPLORATORY: 'Kiểm chứng sơ bộ',
    VALIDATED_PROSPECTIVE: 'Đã kiểm chứng',
    DEGRADED: 'Calibration bị trôi',
};

export const ABSTAIN_LABELS: Record<AbstainReason, string> = {
    INSUFFICIENT_HISTORY: 'Chưa đủ lịch sử giá',
    LOW_COVERAGE: 'Dữ liệu không đủ đầy đủ',
    INSUFFICIENT_TRAINING_DATA: 'Chưa đủ quan sát độc lập',
    PENDING_CORPORATE_ACTION: 'Đang chờ đồng bộ sự kiện doanh nghiệp',
    CALIBRATION_DEGRADED: 'Calibration bị trôi',
    TARGET_SESSION_UNKNOWN: 'Chưa xác định được phiên đích',
    NO_PARENT_SERIES: 'Chưa có chuỗi đối chiếu (thị trường/ngành) để so sánh',
    TARGET_AXIS_MISMATCH: 'Chuỗi đối chiếu lệch trục thời gian với tài sản',
};

export const LEVEL_LABELS: Record<AssetLevel, string> = {
    MARKET: 'Thị trường',
    SECTOR: 'Ngành',
    STOCK: 'Cổ phiếu',
};

/**
 * Hien thi xac suat.
 *
 * `null` KHONG duoc hien thanh "50%" hay "0%" — tra ve `null` de cho goi tu quyet dinh cach noi
 * "khong co so". Day la rang buoc nghiep vu, khong phai lua chon thiet ke.
 */
export function formatProbability(p: number | null): string | null {
    if (p === null || !Number.isFinite(p)) return null;
    return `${(p * 100).toFixed(1)}%`;
}

/** Nhan ky han, co ghi ro so phien de "1 thang" khong bi hieu la thang duong lich. */
export function horizonLabel(h: number): string {
    const label = HORIZON_LABELS[h];
    return label ? `${label} (${h} phiên)` : `${h} phiên`;
}
