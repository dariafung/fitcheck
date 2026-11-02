import { Occasion, type Category } from "@/lib/ai/schemas/common";
import { OCCASION_LABELS, SORT_LABELS } from "./labels";

// The closet's two tabs, its category filter, its quick filters and its sort
// order, kept in the URL as ?tab=, ?cat=, ?tag= and ?sort= so a refresh stays
// put and they all work together.
export type ClosetTab = "wearing" | "passing-on";

export const CLOSET_TABS: { id: ClosetTab; label: string }[] = [
  { id: "wearing", label: "Wearing" },
  { id: "passing-on", label: "Passing on" },
];

// Head to toe. Accessories can't be added, so they get no filter.
export const CLOSET_CATEGORIES: Category[] = ["top", "bottom", "one_piece", "outerwear", "shoes"];

// Quick filters, beside the categories: pieces not worn lately (from the
// outfit calendar) and occasions.
export type ClosetTag = "not-worn" | Occasion;

// Newest first is the closet's own order (the default). The wear orders read
// the outfit calendar's last 30 days, so they are only offered when it has a
// log. More orders go here, each with how to compare two pieces.
export type ClosetSort = "newest" | "most-worn" | "least-worn";

export const CLOSET_SORTS: { id: ClosetSort; label: string; needsWear: boolean }[] = [
  { id: "newest", label: SORT_LABELS.newest, needsWear: false },
  { id: "most-worn", label: SORT_LABELS.mostWorn, needsWear: true },
  { id: "least-worn", label: SORT_LABELS.leastWorn, needsWear: true },
];

export interface ClosetView {
  tab: ClosetTab;
  cat: Category | null;
  // Wearing only: what's on its way out is not worn by design.
  tag: ClosetTag | null;
  // Wearing only, like the quick filters. Left out means newest first.
  sort?: ClosetSort;
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

export function closetTag(param: string | string[] | undefined): ClosetTag | null {
  if (param === "not-worn") return param;
  const occasion = Occasion.safeParse(param);
  return occasion.success ? occasion.data : null;
}

export function closetSort(param: string | string[] | undefined): ClosetSort {
  return CLOSET_SORTS.find((sort) => sort.id === param)?.id ?? "newest";
}

export function closetView(params: Record<string, string | string[] | undefined>): ClosetView {
  const tab = closetTab(params.tab);
  const sort = tab === "wearing" ? closetSort(params.sort) : "newest";
  return {
    tab,
    cat: closetCategory(params.cat),
    tag: tab === "wearing" ? closetTag(params.tag) : null,
    ...(sort !== "newest" && { sort }),
  };
}

export function categorySlug(cat: Category): string {
  return cat.replace("_", "-");
}

// Defaults (Wearing, no filter) stay out of the URL, so the plain /closet is
// the starting view.
export function closetHref({ tab, cat, tag, sort }: ClosetView): string {
  const params = new URLSearchParams();
  if (tab !== "wearing") params.set("tab", tab);
  if (cat) params.set("cat", categorySlug(cat));
  if (tag && tab === "wearing") params.set("tag", tag);
  if (sort && sort !== "newest" && tab === "wearing") params.set("sort", sort);
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

// Ids of pieces not worn lately; null when the outfit calendar is off or has
// nothing logged, and then there is no such filter.
export type NotWorn = ReadonlySet<string> | null;

export function inTag<T extends { id: string; occasions: readonly string[] }>(
  items: T[],
  tag: ClosetTag | null,
  notWorn: NotWorn,
): T[] {
  if (!tag) return items;
  if (tag === "not-worn") return notWorn ? items.filter((item) => notWorn.has(item.id)) : items;
  return items.filter((item) => item.occasions.includes(tag));
}

export function tagLabel(tag: ClosetTag): string {
  return tag === "not-worn" ? "Not worn lately" : OCCASION_LABELS[tag];
}

// Baymard: offer only the few that matter. At most this many occasions.
export const QUICK_OCCASIONS = 2;

// The quick filters for a tab, with how many pieces each gives with the
// picked category: "Not worn lately" when the calendar knows, then the
// occasions most of the tab is tagged for (not one that every piece has, which
// would filter nothing). Empty ones are left out, except the one already picked.
export function quickTags<T extends { id: string; category: string; occasions: readonly string[] }>(
  tabItems: T[],
  view: Pick<ClosetView, "cat" | "tag">,
  notWorn: NotWorn,
): { tag: ClosetTag; count: number }[] {
  const occasions = Occasion.options
    .map((occasion) => ({ occasion, count: inTag(tabItems, occasion, notWorn).length }))
    .filter(({ count }) => count > 0 && count < tabItems.length)
    // Stable sort: ties keep the schema's order (work, school, social, sport, home).
    .sort((a, b) => b.count - a.count)
    .slice(0, QUICK_OCCASIONS)
    .map(({ occasion }) => occasion);
  const tags: ClosetTag[] = [...(notWorn ? ["not-worn" as const] : []), ...occasions];
  if (view.tag && !tags.includes(view.tag) && (view.tag !== "not-worn" || notWorn)) tags.push(view.tag);
  return tags
    .map((tag) => ({ tag, count: inCategory(inTag(tabItems, tag, notWorn), view.cat).length }))
    .filter(({ tag, count }) => count > 0 || tag === view.tag);
}

// How often and how lately each piece was worn in the calendar's 30 days;
// null when the calendar is off or has nothing logged.
export type WearCounts = ReadonlyMap<string, { count: number; lastWorn: string | null }> | null;

// The sorts to offer: the wear ones only when there is a log to read.
export function sortOptions(wear: WearCounts): { id: ClosetSort; label: string }[] {
  return CLOSET_SORTS.filter((sort) => !sort.needsWear || wear).map(({ id, label }) => ({ id, label }));
}

// Items arrive newest first; ties keep that order (the sort is stable).
// Most worn: most outfits first, then the one worn more lately. Least worn:
// fewest outfits first (never worn in the 30 days at the top), then the one
// worn longest ago.
export function sortItems<T extends { id: string }>(items: T[], sort: ClosetSort | undefined, wear: WearCounts): T[] {
  if (!sort || sort === "newest" || !wear) return items;
  const count = (item: T) => wear.get(item.id)?.count ?? 0;
  const last = (item: T) => wear.get(item.id)?.lastWorn ?? "";
  return [...items].sort((a, b) =>
    sort === "most-worn"
      ? count(b) - count(a) || last(b).localeCompare(last(a))
      : count(a) - count(b) || last(a).localeCompare(last(b)),
  );
}
