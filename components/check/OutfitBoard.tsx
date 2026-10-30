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

// One outfit laid out like a flat-lay collage: real photos on white, each
// piece on its own. Photos that couldn't be cut out show as they are.
export function OutfitBoard({ pieces }: { pieces: BoardPiece[] }) {
  const boxes = boardLayout(pieces.map((p) => p.category));
  return (
    <ul
      aria-label="Outfit"
      data-testid="outfit-board"
      className="relative aspect-[4/5] w-56 shrink-0 snap-start border border-line bg-paper md:w-auto"
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
              <Image src={piece.src} alt={piece.title} fill unoptimized sizes="160px" className="object-contain" />
            ) : (
              <p className="flex h-full items-end bg-tile p-2 text-xs leading-tight text-ink-2">{piece.title}</p>
            )}
            {piece.isCandidate && (
              <span className="absolute top-0 left-0 bg-ink px-1.5 py-0.5 text-xs font-medium text-paper">New</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
