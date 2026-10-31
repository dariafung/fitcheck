import { aiNotice } from "@/lib/ai/notices";
import type { EntryErrorCode } from "@/lib/entry/draft";

// The closet holds clothes and shoes only; accessories are turned away.
export const ACCESSORY_NOT_ADDED = "We only do clothes and shoes for now.";

// Short, spoken-style copy for every way adding a screenshot can fail.
const UPLOAD_ERRORS: Record<EntryErrorCode, string> = {
  no_file: "Pick a screenshot first.",
  not_image: "That file isn't a picture. Try a PNG or JPG.",
  too_large: "That picture is too big. Try a smaller screenshot.",
  too_small: "That picture is too small to read.",
  unrecognized: "Couldn't spot a product there. Try another screenshot?",
  accessory: ACCESSORY_NOT_ADDED,
};

export function extractErrorMessage(code: string | undefined): string {
  return code && code in UPLOAD_ERRORS
    ? UPLOAD_ERRORS[code as EntryErrorCode]
    : (aiNotice(code) ?? "Couldn't read the details. Try again?");
}

export const OFFLINE = "Looks like you're offline. Try again?";
export const SAVE_FAILED = "Couldn't save. Try again?";

// While an on-model photo is redrawn as the garment alone on white.
export const CUTTING_OUT = "AI is cutting out the photo…";
