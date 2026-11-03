"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { CONDITION_LABELS, CONDITIONS, parsePrice, priceInput, type Condition } from "@/lib/resale/listing";
import { ITEM_SIZE_PLACEHOLDER, MAX_ITEM_SIZE_LENGTH } from "@/lib/resale/size";
import { SIZE_FIRST } from "./size-form";

export const PRICE_FIRST = "Add a price in US dollars, like 25 or 24.50.";
export const CONDITION_FIRST = "Pick a condition.";

export interface Listing {
  size: string;
  askingPriceCents: number;
  condition: Condition;
}

// What passing an item on asks for, in place: its size (as on the label),
// the asking price in US dollars and its condition, all three required.
// onSave gets them checked and returns a problem to show, or null.
export function ListingForm({
  initial,
  submitLabel,
  busyLabel,
  onSave,
  onCancel,
}: {
  initial: { size: string | null; askingPriceCents: number | null; condition: string | null };
  submitLabel: string;
  busyLabel: string;
  onSave: (listing: Listing) => Promise<string | null>;
  onCancel: () => void;
}) {
  const id = useId();
  const [size, setSize] = useState(initial.size ?? "");
  const [price, setPrice] = useState(priceInput(initial.askingPriceCents));
  const [condition, setCondition] = useState<Condition | "">(
    CONDITIONS.includes(initial.condition as Condition) ? (initial.condition as Condition) : "",
  );
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = size.trim();
    const cents = parsePrice(price);
    const problem = !trimmed ? SIZE_FIRST : cents === null ? PRICE_FIRST : !condition ? CONDITION_FIRST : null;
    if (problem || cents === null || !condition) {
      setProblem(problem);
      return;
    }
    setSaving(true);
    setProblem(null);
    const next = await onSave({ size: trimmed, askingPriceCents: cents, condition });
    setSaving(false);
    setProblem(next);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2" htmlFor={`${id}-size`}>
          <span className="text-ink-2">Size</span>
          <input
            id={`${id}-size`}
            className="field w-full"
            value={size}
            maxLength={MAX_ITEM_SIZE_LENGTH}
            placeholder={ITEM_SIZE_PLACEHOLDER}
            autoFocus
            onChange={(e) => setSize(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2" htmlFor={`${id}-price`}>
          <span className="text-ink-2">Price (USD)</span>
          <input
            id={`${id}-price`}
            className="field w-full"
            inputMode="decimal"
            value={price}
            placeholder="25"
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-2 sm:col-span-1" htmlFor={`${id}-condition`}>
          <span className="text-ink-2">Condition</span>
          <Select
            id={`${id}-condition`}
            className="field w-full"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
          >
            <option value="" disabled>
              Pick one
            </option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={saving} className="btn-secondary">
          {saving ? busyLabel : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-text">
          Cancel
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </form>
  );
}
