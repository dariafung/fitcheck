import Link from "next/link";
import type { ReactNode } from "react";
import { categoryFilters, CLOSET_TABS, closetHref, inCategory, inTab, type ClosetView } from "@/lib/closet/tabs";
import { categoryLabel } from "@/lib/closet/tags";

// Every number on these links is how many pieces you get when you click it:
// the tab counts follow the picked category, the category counts follow the
// tab.

export const FILTER =
  "shrink-0 whitespace-nowrap text-sm underline-offset-[6px] decoration-2 transition-colors duration-150";

const on = (active: boolean) => (active ? "text-ink underline" : "text-ink-2 hover:text-ink");

export function ClosetFilters<T extends { status: string; category: string }>({
  items,
  view,
}: {
  items: T[];
  view: ClosetView;
}) {
  const tabItems = inTab(items, view.tab);
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-8 border-y border-line py-3.5">
        {CLOSET_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={closetHref({ ...view, tab: tab.id })}
            scroll={false}
            aria-current={tab.id === view.tab ? "page" : undefined}
            className={`${FILTER} ${on(tab.id === view.tab)}`}
          >
            {tab.label}{" "}
            <span className="text-ink-2 tabular-nums">{inCategory(inTab(items, tab.id), view.cat).length}</span>
          </Link>
        ))}
      </div>
      {/* Nothing to sort when the tab is empty. On a phone the row scrolls
          sideways, edge to edge, rather than wrapping. */}
      {tabItems.length > 0 && (
        <div
          role="group"
          aria-label="Category"
          className="-mx-4 flex items-center gap-6 overflow-x-auto px-4 pt-4 pb-1 md:mx-0 md:px-0"
        >
          <CategoryLink href={closetHref({ ...view, cat: null })} active={view.cat === null}>
            All <span className="text-ink-2 tabular-nums">{tabItems.length}</span>
          </CategoryLink>
          {categoryFilters(tabItems, view.cat).map(({ cat, count }) => (
            <CategoryLink key={cat} href={closetHref({ ...view, cat })} active={cat === view.cat}>
              {categoryLabel(cat)} <span className="text-ink-2 tabular-nums">{count}</span>
            </CategoryLink>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`${FILTER} py-1 ${on(active)}`}
    >
      {children}
    </Link>
  );
}
