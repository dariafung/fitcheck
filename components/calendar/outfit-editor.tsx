"use client";

import { useState } from "react";
import { ItemImage } from "@/components/closet/item-image";
import { Occasion } from "@/lib/ai/schemas/common";
import type { ClosetCard } from "@/lib/closet/items";
import { OCCASION_LABELS } from "@/lib/closet/labels";
import type { LoggedOutfit } from "@/lib/wear/stats";
import { outfitProblem } from "@/lib/wear/messages";

// Tap the pieces you had on, maybe pick where you went, Save. A piece passed
// on since stays listed in the outfit that had it.
export function OutfitEditor({
  day,
  outfit,
  items,
  onSaved,
  onCancel,
}: {
  day: string;
  // Null for a new outfit.
  outfit: LoggedOutfit | null;
  items: ClosetCard[];
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(outfit?.itemIds));
  const [occasion, setOccasion] = useState<Occasion | null>(outfit?.occasion ?? null);
  // Fixed per new outfit, so a retried Save can't log it twice.
  const [newId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = items.filter((i) => i.status === "active" || outfit?.itemIds.includes(i.id));

  function toggle(id: string) {
    setPicked((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    const itemIds = [...picked];
    const res = await fetch(outfit ? `/api/wear/outfits/${outfit.id}` : "/api/wear/outfits", {
      method: outfit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outfit ? { itemIds, occasion } : { id: newId, date: day, itemIds, occasion }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setProblem(await outfitProblem(res));
      return;
    }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm">What did you wear?</legend>
        <ul className="grid grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4 lg:grid-cols-3">
          {shown.map((item) => {
            const on = picked.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={on}
                  className="group relative block w-full text-left"
                >
                  <span className={`block outline-offset-[-2px] ${on ? "outline-2 outline-ink" : ""}`}>
                    <ItemImage src={item.imageUrl} alt="" category={item.category} swatch={item.swatch} sizes="120px" />
                  </span>
                  {on && (
                    <span aria-hidden="true" className="absolute top-1 right-1 flex size-5 items-center justify-center bg-ink text-xs text-paper">
                      ✓
                    </span>
                  )}
                  <span className="mt-1 line-clamp-1 text-xs group-hover:underline">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div role="group" aria-label="Occasion" className="flex flex-col gap-2">
        <span className="text-sm">
          Where to? <span className="text-ink-2">Optional</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {Occasion.options.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={occasion === o}
              onClick={() => setOccasion(occasion === o ? null : o)}
              className="chip"
            >
              {OCCASION_LABELS[o]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={saving || picked.size === 0} className="btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="btn-text">
            Cancel
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="notice">
          {problem}
        </p>
      )}
    </div>
  );
}
