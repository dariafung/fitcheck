import Image from "next/image";
import { categoryLabel } from "@/lib/closet/tags";
import { Silhouette } from "./silhouette";

// A photo, or the item's color in the shape of its category when it has none
// yet. Stored photos are already framed on white with the margin built in
// (lib/entry/frame.ts), so the tile is white too and adds no padding.
// Signed storage URLs expire, so images skip the optimizer.
export function ItemImage({
  src,
  alt,
  category,
  swatch,
  sizes,
  priority,
  aspect = "aspect-[4/5]",
}: {
  src: string | null;
  alt: string;
  category: string;
  swatch: string | null;
  sizes: string;
  priority?: boolean;
  aspect?: string;
}) {
  return (
    <div className={`relative ${aspect} overflow-hidden bg-paper text-ink`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          priority={priority}
          className="object-contain"
        />
      ) : swatch ? (
        <Silhouette category={category} color={swatch} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-ink-2">
          {categoryLabel(category)}
        </span>
      )}
    </div>
  );
}
