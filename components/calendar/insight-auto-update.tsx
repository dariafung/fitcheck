"use client";

import { useEffect, useState } from "react";
import { aiNotice, isAiFailure } from "@/lib/ai/notices";
import type { ClosetCard } from "@/lib/closet/items";
import type { VisibleInsights } from "@/lib/wear/insights";
import { InsightsEmpty, InsightsSkeleton, InsightsView } from "./insight-view";

const AI_FAILED = "Couldn't write insights right now.";

// The insights when the log changed since they were written: shows the old
// ones (or a skeleton) while the server asks the model, then swaps in the
// new ones. On a failure the old ones stay; with none, a short notice.
export function InsightAutoUpdate({ initial, items }: { initial: VisibleInsights | null; items: ClosetCard[] }) {
  const [insights, setInsights] = useState(initial);
  const [updating, setUpdating] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function update() {
      const res = await fetch("/api/wear/insights", { method: "POST" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { insights?: VisibleInsights | null; error?: string } | null;
      if (cancelled) return;
      if (res?.ok && json?.insights !== undefined) setInsights(json.insights);
      else if (!res?.ok) setProblem(aiNotice(json?.error) ?? (isAiFailure(json?.error) || !res ? AI_FAILED : null));
      setUpdating(false);
    }
    void update();
    return () => {
      cancelled = true;
    };
  }, []);

  if (insights) return <InsightsView insights={insights} items={items} note={updating ? "Updating…" : undefined} />;
  if (updating) return <InsightsSkeleton note="Reading your log…" />;
  return <InsightsEmpty daysToGo={0} message={problem ?? undefined} />;
}
