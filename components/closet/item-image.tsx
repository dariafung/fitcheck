import Image from "next/image";
import { categoryLabel } from "@/lib/closet/tags";
import { Silhouette } from "./silhouette";

// A photo, or the item's color in the shape of its category when it has none
// yet. Photos sit on the shelf tile with room around them (object-contain),
// so cut-outs and screenshots line up the same way.
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
    <div className={`relative ${aspect} overflow-hidden bg-tile text-ink`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          priority={priority}
          className="object-contain p-[9%]"
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
