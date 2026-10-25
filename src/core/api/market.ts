import type {
  AssetLevel,
  ForecastResponse,
  PredictionStatus,
  ValidationStatus,
  AbstainReason,
  TargetDefinition,
} from "./types";
export interface PricePoint {
  date: string;
  close: number;
  volume: number | null;
}
export interface SnapshotForecast {
  /** Snapshot chi bao muc tieu tuyet doi; truong nay de giao dien kiem lai chu khong gia dinh. */
  targetDefinition: TargetDefinition;
  probabilityUp: number | null;
  probabilityNotUp: number | null;
  predictionStatus: PredictionStatus;
  validationStatus: ValidationStatus;
  abstainReason: AbstainReason | null;
  dataThrough: string;
  asOf: string;
  modelVersion: string;
}
export interface MarketAsset {
  assetId: number;
  symbol: string;
  name: string;
  level: AssetLevel;
  exchange: string | null;
  sector: string | null;
  currency: string;
  prices: PricePoint[];
  forecast: SnapshotForecast | null;
}
export interface MarketSnapshot {
  items: MarketAsset[];
  nextCursor: number | null;
  horizonSessions: number;
  disclaimer: string;
}
export interface MarketSeries {
  symbol: string;
  level: AssetLevel;
  currency: string;
  prices: PricePoint[];
}
export interface WorkspaceData {
  markets: MarketAsset[];
  sectors: MarketAsset[];
  stocks: MarketSnapshot | null;
  series: MarketSeries | null;
  forecast: ForecastResponse | null;
  selected: string;
  errors: string[];
  search: string;
  sector: string;
  stockError: string | null;
}
export const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
export const percent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `${(value * 100).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export function priceChange(prices: PricePoint[]): number | null {
  if (prices.length < 2) return null;
  const previous = prices.at(-2)!.close;
  return previous > 0 ? prices.at(-1)!.close / previous - 1 : null;
}
export function stale(
  date: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!date) return true;
  const time = Date.parse(date);
  return !Number.isFinite(time) || now - time > 5 * 86400000;
}
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function chartGeometry(points: PricePoint[], width = 720, height = 210) {
  const valid = points.filter((p) => Number.isFinite(p.close) && p.close > 0);
  if (valid.length < 2) return null;
  const values = valid.map((p) => p.close);
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.002);
  const min = lo - pad,
    max = hi + pad;
  const positions = valid.map((p, i) => ({
    x: (i / (valid.length - 1)) * width,
    y: 15 + ((max - p.close) / (max - min)) * height,
    point: p,
  }));
  return {
    positions,
    min,
    max,
    path: positions
      .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" "),
  };
}
export function readWatchlist(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (v): v is string =>
                typeof v === "string" && /^[A-Z0-9._-]{1,40}$/.test(v),
            ),
          ),
        ].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
