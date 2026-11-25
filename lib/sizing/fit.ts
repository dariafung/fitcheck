// How a piece's size turned out on its owner. No server-only imports: the
// item page uses this too.
import { z } from "zod";

export const SIZE_FITS = ["small", "right", "large"] as const;
export const SizeFit = z.enum(SIZE_FITS);
export type SizeFit = z.infer<typeof SizeFit>;

export const SIZE_FIT_LABELS: Record<SizeFit, string> = {
  small: "Too small",
  right: "Just right",
  large: "Too big",
};
