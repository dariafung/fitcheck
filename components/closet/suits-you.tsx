import { notFound } from "next/navigation";
import { connection } from "next/server";
import { currentMode } from "@/lib/ai/mode";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { resaleOptedInFor, suitsYou } from "@/lib/resale/feed";
import { listingText } from "@/lib/resale/listing";
import { sizeLabel } from "@/lib/resale/size";
import { ItemImage } from "./item-image";

const GRID = "-mx-2 grid grid-cols-2 gap-x-1 gap-y-10 md:mx-0 md:grid-cols-3 md:gap-x-4";

// The Suits you tab: what other people are passing on whose buy check, run
// from this user's side, scored high. Look only: the seller's picked name, no
// way to contact them. There is no such page for anyone who turned resale
// matching off in Profile.
export async function SuitsYou() {
  await connection();
  const userId = await currentUserId();
  if (!(await resaleOptedInFor(userId))) notFound();
  const pieces = await suitsYou(createServerClient(), userId, currentMode());
  if (pieces.length === 0) {
    return <p className="text-sm text-ink-2">Nothing yet. Pieces other people pass on that suit you show up here.</p>;
  }
  return (
    <section aria-label="Pieces that suit you">
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
                <p className="text-sm text-ink-2">from {piece.sellerName}</p>
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

export function SuitsYouSkeleton() {
  return (
    <div className={GRID}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="aspect-[4/5] bg-tile motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
