import Link from "next/link";
import type { ReactNode } from "react";
import {
  categoryFilters,
  CLOSET_TABS,
  closetHref,
  inCategory,
  inTab,
  inTag,
  quickTags,
  tagLabel,
  type ClosetSort,
  type ClosetView,
  type NotWorn,
} from "@/lib/closet/tabs";
import { categoryLabel } from "@/lib/closet/tags";
import { SortMenu } from "./sort-menu";

// Every number on these links is how many pieces you get when you click it:
// the tab counts follow the picked category and quick filter, the category
// counts follow the tab and quick filter, the quick filter counts follow the
// tab and category.

export const FILTER =
  "shrink-0 whitespace-nowrap text-sm underline-offset-[6px] decoration-2 transition-colors duration-150";

const on = (active: boolean) => (active ? "text-ink underline" : "text-ink-2 hover:text-ink");

export function ClosetFilters<T extends { id: string; status: string; category: string; occasions: string[] }>({
  items,
  view,
  notWorn,
  sorts = [],
}: {
  items: T[];
  view: ClosetView;
  notWorn: NotWorn;
  // The orders the sort menu offers; no menu with one or none.
  sorts?: { id: ClosetSort; label: string }[];
}) {
  // Quick filters are for Wearing only; switching to Passing on drops them.
  const inTabTagged = (tab: ClosetView["tab"]) => inTag(inTab(items, tab), tab === "wearing" ? view.tag : null, notWorn);
  const tabItems = inTab(items, view.tab);
  const tagged = inTag(tabItems, view.tag, notWorn);
  const tags = view.tab === "wearing" ? quickTags(tabItems, view, notWorn) : [];
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-8 border-y border-line py-3.5">
        {CLOSET_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={closetHref({ ...view, tab: tab.id })}
            scroll={false}
            aria-current={tab.id === view.tab ? "page" : undefined}
            className={`${FILTER} -my-[13px] inline-flex min-h-11 items-center ${on(tab.id === view.tab)}`}
          >
            <span>
              {tab.label}{" "}
              <span className="text-ink-2 tabular-nums">{inCategory(inTabTagged(tab.id), view.cat).length}</span>
            </span>
          </Link>
        ))}
        {/* Sorting is for Wearing, like the quick filters. */}
        {view.tab === "wearing" && sorts.length > 1 && tabItems.length > 1 && <SortMenu view={view} options={sorts} />}
      </div>
      {/* Nothing to sort when the tab is empty. On a phone the row scrolls
          sideways, edge to edge, rather than wrapping. The quick filters
          follow the categories after a dot, in the same style. */}
      {tabItems.length > 0 && (
        <div className="-mx-4 flex items-center gap-6 overflow-x-auto px-4 pt-0.5 md:mx-0 md:px-0">
          <div role="group" aria-label="Category" className="flex shrink-0 items-center gap-6">
            <CategoryLink href={closetHref({ ...view, cat: null })} active={view.cat === null}>
              All <span className="text-ink-2 tabular-nums">{tagged.length}</span>
            </CategoryLink>
            {categoryFilters(tagged, view.cat).map(({ cat, count }) => (
              <CategoryLink key={cat} href={closetHref({ ...view, cat })} active={cat === view.cat}>
                {categoryLabel(cat)} <span className="text-ink-2 tabular-nums">{count}</span>
              </CategoryLink>
            ))}
          </div>
          {tags.length > 0 && (
            <>
              <span aria-hidden="true" className="inline-flex min-h-11 shrink-0 items-end pb-2 text-sm text-ink-2">
                ·
              </span>
              <div role="group" aria-label="Quick filters" className="flex shrink-0 items-center gap-6">
                {tags.map(({ tag, count }) => (
                  // Picked again, it switches off.
                  <CategoryLink
                    key={tag}
                    href={closetHref({ ...view, tag: tag === view.tag ? null : tag })}
                    active={tag === view.tag}
                  >
                    {tagLabel(tag)} <span className="text-ink-2 tabular-nums">{count}</span>
                  </CategoryLink>
                ))}
              </div>
            </>
          )}
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
      className={`${FILTER} inline-flex min-h-11 items-end pb-2 ${on(active)}`}
    >
      {/* One flex item, so the space before the count stays. */}
      <span>{children}</span>
    </Link>
  );
}
