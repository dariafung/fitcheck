"use client";

import { useEffect, useState } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { OutfitBoard } from "@/components/check/OutfitBoard";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import type { FixView } from "@/lib/closet/fix-outfit-store";
import type { OutfitView } from "@/lib/closet/outfit-pieces";
import type { SavedOutfitView } from "@/lib/closet/saved-outfits";

export const FIX_HEADING = "Try it like this";
export const FIX_LOOKING = "Looking for an outfit that fixes this…";
// Shown as it is when no outfit helps; the model writes none of it.
export const NO_FIX = "Nothing in your closet fixes this yet.";
export const SAVED_HEADING = "Saved outfits";
const SAVE_FAILED = "Couldn't save. Try again.";
const REMOVE_FAILED = "Couldn't remove it. Try again.";

// A feeling just saved is parsed in the background: ask again for a while.
export const PENDING_RETRIES = 6;
export const PENDING_WAIT_MS = 2500;

// Whether another try is due: only while the feeling is still being parsed.
export function shouldRetry(state: FixView["state"], attempt: number): boolean {
  return state === "pending" && attempt < PENDING_RETRIES;
}

// The try after the retries ran out: it asks the server to stop waiting for
// the feeling and go by a low rating alone.
export function isLastTry(attempt: number): boolean {
  return attempt >= PENDING_RETRIES;
}

// Two outfits are the same when they have the same pieces.
export const sameOutfit = (a: readonly string[], b: readonly string[]) => a.join("+") === b.join("+");

// The saved outfits listed under the suggestion: all but the suggested one,
// which shows its saved state on its own board.
export function otherSaved<T extends { itemIds: string[] }>(saved: readonly T[], suggested: readonly string[] | null): T[] {
  return suggested ? saved.filter((o) => !sameOutfit(o.itemIds, suggested)) : [...saved];
}

async function askFix(itemId: string, settle: boolean): Promise<FixView> {
  const res = await fetch(`/api/items/${itemId}/fix${settle ? "?settle=1" : ""}`, { method: "POST" }).catch(() => null);
  if (!res?.ok) return { state: "none" };
  return ((await res.json().catch(() => null)) as FixView | null) ?? { state: "none" };
}

async function listSaved(itemId: string): Promise<SavedOutfitView[]> {
  const res = await fetch(`/api/items/${itemId}/saved-outfits`).catch(() => null);
  if (!res?.ok) return [];
  const json = (await res.json().catch(() => null)) as { outfits?: SavedOutfitView[] } | null;
  return json?.outfits ?? [];
}

function Board({ outfit }: { outfit: OutfitView }) {
  return <OutfitBoard pieces={outfit.pieces.map((p) => ({ ...p, isCandidate: false }))} />;
}

// Under "How it feels" on an item page. For a piece rated 1 or 2 stars, or
// whose note says something bad about it: one outfit from the user's own
// closet that makes it work, with one reason and a Save button. Then the saved outfits this piece is
// in, whichever page they were saved from. Both are asked for once the page
// is up. Failures say nothing: there is just no suggestion.
export function ItemOutfits({ itemId, fix, readOnly }: { itemId: string; fix: "off" | "ask" | "wait"; readOnly: boolean }) {
  // Null while asking.
  const [view, setView] = useState<FixView | null>(fix === "off" ? { state: "none" } : null);
  const [saved, setSaved] = useState<SavedOutfitView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fix === "off") return;
    let cancelled = false;
    async function ask() {
      for (let attempt = 0; ; attempt++) {
        const next = await askFix(itemId, isLastTry(attempt));
        if (cancelled) return;
        if (!shouldRetry(next.state, attempt)) {
          setView(next.state === "pending" ? { state: "none" } : next);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, PENDING_WAIT_MS));
        if (cancelled) return;
      }
    }
    void ask();
    return () => {
      cancelled = true;
    };
  }, [itemId, fix]);

  useEffect(() => {
    if (readOnly) return;
    let current = true;
    listSaved(itemId).then((outfits) => {
      if (current) setSaved(outfits);
    });
    return () => {
      current = false;
    };
  }, [itemId, readOnly]);

  const suggestion = view?.state === "suggestion" ? view : null;

  async function save() {
    if (!suggestion) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/saved-outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: suggestion.outfit.itemIds }),
    }).catch(() => null);
    const json = res?.ok ? ((await res.json().catch(() => null)) as { outfit?: { id: string } } | null) : null;
    setBusy(false);
    if (!json?.outfit) {
      setError(res?.status === 403 ? DEMO_READ_ONLY : SAVE_FAILED);
      return;
    }
    setView({ ...suggestion, savedId: json.outfit.id });
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/saved-outfits/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    // Already gone counts as removed.
    if (!res?.ok && res?.status !== 404) {
      setError(res?.status === 403 ? DEMO_READ_ONLY : REMOVE_FAILED);
      return;
    }
    setSaved((list) => list.filter((o) => o.id !== id));
    setView((v) => (v?.state === "suggestion" && v.savedId === id ? { ...v, savedId: null } : v));
  }

  const others = otherSaved(saved, suggestion?.outfit.itemIds ?? null);
  const looking = view === null && fix === "ask";
  if (!looking && !suggestion && view?.state !== "no_fix" && others.length === 0) return null;

  return (
    <div className="flex flex-col gap-10">
      {(looking || suggestion || view?.state === "no_fix") && (
        <section aria-labelledby="fix-heading" className="flex flex-col gap-4">
          <h2 id="fix-heading" className="text-lg font-medium">
            {FIX_HEADING}
          </h2>
          {looking && (
            <p className="text-sm text-ink-2" aria-busy="true">
              {FIX_LOOKING}
            </p>
          )}
          {view?.state === "no_fix" && <p className="text-sm text-ink-2">{NO_FIX}</p>}
          {suggestion && (
            <>
              <div className="w-56 max-w-full">
                <Board outfit={suggestion.outfit} />
              </div>
              <p data-testid="fix-reason" className="max-w-[34ch] font-serif text-lg">
                {suggestion.reason}
              </p>
              {readOnly ? (
                <ReadOnlyNote />
              ) : suggestion.savedId ? (
                <div className="flex flex-wrap items-center gap-4">
                  <p role="status" className="text-sm text-ink-2">
                    Saved
                  </p>
                  <button type="button" disabled={busy} onClick={() => remove(suggestion.savedId!)} className="btn-text">
                    Remove
                  </button>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={save} className="btn-secondary self-start">
                  {busy ? "Saving…" : "Save outfit"}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="saved-outfits-heading" className="flex flex-col gap-4">
          <h2 id="saved-outfits-heading" className="text-lg font-medium">
            {SAVED_HEADING}
          </h2>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-4">
            {others.map((outfit) => (
              <li key={outfit.id} data-testid="saved-outfit" className="flex flex-col items-start gap-1">
                <Board outfit={outfit} />
                <button type="button" disabled={busy} onClick={() => remove(outfit.id)} className="btn-text">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
