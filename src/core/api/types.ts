/**
 * Kieu du lieu khop shared/contracts/openapi.yaml.
 *
 * Phase 1 viet tay. Phase 4 se sinh tu dong tu openapi.yaml va co kiem tra drift trong CI —
 * giong cach boilerplate cua anh lam voi GraphQL schema.
 */

export type AssetLevel = 'market' | 'sector' | 'stock';

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
    | 'TARGET_SESSION_UNKNOWN';

export interface Asset {
    assetId: number;
    level: AssetLevel;
    symbol: string;
    name: string;
    exchange: string | null;
    currency: string;
    icbCode: string | null;
    status: 'ACTIVE' | 'SUSPENDED' | 'DELISTED';
    listedFrom: string | null;
    listedTo: string | null;
}

export interface HorizonForecast {
    horizonSessions: 1 | 5 | 21 | 63 | 252;
    predictionStatus: PredictionStatus;
    /** Null khi predictionStatus khong phai LIVE/STALE. */
    probabilityUp: number | null;
    /** PHAN BU cua probabilityUp, gom ca gia di ngang. KHONG phai xac suat giam. */
    probabilityNotUp: number | null;
    targetDate: string | null;
    abstainReason: AbstainReason | null;
}

export interface ForecastResponse {
    asset: Asset;
    asOf: string;
    dataThrough: string;
    modelVersion: string;
    validationStatus: ValidationStatus;
    disclaimer: string;
    horizons: HorizonForecast[];
}

export interface DataStatus {
    latestTradingDate: string | null;
    latestIngestAt: string | null;
    latestComputeAt: string | null;
    sessionsBehind: number;
    isStale: boolean;
    disclaimer: string;
    sources: { code: string; enabled: boolean; lastSuccessAt: string | null }[];
}

/** Nhan tieng Viet cho ky han, tinh bang PHIEN chu khong phai ngay lich. */
export const HORIZON_LABELS: Record<number, string> = {
    1: 'Phien toi',
    5: '1 tuan',
    21: '1 thang',
    63: '1 quy',
    252: '1 nam',
};

/** Chi VALIDATED_PROSPECTIVE moi duoc mien canh bao. Khop ValidationStatus::requires_warning o Rust. */
export function requiresWarning(s: ValidationStatus): boolean {
    return s !== 'VALIDATED_PROSPECTIVE';
}

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
    NOT_VALIDATED: 'Chua kiem chung',
    BASELINE_ONLY: 'Chi co baseline',
    VALIDATED_EXPLORATORY: 'Kiem chung so bo',
    VALIDATED_PROSPECTIVE: 'Da kiem chung',
    DEGRADED: 'Calibration bi troi',
};

export const ABSTAIN_LABELS: Record<AbstainReason, string> = {
    INSUFFICIENT_HISTORY: 'Chua du lich su gia',
    LOW_COVERAGE: 'Du lieu khong du day du',
    INSUFFICIENT_TRAINING_DATA: 'Chua du mau huan luyen',
    PENDING_CORPORATE_ACTION: 'Dang cho dong bo su kien doanh nghiep',
    CALIBRATION_DEGRADED: 'Calibration bi troi',
    TARGET_SESSION_UNKNOWN: 'Chua xac dinh duoc phien dich',
};
