/**
 * Kieu va logic thuan cua lop admin.
 *
 * # Vi sao tach khoi `admin.ts`
 *
 * `admin.ts` import `astro:env/server`, nen no chi ton tai trong runtime cua Astro — test
 * khong load duoc no. Nhung `jobCanhBao` la cho logic nghiep vu dang nam, va do la cho CAN
 * test nhat.
 *
 * Tach ra con dung huong tach lop: danh sach loai job va cach doc `stats` khong phu thuoc vao
 * chuyen ai goi HTTP nhu the nao.
 */

/** Ten cookie giu access token. */
export const TOKEN_COOKIE = 'merix_at';
/** Ten cookie giu refresh token. */
export const REFRESH_COOKIE = 'merix_rt';

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/** Trang phan trang cua CRUD generic. */
export interface Page<T> {
    edges: { node: T; cursor: string }[];
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        totalCount: number | null;
        totalPage: number | null;
        totalIsEstimate?: boolean;
    };
}

export interface JobRun {
    jobRunId: number;
    jobType: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    requestedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    attempts: number;
    stats: Record<string, unknown> | null;
    lastError: string | null;
}

export interface Alert {
    alertId: number;
    severity: string;
    code: string;
    message: string;
    assetId: number | null;
    jobRunId: number | null;
    createdAt: string;
    acknowledgedAt: string | null;
}

export interface ValidationRun {
    validationRunId: number;
    modelVersionId: number;
    periodFrom: string;
    periodTo: string;
    /**
     * So du bao THO da cham, CHUA ghep cap voi baseline. **Khong phai bang chung.**
     *
     * 1.700 ma du bao trong cung mot phien chia nhau MOT cu soc thi truong, nen con so nay lon
     * hon luong bang chung that hang nghin lan. No chi dung cho dung mot viec: no la con so ma
     * nguong `NOT_VALIDATED` so sanh. Hien thi no mot minh la noi qua - no phai dung canh
     * `soPhienDocLap`.
     */
    nForecasts: number;
    /**
     * Mau so THAT cua khoang tin cay: so phien doc lap (`S/h`). `null` = khong do duoc khoang.
     *
     * Day la con so tra loi "co bao nhieu bang chung". Tren du lieu that no nho hon `nForecasts`
     * hang nghin lan.
     */
    soPhienDocLap: number | null;
    /**
     * So cau hinh da thu trong cung ho gia thuyet, dem ngay truoc khi ket luan (da gom ca cau
     * hinh cua chinh dong nay). Khoang tin cay duoc noi ra theo con so nay (Holm).
     */
    trialsBefore: number;
    /** Khoang tren dong nay DA BI NOI RA so voi khoang tho chua. */
    ciAdjusted: boolean;
    /**
     * O cua dong nay co nam trong tap quyet dinh dang ky truoc khong. `false` = tham do: con so
     * van dung duoc, nhung chon chinh no de ket luan la chon sau khi da nhin ket qua.
     */
    oQuyetDinh: boolean;
    brier: number | null;
    brierSkillPercent: number | null;
    /**
     * Khoang tin cay 95% cua skill.
     *
     * Day la cot quyet dinh, khong phai cot trang tri: `validationStatus` duoc gan theo
     * `brierSkillCiLow > 0`, khong theo `brierSkillPercent > 0`. Do duoc tren du lieu that: dung
     * diem uoc luong thi 10 mo hinh duoc goi la da kiem chung; dung khoang thi con **1**.
     */
    brierSkillCiLow: number | null;
    brierSkillCiHigh: number | null;
    logLoss: number | null;
    accuracy: number | null;
    /** ADR-010: ty le lien ket nganh la suy doan. Bat buoc hien thi. */
    inferredMembershipRatio: string | null;
    notes: string | null;
    createdAt: string;
}

export interface ModelVersion {
    modelVersionId: number;
    code: string;
    family: string;
    assetLevel: string;
    horizonSessions: number;
    featureSetVersion: string;
    status: string;
    validationStatus: string;
    trainedThrough: string | null;
}

export const STATUS_LABELS: Record<JobRun['status'], string> = {
    PENDING: 'Đang chờ',
    RUNNING: 'Đang chạy',
    SUCCEEDED: 'Thành công',
    FAILED: 'Thất bại',
    CANCELLED: 'Đã huỷ',
};

/**
 * Mot job `SUCCEEDED` co the van co van de — `stats` cua no mang so ma loi.
 *
 * Day la phat hien ADR-026: mot job di het 1.754 ma voi 95% ma loi van ket thuc `SUCCEEDED`, va
 * so ma loi nam trong `stats` ma khong ai doc `stats` cua job thanh cong. Nen trang admin phai
 * **tu doc** `stats` va noi ra.
 */
export function jobCanhBao(j: JobRun): string | null {
    if (j.status === 'FAILED' || j.status === 'CANCELLED') return null;
    const s = j.stats;
    if (!s) return null;

    const phan: string[] = [];
    const soCua = (k: string): number => {
        const v = s[k];
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    };
    const failed = soCua('failed');
    const empty = soCua('empty');
    const skipped = soCua('skipped');
    const abstained = soCua('abstained');
    const live = soCua('live');

    if (failed > 0) phan.push(`${failed} mã lỗi`);
    if (empty > 0) phan.push(`${empty} mã nguồn trả rỗng`);
    if (skipped > 0) phan.push(`${skipped} mã bị bỏ qua`);
    // Toàn bộ abstain mà không có dòng nào phát được: job "thành công" mà không ra sản phẩm.
    if (abstained > 0 && live === 0) phan.push(`${abstained} dự báo abstain, 0 phát được`);

    return phan.length > 0 ? phan.join(' · ') : null;
}

/**
 * Loai job co the xep tay tu trang admin.
 *
 * Danh sach nay **duoc test doi chieu voi `contracts/openapi.json`** (hop dong sinh tu backend, schema `JobType`).
 * Backend co test tuong ung doi chieu `JobType` voi danh sach handler. Chep tay giua nhieu noi thi hai ben lech nhau ma test van xanh, va trang
 * admin se gui mot loai job ma backend tu choi.
 */
export const JOB_TYPES = [
    'INGEST_UNIVERSE',
    'INGEST_PRICE',
    'INGEST_CORPORATE_ACTIONS',
    'INGEST_INDUSTRY',
    'REBUILD_CALENDAR',
    'BUILD_SECTOR_INDEX',
    'COMPUTE_FEATURE',
    'COMPUTE_FORECAST',
    'EVALUATE_FORECAST',
    'RUN_VALIDATION',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

/** Mo ta ngan tung loai job, de nguoi van hanh khong phai doan tu ten. */
export const JOB_DESCRIPTIONS: Record<JobType, string> = {
    INGEST_UNIVERSE: 'Đồng bộ danh sách mã niêm yết',
    INGEST_PRICE: 'Nạp giá OHLCV (chia lô theo ngày)',
    INGEST_CORPORATE_ACTIONS: 'Nạp sự kiện quyền',
    INGEST_INDUSTRY: 'Đồng bộ phân ngành',
    REBUILD_CALENDAR: 'Dựng lại lịch phiên từ dữ liệu giá',
    BUILD_SECTOR_INDEX: 'Dựng chỉ số ngành (bình quân đều)',
    COMPUTE_FEATURE: 'Tính đặc trưng và ghi bảng gold',
    COMPUTE_FORECAST: 'Chạy dự báo cho toàn bộ engine × kỳ hạn',
    EVALUATE_FORECAST: 'Đối chiếu dự báo đã đáo hạn với kết quả thật',
    RUN_VALIDATION: 'Tổng hợp Brier / skill theo phiên bản mô hình',
};

export interface DataSource {
    sourceId: number;
    code: string;
    displayName: string;
    baseUrl: string;
    licenceNote: string;
    priority: number;
    rateLimitPerMin: number;
    enabled: boolean;
    updatedAt: string;
}

/**
 * Brier skill tinh theo phan tram, so sanh voi du bao khi hau.
 *
 * Tra `null` khi chua do duoc. **Khong** tra 0: 0 co nghia "khong hon khi hau", va do la mot ket
 * luan that, khac han voi "chua biet".
 */
export function skillLabel(v: number | null): string | null {
    if (v === null || !Number.isFinite(v)) return null;
    const dau = v > 0 ? '+' : '';
    return `${dau}${v.toFixed(2)}%`;
}
