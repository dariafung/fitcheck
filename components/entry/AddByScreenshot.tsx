"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { CLOTHING_LABELS } from "@/lib/closet/labels";
import type { ItemDraft, SaveItemRequest } from "@/lib/entry/draft";
import type { TempUnit } from "@/lib/profile/temp-unit";
import { CleanedNote } from "./CleanedNote";
import { ItemCard, type EditedItem } from "./ItemCard";
import { AiWait } from "./ai-wait";
import { ACCESSORY_NOT_ADDED, CUTTING_OUT, extractErrorMessage, OFFLINE, SAVE_FAILED } from "./messages";
import { shrinkScreenshot } from "./shrink";

type Step =
  | { kind: "idle" }
  | { kind: "loading"; preview: string }
  | { kind: "cutting"; draft: ItemDraft }
  // `original` is the draft with the store's own photo, after the model cut it out.
  | { kind: "draft"; draft: ItemDraft; original?: ItemDraft; saving: boolean }
  | { kind: "saved"; title: string };

// tempUnit streams in after the page; only the card reads it, long after.
export function AddByScreenshot({ tempUnit }: { tempUnit: Promise<TempUnit> }) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [problem, setProblem] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [round, setRound] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = step.kind === "loading" || step.kind === "cutting" || (step.kind === "draft" && step.saving);

  // An on-model photo, or one on a backdrop that can't be turned white for
  // free, is redrawn as the garment alone on white before the card shows. If that fails the card keeps the store's photo, framed on
  // white like every other, without a word.
  async function cutOut(draft: ItemDraft) {
    setStep({ kind: "cutting", draft });
    let original = draft;
    try {
      const res = await fetch("/api/items/cutout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: draft.imagePaths[0], title: draft.title, tags: draft.tags }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.original?.path && json.original?.url) {
        original = { ...draft, imagePaths: [json.original.path], imageUrls: [json.original.url] };
      }
      if (res.ok && json.path && json.url) {
        const cleaned: ItemDraft = {
          ...draft,
          imagePaths: [json.path],
          imageUrls: [json.url],
          onModel: false,
          rawSource: { ...draft.rawSource, cutOutByAi: true },
        };
        setStep({ kind: "draft", draft: cleaned, original, saving: false });
        return;
      }
    } catch {
      // Keep the original.
    }
    setStep({ kind: "draft", draft: original, saving: false });
  }

  async function upload(file: File) {
    setProblem(undefined);
    const preview = URL.createObjectURL(file);
    setStep({ kind: "loading", preview });
    try {
      const body = new FormData();
      body.append("screenshot", await shrinkScreenshot(file), file.name);
      const res = await fetch("/api/items/extract", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.draft) {
        setRound((r) => r + 1);
        if (json.draft.cutOut && json.draft.imagePaths[0]) await cutOut(json.draft);
        else setStep({ kind: "draft", draft: json.draft, saving: false });
      } else {
        setProblem(extractErrorMessage(json.error));
        setStep({ kind: "idle" });
      }
    } catch {
      setProblem(OFFLINE);
      setStep({ kind: "idle" });
    } finally {
      URL.revokeObjectURL(preview);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Desktop: a screenshot on the clipboard can be pasted straight in, but only
  // while the drop area is up. With a card open, a paste would throw the
  // card's edits away; "Add another" starts over instead.
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

  async function save(draft: ItemDraft, edited: EditedItem, original?: ItemDraft) {
    setProblem(undefined);
    setStep({ kind: "draft", draft, original, saving: true });
    const body: SaveItemRequest = {
      entryMethod: "screenshot",
      title: edited.title,
      brand: edited.brand,
      size: edited.size,
      priceCents: draft.priceCents,
      currency: draft.currency,
      imagePaths: draft.imagePaths,
      aiTags: draft.tags,
      tags: edited.tags,
      onModel: draft.onModel,
      rawSource: draft.rawSource,
    };
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStep({ kind: "saved", title: edited.title });
        return;
      }
      const json = await res.json().catch(() => ({}));
      setProblem(json.error === "accessory" ? ACCESSORY_NOT_ADDED : SAVE_FAILED);
    } catch {
      setProblem(OFFLINE);
    }
    setStep({ kind: "draft", draft, original, saving: false });
  }

  // Back to the drop area, ready for the next screenshot.
  function startOver() {
    setProblem(undefined);
    setStep({ kind: "idle" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const reading = step.kind === "loading" || step.kind === "cutting";
  const draft = step.kind === "draft" ? step : null;
  // Reading errors show above the drop area; saving errors next to Save.
  const saveProblem = draft ? problem : undefined;
  const readProblem = draft ? undefined : problem;
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (readProblem) notice.current?.scrollIntoView({ block: "nearest" });
  }, [readProblem]);

  return (
    <div className="flex flex-col gap-8">
      <div role="status" aria-live="polite" className="empty:hidden">
        {readProblem && (
          <p ref={notice} className="notice">
            {readProblem}
          </p>
        )}
        {step.kind === "saved" && (
          <div className="notice flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg">
              <span className="font-medium">{step.title}</span> is in your closet.
            </p>
            <div className="flex gap-3">
              <Link href="/closet" className="btn-secondary">
                See closet
              </Link>
              <button type="button" onClick={startOver} className="btn-primary">
                Add another
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Folds away once there's a card, as on the purchase check. */}
      {(step.kind === "idle" || reading) && (
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
          data-idle={step.kind === "idle" || undefined}
          className="dropzone flex min-h-64 flex-col items-center justify-center gap-4 px-8 py-12 text-center md:min-h-80"
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
          {/* The button says what's happening; no second line repeats it. */}
          <label
            htmlFor="screenshot"
            className="btn-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:cursor-default peer-disabled:opacity-40"
          >
            {step.kind === "loading" ? "Reading…" : step.kind === "cutting" ? CUTTING_OUT : "Choose a screenshot"}
          </label>
          <p className="max-w-[40ch] text-sm text-ink-2">
            One screen is enough. Just get the photo and name in it.
            <span className="hidden sm:inline"> You can also drop or paste it.</span>
          </p>
          <span aria-live="polite" className="sr-only">
            {step.kind === "loading" ? "Reading your screenshot…" : step.kind === "cutting" ? CUTTING_OUT : ""}
          </span>
        </div>
      )}

      {step.kind === "loading" && <AiWait name="read" />}
      {step.kind === "cutting" && <AiWait name="cutOut" />}
      {step.kind === "loading" && <LoadingCard preview={step.preview} />}
      {step.kind === "cutting" && step.draft.imageUrls[0] && <LoadingCard preview={step.draft.imageUrls[0]} />}
      {draft && (
        <button type="button" onClick={startOver} disabled={draft.saving} className="btn-text self-start">
          Use another screenshot
        </button>
      )}
      {draft && (
        <ItemCard
          key={round}
          draft={draft.draft}
          withSize
          initialSize={draft.draft.size}
          saving={draft.saving}
          onSave={(edited) => save(draft.draft, edited, draft.original)}
          categories={CLOTHING_LABELS}
          tempUnit={use(tempUnit)}
          photoNote={
            draft.original && (
              <CleanedNote
                disabled={draft.saving}
                onUseOriginal={() => draft.original && setStep({ kind: "draft", draft: draft.original, saving: false })}
              />
            )
          }
          actions={
            saveProblem && (
              <p role="alert" className="text-sm font-medium">
                {saveProblem}
              </p>
            )
          }
        />
      )}
    </div>
  );
}

function LoadingCard({ preview }: { preview: string }) {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-12">
      <div className="relative aspect-[4/5] overflow-hidden bg-tile md:col-span-5">
        <Image src={preview} alt="" fill unoptimized sizes="(min-width: 768px) 40vw, 100vw" className="object-contain p-[9%] opacity-50" />
      </div>
      <div className="flex flex-col gap-4 md:col-span-6 md:col-start-7 lg:col-span-5 motion-safe:animate-pulse">
        <div className="h-7 w-1/2 bg-tile" />
        <div className="h-10 bg-tile" />
        <div className="h-10 bg-tile" />
        <div className="h-10 w-2/3 bg-tile" />
      </div>
    </div>
  );
}
