"use client";

import Image from "next/image";
import { useState } from "react";
import { AI_BUDGET_NOTICE, aiNotice } from "@/lib/ai/notices";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { STYLE_FAILED, STYLE_IT, STYLING } from "@/lib/check/reasons";
import { OutfitBoard, type BoardPiece } from "./OutfitBoard";

export interface StyleCandidate {
  photo: string;
  title: string;
  tags: ItemTags;
}

// "Style it with AI" for the sample outfits on one result: one outfit at a
// time, each picture kept only while the page shows this result. Over
// budget or over the daily limit, every button goes away and `stopped`
// says why.
export function useStyleIt(candidate: StyleCandidate | null) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [showing, setShowing] = useState<Record<string, boolean>>({});
  const [stopped, setStopped] = useState<string | null>(null);

  async function style(outfitId: string, itemIds: string[]) {
    if (!candidate || busyId) return;
    setBusyId(outfitId);
    setFailedId(null);
    try {
      const res = await fetch("/api/checks/style", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidate, itemIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && typeof json.image === "string") {
        setImages((all) => ({ ...all, [outfitId]: json.image }));
        setShowing((all) => ({ ...all, [outfitId]: true }));
      } else if (json.error === "budget") {
        setStopped(AI_BUDGET_NOTICE);
      } else if (aiNotice(json.error)) {
        setStopped(aiNotice(json.error) ?? null);
      } else {
        setFailedId(outfitId);
      }
    } catch {
      setFailedId(outfitId);
    } finally {
      setBusyId(null);
    }
  }

  const toggle = (outfitId: string) => setShowing((all) => ({ ...all, [outfitId]: !all[outfitId] }));

  return { enabled: candidate !== null, busyId, failedId, images, showing, stopped, style, toggle };
}

export type StyleIt = ReturnType<typeof useStyleIt>;

// One sample outfit: the board of real photos, or the AI picture of it.
export function StyledOutfit({
  outfitId,
  pieces,
  itemIds,
  styleIt,
}: {
  outfitId: string;
  pieces: BoardPiece[];
  // Owned items in the outfit, for the request.
  itemIds: string[];
  styleIt: StyleIt;
}) {
  const image = styleIt.images[outfitId];
  const busy = styleIt.busyId === outfitId;
  // Every piece, the candidate plus each owned item, needs a photo to copy.
  const canStyle =
    styleIt.enabled && pieces.length === itemIds.length + 1 && pieces.every((p) => p.src) && !styleIt.stopped;
  return (
    <div className="flex w-56 shrink-0 snap-start flex-col items-start gap-2 md:w-auto">
      {image && styleIt.showing[outfitId] ? (
        <div data-testid="ai-board" className="relative aspect-[4/5] w-full border border-line bg-paper">
          <Image
            src={image}
            alt={`AI-generated look: ${pieces.map((p) => p.title).join(", ")}`}
            fill
            unoptimized
            sizes="(min-width: 768px) 30vw, 224px"
            className="object-contain"
          />
          <span className="absolute top-0 left-0 bg-ink px-1.5 py-0.5 text-xs font-medium text-paper">AI-generated</span>
        </div>
      ) : (
        <div aria-busy={busy} className={`w-full ${busy ? "opacity-50 motion-safe:animate-pulse" : ""}`}>
          <OutfitBoard pieces={pieces} />
        </div>
      )}
      {busy ? (
        <p className="text-sm text-ink-2">{STYLING}</p>
      ) : image ? (
        <button type="button" className="btn-text" onClick={() => styleIt.toggle(outfitId)}>
          {styleIt.showing[outfitId] ? "Show real photos" : "Show AI look"}
        </button>
      ) : (
        canStyle && (
          <button
            type="button"
            className="btn-text"
            disabled={styleIt.busyId !== null}
            onClick={() => void styleIt.style(outfitId, itemIds)}
          >
            {STYLE_IT}
          </button>
        )
      )}
      {styleIt.failedId === outfitId && !busy && <p className="text-sm text-ink-2">{STYLE_FAILED}</p>}
    </div>
  );
}
