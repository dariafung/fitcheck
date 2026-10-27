"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

const INPUT =
  "w-24 rounded-lg border border-black/15 bg-transparent px-2 py-1 tabular-nums outline-none focus:border-foreground dark:border-white/20";
const ERROR = "text-xs text-red-600 dark:text-red-400";

export function ProfileForm({ initial, initialUnits }: { initial: Profile; initialUnits: Units }) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);
  const [fields, setFields] = useState(() => fieldsFor(initial, initialUnits));
  const [shape, setShape] = useState<BodyShape | null>(initial.bodyShape);
  const [mix, setMix] = useState(() =>
    Object.fromEntries(Occasion.options.map((o) => [o, String(initial.lifestyleMix[o])])) as Record<Occasion, string>,
  );
  const [errors, setErrors] = useState<Partial<Record<Measurement | Occasion | "shape", string>>>({});
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
    const found = check();
    setErrors(found);
    const input = ProfileInput.safeParse({
      ...Object.fromEntries(MEASUREMENTS.map((m) => [m, fields[m].metric])),
      bodyShape: shape,
      lifestyleMix: Object.fromEntries(Occasion.options.map((o) => [o, Number(mix[o])])),
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
    <form onSubmit={save} noValidate className="flex flex-col gap-10">
      <section aria-labelledby="body-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="body-heading" className="text-lg font-semibold">
            Your body
          </h2>
          <div role="group" aria-label="Units" className="flex rounded-full border border-black/15 p-0.5 text-sm dark:border-white/20">
            {(["imperial", "metric"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={units === u}
                onClick={() => switchUnits(u)}
                className="rounded-full px-3 py-0.5 aria-pressed:bg-foreground aria-pressed:text-background"
              >
                {u === "imperial" ? "in · lb" : "cm · kg"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-foreground/60">Height and weight are a must. The rest helps.</p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {MEASUREMENTS.map((m) => (
            <div key={m} className="flex flex-col gap-1">
              <label htmlFor={m} className="text-sm text-foreground/70">
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
                <span className="text-sm text-foreground/60">{unitLabel(kindOf(m), units)}</span>
              </div>
              {m === "heightCm" && units === "imperial" && height !== null && !Number.isNaN(height) && (
                <span className="text-xs text-foreground/50">{feetAndInches(height / CM_PER_IN)}</span>
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
          <legend className="mb-2 text-sm text-foreground/70">Body shape</legend>
          <div className="flex flex-wrap gap-2">
            {BODY_SHAPES.map((s) => (
              <label
                key={s}
                className="cursor-pointer rounded-full border border-black/15 px-3 py-1 text-sm has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 dark:border-white/20"
              >
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
      </section>

      <section aria-labelledby="mix-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="mix-heading" className="text-lg font-semibold">
            Outfits you want each season
          </h2>
          <p className="text-sm text-foreground/60">How many different looks for each.</p>
        </div>
        <div className="flex flex-col gap-3">
          {Occasion.options.map((o) => (
            <div key={o} className="flex flex-wrap items-center gap-3">
              <label htmlFor={`mix-${o}`} className="w-16 text-sm">
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && (
          <p role="status" className="text-sm text-foreground/60">
            Saved
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t save. Try again.
          </p>
        )}
      </div>
    </form>
  );
}
