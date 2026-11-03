import { connection } from "next/server";
import { currentMode } from "@/lib/ai/mode";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { suitsYou } from "@/lib/resale/feed";
import { listingText } from "@/lib/resale/listing";
import { sizeLabel } from "@/lib/resale/size";
import { ItemImage } from "./item-image";

const GRID = "-mx-2 grid grid-cols-2 gap-x-1 gap-y-10 md:mx-0 md:grid-cols-3 md:gap-x-4";

// Home's pick from what other people are passing on: pieces whose buy check,
// run from this user's side, scored high. Look only: no seller, no contact.
// Not shown at all when there's nothing to show.
export async function SuitsYou() {
  await connection();
  const pieces = await suitsYou(createServerClient(), await currentUserId(), currentMode());
  if (pieces.length === 0) return null;
  return (
    <section aria-labelledby="suits-you" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-3">
        <h2 id="suits-you" className="text-lg leading-none font-medium">
          Suits you
        </h2>
        <span className="text-sm text-ink-2">Secondhand, from other people&apos;s closets</span>
      </div>
      <ul className={GRID}>
        {pieces.map((piece) => {
          const listing = listingText(piece.askingPriceCents, piece.condition);
          return (
            <li key={piece.id} className="flex min-w-0 flex-col gap-2">
              <ItemImage
                src={piece.imageUrl}
                alt={piece.title}
                category={piece.category}
                swatch={piece.swatch}
                sizes="(min-width: 768px) 25vw, 50vw"
              />
              <div className="flex flex-col gap-1 px-2 md:px-0">
                <p className="text-sm font-medium">{piece.title}</p>
                <p className="text-sm text-ink-2">
                  {[piece.size && sizeLabel(piece.size), listing].filter(Boolean).join(" · ")}
                </p>
                {piece.reasons.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {piece.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
