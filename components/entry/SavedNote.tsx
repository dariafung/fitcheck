import Link from "next/link";
import type { ReactNode } from "react";
import { starterAfterSave } from "@/lib/closet/starter";

// What the add page says once an item is saved: that it's in, how many are
// left to the starter target (or, on the save that gets there, the way to a
// purchase check), and a light nudge to say how it feels. `activeCount`
// counts the new item; null when it isn't known, and nothing is said about
// progress. `more` means a queue is moving on to its next screenshot: only
// the short line shows, with no links to leave by.
export function SavedNote({
  title,
  itemId,
  activeCount,
  more = false,
  children,
}: {
  title: string;
  itemId: string | null;
  activeCount: number | null;
  more?: boolean;
  // The buttons, beside the text from 640 px.
  children?: ReactNode;
}) {
  const starter = activeCount === null ? null : starterAfterSave(activeCount);
  return (
    <div className="notice flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-lg">
          <span className="font-medium">{title}</span> is in your closet.
        </p>
        {starter && (
          <p data-testid="starter-left" className="text-sm text-ink-2">
            {starter.text}
            {starter.reached && !more && (
              <>
                {" "}
                <Link href="/check" className="py-3.5 font-medium text-ink underline underline-offset-4">
                  Check something you want to buy
                </Link>
              </>
            )}
          </p>
        )}
        {!more && itemId && (
          <p className="text-sm text-ink-2">
            If you like,{" "}
            <Link href={`/closet/${itemId}`} className="py-3.5 text-ink underline underline-offset-4">
              say how it feels
            </Link>
            . It makes checks sharper.
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
