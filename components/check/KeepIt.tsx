"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import type { EditedItem } from "@/components/entry/ItemCard";
import { OFFLINE, SAVE_FAILED } from "@/components/entry/messages";
import type { ItemDraft, SaveItemRequest } from "@/lib/entry/draft";

export interface Bought {
  // The card as read off the screenshot, and as the user confirmed it.
  draft: ItemDraft;
  edited: EditedItem;
  // The photo the check used, as a data URL.
  photo: string;
}

type State = { kind: "ready" } | { kind: "saving" } | { kind: "failed"; message: string } | { kind: "saved"; id: string };

// "I bought it — add to closet" on a result: the checked piece goes into the
// closet with the card and photo already confirmed, through the same save
// as the add page. Only on this tap; a check on its own stores nothing.
export function KeepIt({ bought, readOnly }: { bought: Bought; readOnly: boolean }) {
  const [state, setState] = useState<State>({ kind: "ready" });
  if (readOnly) return <ReadOnlyNote />;

  async function keep() {
    setState({ kind: "saving" });
    try {
      const stored = await fetch("/api/checks/photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo: bought.photo }),
      });
      const { path, message } = await stored.json().catch(() => ({}));
      if (!stored.ok || typeof path !== "string") {
        setState({ kind: "failed", message: typeof message === "string" ? message : SAVE_FAILED });
        return;
      }
      const { draft, edited } = bought;
      const body: SaveItemRequest = {
        entryMethod: "screenshot",
        title: edited.title,
        brand: edited.brand,
        priceCents: draft.priceCents,
        currency: draft.currency,
        imagePaths: [path],
        aiTags: draft.tags,
        tags: edited.tags,
        onModel: draft.onModel,
        rawSource: { ...draft.rawSource, fromCheck: true },
      };
      const saved = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await saved.json().catch(() => ({}));
      if (saved.ok && typeof json.item?.id === "string") {
        setState({ kind: "saved", id: json.item.id });
        return;
      }
      setState({ kind: "failed", message: typeof json.message === "string" ? json.message : SAVE_FAILED });
    } catch {
      setState({ kind: "failed", message: OFFLINE });
    }
  }

  if (state.kind === "saved") {
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-3 text-base">
        <span>
          <span className="font-medium">{bought.edited.title}</span> is in your closet.
        </span>
        <Link href={`/closet/${state.id}`} className="btn-text">
          See it
        </Link>
      </p>
    );
  }
  return (
    <>
      <button type="button" onClick={keep} disabled={state.kind === "saving"} className="btn-secondary">
        {state.kind === "saving" ? "Adding…" : "I bought it — add to closet"}
      </button>
      {state.kind === "failed" && (
        <p role="status" className="text-sm font-medium">
          {state.message}
        </p>
      )}
    </>
  );
}
