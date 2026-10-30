"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { ItemImage } from "@/components/closet/item-image";
import type { ClosetCard } from "@/lib/closet/items";
import { OCCASION_LABELS } from "@/lib/closet/labels";
import { longDay, MAX_OUTFITS_PER_DAY } from "@/lib/wear/day";
import { outfitProblem } from "@/lib/wear/messages";
import type { LoggedOutfit } from "@/lib/wear/stats";
import { OutfitEditor } from "./outfit-editor";

// One day's outfits, each in its own block. Editing opens a block in place;
// an editable day with nothing logged opens straight to a new outfit.
export function DayPanel({
  day,
  outfits,
  items,
  readOnly,
  editable,
}: {
  day: string;
  outfits: LoggedOutfit[];
  items: ClosetCard[];
  readOnly: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const cards = new Map(items.map((i) => [i.id, i]));
  // Until the browser knows today, nothing is editable; an empty day that is
  // gets its editor without a click.
  const open = editing ?? (editable && outfits.length === 0 ? "new" : null);

  function saved() {
    setEditing(null);
    startRefresh(() => router.refresh());
  }

  return (
    <section aria-labelledby="day-heading" aria-busy={refreshing} className="flex flex-col gap-6 border-t border-ink pt-6">
      <h2 id="day-heading" className="text-lg font-medium">
        {longDay(day)}
      </h2>

      {outfits.length === 0 && open === null && <p className="text-sm text-ink-2">Nothing logged.</p>}

      {outfits.length > 0 && (
        <ul className="flex flex-col border-t border-line">
          {outfits.map((outfit, i) =>
            open === outfit.id ? (
              <li key={outfit.id} className="border-b border-line py-4">
                <OutfitEditor day={day} outfit={outfit} items={items} onSaved={saved} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <OutfitRow
                key={outfit.id}
                outfit={outfit}
                label={`Outfit ${i + 1}`}
                cards={cards}
                editable={editable && open === null}
                onEdit={() => setEditing(outfit.id)}
                onDeleted={saved}
              />
            ),
          )}
        </ul>
      )}

      {open === "new" && (
        <OutfitEditor
          day={day}
          outfit={null}
          items={items}
          onSaved={saved}
          onCancel={outfits.length > 0 ? () => setEditing(null) : undefined}
        />
      )}

      {editable && open === null && outfits.length < MAX_OUTFITS_PER_DAY && (
        <button type="button" onClick={() => setEditing("new")} className="btn-secondary self-start">
          {outfits.length === 0 ? "Log an outfit" : "Add another outfit"}
        </button>
      )}

      {!readOnly && !editable && outfits.length > 0 && <p className="text-xs text-ink-2">Too far back to change.</p>}
      {readOnly && <ReadOnlyNote />}
    </section>
  );
}

type RowStatus = "idle" | "confirming" | "deleting" | "error";

function OutfitRow({
  outfit,
  label,
  cards,
  editable,
  onEdit,
  onDeleted,
}: {
  outfit: LoggedOutfit;
  label: string;
  cards: Map<string, ClosetCard>;
  editable: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<RowStatus>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const pieces = outfit.itemIds.flatMap((id) => cards.get(id) ?? []);

  async function remove() {
    setStatus("deleting");
    const res = await fetch(`/api/wear/outfits/${outfit.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setProblem(await outfitProblem(res));
      setStatus("error");
      return;
    }
    onDeleted();
  }

  return (
    <li aria-label={label} className="flex flex-col gap-3 border-b border-line py-4">
      <div className="flex items-start justify-between gap-4">
        <ul className="flex flex-wrap gap-1">
          {pieces.map((p) => (
            <li key={p.id} className="w-12">
              <ItemImage src={p.imageUrl} alt={p.title} category={p.category} swatch={p.swatch} sizes="48px" aspect="aspect-square" />
            </li>
          ))}
        </ul>
        {outfit.occasion && <span className="shrink-0 text-sm">{OCCASION_LABELS[outfit.occasion]}</span>}
      </div>
      {editable && status === "idle" && (
        <div className="flex gap-4 self-end">
          <button type="button" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`} className="btn-text">
            Edit
          </button>
          <button
            type="button"
            onClick={() => setStatus("confirming")}
            aria-label={`Delete ${label.toLowerCase()}`}
            className="btn-text"
          >
            Delete
          </button>
        </div>
      )}
      {status !== "idle" && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <span>Delete this outfit?</span>
            <button
              type="button"
              onClick={remove}
              aria-label="Yes, delete it"
              disabled={status === "deleting"}
              className="btn-primary h-9 px-4"
            >
              {status === "deleting" ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              aria-label="Keep it"
              disabled={status === "deleting"}
              className="btn-text"
            >
              Cancel
            </button>
          </div>
          {status === "error" && problem && (
            <p role="alert" className="text-sm font-medium">
              {problem}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
