"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { CLOTHING_LABELS } from "@/lib/closet/labels";
import type { ItemDraft, SaveItemRequest } from "@/lib/entry/draft";
import type { TempUnit } from "@/lib/profile/temp-unit";
import {
  advance,
  afterReadFailure,
  isDone,
  MAX_SCREENSHOTS,
  queueLabel,
  queueSummary,
  remaining,
  startQueue,
  takeScreenshots,
  tooManyNote,
  type Queue,
} from "@/lib/entry/queue";
import { CleanedNote } from "./CleanedNote";
import { ItemCard, type EditedItem } from "./ItemCard";
import { SavedNote } from "./SavedNote";
import { AiWait } from "./ai-wait";
import { ACCESSORY_NOT_ADDED, CUTTING_OUT, extractErrorMessage, OFFLINE, SAVE_FAILED } from "./messages";
import { shrinkScreenshot } from "./shrink";

// The item just saved; `id` is null only if the answer came back without one.
interface Saved {
  title: string;
  id: string | null;
}

type Step =
  | { kind: "idle" }
  | { kind: "loading"; preview: string }
  | { kind: "cutting"; draft: ItemDraft }
  // `original` is the draft with the store's own photo, after the model cut it out.
  | { kind: "draft"; draft: ItemDraft; original?: ItemDraft; saving: boolean }
  | ({ kind: "saved" } & Saved);

// tempUnit and activeCount (the closet's active items when the page opened,
// null if unknown) stream in after the page; only the card and the saved
// note read them, long after.
export function AddByScreenshot({
  tempUnit,
  activeCount,
}: {
  tempUnit: Promise<TempUnit>;
  activeCount: Promise<number | null>;
}) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [problem, setProblem] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [round, setRound] = useState(0);
  // Several screenshots picked at once (lib/entry/queue.ts): read one after
  // another, each with its own card. Null for a single screenshot.
  const [queue, setQueue] = useState<Queue | null>(null);
  const files = useRef<File[]>([]);
  // About an earlier screenshot in the queue, kept while the next is read.
  const [queueNote, setQueueNote] = useState<string>();
  const [lastSaved, setLastSaved] = useState<Saved>();
  // Items saved since the page opened, on top of activeCount.
  const [savedHere, setSavedHere] = useState(0);
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

  // Reads what was picked, dropped or pasted: one screenshot as always, more
  // as a queue, at most MAX_SCREENSHOTS.
  function begin(picked: File[]) {
    const { taken, leftOut } = takeScreenshots(picked);
    if (taken.length === 0) return;
    const next = startQueue(taken.length);
    files.current = taken;
    setQueue(next);
    setQueueNote(leftOut > 0 ? tooManyNote(leftOut) : undefined);
    setLastSaved(undefined);
    void upload(taken[0], next);
  }

  // The queue moves on to its next screenshot, or ends at the drop area.
  function goNext(next: Queue) {
    setQueue(next);
    if (isDone(next)) {
      files.current = [];
      setStep({ kind: "idle" });
      return;
    }
    void upload(files.current[next.index], next);
  }

  // A screenshot that couldn't be read. Alone, the message shows above the
  // drop area. In a queue the rest is not lost: the queue moves on, waits
  // (offline), or stops for the day (a daily limit, with its own message).
  function readFailed(current: Queue | null, failure: Parameters<typeof afterReadFailure>[0], message: string) {
    const then = current ? afterReadFailure(failure) : "stop";
    if (current && then === "next") {
      setQueueNote(`Screenshot ${queueLabel(current)}: ${message}`);
      goNext(advance(current, "failed"));
      return;
    }
    if (then === "stop") {
      files.current = [];
      setQueue(null);
    }
    setProblem(message);
    setStep({ kind: "idle" });
  }

  // `current` is the queue this screenshot belongs to, at its place in it.
  async function upload(file: File, current: Queue | null) {
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
        readFailed(current, { error: json.error }, extractErrorMessage(json.error));
      }
    } catch {
      readFailed(current, { offline: true }, OFFLINE);
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
      const pasted = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (pasted.length === 0 || busy || step.kind !== "idle") return;
      event.preventDefault();
      begin(pasted);
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
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const saved: Saved = { title: edited.title, id: typeof json.item?.id === "string" ? json.item.id : null };
        setSavedHere((n) => n + 1);
        const next = queue && advance(queue, "added");
        if (next && !isDone(next)) {
          // More to read: say it's in, and move on.
          setLastSaved(saved);
          goNext(next);
          return;
        }
        if (next) {
          files.current = [];
          setQueue(next);
        }
        setLastSaved(undefined);
        setStep({ kind: "saved", ...saved });
        return;
      }
      setProblem(json.error === "accessory" ? ACCESSORY_NOT_ADDED : SAVE_FAILED);
    } catch {
      setProblem(OFFLINE);
    }
    setStep({ kind: "draft", draft, original, saving: false });
  }

  // Back to the drop area, ready for the next screenshot.
  function startOver() {
    setProblem(undefined);
    files.current = [];
    setQueue(null);
    setQueueNote(undefined);
    setLastSaved(undefined);
    setStep({ kind: "idle" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Leaves this screenshot out and reads the next. Its photo, stored when it
  // was read, goes with the daily cleanup of unsaved photos.
  function skip() {
    if (!queue) return;
    setProblem(undefined);
    goNext(advance(queue, "skipped"));
  }

  // After a pause (offline): the same screenshot again, then the rest.
  function resume() {
    if (!queue || isDone(queue)) return;
    void upload(files.current[queue.index], queue);
  }

  const reading = step.kind === "loading" || step.kind === "cutting";
  const draft = step.kind === "draft" ? step : null;
  // A queue with screenshots still to deal with; waiting, when it's paused.
  const going = queue && !isDone(queue) ? queue : null;
  const paused = going && step.kind === "idle" ? going : null;
  const saved = step.kind === "saved" ? step : lastSaved;
  // Reading errors show above the drop area; saving errors next to Save.
  const saveProblem = draft ? problem : undefined;
  const readProblem = draft ? undefined : problem;
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (readProblem) notice.current?.scrollIntoView({ block: "nearest" });
  }, [readProblem]);

  return (
    <div className="flex flex-col gap-8">
      <div role="status" aria-live="polite" className="flex flex-col gap-3 empty:hidden">
        {queueNote && <p className="notice">{queueNote}</p>}
        {readProblem && (
          <p ref={notice} className="notice">
            {readProblem}
          </p>
        )}
        {paused && (
          <button type="button" onClick={resume} className="btn-secondary self-start">
            Keep going ({remaining(paused)} left)
          </button>
        )}
        {saved && (
          <SavedNote
            title={saved.title}
            itemId={saved.id}
            activeCount={addTo(use(activeCount), savedHere)}
            more={going !== null}
          >
            {step.kind === "saved" && (
              <div className="flex gap-3">
                <Link href="/closet" className="btn-secondary">
                  See closet
                </Link>
                <button type="button" onClick={startOver} className="btn-primary">
                  Add another
                </button>
              </div>
            )}
          </SavedNote>
        )}
        {queue && isDone(queue) && (
          <p data-testid="queue-summary" className="text-sm text-ink-2">
            {queueSummary(queue)}
          </p>
        )}
      </div>

      {going && !paused && (
        <div className="flex items-center gap-4">
          <p data-testid="queue-position" className="text-sm font-medium tabular-nums">
            Screenshot {queueLabel(going)}
          </p>
          {draft && (
            <button type="button" onClick={skip} disabled={draft.saving} className="btn-text">
              Skip this one
            </button>
          )}
        </div>
      )}

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
            if (!busy) begin([...e.dataTransfer.files]);
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
            multiple
            disabled={busy}
            onChange={(e) => begin([...(e.target.files ?? [])])}
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
            One screen is enough. Just get the photo and name in it. Pick up to {MAX_SCREENSHOTS} at once.
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
      {draft && !going && (
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

// The closet's active items now: the count when the page opened plus what
// was saved here since. Null stays null.
function addTo(count: number | null, savedHere: number): number | null {
  return count === null ? null : count + savedHere;
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
