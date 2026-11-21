"use client";

import { useState } from "react";
import { SAVE_FAILED } from "@/components/entry/messages";
import type { TokenInfo } from "@/lib/auth/api-token";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";

// The setup steps live in the repo: docs/SHORTCUT.md.
export const SHORTCUT_GUIDE_URL = "https://github.com/dariafung/fitcheck/blob/main/docs/SHORTCUT.md";

// One fixed time zone, so the server and the browser print the same day.
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

// The token an iOS Shortcut signs in with (POST /api/shortcut/check): make
// one, copy it while it shows, revoke it. The token is only ever in this
// component's state, right after it is made; a reload shows that one exists,
// never what it is. The demo account doesn't get this block at all.
export function ShortcutToken({ initial }: { initial: TokenInfo | null }) {
  const [info, setInfo] = useState(initial);
  // Set only right after making one.
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setProblem(null);
    setCopied(false);
    const res = await fetch("/api/profile/tokens", { method }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setProblem(res?.status === 403 ? DEMO_READ_ONLY : SAVE_FAILED);
      return;
    }
    if (method === "DELETE") {
      setInfo(null);
      setToken(null);
      return;
    }
    const made: { token: string } & TokenInfo = await res.json();
    setInfo({ createdAt: made.createdAt, lastUsedAt: made.lastUsedAt });
    setToken(made.token);
  }

  async function copy() {
    if (!token) return;
    const done = await navigator.clipboard.writeText(token).then(
      () => true,
      () => false,
    );
    setCopied(done);
    if (!done) setProblem("Couldn't copy. Select the token and copy it by hand.");
  }

  return (
    <section id="shortcut" aria-labelledby="shortcut-heading" className="grid scroll-mt-6 gap-x-4 gap-y-8 border-t border-ink pt-6 md:grid-cols-12">
      <div className="flex flex-col gap-1.5 md:col-span-4">
        <h2 id="shortcut-heading" className="text-lg font-medium">
          Shortcut
        </h2>
        <p className="text-sm text-ink-2">Check a product page with one tap on your iPhone.</p>
      </div>
      <div className="flex flex-col items-start gap-4 md:col-span-7 md:col-start-6">
        {token ? (
          <>
            <label htmlFor="shortcut-token" className="text-sm text-ink-2">
              Your token. Copy it now: it won&apos;t be shown again.
            </label>
            <input
              id="shortcut-token"
              readOnly
              value={token}
              onFocus={(e) => e.target.select()}
              className="w-full border border-ink bg-paper px-3 py-3 font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <button type="button" onClick={copy} className="btn-secondary">
                Copy
              </button>
              <span role="status" className="text-sm text-ink-2">
                {copied ? "Copied" : ""}
              </span>
            </div>
          </>
        ) : info ? (
          <p className="text-base">
            Token made {DAY.format(new Date(info.createdAt))}.{" "}
            {info.lastUsedAt ? `Last used ${DAY.format(new Date(info.lastUsedAt))}.` : "Not used yet."}
          </p>
        ) : (
          <p className="text-base">No token yet.</p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {!token && (
            <button type="button" disabled={busy} onClick={() => call("POST")} className="btn-secondary">
              {info ? "Make a new token" : "Create token"}
            </button>
          )}
          {info && (
            <button type="button" disabled={busy} onClick={() => call("DELETE")} className="btn-text">
              Revoke
            </button>
          )}
        </div>
        {info && !token && <p className="text-sm text-ink-2">A new token replaces this one.</p>}
        <p className="text-sm text-ink-2">
          <a href={SHORTCUT_GUIDE_URL} target="_blank" rel="noreferrer" className="py-3.5 font-medium text-ink underline underline-offset-4">
            How to set up the Shortcut
          </a>
        </p>
        {problem && (
          <p role="alert" className="text-sm font-medium">
            {problem}
          </p>
        )}
      </div>
    </section>
  );
}
