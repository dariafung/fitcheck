"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import { MAX_FEELING_LENGTH } from "@/lib/closet/feeling-body";
import { appendTranscript, isTooLong } from "@/lib/closet/feeling-draft";
import { VoiceButton } from "./voice-button";

type Status = "idle" | "saving" | "saved" | "error" | "read-only";

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
      setStatus(res?.status === 403 ? "read-only" : "error");
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
    <section aria-labelledby="feeling-heading" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="feeling-heading" className="text-lg font-medium">
          How it feels
        </h2>
        {status === "saved" && (
          <p role="status" className="text-sm text-ink-2">
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
            className="field h-auto resize-y px-4 py-3 font-serif text-lg"
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={status === "saving" || draft.trim() === "" || tooLong}
              className="btn-primary"
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
                className="btn-text"
              >
                Cancel
              </button>
            )}
            {status === "error" && (
              <p role="alert" className="text-sm font-medium">
                Couldn&apos;t save. Try again.
              </p>
            )}
            {status === "read-only" && (
              <p role="alert" className="text-sm font-medium">
                {DEMO_READ_ONLY}
              </p>
            )}
          </div>
          {tooLong && (
            <p role="alert" className="text-sm font-medium">
              That&apos;s a lot. Trim it to save.
            </p>
          )}
          <VoiceButton itemId={itemId} onText={addTranscript} />
        </form>
      ) : (
        <div className="flex flex-col items-start gap-6">
          <p className="w-full font-serif text-lg whitespace-pre-wrap">{saved}</p>
          <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setStatus("idle");
            }}
            className="btn-secondary"
          >
            Edit
          </button>
          <VoiceButton itemId={itemId} onText={addTranscript} />
          </div>
        </div>
      )}
    </section>
  );
}
