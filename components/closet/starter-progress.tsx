import Link from "next/link";
import { starterLabel, starterProgress } from "@/lib/closet/starter";

// "3 of 5" over a thin bar, while the closet is under the starter target;
// nothing from then on. `activeCount` is the number of active items.
export function StarterProgress({ activeCount }: { activeCount: number }) {
  const progress = starterProgress(activeCount);
  if (!progress) return null;
  return (
    <div data-testid="starter-progress" className="flex w-full max-w-sm flex-col gap-2">
      <p className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-ink-2">Start with the {progress.target} pieces you wear most.</span>
        <span className="shrink-0 font-medium tabular-nums">{starterLabel(progress)}</span>
      </p>
      <div aria-hidden className="h-0.5 bg-line">
        <div className="h-full bg-ink" style={{ width: `${(progress.count / progress.target) * 100}%` }} />
      </div>
    </div>
  );
}

// The same on home, with the way to add the next one. The link keeps its
// look but is 44 px tall to tap; the negative margin gives the height back.
export function StarterNudge({ activeCount }: { activeCount: number }) {
  if (!starterProgress(activeCount)) return null;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
      <StarterProgress activeCount={activeCount} />
      <Link
        href="/closet/add"
        className="-my-[13px] inline-flex min-h-11 items-center text-sm underline underline-offset-4 transition-colors duration-150 hover:text-ink-2"
      >
        Add clothes
      </Link>
    </div>
  );
}
