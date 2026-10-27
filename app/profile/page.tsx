import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { loadProfile } from "@/lib/profile/profile";
import { parseUnits, UNITS_COOKIE } from "@/lib/profile/units";
import { describeLocation } from "@/lib/weather/location";
import { LocationPicker } from "./location-picker";
import { ProfileForm } from "./profile-form";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <Suspense fallback={<FormSkeleton />}>
        <BodyAndOutfits />
      </Suspense>
      <Suspense>
        <WeatherLocation />
      </Suspense>
    </div>
  );
}

async function BodyAndOutfits() {
  await connection();
  const [profile, jar] = await Promise.all([loadProfile(createServerClient(), currentUserId()), cookies()]);
  if (!profile) return <p className="text-sm text-foreground/60">Couldn&apos;t find your profile.</p>;
  return <ProfileForm initial={profile} initialUnits={parseUnits(jar.get(UNITS_COOKIE)?.value)} />;
}

async function WeatherLocation() {
  return <LocationPicker current={describeLocation(await headers())} />;
}

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-6 w-32 rounded bg-black/[.06] dark:bg-white/[.08]" />
      <div className="h-40 rounded-xl bg-black/[.04] dark:bg-white/[.06]" />
    </div>
  );
}
