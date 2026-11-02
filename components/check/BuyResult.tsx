"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Category, ItemTags } from "@/lib/ai/schemas/common";
import type { OwnedPiece } from "@/lib/check/board-pieces";
import type { BuyCheckResult, SampleOutfit } from "@/lib/check/buy-check";
import { NO_LIFESTYLE_PARTS, NO_LIFESTYLE_REASON, NO_NOTES_ANSWER, PROFILE_MIX_HREF } from "@/lib/check/reasons";
import { verdict } from "@/lib/check/verdict";
import { Icon } from "@/components/ui/icon";
import { StyledOutfit, useStyleIt } from "./StyleIt";

const PARTS: [keyof BuyCheckResult["parts"], string][] = [
  ["suitsYou", "Suits you"],
  ["outfits", "Outfits"],
  ["revives", "Revives"],
  ["fillsGap", "Fills a gap"],
  ["notRepeat", "Not a repeat"],
];

// A square shelf tile for the outfit row. Pieces without a photo show their
// name instead.
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative isolate aspect-square w-24 shrink-0 overflow-hidden bg-tile md:w-28">
      {src ? (
        <Image src={src} alt={alt} fill unoptimized sizes="112px" className="object-contain p-[10%] mix-blend-multiply" />
      ) : (
        <p className="flex h-full items-end p-2 text-sm leading-tight text-ink-2">{alt}</p>
      )}
    </div>
  );
}

// The closest owned piece shows beside this one only when it's a real
// repeat: Not a repeat at 6 of 10 or lower.
const CLOSEST_SHOWN_AT = 6;

// The new piece and the owned piece it's most like, side by side.
function Closest({ photo, title, item }: { photo: string | null; title: string; item: { id: string; title: string; imageUrl: string | null } }) {
  return (
    <div data-testid="closest" className="flex flex-col gap-4">
      <h3 className="text-base font-medium">Closest in your closet</h3>
      <div className="flex gap-2">
        <div className="flex flex-col gap-2">
          <Thumb src={photo} alt={title} />
          <p className="text-sm text-ink-2">This one</p>
        </div>
        <Link href={`/closet/${item.id}`} className="group flex flex-col gap-2">
          <Thumb src={item.imageUrl} alt={item.title} />
          <span className="line-clamp-2 w-24 text-sm underline decoration-line underline-offset-4 group-hover:decoration-ink md:w-28">
            {item.title}
          </span>
        </Link>
      </div>
    </div>
  );
}

interface Cutouts {
  candidate: string | null;
  items: Record<string, OwnedPiece>;
}

// Cut-outs for the outfit boards. Null while loading, or for good when the
// request fails: the page then keeps the plain rows of photos.
function useCutouts(outfits: SampleOutfit[], photo: string | null, onModel: boolean): Cutouts | null {
  const [cutouts, setCutouts] = useState<Cutouts | null>(null);
  useEffect(() => {
    if (outfits.length === 0) return;
    const itemIds = [...new Set(outfits.flatMap((o) => o.pieces.filter((p) => !p.isCandidate).map((p) => p.id)))];
    const controller = new AbortController();
    fetch("/api/checks/board", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidate: { photo, onModel }, itemIds }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: Cutouts | null) => {
        if (json?.items) setCutouts(json);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [outfits, photo, onModel]);
  return cutouts;
}

// The verdict page. Photo left, verdict right, held in view on a desktop:
// the score is the only colored thing on the page.
export function BuyResult({
  title,
  photo,
  category,
  tags,
  onModel,
  result,
  onCheckAnother,
}: {
  title: string;
  photo: string | null;
  category: Category;
  tags: ItemTags;
  onModel: boolean;
  result: BuyCheckResult;
  onCheckAnother: () => void;
}) {
  const { parts } = result;
  // Nothing in the closet to compare with: no number, no verdict, just
  // what to do first.
  const empty = result.closetSize === 0;
  const cutouts = useCutouts(result.sampleOutfits, photo, onModel);
  const styleIt = useStyleIt(photo ? { photo, title, tags } : null);
  return (
    <section
      aria-label="Result"
      className="grid grid-cols-[2fr_3fr] gap-x-4 gap-y-10 md:grid-cols-12 md:grid-rows-[auto_1fr] md:gap-y-0"
    >
      <div className="relative isolate aspect-[4/5] self-start overflow-hidden bg-tile md:sticky md:top-10 md:col-span-5 md:row-span-2">
        {photo ? (
          <Image
            src={photo}
            alt={title}
            fill
            unoptimized
            sizes="(min-width: 768px) 40vw, 40vw"
            className="object-contain p-[9%] mix-blend-multiply"
          />
        ) : (
          <p className="absolute inset-0 flex items-end p-4 text-sm text-ink-2">{title}</p>
        )}
      </div>

      <header className="flex flex-col justify-end gap-3 md:col-span-6 md:col-start-7 md:justify-start lg:col-span-5 lg:col-start-7">
        <h2 className="text-base font-medium md:text-lg">{title}</h2>
        {empty ? (
          <p className="text-lg font-medium">Nothing to compare it with yet.</p>
        ) : (
          <>
            <p className="flex items-baseline gap-2">
              <span
                data-testid="score"
                className="text-score-phone font-medium text-signal tabular-nums md:text-score"
              >
                {result.score}
              </span>
              <span className="text-sm text-ink-2"> / 100</span>
            </p>
            {/* In ink: only the number is red. */}
            <p data-testid="verdict" className="text-title font-medium uppercase md:text-2xl">
              {verdict(result.score, result.gap)}
            </p>
          </>
        )}
      </header>

      <div className="col-span-2 flex flex-col gap-10 md:col-span-6 md:col-start-7 md:pt-8 lg:col-span-5 lg:col-start-7">
        {empty ? (
          <div className="flex flex-col items-start gap-5">
            <p className="max-w-[34ch] font-serif text-lg">Add a few pieces you wear, then check again.</p>
            <Link href="/closet/add" className="btn-primary">
              Add clothes
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5">
              <p className="max-w-[34ch] font-serif text-lg">{result.summary}</p>
              {result.gap && (
                <p
                  data-kind={result.gap.kind}
                  className={`flex gap-3 text-base before:mt-[0.55em] before:size-2 before:shrink-0 before:content-[''] ${
                    result.gap.kind === "nothing_owned" ? "before:bg-ink-2" : "font-medium before:bg-signal"
                  }`}
                >
                  {result.gap.reason}
                </p>
              )}
            </div>

            <ul className="border-t border-ink">
              {PARTS.map(([key, label]) => {
                const part = parts[key];
                return (
                  <li key={key} className="flex flex-col gap-1 border-b border-line py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-base font-medium">{label}</span>
                      <span className="text-base">
                        {part.points}
                        <span className="text-ink-2">/{part.max}</span>
                      </span>
                    </div>
                    <p className="max-w-[48ch] text-sm text-ink-2">
                      {part.reason === NO_LIFESTYLE_REASON ? (
                        <>
                          {NO_LIFESTYLE_PARTS[0]}
                          <Link href={PROFILE_MIX_HREF} className="text-ink underline underline-offset-4">
                            {NO_LIFESTYLE_PARTS[1]}
                          </Link>
                          {NO_LIFESTYLE_PARTS[2]}
                        </>
                      ) : (
                        part.reason
                      )}
                    </p>
                    {key === "suitsYou" && parts.suitsYou.answers.some((a) => a.score !== null) && (
                      <details className="group text-sm">
                        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-ink [&::-webkit-details-marker]:hidden">
                          <span className="underline underline-offset-4">Why</span>
                          <Icon name="plus" size={12} className="text-ink-2 group-open:hidden" />
                          <Icon name="minus" size={12} className="hidden text-ink-2 group-open:block" />
                        </summary>
                        <ul className="mt-1 flex flex-col gap-2.5 border-l border-line pl-4">
                          {parts.suitsYou.answers.map((a) =>
                            // Not asked, for lack of notes: greyed out, default score.
                            a.score === null ? (
                              <li key={a.id} data-default className="flex gap-3 text-ink-2">
                                <span className="w-8 shrink-0">
                                  {a.points}/{a.max}
                                </span>
                                <span>
                                  {a.question}. {NO_NOTES_ANSWER}
                                </span>
                              </li>
                            ) : (
                              <li key={a.id} className="flex gap-3">
                                <span className="w-8 shrink-0 text-ink-2">
                                  {a.points}/{a.max}
                                </span>
                                <span>
                                  <span className="font-medium">{a.question}.</span>{" "}
                                  <span className="text-ink-2">{a.reason}</span>
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>

            {parts.notRepeat.item && parts.notRepeat.points <= CLOSEST_SHOWN_AT && (
              <Closest photo={photo} title={title} item={parts.notRepeat.item} />
            )}

            {result.sampleOutfits.length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-base font-medium">You could wear it like this</h3>
                {cutouts ? (
                  <div className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
                    {result.sampleOutfits.map((outfit) => (
                      <StyledOutfit
                        key={outfit.id}
                        outfitId={outfit.id}
                        itemIds={outfit.pieces.filter((p) => !p.isCandidate).map((p) => p.id)}
                        styleIt={styleIt}
                        pieces={outfit.pieces.flatMap((piece) => {
                          if (piece.isCandidate) {
                            return [{ ...piece, category, src: cutouts.candidate ?? photo, cutout: !!cutouts.candidate }];
                          }
                          const owned = cutouts.items[piece.id];
                          if (!owned) return [];
                          return [{ ...piece, category: owned.category, src: owned.cutout ?? piece.imageUrl, cutout: !!owned.cutout }];
                        })}
                      />
                    ))}
                  </div>
                ) : (
                  result.sampleOutfits.map((outfit) => (
                    <ul key={outfit.id} aria-label="Outfit" className="flex gap-2 overflow-x-auto">
                      {outfit.pieces.map((piece) => (
                        <li key={piece.id}>
                          <Thumb src={piece.isCandidate ? photo : piece.imageUrl} alt={piece.title} />
                        </li>
                      ))}
                    </ul>
                  ))
                )}
                {styleIt.stopped && <p className="text-sm text-ink-2">{styleIt.stopped}</p>}
              </div>
            )}
          </>
        )}

        <button type="button" onClick={onCheckAnother} className={`${empty ? "btn-secondary" : "btn-primary"} self-start`}>
          Check another
        </button>
      </div>
    </section>
  );
}
