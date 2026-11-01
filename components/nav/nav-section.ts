// Which top-bar link a page belongs to. Sub-pages count as their parent
// (an item page is Closet); anything else, like the purchase check or the
// login page, belongs to none.
export type NavSection = "/" | "/closet" | "/calendar" | "/profile";

const SECTIONS = ["/closet", "/calendar", "/profile"] as const;

export function navSection(pathname: string): NavSection | null {
  if (pathname === "/") return "/";
  return SECTIONS.find((s) => pathname === s || pathname.startsWith(`${s}/`)) ?? null;
}
