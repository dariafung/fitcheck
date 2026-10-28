// Voice recordings live at <userId>/<itemId>/<random uuid>.wav in the
// private feeling-audio bucket. The server picks the path, so a request can
// only point at a recording made for its own user and item.
export const FEELING_AUDIO_BUCKET = "feeling-audio";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NAME = new RegExp(`^${UUID}\\.wav$`);

export function newVoicePath(userId: string, itemId: string): string {
  return `${userId}/${itemId}/${crypto.randomUUID()}.wav`;
}

export function isVoicePath(path: unknown, userId: string, itemId: string): path is string {
  if (typeof path !== "string") return false;
  const prefix = `${userId}/${itemId}/`;
  return path.startsWith(prefix) && NAME.test(path.slice(prefix.length));
}
