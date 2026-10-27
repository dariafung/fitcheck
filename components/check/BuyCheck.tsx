"use client";

import { useEffect, useRef, useState } from "react";
import { ItemCard, type EditedItem } from "@/components/entry/ItemCard";
import { extractErrorMessage, OFFLINE } from "@/components/entry/messages";
import { shrinkScreenshot } from "@/components/entry/shrink";
import type { BuyCheck as BuyCheckResponse, BuyCheckResult } from "@/lib/check/buy-check";
import { INCOMPLETE_ERROR } from "@/lib/check/reasons";
import type { ItemDraft } from "@/lib/entry/draft";
import { BuyResult } from "./BuyResult";

const CHECK_FAILED = "Couldn't check it. Try again?";

type Step =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "draft"; draft: ItemDraft; checking: boolean }
  | { kind: "result"; title: string; photo: string | null; result: BuyCheckResult };

// Upload a screenshot → confirm the card → see the score. One item at a
// time; nothing is kept once you check another.
export function BuyCheck() {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [problem, setProblem] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [round, setRound] = useState(0);
  // The item to send again when the model didn't finish scoring it.
  const [retry, setRetry] = useState<EditedItem>();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = step.kind === "loading" || (step.kind === "draft" && step.checking);

  async function upload(file: File) {
    setProblem(undefined);
    setStep({ kind: "loading" });
    try {
      const body = new FormData();
      body.append("screenshot", await shrinkScreenshot(file), file.name);
      const res = await fetch("/api/checks/extract", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.draft) {
        setRound((r) => r + 1);
        setStep({ kind: "draft", draft: json.draft, checking: false });
      } else {
        setProblem(extractErrorMessage(json.error));
        setStep({ kind: "idle" });
      }
    } catch {
      setProblem(OFFLINE);
      setStep({ kind: "idle" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file || busy || step.kind !== "idle") return;
      event.preventDefault();
      void upload(file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function check(draft: ItemDraft, edited: EditedItem) {
    setProblem(undefined);
    setRetry(undefined);
    setStep({ kind: "draft", draft, checking: true });
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: edited.title, tags: edited.tags }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<BuyCheckResponse> & { error?: string };
      if (res.ok && "result" in json && json.result) {
        setStep({ kind: "result", title: edited.title, photo: draft.imageUrls[0] ?? null, result: json.result });
        return;
      }
      if (res.ok && json.error === INCOMPLETE_ERROR) setRetry(edited);
      setProblem(res.ok && "message" in json ? json.message : CHECK_FAILED);
    } catch {
      setProblem(OFFLINE);
    }
    setStep({ kind: "draft", draft, checking: false });
  }

  function checkAnother() {
    setProblem(undefined);
    setRetry(undefined);
    setStep({ kind: "idle" });
  }

  return (
    <div className="flex flex-col gap-6">
      {(step.kind === "idle" || step.kind === "loading") && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && !busy) void upload(file);
          }}
          data-dragging={dragging || undefined}
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 px-4 py-8 text-center data-dragging:border-foreground dark:border-white/20"
        >
          <input
            ref={inputRef}
            id="screenshot"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor="screenshot"
            className="cursor-pointer rounded-full bg-foreground px-5 py-2.5 font-medium text-background peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:cursor-default peer-disabled:opacity-50"
          >
            {step.kind === "loading" ? "Reading…" : "Choose a screenshot"}
          </label>
          <p className="text-sm opacity-60">
            A screenshot of the product page.
            <span className="hidden sm:inline"> You can also drop or paste it.</span>
          </p>
        </div>
      )}

      <div role="status" aria-live="polite" className="empty:hidden">
        {problem && (
          <p className="rounded-xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-sm font-medium">
            {problem}
          </p>
        )}
        {step.kind === "loading" && <p className="text-sm opacity-70">Reading your screenshot…</p>}
        {step.kind === "draft" && step.checking && (
          <p className="text-sm opacity-70">Checking it against your closet…</p>
        )}
      </div>

      {step.kind === "draft" && retry && (
        <button
          type="button"
          onClick={() => check(step.draft, retry)}
          className="self-start rounded-full bg-foreground px-5 py-2.5 font-medium text-background"
        >
          Try again
        </button>
      )}
      {step.kind === "draft" && (
        <button
          type="button"
          onClick={checkAnother}
          disabled={step.checking}
          className="self-start text-sm underline opacity-70 disabled:opacity-40"
        >
          Use another screenshot
        </button>
      )}
      {step.kind === "draft" && (
        <ItemCard
          key={round}
          draft={step.draft}
          saving={step.checking}
          onSave={(edited) => check(step.draft, edited)}
          submitLabel="Check it"
          busyLabel="Checking…"
          hint="Fix anything that's off, then check."
        />
      )}
      {step.kind === "result" && (
        <BuyResult title={step.title} photo={step.photo} result={step.result} onCheckAnother={checkAnother} />
      )}
    </div>
  );
}
