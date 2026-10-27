"use client";

import Image from "next/image";
import { useId, useState, type ReactNode } from "react";
import type { Category, ItemTags, Occasion } from "@/lib/ai/schemas/common";
import { COLOR_FAMILIES, COLOR_FAMILY_HEX, type ColorFamily } from "@/lib/color-families";
import type { ItemDraft } from "@/lib/entry/draft";
import { TEMP_F_MAX, TEMP_F_MIN } from "@/lib/temperature";
import { readTempRange } from "./temp-range";

const CATEGORIES: [Category, string][] = [
  ["top", "Top"],
  ["bottom", "Bottom"],
  ["one_piece", "One-piece"],
  ["outerwear", "Outerwear"],
  ["shoes", "Shoes"],
  ["accessory", "Accessory"],
];
const FITS = ["slim", "regular", "relaxed", "oversized"] as const;
const FORMALITY = ["Lounge", "Casual", "Smart casual", "Business", "Formal"];
const OCCASIONS: Occasion[] = ["work", "school", "social", "sport", "home"];

const FIELD =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20";

export interface EditedItem {
  title: string;
  brand?: string;
  tags: ItemTags;
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
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
}: {
  draft: ItemDraft;
  saving: boolean;
  onSave: (item: EditedItem) => void;
}) {
  const [title, setTitle] = useState(draft.title);
  const [brand, setBrand] = useState(draft.brand ?? "");
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
      className="grid gap-6 rounded-2xl border border-black/10 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:p-6 dark:border-white/15"
    >
      <div className="mx-auto flex w-full max-w-xs flex-col gap-2 sm:max-w-none">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-black/5 dark:bg-white/10">
          {draft.imageUrls[shown] ? (
            <Image
              src={draft.imageUrls[shown]}
              alt={title}
              fill
              unoptimized
              sizes="(min-width: 640px) 280px, 100vw"
              className="object-cover"
            />
          ) : (
            <p className="flex h-full items-center justify-center text-sm opacity-60">No photo</p>
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
                className="relative aspect-[4/5] w-14 overflow-hidden rounded-md border border-black/10 aria-pressed:border-foreground dark:border-white/15"
              >
                <Image src={url} alt="" fill unoptimized sizes="56px" className="object-cover" />
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
        {price && <p className="text-sm opacity-70">{price}</p>}
        {draft.webSources.length > 0 && (
          <p className="text-sm opacity-70">
            Some details are from{" "}
            {uniqueHosts(draft.webSources).map((source, i) => (
              <span key={source.url}>
                {i > 0 && ", "}
                <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                  {source.host}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Look right?</h2>
          <p className="text-sm opacity-70">Fix anything that&apos;s off, then save.</p>
        </div>

        <Field label="Name" unsure={unsure.has("title")}>
          {(id) => (
            <input id={id} className={FIELD} value={title} required maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>
        <Field label="Brand" unsure={unsure.has("brand")}>
          {(id) => (
            <input id={id} className={FIELD} value={brand} maxLength={120} onChange={(e) => setBrand(e.target.value)} />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" unsure={unsure.has("category")}>
            {(id) => (
              <select id={id} className={FIELD} value={tags.category} onChange={(e) => update("category", e.target.value as Category)}>
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Fit" unsure={unsure.has("fit")}>
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
          <Field label="Main color" unsure={unsure.has("colorFamily")}>
            {(id) => (
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded-full border border-black/15 dark:border-white/20"
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
          <Field label="Colors" unsure={unsure.has("colors")}>
            {(id) => (
              <input id={id} className={FIELD} value={colors} placeholder="black, white" onChange={(e) => setColors(e.target.value)} />
            )}
          </Field>
        </div>
        <Field label="Materials" unsure={unsure.has("materials")}>
          {(id) => (
            <input id={id} className={FIELD} value={materials} placeholder="cotton" onChange={(e) => setMaterials(e.target.value)} />
          )}
        </Field>

        <Field label="How dressy" unsure={unsure.has("formality")}>
          {(id) => (
            <select id={id} className={FIELD} value={tags.formality} onChange={(e) => update("formality", Number(e.target.value))}>
              {FORMALITY.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          )}
        </Field>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">
            Comfortable in
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
            <span className="opacity-70">to</span>
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
            <span className="opacity-70">°F</span>
          </div>
          {temp.problem && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{temp.problem}</p>
          )}
        </fieldset>
        <Chips
          label="Good for"
          unsure={unsure.has("occasions")}
          options={OCCASIONS}
          selected={tags.occasions}
          onToggle={(o) => update("occasions", toggle(tags.occasions, o))}
        />

        <button
          type="submit"
          disabled={saving || !title.trim() || !!temp.problem}
          className="mt-2 rounded-full bg-foreground px-5 py-2.5 font-medium text-background disabled:opacity-50 sm:self-start"
        >
          {saving ? "Saving…" : "Save to closet"}
        </button>
      </div>
    </form>
  );
}

function Unsure() {
  return <span className="ml-1.5 text-xs font-normal text-amber-700 dark:text-amber-400">· double-check</span>;
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
      <label htmlFor={id} className="text-sm font-medium">
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
      <legend className="mb-1.5 text-sm font-medium">
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
            className="rounded-full border border-black/15 px-3 py-1 text-sm aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background dark:border-white/20"
          >
            {capitalize(option)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
