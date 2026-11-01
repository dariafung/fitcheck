import Image from "next/image";
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

// One outfit laid out like a flat-lay collage on the shelf tile, no frame:
// real photos, each piece on its own. Photos that couldn't be cut out show as
// they are, their white multiplied into the tile.
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
        return (
          <li
            key={piece.id}
            className="absolute"
            style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
          >
            {piece.src ? (
              <Image src={piece.src} alt={piece.title} fill unoptimized sizes="160px" className="object-contain mix-blend-multiply" />
            ) : (
              <p className="flex h-full items-end bg-paper p-2 text-sm leading-tight text-ink-2">{piece.title}</p>
            )}
            {piece.isCandidate && (
              <span className="absolute top-0 left-0 border border-ink bg-paper px-1.5 text-sm">New</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
