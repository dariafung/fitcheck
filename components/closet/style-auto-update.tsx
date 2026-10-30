"use client";

import { useEffect, useState } from "react";
import type { VisibleCard } from "@/lib/closet/style-profile";
import { StyleCardSkeleton, StyleCardView } from "./style-card-view";

// Another tab may be rebuilding the card: ask again a few times, then stop.
const BUSY_RETRIES = 3;
const BUSY_WAIT_MS = 5000;

// Home's card when the closet changed since it was made: shows the old card
// (or a skeleton) while the server rebuilds it, then swaps in the new one.
// Failures say nothing: the old card stays, or the card is left out.
export function StyleAutoUpdate({ initial }: { initial: VisibleCard | null }) {
  const [card, setCard] = useState(initial);
  const [updating, setUpdating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function update() {
      for (let attempt = 0; attempt <= BUSY_RETRIES; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS));
        if (cancelled) return;
        try {
          const res = await fetch("/api/style-profile", { method: "POST" });
          if (res.status === 202) continue;
          const json = (await res.json().catch(() => ({}))) as { card?: VisibleCard | null };
          if (!cancelled && res.ok && json.card !== undefined) setCard(json.card);
        } catch {
          // Offline: keep what's shown.
        }
        break;
      }
      if (!cancelled) setUpdating(false);
    }
    void update();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!card) return updating ? <StyleCardSkeleton note="Reading your closet…" /> : null;
  return <StyleCardView card={card} note={updating ? "Updating…" : undefined} />;
}
