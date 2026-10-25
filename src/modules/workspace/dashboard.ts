import {
  escapeHtml as e,
  money,
  percent,
  priceChange,
  readWatchlist,
  stale,
  type MarketAsset,
  type MarketSnapshot,
  type MarketSeries,
  type WorkspaceData,
} from "@core/api/market";
import {
  VALIDATION_LABELS,
  ABSTAIN_LABELS,
  type ForecastResponse,
} from "@core/api/types";
import { getData, renderChart, renderProbability, toast } from "./charts";
import { compactProbabilityHtml } from "./probabilityView";
import { DEFAULT_HORIZON } from "@core/api/target";
const root = document.querySelector<HTMLElement>("#workspace-data");
if (root) {
  const data = JSON.parse(root.dataset.initial!) as WorkspaceData;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
  let symbol = data.selected,
    horizon = DEFAULT_HORIZON,
    period = 63,
    forecast = data.forecast;
  let items = data.stocks?.items ?? [],
    cursor = data.stocks?.nextCursor ?? null,
    filter =
      new URLSearchParams(location.search).get("view") === "watchlist"
        ? "watchlist"
        : "all";
  let saved: string[] = [];
  try {
    saved = readWatchlist(localStorage.getItem("merix-watchlist"));
  } catch {}
  let stockController: AbortController | undefined,
    chartController: AbortController | undefined,
    forecastController: AbortController | undefined;
  let search = data.search,
    sector = data.sector,
    busy = false;
  renderChart(data.series);
  renderProbability(forecast, horizon);
  function updateStars() {
    document
      .querySelectorAll<HTMLButtonElement>("[data-star]")
      .forEach((button) => {
        const active = saved.includes(button.dataset.star!);
        button.textContent = active ? "★" : "☆";
        button.classList.toggle("saved", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute(
          "aria-label",
          `${active ? "Bỏ theo dõi" : "Theo dõi"} ${button.dataset.star}`,
        );
      });
    document
      .querySelectorAll("[data-watch-count]")
      .forEach((el) => (el.textContent = String(saved.length)));
  }
  function row(a: MarketAsset) {
    const last = a.prices.at(-1),
      c = priceChange(a.prices),
      f = a.forecast;
    return `<tr data-stock="${e(a.symbol)}"><td><button class="star-button" data-star="${e(a.symbol)}" aria-label="Theo dõi ${e(a.symbol)}" aria-pressed="false">☆</button></td><th scope="row"><a class="asset-button" href="/asset/${encodeURIComponent(a.symbol)}"><span class="asset-avatar">${e(a.symbol[0])}</span><span>${e(a.symbol)}<small>${e(a.name)}</small></span></a></th><td class="numeric price-cell">${money(last?.close)}<small class="change ${c !== null && c < 0 ? "negative" : ""}">${c === null ? "—" : `${c > 0 ? "+" : ""}${percent(c)}`}</small><span class="table-status-date">${e(last?.date ?? "Chưa có giá")}</span></td><td class="numeric">${compactProbabilityHtml(f)}</td><td><span class="stock-filter-label">${e(a.exchange ?? "—")}</span></td><td><span class="model-badge">${e(f ? VALIDATION_LABELS[f.validationStatus] : "Chưa có dự báo")}</span>${f?.probabilityUp == null ? `<small class="table-status-date">${e(f?.abstainReason ? ABSTAIN_LABELS[f.abstainReason] : "Chưa đủ kết quả")}</small>` : ""}${f && (stale(f.dataThrough) || f.predictionStatus === "STALE") ? `<small class="table-status-date negative">Dự báo cũ · ${e(f.dataThrough)}</small>` : ""}${last && stale(last.date) ? '<small class="table-status-date negative">Giá đã cũ</small>' : ""}</td></tr>`;
  }
  function renderRows() {
    $("#stocks-body").innerHTML = items.map(row).join("");
    $("#results-count").textContent = `Hiển thị ${items.length} tài sản`;
    $("#empty-state").hidden = items.length > 0;
    $("#empty-state").textContent =
      filter === "watchlist" && !saved.length
        ? "Chưa theo dõi mã nào. Nhấn ngôi sao cạnh cổ phiếu để lưu."
        : "Không có tài sản khớp bộ lọc.";
    $("#load-more").hidden = cursor === null;
    document.querySelectorAll<HTMLElement>("[data-filter]").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === filter);
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
    });
    updateStars();
  }
  async function loadStocks(append = false) {
    stockController?.abort();
    const controller = new AbortController();
    stockController = controller;
    busy = true;
    $("#stocks-section").setAttribute("aria-busy", "true");
    $<HTMLButtonElement>("#load-more").disabled = true;
    $("#stocks-message").textContent = "Đang tải dữ liệu…";
    if (!append) {
      items = [];
      cursor = null;
      renderRows();
      $("#empty-state").hidden = true;
    }
    try {
      if (filter === "watchlist" && !saved.length) {
        items = [];
        cursor = null;
        renderRows();
        $("#stocks-message").textContent =
          "Danh sách được lưu trên thiết bị này.";
        return;
      }
      const params: Record<string, string> = {
        level: "STOCK",
        limit: "24",
        horizon: String(DEFAULT_HORIZON),
      };
      if (search) params.search = search;
      if (sector) params.sector = sector;
      if (filter === "watchlist") params.symbols = saved.join(",");
      if (append && cursor !== null) params.after = String(cursor);
      const result = await getData<MarketSnapshot>(
        "snapshot",
        params,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      items = append
        ? [
            ...items,
            ...result.items.filter(
              (a) => !items.some((i) => i.assetId === a.assetId),
            ),
          ]
        : result.items;
      cursor = result.nextCursor;
      renderRows();
      $("#stocks-message").textContent = search
        ? `Kết quả cho “${search}”`
        : filter === "watchlist"
          ? "Danh sách được lưu trên thiết bị này."
          : "";
    } catch (error) {
      if (controller.signal.aborted) return;
      $("#stocks-message").textContent =
        error instanceof Error ? error.message : "Không tải được dữ liệu.";
      if (!append) {
        $("#empty-state").hidden = false;
        $("#empty-state").innerHTML =
          'Không thể tải danh sách. <button type="button" class="retry-button" id="retry-stocks">Thử lại</button>';
      }
    } finally {
      if (!controller.signal.aborted) {
        busy = false;
        $("#stocks-section").setAttribute("aria-busy", "false");
        $<HTMLButtonElement>("#load-more").disabled = false;
      }
    }
  }
  async function loadChart() {
    chartController?.abort();
    const controller = new AbortController();
    chartController = controller;
    $("#chart-symbol").textContent = symbol;
    $("#chart-message").textContent = "Đang tải biểu đồ…";
    renderChart(null, "Đang tải dữ liệu giá…");
    try {
      const result = await getData<MarketSeries>(
        "series",
        { symbol, limit: String(period) },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      renderChart(result);
      $("#chart-unit").textContent =
        result.level === "STOCK" ? result.currency : "Điểm chỉ số";
      $("#chart-message").textContent = "";
    } catch (error) {
      if (controller.signal.aborted) return;
      renderChart(
        null,
        error instanceof Error ? error.message : "Không tải được giá.",
      );
      $("#chart-message").textContent = "Chọn lại khoảng phiên để thử tải lại.";
    }
  }
  async function selectMarket(next: string) {
    symbol = next;
    forecast = null;
    renderProbability(null, horizon, "Đang tải dự báo…");
    document.querySelectorAll<HTMLElement>("[data-market]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.market === symbol);
      b.setAttribute("aria-pressed", String(b.dataset.market === symbol));
    });
    void loadChart();
    forecastController?.abort();
    const controller = new AbortController();
    forecastController = controller;
    try {
      const result = await getData<ForecastResponse>(
        "forecast",
        { symbol },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      forecast = result;
      renderProbability(forecast, horizon);
    } catch (error) {
      if (controller.signal.aborted) return;
      renderProbability(
        null,
        horizon,
        error instanceof Error ? error.message : "Không tải được dự báo.",
      );
    }
  }
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    if (button.dataset.market) {
      void selectMarket(button.dataset.market);
      return;
    }
    if (button.dataset.period) {
      period = Number(button.dataset.period);
      document.querySelectorAll("[data-period]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      void loadChart();
      return;
    }
    if (button.dataset.horizon) {
      horizon = Number(button.dataset.horizon);
      document.querySelectorAll("[data-horizon]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      renderProbability(forecast, horizon);
      return;
    }
    if (button.dataset.star) {
      const symbol = button.dataset.star;
      const had = saved.includes(symbol);
      if (!had && saved.length >= 100) {
        toast("Danh sách theo dõi tối đa 100 mã.");
        return;
      }
      saved = had ? saved.filter((s) => s !== symbol) : [...saved, symbol];
      let persisted = true;
      try {
        localStorage.setItem("merix-watchlist", JSON.stringify(saved));
      } catch {
        persisted = false;
      }
      updateStars();
      window.dispatchEvent(new Event("merix-watchlist"));
      toast(
        persisted
          ? `${had ? "Đã bỏ" : "Đã thêm"} ${symbol} ${had ? "khỏi" : "vào"} danh sách theo dõi.`
          : "Trình duyệt không cho lưu; lựa chọn chỉ tồn tại trong phiên này.",
      );
      if (filter === "watchlist") void loadStocks();
      return;
    }
    if (button.dataset.filter) {
      filter = button.dataset.filter;
      void loadStocks();
      return;
    }
    if (button.dataset.sector) {
      sector = button.dataset.sector;
      filter = "all";
      search = "";
      $<HTMLInputElement>("#global-search").value = "";
      $<HTMLSelectElement>("#sector-filter").value = sector;
      void loadStocks();
      $("#stocks-section").scrollIntoView({ block: "start" });
      return;
    }
    if (button.id === "load-more" && !busy) void loadStocks(true);
    if (button.id === "retry-stocks") void loadStocks();
  });
  $("#sector-filter").addEventListener("change", () => {
    sector = $<HTMLSelectElement>("#sector-filter").value;
    void loadStocks();
  });
  let timer: ReturnType<typeof setTimeout>;
  const input = $<HTMLInputElement>("#global-search");
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      search = input.value.trim();
      void loadStocks();
      $("#stocks-section").scrollIntoView({ block: "nearest" });
    }, 300);
  });
  input.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(timer);
    search = input.value.trim();
    void loadStocks();
    $("#stocks-section").scrollIntoView({ block: "start" });
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== "merix-watchlist") return;
    saved = readWatchlist(event.newValue);
    updateStars();
    if (filter === "watchlist") void loadStocks();
  });
  updateStars();
  if (filter === "watchlist") void loadStocks();
}
