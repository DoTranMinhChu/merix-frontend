import type { APIRoute } from "astro";
import { apiGet } from "@core/api/client";
// Fixed upstream allowlist: never proxy arbitrary URLs or admin endpoints.
export const GET: APIRoute = async ({ url }) => {
  const kind = url.searchParams.get("kind");
  const routes: Record<string, { path: string; params: string[] }> = {
    snapshot: {
      path: "/api/v1/market-snapshot",
      params: ["level", "search", "sector", "symbols", "after", "limit"],
    },
    series: { path: "/api/v1/market-series", params: ["symbol", "limit"] },
    forecast: { path: "/api/v1/forecasts", params: ["symbol"] },
  };
  const route = kind ? routes[kind] : undefined;
  if (!route)
    return Response.json(
      { message: "Loại truy vấn không hợp lệ." },
      { status: 400 },
    );
  const params = new URLSearchParams();
  for (const key of route.params) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      if (value.length > 2000)
        return Response.json({ message: "Bộ lọc quá dài." }, { status: 400 });
      params.set(key, value);
    }
  }
  const result = await apiGet<unknown>(`${route.path}?${params}`);
  return result.kind === "ok"
    ? Response.json(result.data, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        { message: result.message, code: result.code },
        {
          status: result.status >= 400 ? result.status : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
};
