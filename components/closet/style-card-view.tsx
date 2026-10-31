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
      {/* Label beside the text across the page; above it in home's narrow left column. */}
      <dl className="flex flex-col gap-3 text-sm">
        {card.rows.map((row) => (
          <div key={row.topic} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3 lg:flex-col lg:gap-0.5">
            <dt className="shrink-0 text-ink-2 sm:w-36 lg:w-auto">{TOPIC_LABELS[row.topic]}</dt>
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
        <div className="h-5 w-3/4 bg-tile motion-safe:animate-pulse" />
        <div className="h-4 w-2/3 bg-tile motion-safe:animate-pulse" />
        <div className="h-4 w-1/2 bg-tile motion-safe:animate-pulse" />
      </div>
    </StyleSection>
  );
}

// Too few feelings for a card yet.
export function StyleCardEmpty() {
  return (
    <StyleSection>
      <p className="text-sm text-ink-2">Say how 3 pieces feel and we&apos;ll sum up your style.</p>
    </StyleSection>
  );
}

function StyleSection({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="your-style" className="flex flex-col gap-6">
      {/* Same heading bar as Good for today, so the two line up side by side. */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-3 lg:h-12 lg:flex-nowrap lg:items-end">
        <h2 id="your-style" className="text-lg leading-none font-medium">
          Your style
        </h2>
        {note && (
          <span role="status" className="text-sm text-ink-2">
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
