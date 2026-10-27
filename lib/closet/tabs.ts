// The closet's two tabs, kept in the URL as ?tab= so a refresh stays put.
export type ClosetTab = "all" | "passing-on";

export const CLOSET_TABS: { id: ClosetTab; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/closet" },
  { id: "passing-on", label: "Passing on", href: "/closet?tab=passing-on" },
];

// Anything but a known tab falls back to All.
export function closetTab(param: string | string[] | undefined): ClosetTab {
  return param === "passing-on" ? "passing-on" : "all";
}

// All is what is still worn; Passing on is only what is on its way out.
export function inTab<T extends { status: string }>(items: T[], tab: ClosetTab): T[] {
  const status = tab === "passing-on" ? "passing_on" : "active";
  return items.filter((item) => item.status === status);
}
