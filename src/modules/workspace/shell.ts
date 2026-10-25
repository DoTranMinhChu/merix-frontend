import { readWatchlist } from "@core/api/market";
const root = document.documentElement;
try {
  root.classList.toggle(
    "light",
    localStorage.getItem("merix-theme") === "light",
  );
} catch {
  /* Defaults remain usable when storage is disabled. */
}
function count() {
  let saved: string[] = [];
  try {
    saved = readWatchlist(localStorage.getItem("merix-watchlist"));
  } catch {}
  document
    .querySelectorAll("[data-watch-count]")
    .forEach((el) => (el.textContent = String(saved.length)));
}
count();
window.addEventListener("merix-watchlist", count);
window.addEventListener("storage", count);
document.querySelectorAll("[data-theme-toggle]").forEach((button) =>
  button.addEventListener("click", () => {
    const light = root.classList.toggle("light");
    try {
      localStorage.setItem("merix-theme", light ? "light" : "dark");
    } catch {}
    button.setAttribute(
      "aria-label",
      light ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng",
    );
  }),
);
const menu = document.querySelector<HTMLButtonElement>("#menu-toggle");
const sidebar = document.querySelector<HTMLElement>("#app-sidebar");
function closeMenu() {
  sidebar?.classList.remove("open");
  menu?.setAttribute("aria-expanded", "false");
}
menu?.addEventListener("click", () => {
  const open = sidebar?.classList.toggle("open") ?? false;
  menu.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  const el = event.target as Element;
  if (!el.closest("#app-sidebar") && !el.closest("#menu-toggle")) closeMenu();
});
sidebar
  ?.querySelectorAll("a")
  .forEach((a) => a.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    menu?.focus();
  }
  if (
    event.key === "/" &&
    !(event.target instanceof HTMLInputElement) &&
    !(event.target instanceof HTMLTextAreaElement) &&
    !(event.target instanceof HTMLSelectElement)
  ) {
    event.preventDefault();
    document.querySelector<HTMLInputElement>("#global-search")?.focus();
  }
});
