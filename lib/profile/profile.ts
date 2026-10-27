import { z } from "zod";
import { LifestyleMix } from "../ai/schemas/common";
import type { Db } from "../db/server";

export const BODY_SHAPES = ["pear", "apple", "hourglass", "rectangle", "inverted_triangle"] as const;
export const BodyShape = z.enum(BODY_SHAPES);
export type BodyShape = z.infer<typeof BodyShape>;

export const BODY_SHAPE_LABELS: Record<BodyShape, string> = {
  pear: "Pear",
  apple: "Apple",
  hourglass: "Hourglass",
  rectangle: "Rectangle",
  inverted_triangle: "Inverted triangle",
};

// Measurements are stored in cm / kg; the page converts for display.
export const MEASUREMENTS = ["heightCm", "weightKg", "bustCm", "waistCm", "hipCm", "inseamCm"] as const;
export type Measurement = (typeof MEASUREMENTS)[number];

// Generous sanity bounds, in cm or kg.
export const MEASUREMENT_LIMITS: Record<Measurement, { min: number; max: number }> = {
  heightCm: { min: 100, max: 230 },
  weightKg: { min: 25, max: 250 },
  bustCm: { min: 50, max: 200 },
  waistCm: { min: 40, max: 200 },
  hipCm: { min: 50, max: 200 },
  inseamCm: { min: 40, max: 110 },
};

export const REQUIRED_MEASUREMENTS: readonly Measurement[] = ["heightCm", "weightKg"];

const measure = (m: Measurement) => z.number().min(MEASUREMENT_LIMITS[m].min).max(MEASUREMENT_LIMITS[m].max);

// What PUT /api/profile accepts: height, weight and body shape are required;
// the other measurements may be null.
export const ProfileInput = z.strictObject({
  heightCm: measure("heightCm"),
  weightKg: measure("weightKg"),
  bustCm: measure("bustCm").nullable(),
  waistCm: measure("waistCm").nullable(),
  hipCm: measure("hipCm").nullable(),
  inseamCm: measure("inseamCm").nullable(),
  bodyShape: BodyShape,
  lifestyleMix: LifestyleMix,
});
export type ProfileInput = z.infer<typeof ProfileInput>;

// A stored profile can still be incomplete (a new user).
export type Profile = Record<Measurement, number | null> & {
  bodyShape: BodyShape | null;
  lifestyleMix: LifestyleMix;
};

export const EMPTY_MIX: LifestyleMix = { work: 0, school: 0, social: 0, sport: 0, home: 0 };

const COLUMNS = "height_cm, weight_kg, bust_cm, waist_cm, hip_cm, inseam_cm, body_shape, lifestyle_mix";

interface Row {
  height_cm: number | null;
  weight_kg: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  inseam_cm: number | null;
  body_shape: string | null;
  lifestyle_mix: unknown;
}

const num = (v: number | null) => (v === null ? null : Number(v));

// Values from before the current formats (another body shape, an old mix)
// read as not filled in.
function toProfile(row: Row): Profile {
  const shape = BodyShape.safeParse(row.body_shape);
  const mix = LifestyleMix.safeParse(row.lifestyle_mix);
  return {
    heightCm: num(row.height_cm),
    weightKg: num(row.weight_kg),
    bustCm: num(row.bust_cm),
    waistCm: num(row.waist_cm),
    hipCm: num(row.hip_cm),
    inseamCm: num(row.inseam_cm),
    bodyShape: shape.success ? shape.data : null,
    lifestyleMix: mix.success ? mix.data : EMPTY_MIX,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round1OrNull = (n: number | null) => (n === null ? null : round1(n));

export async function loadProfile(db: Db, userId: string): Promise<Profile | null> {
  const { data } = await db.from("users").select(COLUMNS).eq("id", userId).maybeSingle().throwOnError();
  return data ? toProfile(data) : null;
}

// Saves the whole profile (measurements to 0.1 cm / kg). Null when the user
// does not exist.
export async function saveProfile(db: Db, userId: string, input: ProfileInput): Promise<Profile | null> {
  const { data } = await db
    .from("users")
    .update({
      height_cm: round1(input.heightCm),
      weight_kg: round1(input.weightKg),
      bust_cm: round1OrNull(input.bustCm),
      waist_cm: round1OrNull(input.waistCm),
      hip_cm: round1OrNull(input.hipCm),
      inseam_cm: round1OrNull(input.inseamCm),
      body_shape: input.bodyShape,
      lifestyle_mix: input.lifestyleMix,
    })
    .eq("id", userId)
    .select(COLUMNS)
    .maybeSingle()
    .throwOnError();
  return data ? toProfile(data) : null;
}
