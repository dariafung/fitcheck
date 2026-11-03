"use client";

import { useEffect, useState } from "react";
import { AnonAvatar } from "@/components/resale/anon-avatar";
import type { BuyersResult } from "@/lib/resale/buyers";

export const BUYER_STATES = {
  no_buyers: "No active buyers right now.",
  no_size_match: "No buyers for this one right now.",
  none_strong: "No one's a strong match yet.",
} as const;
export const TRY_DEMO = "Try the demo account to see how matching works.";
export const SOME_UNCHECKED = "Some buyers weren't checked yet. Try again later.";

export const BUYERS_HEADING = "Matching buyers";

// At most this many avatars; the rest show as "+N".
export const MAX_AVATARS = 5;

export function avatarRow(count: number): { shown: number; more: number } {
  const shown = Math.min(count, MAX_AVATARS);
  return { shown, more: count - shown };
}

// The count is buyers whose buy check scored 60+, not everyone checked: no
// buyer is shown the item, so the copy says who'd want it.
export function buyerCount(count: number): string {
  return count === 1
    ? "1 person would likely want this."
    : `${count} people would likely want this.`;
}

async function lookUp(itemId: string): Promise<BuyersResult | "error"> {
  const res = await fetch(`/api/items/${itemId}/buyers`, { method: "POST" }).catch(() => null);
  if (!res?.ok) return "error";
  return ((await res.json().catch(() => null)) as BuyersResult | null) ?? "error";
}

function Note({ children }: { children: string }) {
  return <p className="text-sm text-ink-2">{children}</p>;
}

// One identical avatar per match, up to MAX_AVATARS.
function Avatars({ count }: { count: number }) {
  const { shown, more } = avatarRow(count);
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: shown }, (_, i) => (
        <AnonAvatar key={i} />
      ))}
      {more > 0 && <span className="text-sm text-ink-2 tabular-nums">+{more}</span>}
    </div>
  );
}

function Result({ result }: { result: BuyersResult }) {
  switch (result.state) {
    case "no_buyers":
      return (
        <>
          <Note>{BUYER_STATES.no_buyers}</Note>
          {!result.seeded && <Note>{TRY_DEMO}</Note>}
        </>
      );
    case "no_size_match":
      return <Note>{BUYER_STATES.no_size_match}</Note>;
    case "unchecked":
      return <Note>{SOME_UNCHECKED}</Note>;
    case "none_strong":
      return (
        <>
          <Note>{BUYER_STATES.none_strong}</Note>
          {result.someUnchecked && <Note>{SOME_UNCHECKED}</Note>}
        </>
      );
    case "matches":
      return (
        <>
          <Avatars count={result.count} />
          <p className="text-base">{buyerCount(result.count)}</p>
          {result.someUnchecked && <Note>{SOME_UNCHECKED}</Note>}
        </>
      );
  }
}

// "Matching buyers" on a passing-on item: how many buyers in the user's size
// would likely want it (identical anonymous avatars, no names), or why there
// are none. Asked for once the page is up, since checking new buyers takes a
// while.
export function BuyerMatches({ itemId, size }: { itemId: string; size: string | null }) {
  const [result, setResult] = useState<BuyersResult | "error" | null>(null);

  // Asked again when the size changes, since that changes who fits.
  useEffect(() => {
    let current = true;
    lookUp(itemId).then((next) => {
      if (current) setResult(next);
    });
    return () => {
      current = false;
    };
  }, [itemId, size]);

  return (
    <section aria-labelledby="buyers-heading" className="flex flex-col gap-3">
      <h2 id="buyers-heading" className="text-lg font-medium">
        {BUYERS_HEADING}
      </h2>
      {result === null ? (
        <p className="text-sm text-ink-2" aria-busy="true">
          Looking for buyers…
        </p>
      ) : result === "error" ? (
        <p role="alert" className="text-sm font-medium">
          Couldn&apos;t look for buyers. Try again later.
        </p>
      ) : (
        <Result result={result} />
      )}
    </section>
  );
}
