import Image from "next/image";
import { categoryLabel } from "@/lib/closet/tags";

// A photo, or a color swatch + category when the item has none yet.
// Signed storage URLs expire, so images skip the optimizer.
export function ItemImage({
  src,
  alt,
  category,
  swatch,
  sizes,
  priority,
  aspect = "aspect-[3/4]",
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
    <div className={`relative ${aspect} overflow-hidden rounded-xl bg-black/[.04] dark:bg-white/[.06]`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground/50">
          {swatch && (
            <span
              aria-hidden
              className="size-12 rounded-full border border-black/10 shadow-inner dark:border-white/20"
              style={{ backgroundColor: swatch }}
            />
          )}
          <span className="text-xs uppercase tracking-wider">{categoryLabel(category)}</span>
        </div>
      )}
    </div>
  );
}
