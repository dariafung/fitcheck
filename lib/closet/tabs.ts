import type { Category } from "@/lib/ai/schemas/common";

// The closet's two tabs and its category filter, kept in the URL as ?tab= and
// ?cat= so a refresh stays put and the two work together.
export type ClosetTab = "wearing" | "passing-on";

export const CLOSET_TABS: { id: ClosetTab; label: string }[] = [
  { id: "wearing", label: "Wearing" },
  { id: "passing-on", label: "Passing on" },
];

// Head to toe, then the extras.
export const CLOSET_CATEGORIES: Category[] = ["top", "bottom", "one_piece", "outerwear", "shoes", "accessory"];

export interface ClosetView {
  tab: ClosetTab;
  cat: Category | null;
}

// Anything but a known tab falls back to Wearing.
export function closetTab(param: string | string[] | undefined): ClosetTab {
  return param === "passing-on" ? "passing-on" : "wearing";
}

// In the URL a category is written with a dash (one-piece). Anything else
// means no filter.
export function closetCategory(param: string | string[] | undefined): Category | null {
  if (typeof param !== "string") return null;
  return CLOSET_CATEGORIES.find((cat) => categorySlug(cat) === param) ?? null;
}

export function closetView(params: Record<string, string | string[] | undefined>): ClosetView {
  return { tab: closetTab(params.tab), cat: closetCategory(params.cat) };
}

export function categorySlug(cat: Category): string {
  return cat.replace("_", "-");
}

// Defaults (Wearing, no filter) stay out of the URL, so the plain /closet is
// the starting view.
export function closetHref({ tab, cat }: ClosetView): string {
  const params = new URLSearchParams();
  if (tab !== "wearing") params.set("tab", tab);
  if (cat) params.set("cat", categorySlug(cat));
  const query = params.toString();
  return query ? `/closet?${query}` : "/closet";
}

// Wearing is what is still worn; Passing on is only what is on its way out.
export function inTab<T extends { status: string }>(items: T[], tab: ClosetTab): T[] {
  const status = tab === "passing-on" ? "passing_on" : "active";
  return items.filter((item) => item.status === status);
}

export function inCategory<T extends { category: string }>(items: T[], cat: Category | null): T[] {
  return cat ? items.filter((item) => item.category === cat) : items;
}

// The categories to offer for a list, with how many of each it holds. Empty
// ones are left out, except the one already picked, so you can see the filter
// is on and switch it off.
export function categoryFilters<T extends { category: string }>(
  items: T[],
  active: Category | null,
): { cat: Category; count: number }[] {
  return CLOSET_CATEGORIES.map((cat) => ({ cat, count: inCategory(items, cat).length })).filter(
    ({ cat, count }) => count > 0 || cat === active,
  );
}
