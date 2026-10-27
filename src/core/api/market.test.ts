import { describe, it, expect } from "vitest";
import {
  chartGeometry,
  priceChange,
  percent,
  stale,
  readWatchlist,
  escapeHtml,
} from "./market";
import type { SnapshotForecast } from "./market";
import { TARGET_ABSOLUTE, classify } from "./target";
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

/**
 * Ô xác suất của trang danh sách sống hay chết theo `SnapshotForecast.evidence`.
 *
 * Trước vòng này, trường ấy không có một test nào ở phía giao diện: `classify` trả "chưa có cơ
 * sở" khi không suy được dải, nên một `evidence` im lặng thành `null` biến **mọi dòng** của
 * trang danh sách thành "Chưa có cơ sở" mà không gì đỏ. Đo được ở backend: thay `ciLow` bằng
 * `NULL` trong truy vấn snapshot, 39/39 test `--test api` vẫn xanh.
 */
describe("snapshot: hai bien khoang la thu quyet dinh o nay noi gi", () => {
  const snap = (evidence: unknown): SnapshotForecast =>
    ({
      targetDefinition: TARGET_ABSOLUTE,
      predictionStatus: "LIVE",
      validationStatus: "VALIDATED_PROSPECTIVE",
      probabilityUp: 0.62,
      probabilityNotUp: 0.38,
      abstainReason: null,
      dataThrough: "2026-10-23",
      asOf: "2026-10-23",
      modelVersion: "equal_ensemble.v1",
      evidence,
    }) as never;

  it("co khoang thi o gon noi duoc co tin hieu hay khong", () => {
    // w = 5,4 ⇒ dai ≈ 0,0822. 0,62 lech 0,12 — ngoai dai.
    expect(classify(snap({ ciLow: 1.5, ciHigh: 6.9 })).kind).toBe("signal");
    // Cung khoang ay, 0,55 lech 0,05 — TRONG dai.
    expect(
      classify({ ...snap({ ciLow: 1.5, ciHigh: 6.9 }), probabilityUp: 0.55 }).kind,
    ).toBe("no-signal");
  });

  it("thieu khoang thi o gon noi CHUA CO CO SO, khong roi ve mot dai mac dinh", () => {
    for (const e of [null, undefined, { ciLow: null, ciHigh: 6.9 }, { ciLow: 1.5, ciHigh: null }]) {
      const s = classify(snap(e));
      expect(s.kind, `evidence=${JSON.stringify(e)}`).toBe("no-basis");
      expect(s.kind === "no-basis" && s.why).toBe("khong-suy-duoc-dai");
    }
  });

  it("dai cua o gon suy tu CHINH khoang cua no, khong phai mot hang so", () => {
    const hep = classify({
      ...snap({ ciLow: 0.4, ciHigh: 2.2 }),
      probabilityUp: 0.56,
    });
    const rong = classify({
      ...snap({ ciLow: -8, ciHigh: 12 }),
      probabilityUp: 0.56,
    });
    // Cung mot xac suat, hai khoang khac nhau ⇒ hai ket luan khac nhau.
    expect(hep.kind).toBe("signal");
    expect(rong.kind).toBe("no-signal");
  });

  it("`includesThisAsset` di theo tung dong va KHONG doi trang thai cua o", () => {
    const trong = snap({ ciLow: 1.5, ciHigh: 6.9, includesThisAsset: true });
    const ngoai = snap({ ciLow: 1.5, ciHigh: 6.9, includesThisAsset: false });
    // Cung mo hinh, cung khoang ⇒ cung trang thai. Co nay KHONG duoc lam mo hinh "yeu di";
    // no noi mot chuyen khac han: bang chung do tren nhom nao. Tron hai chuyen lai la noi sai.
    expect(classify(trong).kind).toBe("signal");
    expect(classify(ngoai).kind).toBe("signal");
    // Cau canh bao duoc kiem o cho no duoc ve ra: `probabilityView.test.ts`.
    expect(ngoai.evidence?.includesThisAsset).toBe(false);
  });
});
