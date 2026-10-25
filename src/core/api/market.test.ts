import { describe, it, expect } from "vitest";
import {
  chartGeometry,
  priceChange,
  percent,
  stale,
  readWatchlist,
  escapeHtml,
} from "./market";
describe("research data presentation", () => {
  it("does not turn missing probabilities into 0 or 50 percent", () => {
    expect(percent(null)).toBe("—");
    expect(percent(undefined)).toBe("—");
    expect(percent(NaN)).toBe("—");
    expect(percent(0)).toContain("0,0");
  });
  it("handles flat and short price series without invalid SVG coordinates", () => {
    expect(chartGeometry([])).toBeNull();
    expect(
      chartGeometry([{ date: "2026-01-01", close: 100, volume: null }]),
    ).toBeNull();
    const g = chartGeometry([
      { date: "2026-01-01", close: 100, volume: null },
      { date: "2026-01-02", close: 100, volume: 0 },
    ]);
    expect(g?.path).not.toMatch(/NaN|Infinity/);
    expect(g?.positions[0].y).toBe(g?.positions[1].y);
  });
  it("compares actual adjacent closes and leaves missing comparison unknown", () => {
    expect(priceChange([])).toBeNull();
    expect(
      priceChange([
        { date: "1", close: 100, volume: 0 },
        { date: "2", close: 110, volume: 0 },
      ]),
    ).toBeCloseTo(0.1);
  });
  it("labels stale and absent dates explicitly", () => {
    const now = Date.parse("2026-10-22T00:00:00Z");
    expect(stale("2026-10-21", now)).toBe(false);
    expect(stale("2026-10-01", now)).toBe(true);
    expect(stale(null, now)).toBe(true);
  });
  it("bounds and sanitizes persisted watchlists", () => {
    expect(readWatchlist("invalid")).toEqual([]);
    expect(readWatchlist('{"x":1}')).toEqual([]);
    expect(readWatchlist('["FPT","FPT","<script>",null,"VCB"]')).toEqual([
      "FPT",
      "VCB",
    ]);
    expect(
      readWatchlist(
        JSON.stringify(Array.from({ length: 150 }, (_, i) => `X${i}`)),
      ),
    ).toHaveLength(100);
  });
  it("escapes hostile names before inserting dynamic HTML", () => {
    expect(escapeHtml('<img src=x onerror="x">')).toBe(
      "&lt;img src=x onerror=&quot;x&quot;&gt;",
    );
    expect(escapeHtml("'&")).toBe("&#39;&amp;");
  });
});
