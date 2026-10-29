import { MAX_FEELING_LENGTH } from "./feeling-body";

// A transcript goes after whatever is already in the box, on its own line.
// Safe to import from client code.
export function appendTranscript(draft: string, transcript: string): string {
  const before = draft.trimEnd();
  const added = transcript.trim();
  if (!added) return draft;
  return before ? `${before}\n${added}` : added;
}

// Typing stops at the limit, but a transcript can push the text past it.
export function isTooLong(draft: string): boolean {
  return draft.trim().length > MAX_FEELING_LENGTH;
}
