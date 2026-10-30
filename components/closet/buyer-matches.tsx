"use client";

import { useEffect, useState } from "react";
import { AnonAvatar } from "@/components/resale/anon-avatar";
import type { BuyersResult } from "@/lib/resale/buyers";

export const BUYER_STATES = {
  no_buyers: "No active buyers right now.",
  no_size_match: "No buyers in this size right now.",
  none_strong: "No one's a strong match yet.",
} as const;

async function lookUp(itemId: string): Promise<BuyersResult | "error"> {
  const res = await fetch(`/api/items/${itemId}/buyers`, { method: "POST" }).catch(() => null);
  if (!res?.ok) return "error";
  return ((await res.json().catch(() => null)) as BuyersResult | null) ?? "error";
}

// "Who'd want it" on a passing-on item: anonymous buyers with their scores,
// or why there are none. Asked for once the page is up, since finding
// buyers can take a while.
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
        Who&apos;d want it
      </h2>
      {result === null ? (
        <p className="text-sm text-ink-2" aria-busy="true">
          Looking for buyers…
        </p>
      ) : result === "error" ? (
        <p role="alert" className="text-sm font-medium">
          Couldn&apos;t look for buyers. Try again later.
        </p>
      ) : result.state === "matches" ? (
        <ul className="flex flex-col gap-3">
          {result.matches.map((m) => (
            <li key={m.key} className="flex items-center gap-3">
              <AnonAvatar color={m.color} label={`Anonymous buyer, ${m.score} match`} />
              <span className="text-base tabular-nums">{m.score} match</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">{BUYER_STATES[result.state]}</p>
      )}
    </section>
  );
}
