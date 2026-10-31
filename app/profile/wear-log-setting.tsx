"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
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
      setProblem(res?.status === 403 ? DEMO_READ_ONLY : "Couldn't save. Try again.");
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
      <div className="flex flex-col gap-4 md:col-span-7 md:col-start-6">
        {readOnly ? (
          <>
            <p className="text-base">{enabled ? "On" : "Off"}</p>
            <ReadOnlyNote />
          </>
        ) : (
          <button
            type="button"
            aria-pressed={enabled}
            disabled={saving || refreshing}
            onClick={() => toggle(!enabled)}
            className="chip self-start"
          >
            Keep an outfit calendar
          </button>
        )}
        {!readOnly && <p className="text-sm text-ink-2">{enabled ? "On. Turn it off to hide it; your log stays." : "Off. Your log is kept."}</p>}
        {problem && (
          <p role="alert" className="text-sm font-medium">
            {problem}
          </p>
        )}
      </div>
    </section>
  );
}
