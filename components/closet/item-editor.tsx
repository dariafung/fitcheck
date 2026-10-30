"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useRef, useState, type ReactNode } from "react";
import { ItemCard, type EditedItem } from "@/components/entry/ItemCard";
import { ACCESSORY_NOT_ADDED } from "@/components/entry/messages";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { DEMO_READ_ONLY } from "@/lib/auth/messages";
import type { ClosetItem } from "@/lib/closet/items";
import { CATEGORY_LABELS, CLOTHING_LABELS } from "@/lib/closet/labels";
import type { ItemDraft } from "@/lib/entry/draft";

// What the entry card edits on a saved item.
export interface EditableDetails {
  title: string;
  brand: string | null;
  size: string | null;
  tags: ItemTags;
  imageUrls: string[];
}

const EditDetails = createContext<{ open: () => void; saved: boolean } | null>(null);

function asDraft(details: EditableDetails): ItemDraft {
  return {
    title: details.title,
    brand: details.brand ?? undefined,
    tags: details.tags,
    onModel: false,
    lowConfidence: [],
    webSources: [],
    imagePaths: [],
    imageUrls: details.imageUrls.slice(0, 3),
    rawSource: {},
  };
}

// The item page, or in its place the entry card filled with the item's
// details. "Edit details" (anywhere inside) swaps them; saving or Cancel
// swaps back.
export function ItemEditor({
  itemId,
  details,
  children,
}: {
  itemId: string;
  details: EditableDetails;
  children: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The last saved details, so reopening before the page refreshes shows them.
  const [latest, setLatest] = useState<EditableDetails | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // Either view starts at its top; the card also takes focus, since the
  // button that opened it is gone.
  function show(edit: boolean) {
    setEditing(edit);
    requestAnimationFrame(() => {
      const el = top.current;
      if (!el) return;
      if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
      if (edit) el.focus({ preventScroll: true });
    });
  }

  function open() {
    setProblem(null);
    setSaved(false);
    show(true);
  }

  async function save(edited: EditedItem) {
    setSaving(true);
    setProblem(null);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        details: { title: edited.title, brand: edited.brand ?? null, tags: edited.tags },
        size: edited.size || null,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setProblem(await saveProblem(res));
      return;
    }
    const { item } = (await res.json()) as { item: ClosetItem };
    setLatest({ title: item.title, brand: item.brand, size: item.size, tags: item.tags, imageUrls: item.imageUrls });
    setSaved(true);
    show(false);
    router.refresh();
  }

  return (
    <div ref={top} tabIndex={-1} className="scroll-mt-10 outline-none">
      {editing ? (
        <ItemCard
          draft={asDraft(latest ?? details)}
          withSize
          initialSize={(latest ?? details).size}
          saving={saving}
          onSave={save}
          submitLabel="Save changes"
          // An accessory saved before they were turned away keeps its type
          // on show; anything else can't become one.
          categories={(latest ?? details).tags.category === "accessory" ? CATEGORY_LABELS : CLOTHING_LABELS}
          heading="Edit details"
          hint="Change anything that's off, then save."
          actions={
            <>
              <button
                type="button"
                onClick={() => show(false)}
                disabled={saving}
                className="btn-text self-start md:self-center"
              >
                Cancel
              </button>
              {problem && (
                <p role="alert" className="text-sm font-medium">
                  {problem}
                </p>
              )}
            </>
          }
        />
      ) : (
        <EditDetails value={{ open, saved }}>{children}</EditDetails>
      )}
    </div>
  );
}

async function saveProblem(res: Response | null): Promise<string> {
  if (res?.status === 403) return DEMO_READ_ONLY;
  if (res?.status === 400) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    if (error === "size_required") return "Passing-on items need a size.";
    if (error === "accessory") return ACCESSORY_NOT_ADDED;
  }
  return "Couldn't save. Try again.";
}

// Opens the editor; "Saved" next to it after a save.
export function EditDetailsButton() {
  const ctx = use(EditDetails);
  if (!ctx) return null;
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={ctx.open} className="btn-secondary">
        Edit details
      </button>
      {ctx.saved && (
        <span role="status" className="text-sm text-ink-2">
          Saved
        </span>
      )}
    </div>
  );
}
