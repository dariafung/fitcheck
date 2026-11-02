"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { Icon } from "@/components/ui/icon";
import { SORT_HEADING } from "@/lib/closet/labels";
import { closetHref, type ClosetSort, type ClosetView } from "@/lib/closet/tabs";

// The closet's sort order, at the end of the tab bar. It reads as small text
// like the tabs; the real select sits on top of it, see-through and at 16px so
// iOS Safari does not zoom in when it opens. The order lives in the URL.
export function SortMenu({ view, options }: { view: ClosetView; options: { id: ClosetSort; label: string }[] }) {
  const router = useRouter();
  const id = useId();
  const current = view.sort ?? "newest";
  const label = options.find((o) => o.id === current)?.label ?? options[0].label;
  return (
    <div className="-my-[13px] ml-auto flex min-h-11 shrink-0 items-center gap-2 text-sm">
      <label htmlFor={id} className="text-ink-2">
        {SORT_HEADING}
      </label>
      <div className="relative inline-flex min-h-11 items-center gap-1 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2">
        <span aria-hidden="true">{label}</span>
        <Icon name="chevron-down" size={12} />
        <select
          id={id}
          value={current}
          onChange={(e) => router.push(closetHref({ ...view, sort: e.target.value as ClosetSort }), { scroll: false })}
          className="absolute inset-0 cursor-pointer appearance-none text-[16px] opacity-0"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
