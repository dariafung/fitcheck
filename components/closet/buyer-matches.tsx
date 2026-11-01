"use client";

import { useEffect, useState } from "react";
import type { BuyersResult } from "@/lib/resale/buyers";

export const BUYER_STATES = {
  no_buyers: "No active buyers right now.",
  no_size_match: "No buyers in this size right now.",
  none_strong: "No one's a strong match yet.",
} as const;
export const TRY_DEMO = "Try the demo account to see how matching works.";
export const SOME_UNCHECKED = "Some buyers weren't checked yet. Try again later.";
export const SAMPLE_BUYERS = "Sample buyers for the demo.";

// The words beside the big count: "1 buyer in your size", "3 buyers in your size".
export function buyersInSize(count: number): string {
  return count === 1 ? "buyer in your size" : "buyers in your size";
}

async function lookUp(itemId: string): Promise<BuyersResult | "error"> {
  const res = await fetch(`/api/items/${itemId}/buyers`, { method: "POST" }).catch(() => null);
  if (!res?.ok) return "error";
  return ((await res.json().catch(() => null)) as BuyersResult | null) ?? "error";
}

function Note({ children }: { children: string }) {
  return <p className="text-sm text-ink-2">{children}</p>;
}

function Result({ result }: { result: BuyersResult }) {
  switch (result.state) {
    case "no_buyers":
      return (
        <>
          <Note>{BUYER_STATES.no_buyers}</Note>
          {!result.sample && <Note>{TRY_DEMO}</Note>}
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
          <p className="flex items-baseline gap-2">
            <span className="text-title font-medium tabular-nums">{result.count}</span>
            <span className="text-base">{buyersInSize(result.count)}</span>
          </p>
          {result.someUnchecked && <Note>{SOME_UNCHECKED}</Note>}
          {result.sample && <Note>{SAMPLE_BUYERS}</Note>}
        </>
      );
  }
}

// "Who might want it" on a passing-on item: how many buyers in the user's size
// would likely want it, as one big number (no faces, no names), or why there
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
        Who might want it
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
