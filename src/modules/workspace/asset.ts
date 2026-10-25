import type { ForecastResponse } from "@core/api/types";
import { readWatchlist, type MarketSeries } from "@core/api/market";
import { getData, renderChart, renderProbability, toast } from "./charts";
const root = document.querySelector<HTMLElement>("#asset-workspace");
if (root) {
  const initial = JSON.parse(root.dataset.initial!) as {
    symbol: string;
    forecast: ForecastResponse | null;
    series: MarketSeries | null;
  };
  let controller: AbortController | undefined;
  renderChart(initial.series);
  renderProbability(initial.forecast, 21);
  root.querySelectorAll<HTMLButtonElement>("[data-horizon]").forEach((button) =>
    button.addEventListener("click", () => {
      root.querySelectorAll("[data-horizon]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      renderProbability(initial.forecast, Number(button.dataset.horizon));
    }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((button) =>
    button.addEventListener("click", async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      root.querySelectorAll("[data-period]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      renderChart(null, "Đang tải giá…");
      try {
        const series = await getData<MarketSeries>(
          "series",
          { symbol: initial.symbol, limit: button.dataset.period! },
          current.signal,
        );
        if (!current.signal.aborted) renderChart(series);
      } catch (error) {
        if (!current.signal.aborted)
          renderChart(
            null,
            error instanceof Error ? error.message : "Không tải được giá.",
          );
      }
    }),
  );
  let saved: string[] = [];
  try {
    saved = readWatchlist(localStorage.getItem("merix-watchlist"));
  } catch {}
  const button = root.querySelector<HTMLButtonElement>("#asset-watch");
  function update() {
    if (button) {
      const active = saved.includes(initial.symbol);
      button.textContent = active ? "★ Đang theo dõi" : "☆ Theo dõi";
      button.setAttribute("aria-pressed", String(active));
    }
  }
  update();
  button?.addEventListener("click", () => {
    const active = saved.includes(initial.symbol);
    if (!active && saved.length >= 100) {
      toast("Danh sách theo dõi tối đa 100 mã.");
      return;
    }
    saved = active
      ? saved.filter((s) => s !== initial.symbol)
      : [...saved, initial.symbol];
    try {
      localStorage.setItem("merix-watchlist", JSON.stringify(saved));
      toast(active ? "Đã bỏ theo dõi." : "Đã thêm vào danh sách theo dõi.");
    } catch {
      toast(
        "Không lưu được trên trình duyệt; lựa chọn chỉ có trong phiên này.",
      );
    }
    update();
    window.dispatchEvent(new Event("merix-watchlist"));
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "merix-watchlist") {
      saved = readWatchlist(event.newValue);
      update();
    }
  });
}
