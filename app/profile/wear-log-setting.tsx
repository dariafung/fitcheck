"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { SAVE_FAILED } from "@/components/entry/messages";
import { Checkbox } from "@/components/ui/checkbox";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";

// The outfit calendar on or off, saved as soon as it's tapped. Off hides
// Calendar from the top bar and the wear counts from item pages; the log is
// kept for when it's back on.
export function WearLogSetting({ initial, readOnly }: { initial: boolean; readOnly: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  // Until the refreshed page brings the top bar up to date.
  const [refreshing, startRefresh] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setSaving(true);
    setProblem(null);
    setEnabled(next);
    const res = await fetch("/api/profile/wear-log", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setEnabled(!next);
      setProblem(res?.status === 403 ? DEMO_READ_ONLY : SAVE_FAILED);
      return;
    }
    startRefresh(() => router.refresh());
  }

  return (
    <section id="calendar" aria-labelledby="calendar-heading" className="grid scroll-mt-6 gap-x-4 gap-y-8 border-t border-ink pt-6 md:grid-cols-12">
      <div className="flex flex-col gap-1.5 md:col-span-4">
        <h2 id="calendar-heading" className="text-lg font-medium">
          Outfit calendar
        </h2>
        <p className="text-sm text-ink-2">Log what you wear and see what you reach for.</p>
      </div>
      <div className="flex flex-col gap-4 md:col-span-7 md:col-start-6 md:-mt-2.5">
        {readOnly ? (
          <>
            <p className="text-base">{enabled ? "On" : "Off"}</p>
            <ReadOnlyNote />
          </>
        ) : (
          <div className="flex flex-col">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-base">
              <Checkbox
                checked={enabled}
                disabled={saving || refreshing}
                onChange={(e) => toggle(e.target.checked)}
              />
              Keep an outfit calendar
            </label>
            <p className="pl-8 text-sm text-ink-2">Turning it off hides it. Your log is kept.</p>
          </div>
        )}
        {problem && (
          <p role="alert" className="text-sm font-medium">
            {problem}
          </p>
        )}
      </div>
    </section>
  );
}
