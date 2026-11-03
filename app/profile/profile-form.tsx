"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { SAVE_FAILED } from "@/components/entry/messages";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { writeCookie } from "@/lib/cookie";
import { MAX_OUTFITS_WANTED, Occasion } from "@/lib/ai/schemas/common";
import {
  BODY_SHAPE_LABELS,
  BODY_SHAPES,
  MEASUREMENT_LIMITS,
  MEASUREMENTS,
  ProfileInput,
  REQUIRED_MEASUREMENTS,
  type BodyShape,
  type Measurement,
  type Profile,
} from "@/lib/profile/profile";
import {
  CM_PER_IN,
  displayBounds,
  feetAndInches,
  fromDisplay,
  toDisplay,
  unitLabel,
  unitsCookieString,
  type Units,
} from "@/lib/profile/units";
import { DEFAULT_TEMP_UNIT, type TempUnit } from "@/lib/profile/temp-unit";
import { MAX_NICKNAME_LENGTH, Nickname } from "@/lib/profile/nickname";
import { LETTER_SIZES, SHOE_SIZE_OPTIONS } from "@/lib/resale/size";

type Status = "idle" | "saving" | "saved" | "error";

const LABELS: Record<Measurement, string> = {
  heightCm: "Height",
  weightKg: "Weight",
  bustCm: "Bust",
  waistCm: "Waist",
  hipCm: "Hips",
  inseamCm: "Inseam",
};

const OCCASION_LABELS: Record<Occasion, string> = {
  work: "Work",
  school: "School",
  social: "Social",
  sport: "Sport",
  home: "Home",
};

const kindOf = (m: Measurement) => (m === "weightKg" ? "weight" : "length");

// Picked from fixed lists; all three are required.
const SIZES = ["topSize", "bottomSize", "shoeSize"] as const;
type SizeField = (typeof SIZES)[number];

const SIZE_LABELS: Record<SizeField, string> = {
  topSize: "Tops & dresses",
  bottomSize: "Bottoms",
  shoeSize: "Shoes",
};

const SIZE_OPTIONS: Record<SizeField, { value: string; label: string }[]> = {
  topSize: LETTER_SIZES.map((s) => ({ value: s, label: s })),
  bottomSize: LETTER_SIZES.map((s) => ({ value: s, label: s })),
  shoeSize: SHOE_SIZE_OPTIONS,
};

// text is what the box shows; metric is the cm / kg value behind it (null =
// empty, NaN = not a number). Untouched fields keep their stored value
// exactly, whatever the units.
interface Field {
  text: string;
  metric: number | null;
}

function fieldsFor(profile: Profile, units: Units): Record<Measurement, Field> {
  return Object.fromEntries(
    MEASUREMENTS.map((m) => {
      const v = profile[m];
      return [m, { text: v === null ? "" : String(toDisplay(kindOf(m), v, units)), metric: v }];
    }),
  ) as Record<Measurement, Field>;
}

const INPUT = "field w-24";
const ERROR = "text-sm font-medium";

// Each section is a spec sheet: what it is on the left, the fields on the right.
const SECTION = "grid gap-x-4 gap-y-8 border-t border-ink pt-6 md:grid-cols-12";
const SECTION_HEAD = "flex flex-col gap-1.5 md:col-span-4";
const SECTION_BODY = "flex flex-col gap-8 md:col-span-7 md:col-start-6";

// Preferences: one labelled row each, the control on the right.
const PREF_ROW = "grid grid-cols-[7rem_1fr] items-start gap-x-4 gap-y-2 border-b border-line py-3 sm:grid-cols-[9rem_1fr]";
const PREF_LABEL = "flex min-h-11 items-center text-base";
// Two-way switch (in · lb / cm · kg, °F / °C): 44 tall to tap, a line
// between the halves.
const SEGMENTS = "flex w-fit self-start border border-ink text-sm";
const SEGMENT =
  "h-11 min-w-14 cursor-pointer border-l border-ink px-4 transition-colors duration-150 first:border-l-0 disabled:cursor-default aria-pressed:bg-ink aria-pressed:text-paper";

export function ProfileForm({
  initial,
  initialUnits,
  readOnly = false,
}: {
  initial: Profile;
  initialUnits: Units;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);
  const [name, setName] = useState(initial.name);
  const [fields, setFields] = useState(() => fieldsFor(initial, initialUnits));
  const [shape, setShape] = useState<BodyShape | null>(initial.bodyShape);
  const [mix, setMix] = useState(() =>
    Object.fromEntries(Occasion.options.map((o) => [o, String(initial.lifestyleMix[o])])) as Record<Occasion, string>,
  );
  const [sizes, setSizes] = useState<Record<SizeField, string>>(() => ({
    topSize: initial.topSize ?? "",
    bottomSize: initial.bottomSize ?? "",
    shoeSize: initial.shoeSize ?? "",
  }));
  // Until one is saved, the unit the rest of the site already shows.
  const [tempUnit, setTempUnit] = useState<TempUnit>(initial.tempUnit ?? DEFAULT_TEMP_UNIT);
  const [resaleOptIn, setResaleOptIn] = useState(initial.resaleOptIn);
  const [errors, setErrors] = useState<
    Partial<Record<Measurement | Occasion | SizeField | "shape" | "name", string>>
  >({});
  const [status, setStatus] = useState<Status>("idle");

  function edited() {
    if (status !== "saving") setStatus("idle");
  }

  function switchUnits(next: Units) {
    if (next === units) return;
    writeCookie(unitsCookieString(next));
    setUnits(next);
    setFields((prev) =>
      Object.fromEntries(
        MEASUREMENTS.map((m) => {
          const { metric } = prev[m];
          const text = metric !== null && !Number.isNaN(metric) ? String(toDisplay(kindOf(m), metric, next)) : prev[m].text;
          return [m, { text, metric }];
        }),
      ) as Record<Measurement, Field>,
    );
    setErrors({});
  }

  function setMeasurement(m: Measurement, text: string) {
    const t = text.trim();
    const n = Number(t);
    const metric = t === "" ? null : Number.isFinite(n) ? fromDisplay(kindOf(m), n, units) : NaN;
    setFields((prev) => ({ ...prev, [m]: { text, metric } }));
    edited();
  }

  function check(): typeof errors {
    const found: typeof errors = {};
    if (!Nickname.safeParse(name).success) found.name = "2 to 30 characters.";
    for (const m of MEASUREMENTS) {
      const { metric } = fields[m];
      const { min, max } = MEASUREMENT_LIMITS[m];
      if (metric === null) {
        if (REQUIRED_MEASUREMENTS.includes(m)) found[m] = `Add your ${LABELS[m].toLowerCase()}.`;
      } else if (Number.isNaN(metric) || metric < min || metric > max) {
        const shown = displayBounds(kindOf(m), { min, max }, units);
        found[m] = `${shown.min} to ${shown.max} ${unitLabel(kindOf(m), units)}.`;
      }
    }
    if (!shape) found.shape = "Pick one.";
    for (const s of SIZES) {
      if (!sizes[s]) found[s] = "Pick a size.";
    }
    for (const o of Occasion.options) {
      const n = Number(mix[o]);
      if (mix[o].trim() === "" || !Number.isInteger(n) || n < 0 || n > MAX_OUTFITS_WANTED) {
        found[o] = `0 to ${MAX_OUTFITS_WANTED}.`;
      }
    }
    return found;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const found = check();
    setErrors(found);
    const input = ProfileInput.safeParse({
      name,
      ...Object.fromEntries(MEASUREMENTS.map((m) => [m, fields[m].metric])),
      bodyShape: shape,
      lifestyleMix: Object.fromEntries(Occasion.options.map((o) => [o, Number(mix[o])])),
      ...sizes,
      tempUnit,
      resaleOptIn,
    });
    if (Object.keys(found).length > 0 || !input.success) {
      setStatus("idle");
      return;
    }
    setStatus("saving");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.data),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  const height = fields.heightCm.metric;

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-16">
      {/* The demo account can look but not change anything: every box and
          switch in here is disabled at once. Units in Preferences stay
          usable, since they only change how numbers show in this browser. */}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-16">
        <section aria-labelledby="name-heading" className={SECTION}>
          <div className={SECTION_HEAD}>
            <h2 id="name-heading" className="text-lg font-medium">
              Your name
            </h2>
            <p className="text-sm text-ink-2">What others see, like people who might buy what you pass on.</p>
          </div>
          <div className={SECTION_BODY}>
            <div className="flex max-w-sm flex-col gap-1.5">
              <label htmlFor="name" className="text-sm text-ink-2">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="nickname"
                maxLength={MAX_NICKNAME_LENGTH}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  edited();
                }}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={INPUT}
              />
              {errors.name && (
                <p id="name-error" className={ERROR}>
                  {errors.name}
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="body-heading" className={SECTION}>
          <div className={SECTION_HEAD}>
            <h2 id="body-heading" className="text-lg font-medium">
              Your body
            </h2>
            <p className="text-sm text-ink-2">Height, weight and sizes are a must. The rest helps.</p>
          </div>

          <div className={SECTION_BODY}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
              {MEASUREMENTS.map((m) => (
                <div key={m} className="flex flex-col gap-1.5">
                  <label htmlFor={m} className="text-sm text-ink-2">
                    {LABELS[m]}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={m}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={fields[m].text}
                      onChange={(e) => setMeasurement(m, e.target.value)}
                      aria-invalid={errors[m] ? true : undefined}
                      aria-describedby={errors[m] ? `${m}-error` : undefined}
                      className={INPUT}
                    />
                    <span className="text-sm text-ink-2">{unitLabel(kindOf(m), units)}</span>
                  </div>
                  {m === "heightCm" && units === "imperial" && height !== null && !Number.isNaN(height) && (
                    <span className="text-sm text-ink-2 tabular-nums">{feetAndInches(height / CM_PER_IN)}</span>
                  )}
                  {errors[m] && (
                    <p id={`${m}-error`} className={ERROR}>
                      {errors[m]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <fieldset className="flex flex-col gap-2" aria-describedby={errors.shape ? "shape-error" : undefined}>
              <legend className="mb-2 text-sm text-ink-2">Body shape</legend>
              <div className="flex flex-wrap gap-2">
                {BODY_SHAPES.map((s) => (
                  <label key={s} className="chip">
                    <input
                      type="radio"
                      name="bodyShape"
                      value={s}
                      checked={shape === s}
                      onChange={() => {
                        setShape(s);
                        edited();
                      }}
                      className="sr-only"
                    />
                    {BODY_SHAPE_LABELS[s]}
                  </label>
                ))}
              </div>
              {errors.shape && (
                <p id="shape-error" className={ERROR}>
                  {errors.shape}
                </p>
              )}
          </fieldset>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {SIZES.map((s) => (
              <div key={s} className="flex flex-col gap-1.5">
                <label htmlFor={s} className="text-sm text-ink-2">
                  {SIZE_LABELS[s]}
                </label>
                <Select
                  id={s}
                  value={sizes[s]}
                  onChange={(e) => {
                    setSizes((prev) => ({ ...prev, [s]: e.target.value }));
                    edited();
                  }}
                  aria-invalid={errors[s] ? true : undefined}
                  aria-describedby={errors[s] ? `${s}-error` : undefined}
                  className="field"
                >
                  <option value="">Pick one</option>
                  {SIZE_OPTIONS[s].map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {errors[s] && (
                  <p id={`${s}-error`} className={ERROR}>
                    {errors[s]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="mix-heading" className={SECTION}>
        <div className={SECTION_HEAD}>
          <h2 id="mix-heading" className="text-lg font-medium">
            Outfits you want each season
          </h2>
          <p className="text-sm text-ink-2">How many different looks for each.</p>
        </div>
        <div className="flex flex-col border-t border-line md:col-span-7 md:col-start-6">
          {Occasion.options.map((o) => (
            <div key={o} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-2">
              <label htmlFor={`mix-${o}`} className="w-28 text-base">
                {OCCASION_LABELS[o]}
              </label>
              <input
                id={`mix-${o}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_OUTFITS_WANTED}
                step={1}
                value={mix[o]}
                onChange={(e) => {
                  setMix((prev) => ({ ...prev, [o]: e.target.value }));
                  edited();
                }}
                aria-invalid={errors[o] ? true : undefined}
                aria-describedby={errors[o] ? `mix-${o}-error` : undefined}
                className={INPUT}
              />
              {errors[o] && (
                <p id={`mix-${o}-error`} className={ERROR}>
                  {errors[o]}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
      </fieldset>

      <section aria-labelledby="prefs-heading" className={SECTION}>
        <div className={SECTION_HEAD}>
          <h2 id="prefs-heading" className="text-lg font-medium">
            Preferences
          </h2>
        </div>
        <div className="flex flex-col border-t border-line md:col-span-7 md:col-start-6">
          {/* Only how numbers are shown: switches at once, kept in this browser. */}
          <div className={PREF_ROW}>
            <span id="units-label" className={PREF_LABEL}>
              Units
            </span>
            <div role="group" aria-labelledby="units-label" className={SEGMENTS}>
              {(["imperial", "metric"] as const).map((u) => (
                <button key={u} type="button" aria-pressed={units === u} onClick={() => switchUnits(u)} className={SEGMENT}>
                  {u === "imperial" ? "in · lb" : "cm · kg"}
                </button>
              ))}
            </div>
          </div>

          {/* Saved with the profile: everywhere switches after Save. Locked
              for the demo account, like the rest of the form. */}
          <fieldset disabled={readOnly} className={`${PREF_ROW} min-w-0`}>
            <span id="temp-label" className={PREF_LABEL}>
              Temperature
            </span>
            <div className="flex flex-col gap-2">
              <div
                role="group"
                aria-labelledby="temp-label"
                className={SEGMENTS}
              >
                {(["F", "C"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={tempUnit === u}
                    onClick={() => {
                      setTempUnit(u);
                      edited();
                    }}
                    className={SEGMENT}
                  >
                    °{u}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          {/* The demo account is never anyone's buyer, so it doesn't see this. */}
          {!readOnly && (
            <div className={PREF_ROW}>
              <span className={PREF_LABEL}>Resale</span>
              <div className="flex flex-col">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
                  <Checkbox
                    checked={resaleOptIn}
                    onChange={(e) => {
                      setResaleOptIn(e.target.checked);
                      edited();
                    }}
                  />
                  Match me with secondhand pieces
                </label>
                <p className="flex flex-col gap-1 pl-8 text-sm text-ink-2">
                  <span>People passing on pieces see a match.</span>
                  <span>We share only your sizes, never your name or email.</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="-mt-8 flex items-center gap-4 md:pl-[calc((100%-11*16px)/12*5+5*16px)]">
        {readOnly ? (
          // As wide as the Outfit calendar's note below.
          <div className="flex-1">
            <ReadOnlyNote />
          </div>
        ) : (
          <button type="submit" disabled={status === "saving"} className="btn-primary px-10">
            {status === "saving" ? "Saving…" : "Save"}
          </button>
        )}
        {status === "saved" && (
          <p role="status" className="text-sm text-ink-2">
            Saved
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm font-medium">
            {SAVE_FAILED}
          </p>
        )}
      </div>
    </form>
  );
}
