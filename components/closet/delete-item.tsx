"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "confirming" | "deleting" | "error";

// "Delete" turns into "Delete this for good? [Delete] [Cancel]" in place, the
// same way the temperature range opens for editing.
export function DeleteItem({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  async function remove() {
    setStatus("deleting");
    const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    router.replace("/closet");
    router.refresh();
  }

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStatus("confirming")}
        aria-label="Delete this item"
        className="self-start text-sm text-foreground/60 underline underline-offset-2 hover:text-foreground"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span>Delete this for good?</span>
        <button
          type="button"
          onClick={remove}
          aria-label="Yes, delete it"
          disabled={status === "deleting"}
          className="rounded-full bg-foreground px-4 py-1 font-medium text-background disabled:opacity-40"
        >
          {status === "deleting" ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          aria-label="Keep it"
          disabled={status === "deleting"}
          className="text-foreground/60 hover:underline disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
      {status === "error" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Couldn&apos;t delete. Try again.
        </p>
      )}
    </div>
  );
}
