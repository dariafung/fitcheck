import type { ReactNode } from "react";
import type { ProfileTopic } from "@/lib/ai/schemas/build-profile";
import type { VisibleCard } from "@/lib/closet/style-profile";

// Shared by the server card and the client one that swaps in a fresh card,
// so no server-only imports here.

const TOPIC_LABELS: Record<ProfileTopic, string> = {
  color: "Colors",
  fit: "Fit",
  feel: "Fabrics",
  length: "Length",
  style: "Style",
  occasion: "Where you wear it",
};

// Fixed zone so the server and the browser print the same day.
const UPDATED = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

export function StyleCardView({ card, note }: { card: VisibleCard; note?: string }) {
  return (
    <StyleSection note={note ?? `Updated ${UPDATED.format(new Date(card.generatedAt))}`}>
      <p>{card.headline}</p>
      <dl className="flex flex-col gap-3 text-sm">
        {card.rows.map((row) => (
          <div key={row.topic} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 text-foreground/60 sm:w-36">{TOPIC_LABELS[row.topic]}</dt>
            <dd className="flex flex-col gap-0.5">
              {row.suits && <span>{row.suits}</span>}
              {row.avoid && <span className="text-foreground/70">Skip: {row.avoid}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </StyleSection>
  );
}

export function StyleCardSkeleton({ note }: { note?: string }) {
  return (
    <StyleSection note={note}>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-5 w-3/4 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      </div>
    </StyleSection>
  );
}

// Too few feelings for a card yet.
export function StyleCardEmpty() {
  return (
    <StyleSection>
      <p className="text-sm text-foreground/60">Say how 3 pieces feel and we&apos;ll sum up your style.</p>
    </StyleSection>
  );
}

function StyleSection({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="your-style"
      className="flex flex-col gap-4 rounded-2xl border border-black/10 p-5 sm:p-6 dark:border-white/15"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="your-style" className="text-lg font-semibold">
          Your style
        </h2>
        {note && (
          <span role="status" className="text-sm text-foreground/50">
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
