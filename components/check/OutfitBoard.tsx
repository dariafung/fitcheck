import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/ai/schemas/common";
import { boardLayout } from "@/lib/check/board-layout";

export interface BoardPiece {
  id: string;
  title: string;
  category: Category;
  src: string | null;
  // True when the background is already cut away.
  cutout: boolean;
  isCandidate: boolean;
}

// "With your Speed Up Short · Japan Pro": the owned pieces of an outfit, in
// words, under its board or its styled picture.
export function ownedLine(pieces: BoardPiece[]): string | null {
  const owned = pieces.filter((p) => !p.isCandidate && p.title);
  return owned.length > 0 ? `With your ${owned.map((p) => p.title).join(" · ")}` : null;
}

// One outfit laid out like a flat-lay collage on the shelf tile, no frame:
// real photos, each piece on its own. Photos that couldn't be cut out show as
// they are, their white multiplied into the tile. Each owned piece links to
// its page and, on hover, names itself in a white tag at the foot of its box.
export function OutfitBoard({ pieces }: { pieces: BoardPiece[] }) {
  const boxes = boardLayout(pieces.map((p) => p.category));
  return (
    <ul
      aria-label="Outfit"
      data-testid="outfit-board"
      className="relative isolate aspect-[4/5] w-full bg-tile"
    >
      {pieces.map((piece, i) => {
        const box = boxes[i];
        const art = piece.src ? (
          <Image src={piece.src} alt={piece.title} fill unoptimized sizes="160px" className="object-contain mix-blend-multiply" />
        ) : (
          <p className="flex h-full items-end bg-paper p-2 text-sm leading-tight text-ink-2">{piece.title}</p>
        );
        return (
          <li
            key={piece.id}
            className="absolute"
            style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
          >
            {piece.isCandidate ? (
              <>
                {art}
                <span className="absolute top-0 left-0 border border-ink bg-paper px-1.5 text-sm">New</span>
              </>
            ) : (
              <Link href={`/closet/${piece.id}`} className="group/piece absolute inset-0 hover:z-10 focus-visible:z-10">
                {art}
                {/* Tags on the right half hang from the box's right edge, so they stay on the board. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-0 hidden w-max max-w-44 border border-ink bg-paper px-1.5 text-sm group-hover/piece:block group-focus-visible/piece:block ${
                    box.left + box.width / 2 > 50 ? "right-0" : "left-0"
                  }`}
                >
                  {piece.title}
                </span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
