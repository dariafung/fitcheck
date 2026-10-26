"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ItemDraft, SaveItemRequest } from "@/lib/entry/draft";
import { ItemCard, type EditedItem } from "./ItemCard";
import { extractErrorMessage, OFFLINE, SAVE_FAILED } from "./messages";
import { shrinkScreenshot } from "./shrink";

type Step =
  | { kind: "idle" }
  | { kind: "loading"; preview: string }
  | { kind: "draft"; draft: ItemDraft; saving: boolean }
  | { kind: "saved"; title: string };

export function AddByScreenshot() {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [problem, setProblem] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = step.kind === "loading" || (step.kind === "draft" && step.saving);

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
        setStep({ kind: "draft", draft: json.draft, saving: false });
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

  // Desktop: a screenshot on the clipboard can be pasted straight in.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file || busy) return;
      event.preventDefault();
      void upload(file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function save(draft: ItemDraft, edited: EditedItem) {
    setProblem(undefined);
    setStep({ kind: "draft", draft, saving: true });
    const body: SaveItemRequest = {
      entryMethod: "screenshot",
      title: edited.title,
      brand: edited.brand,
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
      setProblem(SAVE_FAILED);
    } catch {
      setProblem(OFFLINE);
    }
    setStep({ kind: "draft", draft, saving: false });
  }

  function addAnother() {
    setStep({ kind: "idle" });
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
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
          One screen is enough. Just get the photo and name in it.
          <span className="hidden sm:inline"> You can also drop or paste it.</span>
        </p>
      </div>

      <div role="status" aria-live="polite" className="empty:hidden">
        {problem && (
          <p className="rounded-xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-sm font-medium">
            {problem}
          </p>
        )}
        {step.kind === "loading" && <p className="text-sm opacity-70">Reading your screenshot…</p>}
        {step.kind === "saved" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/15">
            <p>
              <span className="font-medium">{step.title}</span> is in your closet.
            </p>
            <div className="flex gap-2">
              <Link href="/closet" className="rounded-full border px-4 py-2 text-sm">
                See closet
              </Link>
              <button type="button" onClick={addAnother} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
                Add another
              </button>
            </div>
          </div>
        )}
      </div>

      {step.kind === "loading" && <LoadingCard preview={step.preview} />}
      {step.kind === "draft" && (
        <ItemCard
          key={step.draft.imagePaths.join()}
          draft={step.draft}
          saving={step.saving}
          onSave={(edited) => save(step.draft, edited)}
        />
      )}
    </div>
  );
}

function LoadingCard({ preview }: { preview: string }) {
  return (
    <div aria-hidden className="grid gap-6 rounded-2xl border border-black/10 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:p-6 dark:border-white/15">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-xl bg-black/5 sm:max-w-none dark:bg-white/10">
        <Image src={preview} alt="" fill unoptimized sizes="(min-width: 640px) 280px, 100vw" className="object-cover object-top opacity-60" />
      </div>
      <div className="flex animate-pulse flex-col gap-3">
        <div className="h-6 w-1/2 rounded bg-black/5 dark:bg-white/10" />
        <div className="h-10 rounded-lg bg-black/5 dark:bg-white/10" />
        <div className="h-10 rounded-lg bg-black/5 dark:bg-white/10" />
        <div className="h-10 w-2/3 rounded-lg bg-black/5 dark:bg-white/10" />
      </div>
    </div>
  );
}
