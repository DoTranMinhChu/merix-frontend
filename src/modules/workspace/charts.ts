import {
  chartGeometry,
  escapeHtml as e,
  money,
  percent,
  priceChange,
  stale,
  type MarketSeries,
} from "@core/api/market";
import type { ForecastResponse } from "@core/api/types";
import { probabilityBodyHtml } from "./probabilityView";
export async function getData<T>(
  kind: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams({ kind, ...params });
  const response = await fetch(`/api/market?${query}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? "Không tải được dữ liệu.");
  return body as T;
}
export function renderChart(series: MarketSeries | null, error?: string) {
  const body = document.querySelector<HTMLElement>("#chart-body");
  if (!body) return;
  const points = series?.prices ?? [];
  const latest = points.at(-1);
  const change = priceChange(points);
  const g = chartGeometry(points);
  body.innerHTML = `<div class="chart-metric"><span>${money(latest?.close)}</span><span class="change ${change !== null && change < 0 ? "negative" : ""}">${change === null ? "Chưa đủ hai phiên" : `${change > 0 ? "+" : ""}${percent(change)}`}</span><small>${latest ? `Phiên ${e(latest.date)} · Giá đã điều chỉnh${stale(latest.date) ? " · Dữ liệu đã cũ" : ""}` : "Chưa có dữ liệu giá"}</small></div>`;
  if (!g) {
    body.insertAdjacentHTML(
      "beforeend",
      `<p class="chart-empty">${e(error ?? "Cần ít nhất hai phiên giá để vẽ biểu đồ.")}</p>`,
    );
    return;
  }
  const volumes = points.map((p) => p.volume ?? 0);
  const maxVolume = Math.max(...volumes, 1);
  const bars = g.positions
    .filter((p) => p.point.volume !== null)
    .map(
      (p) =>
        `<rect x="${p.x}" y="${245 - ((p.point.volume ?? 0) / maxVolume) * 35}" width="${Math.max(1, 480 / points.length)}" height="${((p.point.volume ?? 0) / maxVolume) * 35}" fill="var(--mint)" opacity=".15"/>`,
    )
    .join("");
  body.insertAdjacentHTML(
    "beforeend",
    `<div class="chart-container"><svg id="live-chart" viewBox="-5 0 805 270" role="img" aria-label="Giá đóng cửa đã điều chỉnh ${e(series?.symbol)}"><title>Diễn biến giá ${e(series?.symbol)}</title>${[0, 1, 2, 3, 4].map((i) => `<line x1="0" x2="720" y1="${15 + i * 52.5}" y2="${15 + i * 52.5}" class="grid-line"/><text x="735" y="${19 + i * 52.5}" class="axis-text">${money(g.max - ((g.max - g.min) * i) / 4)}</text>`).join("")}${bars}<path d="${g.path} L720 245 L0 245Z" fill="var(--mint)" opacity=".04"/><path d="${g.path}" fill="none" stroke="var(--mint)" stroke-width="2.5"/><g id="chart-cursor" visibility="hidden"><line y1="5" y2="245" stroke="var(--muted)" stroke-dasharray="4 4"/><circle r="4" fill="var(--mint)"/></g></svg><div class="chart-dates"><span>${e(points[0].date)}</span><span>${e(latest!.date)}</span></div><p class="chart-point-label" id="chart-point-label">Rê chuột hoặc chạm để xem từng phiên.</p></div>`,
  );
  const svg = document.querySelector<SVGSVGElement>("#live-chart")!;
  svg.addEventListener("pointermove", (event) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const x = point.matrixTransform(ctm.inverse()).x;
    const selected = g.positions.reduce((a, b) =>
      Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b,
    );
    const cursor = svg.querySelector("#chart-cursor")!;
    cursor.setAttribute("visibility", "visible");
    const line = cursor.querySelector("line")!;
    line.setAttribute("x1", String(selected.x));
    line.setAttribute("x2", String(selected.x));
    const circle = cursor.querySelector("circle")!;
    circle.setAttribute("cx", String(selected.x));
    circle.setAttribute("cy", String(selected.y));
    document.querySelector("#chart-point-label")!.textContent =
      `${selected.point.date} · ${money(selected.point.close)} · Khối lượng ${money(selected.point.volume)}`;
  });
  svg.addEventListener("pointerleave", () =>
    svg.querySelector("#chart-cursor")?.setAttribute("visibility", "hidden"),
  );
}
export function renderProbability(
  forecast: ForecastResponse | null,
  horizon: number,
  error?: string,
) {
  const target = document.querySelector("#probability-body");
  if (!target) return;
  document.querySelector("#horizon-label")!.textContent = `${horizon} phiên`;
  // Chon dong va dat ten con so deu o probabilityView/target: day khong tu `find` theo ky han.
  target.innerHTML = probabilityBodyHtml(forecast, horizon, error);
}
export function toast(message: string) {
  const element = document.querySelector<HTMLElement>("#app-toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("visible");
  setTimeout(() => element.classList.remove("visible"), 3500);
}
