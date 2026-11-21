"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import { MAX_RATING } from "@/lib/closet/item-patch";

const STARS = Array.from({ length: MAX_RATING }, (_, i) => i + 1);
const STAR_PATH = "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z";

// "3 of 5 stars", "1 of 5 stars", or "Not rated".
export function ratingLabel(rating: number | null): string {
  return rating === null ? "Not rated" : `${rating} of ${MAX_RATING} stars`;
}

// What tapping a star saves: that many stars, or none when it is the
// current rating.
export function nextRating(current: number | null, tapped: number): number | null {
  return current === tapped ? null : tapped;
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={filled ? "text-ink" : "text-ink-2"}
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

// The item's star rating under its name. One tap saves; tapping the current
// rating clears it. The demo account sees the stars and can't change them;
// with no rating it sees nothing.
export function ItemRating({ itemId, rating, readOnly }: { itemId: string; rating: number | null; readOnly: boolean }) {
  const router = useRouter();
  // Shown at once; the refreshed page brings the saved value back.
  const [shown, setShown] = useState(rating);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  if (readOnly) {
    if (rating === null) return null;
    return (
      <p role="img" aria-label={ratingLabel(rating)} data-testid="item-rating" className="mt-3 flex gap-1">
        {STARS.map((star) => (
          <Star key={star} filled={star <= rating} />
        ))}
      </p>
    );
  }

  async function rate(tapped: number) {
    const before = shown;
    const next = nextRating(before, tapped);
    setShown(next);
    setSaving(true);
    setProblem(null);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setShown(before);
      setProblem(res?.status === 403 ? DEMO_READ_ONLY : "Couldn't save. Try again.");
      return;
    }
    // A low rating, or losing one, changes what the page suggests.
    startRefresh(() => router.refresh());
  }

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div role="group" aria-label="Your rating" data-testid="item-rating" data-rating={shown ?? 0} className="-ml-3 flex">
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            disabled={saving || refreshing}
            aria-pressed={shown !== null && star <= shown}
            aria-label={star === 1 ? "1 star" : `${star} stars`}
            onClick={() => rate(star)}
            className="flex size-11 items-center justify-center"
          >
            <Star filled={shown !== null && star <= shown} />
          </button>
        ))}
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </div>
  );
}
