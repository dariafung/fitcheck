"use client";

import Image from "next/image";
import { useId, useState, type ReactNode } from "react";
import type { Category, ItemTags, Occasion } from "@/lib/ai/schemas/common";
import { CATEGORY_LABELS, FIELD_LABELS, FORMALITY_LABELS, capitalize } from "@/lib/closet/labels";
import { COLOR_FAMILIES, COLOR_FAMILY_HEX, type ColorFamily } from "@/lib/color-families";
import type { ItemDraft } from "@/lib/entry/draft";
import { ITEM_SIZE_PLACEHOLDER, MAX_ITEM_SIZE_LENGTH } from "@/lib/resale/size";
import { TEMP_F_MAX, TEMP_F_MIN } from "@/lib/temperature";
import { BrandInput } from "./BrandInput";
import { readTempRange } from "./temp-range";

const FITS = ["slim", "regular", "relaxed", "oversized"] as const;
const OCCASIONS: Occasion[] = ["work", "school", "social", "sport", "home"];

const FIELD = "field";

export interface EditedItem {
  title: string;
  brand?: string;
  // Only from a card with a size field; empty when left blank.
  size?: string;
  tags: ItemTags;
}

function splitList(text: string): string[] {
  return [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];
}

function formatPrice(cents?: number, currency?: string) {
  if (cents === undefined) return undefined;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

function uniqueHosts(sources: { url: string }[]) {
  const seen = new Map<string, { host: string; url: string }>();
  for (const { url } of sources) {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (!seen.has(host)) seen.set(host, { host, url });
  }
  return [...seen.values()];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ItemCard({
  draft,
  saving,
  onSave,
  submitLabel = "Save to closet",
  busyLabel = "Saving…",
  heading = "Look right?",
  hint = "Fix anything that's off, then save.",
  actions,
  categories = CATEGORY_LABELS,
  withSize = false,
  initialSize = null,
}: {
  draft: ItemDraft;
  saving: boolean;
  onSave: (item: EditedItem) => void;
  submitLabel?: string;
  busyLabel?: string;
  heading?: string;
  hint?: string;
  // Shown next to the submit button, e.g. Cancel and an error when editing.
  actions?: ReactNode;
  // The types offered; all of them unless a page narrows it.
  categories?: [Category, string][];
  // An optional, typed size: for items saved to the closet, not buy checks.
  withSize?: boolean;
  initialSize?: string | null;
}) {
  const [title, setTitle] = useState(draft.title);
  const [brand, setBrand] = useState(draft.brand ?? "");
  const [size, setSize] = useState(initialSize ?? "");
  const [tags, setTags] = useState<ItemTags>(draft.tags);
  const [colors, setColors] = useState(draft.tags.colors.map((c) => c.name).join(", "));
  const [materials, setMaterials] = useState(draft.tags.materials.join(", "));
  const [tempLow, setTempLow] = useState(String(draft.tags.tempRangeF?.min ?? ""));
  const [tempHigh, setTempHigh] = useState(String(draft.tags.tempRangeF?.max ?? ""));
  const temp = readTempRange(tempLow, tempHigh);
  const [shown, setShown] = useState(0);
  const unsure = new Set(draft.lowConfidence);
  const price = formatPrice(draft.priceCents, draft.currency);

  function update<K extends keyof ItemTags>(key: K, value: ItemTags[K]) {
    setTags((t) => ({ ...t, [key]: value }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    // Keep hex values for colors the user didn't rename.
    const known = new Map(draft.tags.colors.map((c) => [c.name.toLowerCase(), c]));
    onSave({
      title: title.trim(),
      brand: brand.trim() || undefined,
      ...(withSize && { size: size.trim() }),
      tags: {
        ...tags,
        colors: splitList(colors).map((name) => known.get(name.toLowerCase()) ?? { name }),
        materials: splitList(materials),
        tempRangeF: temp.range,
      },
    });
  }

  return (
    <form
      onSubmit={save}
      aria-label="Item details"
      className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-12"
    >
      <div className="flex w-3/5 flex-col gap-3 md:sticky md:top-10 md:col-span-5 md:w-full md:self-start">
        <div className="relative aspect-[4/5] overflow-hidden bg-tile">
          {draft.imageUrls[shown] ? (
            <Image
              src={draft.imageUrls[shown]}
              alt={title}
              fill
              unoptimized
              sizes="(min-width: 768px) 40vw, 60vw"
              className="object-contain p-[9%]"
            />
          ) : (
            <p className="flex h-full items-end p-4 text-sm text-ink-2">No photo</p>
          )}
        </div>
        {draft.imageUrls.length > 1 && (
          <div className="flex gap-2">
            {draft.imageUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setShown(i)}
                aria-label={`Photo ${i + 1}`}
                aria-pressed={i === shown}
                className="relative aspect-[4/5] w-14 overflow-hidden border border-transparent bg-tile transition-colors duration-150 aria-pressed:border-ink"
              >
                <Image src={url} alt="" fill unoptimized sizes="56px" className="object-contain p-1" />
              </button>
            ))}
          </div>
        )}
        {unsure.has("image") && (
          <p className="text-sm">
            Photo is the whole screenshot
            <Unsure />
          </p>
        )}
        {price && <p className="text-base tabular-nums">{price}</p>}
        {draft.webSources.length > 0 && (
          <p className="text-sm text-ink-2">
            Some details are from{" "}
            {uniqueHosts(draft.webSources).map((source, i) => (
              <span key={source.url}>
                {i > 0 && ", "}
                <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">
                  {source.host}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-5 md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-7">
        <div className="mb-3 flex flex-col gap-1 border-b border-ink pb-4">
          <h2 className="text-xl font-medium">{heading}</h2>
          <p className="text-sm text-ink-2">{hint}</p>
        </div>

        <Field label="Name" unsure={unsure.has("title")}>
          {(id) => (
            <input id={id} className={FIELD} value={title} required maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>
        <Field label="Brand" unsure={unsure.has("brand")}>
          {(id) => (
            <BrandInput id={id} className={FIELD} value={brand} maxLength={120} onChange={setBrand} />
          )}
        </Field>
        {withSize && (
          <Field label="Size" unsure={unsure.has("size")}>
            {(id) => (
              <input
                id={id}
                className={FIELD}
                value={size}
                maxLength={MAX_ITEM_SIZE_LENGTH}
                placeholder={ITEM_SIZE_PLACEHOLDER}
                onChange={(e) => setSize(e.target.value)}
              />
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label={FIELD_LABELS.category} unsure={unsure.has("category")}>
            {(id) => (
              <select id={id} className={FIELD} value={tags.category} onChange={(e) => update("category", e.target.value as Category)}>
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={FIELD_LABELS.fit} unsure={unsure.has("fit")}>
            {(id) => (
              <select
                id={id}
                className={FIELD}
                value={tags.fit ?? ""}
                onChange={(e) => update("fit", e.target.value as ItemTags["fit"])}
              >
                {/* An AI fit can be changed but not cleared: user_tags only store values. */}
                {!draft.tags.fit && <option value="">Not sure</option>}
                {FITS.map((fit) => (
                  <option key={fit} value={fit}>{capitalize(fit)}</option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={FIELD_LABELS.colorFamily} unsure={unsure.has("colorFamily")}>
            {(id) => (
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 border border-ink/20"
                  style={{ background: tags.colorFamily ? COLOR_FAMILY_HEX[tags.colorFamily] : "transparent" }}
                />
                <select
                  id={id}
                  className={`${FIELD} pl-9`}
                  value={tags.colorFamily ?? ""}
                  onChange={(e) => update("colorFamily", e.target.value as ColorFamily)}
                >
                  {!draft.tags.colorFamily && <option value="">Not sure</option>}
                  {COLOR_FAMILIES.map((family) => (
                    <option key={family} value={family}>{capitalize(family)}</option>
                  ))}
                </select>
              </div>
            )}
          </Field>
          <Field label={FIELD_LABELS.colors} unsure={unsure.has("colors")}>
            {(id) => (
              <input id={id} className={FIELD} value={colors} placeholder="black, white" onChange={(e) => setColors(e.target.value)} />
            )}
          </Field>
        </div>
        <Field label={FIELD_LABELS.materials} unsure={unsure.has("materials")}>
          {(id) => (
            <input id={id} className={FIELD} value={materials} placeholder="cotton" onChange={(e) => setMaterials(e.target.value)} />
          )}
        </Field>

        <Field label={FIELD_LABELS.formality} unsure={unsure.has("formality")}>
          {(id) => (
            <select id={id} className={FIELD} value={tags.formality} onChange={(e) => update("formality", Number(e.target.value))}>
              {FORMALITY_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          )}
        </Field>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm text-ink-2">
            {FIELD_LABELS.tempRangeF}
            {unsure.has("tempRangeF") && <Unsure />}
          </legend>
          <div className="flex items-center gap-2">
            <input
              aria-label="Lowest °F"
              type="number"
              inputMode="numeric"
              step={1}
              min={TEMP_F_MIN}
              max={TEMP_F_MAX}
              required={!!draft.tags.tempRangeF}
              value={tempLow}
              onChange={(e) => setTempLow(e.target.value)}
              className={`${FIELD} min-w-0 flex-1`}
            />
            <span className="text-ink-2">to</span>
            <input
              aria-label="Highest °F"
              type="number"
              inputMode="numeric"
              step={1}
              min={TEMP_F_MIN}
              max={TEMP_F_MAX}
              required={!!draft.tags.tempRangeF}
              value={tempHigh}
              onChange={(e) => setTempHigh(e.target.value)}
              className={`${FIELD} min-w-0 flex-1`}
            />
            <span className="text-ink-2">°F</span>
          </div>
          {temp.problem && (
            <p className="text-sm font-medium">{temp.problem}</p>
          )}
        </fieldset>
        <Chips
          label={FIELD_LABELS.occasions}
          unsure={unsure.has("occasions")}
          options={OCCASIONS}
          selected={tags.occasions}
          onToggle={(o) => update("occasions", toggle(tags.occasions, o))}
        />

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center">
          <button
            type="submit"
            disabled={saving || !title.trim() || !!temp.problem}
            className="btn-primary w-full md:w-auto md:px-10"
          >
            {saving ? busyLabel : submitLabel}
          </button>
          {actions}
        </div>
      </div>
    </form>
  );
}

function Unsure() {
  return <span className="ml-1.5 font-medium text-ink underline decoration-dotted underline-offset-4">· double-check</span>;
}

function Field({
  label,
  unsure,
  children,
}: {
  label: string;
  unsure?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-ink-2">
        {label}
        {unsure && <Unsure />}
      </label>
      {children(id)}
    </div>
  );
}

function Chips<T extends string>({
  label,
  unsure,
  options,
  selected,
  onToggle,
}: {
  label: string;
  unsure?: boolean;
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm text-ink-2">
        {label}
        {unsure && <Unsure />}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected.includes(option)}
            onClick={() => onToggle(option)}
            className="chip"
          >
            {capitalize(option)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
