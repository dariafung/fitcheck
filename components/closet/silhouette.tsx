// Flat garment outlines for items without a photo yet: the item's own color
// family, cut in the shape of its category, standing on the shelf tile the
// way a cut-out photo will. Drawn on a 100 × 125 (4:5) board.

const SHAPES: Record<string, string> = {
  top: "M41 26 Q50 33 59 26 L72 31 L84 50 L73 56 L68 49 L68 99 L32 99 L32 49 L27 56 L16 50 L28 31 Z",
  outerwear:
    "M42 22 L50 40 L58 22 L70 26 L80 34 L86 96 L75 98 L70 56 L70 106 L30 106 L30 56 L25 98 L14 96 L20 34 L30 26 Z",
  bottom: "M33 21 L67 21 L71 106 L55 106 L50 47 L45 106 L29 106 Z",
  one_piece: "M41 21 Q50 29 59 21 L62 23 L61 46 L76 106 L24 106 L39 46 L38 23 Z",
  shoes:
    "M20 78 L20 96 L82 96 Q88 96 88 90 Q88 84 81 82 L64 77 L53 66 L40 66 Q35 73 27 73 L20 72 Z",
  accessory: "M24 56 L76 56 L80 102 L20 102 Z",
};

// Lines drawn on top of the fill (a fly, a placket, a sole, a handle).
const DETAILS: Record<string, string> = {
  outerwear: "M50 40 L50 106",
  bottom: "M33 28 L67 28",
  shoes: "M20 90 L88 90",
  accessory: "M38 56 Q38 38 50 38 Q62 38 62 56",
};

export function Silhouette({ category, color }: { category: string; color: string }) {
  const shape = SHAPES[category] ?? SHAPES.accessory;
  const detail = DETAILS[category] ?? (SHAPES[category] ? undefined : DETAILS.accessory);
  return (
    <svg
      viewBox="0 0 100 125"
      aria-hidden
      className="absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={shape}
        fill={color}
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={0.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {detail && (
        <path
          d={detail}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.22}
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
