"use client";

import Image from "next/image";
import type { BuyCheckResult } from "@/lib/check/buy-check";

const PARTS: [keyof BuyCheckResult["parts"], string][] = [
  ["suitsYou", "Suits you"],
  ["outfits", "Outfits"],
  ["revives", "Revives"],
  ["fillsGap", "Fills a gap"],
  ["notRepeat", "Not a repeat"],
];

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/10">
      {src ? (
        <Image src={src} alt={alt} fill unoptimized sizes="64px" className="object-cover" />
      ) : (
        <p className="flex h-full items-center justify-center p-1 text-center text-[10px] leading-tight opacity-60">{alt}</p>
      )}
    </div>
  );
}

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
    <section aria-label="Result" className="flex flex-col gap-6 rounded-2xl border border-black/10 p-4 sm:p-6 dark:border-white/15">
      <div className="flex items-start gap-4">
        <Thumb src={photo} alt={title} />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-semibold">{title}</h2>
          <p>
            <span data-testid="score" className="text-4xl font-semibold tabular-nums">
              {result.score}
            </span>
            <span className="opacity-60"> / 100</span>
          </p>
        </div>
      </div>

      {result.gap && (
        <p
          data-kind={result.gap.kind}
          className={
            result.gap.kind === "nothing_owned"
              ? "rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-sm dark:border-white/15 dark:bg-white/10"
              : "rounded-xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-sm font-medium"
          }
        >
          {result.gap.reason}
        </p>
      )}
      <p className="opacity-80">{result.summary}</p>

      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
        {PARTS.map(([key, label]) => {
          const part = parts[key];
          return (
            <li key={key} className="flex flex-col gap-1 py-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums opacity-70">
                  {part.points}/{part.max}
                </span>
              </div>
              <p className="text-sm opacity-70">{part.reason}</p>
              {key === "suitsYou" && parts.suitsYou.answers.some((a) => a.score !== null) && (
                <details className="text-sm">
                  <summary className="cursor-pointer opacity-70">Why</summary>
                  <ul className="mt-2 flex flex-col gap-2">
                    {parts.suitsYou.answers.map((a) => (
                      <li key={a.id} className="flex gap-3">
                        <span className="w-8 shrink-0 tabular-nums opacity-70">
                          {a.points}/{a.max}
                        </span>
                        <span>
                          <span className="font-medium">{a.question}.</span> <span className="opacity-70">{a.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      {result.sampleOutfits.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium">You could wear it like this</h3>
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

      <button
        type="button"
        onClick={onCheckAnother}
        className="self-start rounded-full bg-foreground px-5 py-2.5 font-medium text-background"
      >
        Check another
      </button>
    </section>
  );
}
