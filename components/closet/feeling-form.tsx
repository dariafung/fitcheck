"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MAX_FEELING_LENGTH } from "@/lib/closet/feeling-body";
import { appendTranscript, isTooLong } from "@/lib/closet/feeling-draft";
import { VoiceButton } from "./voice-button";

type Status = "idle" | "saving" | "saved" | "error";

export function FeelingForm({ itemId, initialText }: { itemId: string; initialText: string | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialText);
  const [draft, setDraft] = useState(initialText ?? "");
  const [editing, setEditing] = useState(initialText === null);
  const [status, setStatus] = useState<Status>("idle");
  // Set once a transcript lands in the box; saved as the feeling's source.
  const [usedVoice, setUsedVoice] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const tooLong = isTooLong(draft);

  function addTranscript(text: string) {
    setDraft((d) => appendTranscript(d, text));
    setUsedVoice(true);
    setEditing(true);
    setStatus("idle");
    // After the box renders with the new text, put the cursor at its end.
    requestAnimationFrame(() => {
      const el = textarea.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch(`/api/items/${itemId}/feelings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft, source: usedVoice ? "voice" : "typed" }),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    const { feeling } = (await res.json()) as { feeling: { text: string } };
    setSaved(feeling.text);
    setDraft(feeling.text);
    setEditing(false);
    setUsedVoice(false);
    setStatus("saved");
    router.refresh();
  }

  return (
    <section aria-labelledby="feeling-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="feeling-heading" className="text-lg font-semibold">
          How it feels
        </h2>
        {status === "saved" && (
          <p role="status" className="text-sm text-foreground/60">
            Saved
          </p>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <textarea
            ref={textarea}
            aria-label="How it feels"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_FEELING_LENGTH}
            rows={5}
            placeholder="Fit, comfort, how you feel in it. Anything goes."
            className="w-full resize-y rounded-xl border border-black/15 bg-transparent p-3 text-base leading-relaxed outline-none focus:border-foreground dark:border-white/20"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === "saving" || draft.trim() === "" || tooLong}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40"
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            {saved !== null && (
              <button
                type="button"
                onClick={() => {
                  setDraft(saved);
                  setEditing(false);
                  setUsedVoice(false);
                  setStatus("idle");
                }}
                className="px-2 py-2 text-sm text-foreground/60 hover:underline"
              >
                Cancel
              </button>
            )}
            {status === "error" && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                Couldn&apos;t save. Try again.
              </p>
            )}
          </div>
          {tooLong && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              That&apos;s a lot. Trim it to save.
            </p>
          )}
          <VoiceButton itemId={itemId} onText={addTranscript} />
        </form>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="w-full whitespace-pre-wrap rounded-xl bg-black/[.04] p-4 leading-relaxed dark:bg-white/[.06]">
            {saved}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setStatus("idle");
            }}
            className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Edit
          </button>
          <VoiceButton itemId={itemId} onText={addTranscript} />
        </div>
      )}
    </section>
  );
}
