"use client";

import { use, useEffect, useRef, useState } from "react";
import { ItemCard, type EditedItem } from "@/components/entry/ItemCard";
import { CleanedNote } from "@/components/entry/CleanedNote";
import { CUTTING_OUT, extractErrorMessage, OFFLINE } from "@/components/entry/messages";
import { shrinkScreenshot } from "@/components/entry/shrink";
import { aiNotice } from "@/lib/ai/notices";
import type { Category, ItemTags } from "@/lib/ai/schemas/common";
import type { BuyCheck as BuyCheckResponse, BuyCheckResult } from "@/lib/check/buy-check";
import { INCOMPLETE_ERROR } from "@/lib/check/reasons";
import type { ItemDraft } from "@/lib/entry/draft";
import type { TempUnit } from "@/lib/profile/temp-unit";
import { BuyResult } from "./BuyResult";

const CHECK_FAILED = "Couldn't check it. Try again?";

type Step =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "cutting" }
  // `original` is the draft before the model cut its photo out.
  | { kind: "draft"; draft: ItemDraft; original?: ItemDraft; checking: boolean }
  | {
      kind: "result";
      title: string;
      photo: string | null;
      category: Category;
      tags: ItemTags;
      onModel: boolean;
      result: BuyCheckResult;
    };

// Upload a screenshot → confirm the card → see the score. One item at a
// time; nothing is kept once you check another.
// tempUnit streams in after the page; only the card reads it, long after.
export function BuyCheck({ tempUnit }: { tempUnit: Promise<TempUnit> }) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [problem, setProblem] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [round, setRound] = useState(0);
  // The item to send again when the model didn't finish scoring it.
  const [retry, setRetry] = useState<EditedItem>();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = step.kind === "loading" || step.kind === "cutting" || (step.kind === "draft" && step.checking);

  // An on-model photo is redrawn as the garment alone on white, so the
  // outfit boards show no person. Nothing is stored. If it fails the card
  // keeps the original, without a word.
  async function cutOut(draft: ItemDraft) {
    setStep({ kind: "cutting" });
    try {
      const res = await fetch("/api/checks/cutout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo: draft.imageUrls[0], title: draft.title, tags: draft.tags }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.photo) {
        const cleaned: ItemDraft = { ...draft, imageUrls: [json.photo], onModel: false };
        setStep({ kind: "draft", draft: cleaned, original: draft, checking: false });
        return;
      }
    } catch {
      // Keep the original.
    }
    setStep({ kind: "draft", draft, checking: false });
  }

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
        if (json.draft.onModel && json.draft.imageUrls[0]) await cutOut(json.draft);
        else setStep({ kind: "draft", draft: json.draft, checking: false });
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

  async function check(draft: ItemDraft, edited: EditedItem, original?: ItemDraft) {
    setProblem(undefined);
    setRetry(undefined);
    setStep({ kind: "draft", draft, original, checking: true });
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: edited.title, tags: edited.tags, photo: draft.imageUrls[0] }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<BuyCheckResponse> & { error?: string };
      if (res.ok && "result" in json && json.result) {
        setStep({
          kind: "result",
          title: edited.title,
          photo: draft.imageUrls[0] ?? null,
          category: edited.tags.category,
          tags: edited.tags,
          onModel: draft.onModel,
          result: json.result,
        });
        return;
      }
      if (res.ok && json.error === INCOMPLETE_ERROR) setRetry(edited);
      setProblem(res.ok && "message" in json ? json.message : (aiNotice(json.error) ?? CHECK_FAILED));
    } catch {
      setProblem(OFFLINE);
    }
    setStep({ kind: "draft", draft, original, checking: false });
  }

  function checkAnother() {
    setProblem(undefined);
    setRetry(undefined);
    setStep({ kind: "idle" });
  }

  return (
    <div className="flex flex-col gap-8">
      {(step.kind === "idle" || step.kind === "loading" || step.kind === "cutting") && (
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
          className="dropzone flex min-h-64 flex-col items-center justify-center gap-4 px-8 py-12 text-center md:aspect-[4/5] md:min-h-0"
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
            className="btn-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:cursor-default peer-disabled:opacity-40"
          >
            {step.kind === "loading" || step.kind === "cutting" ? "Reading…" : "Choose a screenshot"}
          </label>
          <p className="max-w-[40ch] text-sm text-ink-2">
            A screenshot of the product page.
            <span className="hidden sm:inline"> You can also drop or paste it.</span>
          </p>
        </div>
      )}

      <div role="status" aria-live="polite" className="empty:hidden">
        {problem && (
          <p className="notice">
            {problem}
          </p>
        )}
        {step.kind === "loading" && <p className="text-sm text-ink-2">Reading your screenshot…</p>}
        {step.kind === "cutting" && <p className="text-sm text-ink-2">{CUTTING_OUT}</p>}
        {step.kind === "draft" && step.checking && (
          <p className="text-sm text-ink-2">Checking it against your closet…</p>
        )}
      </div>

      {step.kind === "draft" && retry && (
        <button
          type="button"
          onClick={() => check(step.draft, retry, step.original)}
          className="btn-primary self-start"
        >
          Try again
        </button>
      )}
      {step.kind === "draft" && (
        <button
          type="button"
          onClick={checkAnother}
          disabled={step.checking}
          className="btn-text self-start"
        >
          Use another screenshot
        </button>
      )}
      {step.kind === "draft" && (
        <ItemCard
          key={round}
          draft={step.draft}
          saving={step.checking}
          onSave={(edited) => check(step.draft, edited, step.original)}
          submitLabel="Check it"
          busyLabel="Checking…"
          hint="Fix anything that's off, then check."
          tempUnit={use(tempUnit)}
          photoNote={
            step.original && (
              <CleanedNote
                disabled={step.checking}
                onUseOriginal={() => step.original && setStep({ kind: "draft", draft: step.original, checking: false })}
              />
            )
          }
        />
      )}
      {step.kind === "result" && (
        <BuyResult
          title={step.title}
          photo={step.photo}
          category={step.category}
          tags={step.tags}
          onModel={step.onModel}
          result={step.result}
          onCheckAnother={checkAnother}
        />
      )}
    </div>
  );
}
