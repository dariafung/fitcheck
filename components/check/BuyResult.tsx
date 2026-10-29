"use client";

import Image from "next/image";
import Link from "next/link";
import type { BuyCheckResult } from "@/lib/check/buy-check";
import { NO_LIFESTYLE_PARTS, NO_LIFESTYLE_REASON, NO_NOTES_ANSWER, PROFILE_MIX_HREF } from "@/lib/check/reasons";

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
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-tile md:w-28">
      {src ? (
        <Image src={src} alt={alt} fill unoptimized sizes="112px" className="object-contain p-[10%]" />
      ) : (
        <p className="flex h-full items-end p-2 text-xs leading-tight text-ink-2">{alt}</p>
      )}
    </div>
  );
}

// The verdict page. Photo left, verdict right, held in view on a desktop:
// the score is the only colored thing on the page.
export function BuyResult({
  title,
  photo,
  result,
  onCheckAnother,
}: {
  title: string;
  photo: string | null;
  result: BuyCheckResult;
  onCheckAnother: () => void;
}) {
  const { parts } = result;
  return (
    <section
      aria-label="Result"
      className="grid grid-cols-[2fr_3fr] gap-x-4 gap-y-10 md:grid-cols-12 md:gap-y-0"
    >
      <div className="relative aspect-[4/5] self-start overflow-hidden bg-tile md:col-span-5 md:row-span-2">
        {photo ? (
          <Image
            src={photo}
            alt={title}
            fill
            unoptimized
            sizes="(min-width: 768px) 40vw, 40vw"
            className="object-contain p-[9%]"
          />
        ) : (
          <p className="absolute inset-0 flex items-end p-4 text-sm text-ink-2">{title}</p>
        )}
      </div>

      <header className="flex flex-col justify-end gap-3 md:col-span-6 md:col-start-7 md:justify-start lg:col-span-5 lg:col-start-7">
        <h2 className="text-base font-medium md:text-lg">{title}</h2>
        <p className="flex items-baseline gap-2">
          <span
            data-testid="score"
            className="text-[64px] leading-[0.9] font-medium tracking-[-0.04em] text-signal tabular-nums md:text-score"
          >
            {result.score}
          </span>
          <span className="text-sm text-ink-2"> / 100</span>
        </p>
      </header>

      <div className="col-span-2 flex flex-col gap-10 md:col-span-6 md:col-start-7 md:pt-8 lg:col-span-5 lg:col-start-7">
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
                  <details className="group mt-1 text-sm">
                    <summary className="inline-flex cursor-pointer list-none items-baseline gap-1.5 text-ink after:w-2 after:content-['+'] group-open:after:content-['−'] [&::-webkit-details-marker]:hidden">
                      <span className="underline underline-offset-4">Why</span>
                    </summary>
                    <ul className="mt-3 flex flex-col gap-2.5 border-l border-line pl-4">
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

        {result.sampleOutfits.length > 0 && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-medium">You could wear it like this</h3>
            {result.sampleOutfits.map((outfit) => (
              <ul key={outfit.id} aria-label="Outfit" className="flex gap-2 overflow-x-auto">
                {outfit.pieces.map((piece) => (
                  <li key={piece.id}>
                    <Thumb src={piece.isCandidate ? photo : piece.imageUrl} alt={piece.title} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}

        <button type="button" onClick={onCheckAnother} className="btn-primary self-start">
          Check another
        </button>
      </div>
    </section>
  );
}
