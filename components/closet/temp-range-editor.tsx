"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TEMP_F_MAX, TEMP_F_MIN, TempRangeF } from "@/lib/temperature";

type Status = "idle" | "saving" | "saved" | "error";

const INPUT =
  "w-16 rounded-lg border border-black/15 bg-transparent px-2 py-1 text-center tabular-nums outline-none focus:border-foreground dark:border-white/20";

function formatRange(range: TempRangeF | null): string {
  return range ? `${range.min} to ${range.max}°F` : "any weather";
}

// "Comfortable in 68 to 95°F" (same wording as the entry card); Edit opens
// low/high fields that are saved together.
export function TempRangeEditor({ itemId, initial }: { itemId: string; initial: TempRangeF | null }) {
  const router = useRouter();
  const [range, setRange] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [low, setLow] = useState(initial ? String(initial.min) : "");
  const [high, setHigh] = useState(initial ? String(initial.max) : "");
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  function startEditing() {
    setLow(range ? String(range.min) : "");
    setHigh(range ? String(range.max) : "");
    setProblem(null);
    setStatus("idle");
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = TempRangeF.safeParse({ min: Number(low), max: Number(high) });
    if (low.trim() === "" || high.trim() === "" || !next.success) {
      setProblem(`Whole numbers from ${TEMP_F_MIN} to ${TEMP_F_MAX}, low first.`);
      return;
    }
    setProblem(null);
    setStatus("saving");
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempRangeF: next.data }),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    const { tempRangeF } = (await res.json()) as { tempRangeF: TempRangeF };
    setRange(tempRangeF);
    setEditing(false);
    setStatus("saved");
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground/60">Comfortable in</span>
        <span className="rounded-full bg-black/[.05] px-2.5 py-0.5 tabular-nums dark:bg-white/[.08]">
          {formatRange(range)}
        </span>
        <button
          type="button"
          onClick={startEditing}
          aria-label={range ? "Edit temperature range" : "Set temperature range"}
          className="text-foreground/60 underline underline-offset-2 hover:text-foreground">
          {range ? "Edit" : "Set"}
        </button>
        {status === "saved" && (
          <span role="status" className="text-xs text-foreground/50">
            Saved
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground/60">Comfortable in</span>
        <input
          aria-label="Lowest °F"
          type="number"
          inputMode="numeric"
          step={1}
          min={TEMP_F_MIN}
          max={TEMP_F_MAX}
          value={low}
          onChange={(e) => setLow(e.target.value)}
          className={INPUT}
        />
        <span className="text-foreground/60">to</span>
        <input
          aria-label="Highest °F"
          type="number"
          inputMode="numeric"
          step={1}
          min={TEMP_F_MIN}
          max={TEMP_F_MAX}
          value={high}
          onChange={(e) => setHigh(e.target.value)}
          className={INPUT}
        />
        <span className="text-foreground/60">°F</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          aria-label="Save temperature range"
          disabled={status === "saving"}
          className="rounded-full bg-foreground px-4 py-1 text-sm font-medium text-background disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel temperature change"
          className="text-sm text-foreground/60 hover:underline"
        >
          Cancel
        </button>
      </div>
      {(problem || status === "error") && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {problem ?? "Couldn't save. Try again."}
        </p>
      )}
    </form>
  );
}
