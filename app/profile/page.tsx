import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { PhoneLogOut } from "@/components/auth/account-nav";
import { isReadOnly } from "@/lib/auth/session";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { loadProfile } from "@/lib/profile/profile";
import { parseUnits, UNITS_COOKIE } from "@/lib/profile/units";
import { wearLogEnabledFor } from "@/lib/wear/settings";
import { describeLocation } from "@/lib/weather/location";
import { LocationPicker } from "./location-picker";
import { ProfileForm } from "./profile-form";
import { WearLogSetting } from "./wear-log-setting";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-16">
      <h1 className="text-xl font-medium">Profile</h1>
      <Suspense fallback={<FormSkeleton />}>
        <BodyAndOutfits />
      </Suspense>
      <Suspense>
        <WeatherLocation />
      </Suspense>
      <Suspense>
        <WearLog />
      </Suspense>
      <Suspense>
        <PhoneLogOut />
      </Suspense>
    </div>
  );
}

async function BodyAndOutfits() {
  await connection();
  const [profile, jar, readOnly] = await Promise.all([
    currentUserId().then((userId) => loadProfile(createServerClient(), userId)),
    cookies(),
    isReadOnly(),
  ]);
  if (!profile) return <p className="text-sm text-ink-2">Couldn&apos;t find your profile.</p>;
  return (
    <ProfileForm
      initial={profile}
      initialUnits={parseUnits(jar.get(UNITS_COOKIE)?.value)}
      readOnly={readOnly}
    />
  );
}

async function WeatherLocation() {
  return <LocationPicker current={describeLocation(await headers())} />;
}

async function WearLog() {
  await connection();
  const [enabled, readOnly] = await Promise.all([currentUserId().then(wearLogEnabledFor), isReadOnly()]);
  return <WearLogSetting initial={enabled} readOnly={readOnly} />;
}

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 border-t border-ink pt-6">
      <div className="h-6 w-32 bg-tile motion-safe:animate-pulse" />
      <div className="h-40 bg-tile motion-safe:animate-pulse" />
    </div>
  );
}
