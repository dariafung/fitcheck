import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Recorded live responses, committed to git under fixtures/ai/<fn>/<hash>.json.
export interface ReplayRecord {
  fn: string;
  promptVersion: string;
  inputHash: string;
  inputPreview: string;
  output: unknown;
  recordedAt: string;
}

export const DEFAULT_REPLAY_DIR = path.join(process.cwd(), "fixtures", "ai");

function recordPath(dir: string, fn: string, hash: string): string {
  return path.join(dir, fn, `${hash}.json`);
}

export async function readReplay(
  fn: string,
  hash: string,
  dir = DEFAULT_REPLAY_DIR,
): Promise<ReplayRecord | null> {
  try {
    const text = await readFile(recordPath(dir, fn, hash), "utf8");
    return JSON.parse(text) as ReplayRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeReplay(
  record: ReplayRecord,
  dir = DEFAULT_REPLAY_DIR,
): Promise<void> {
  const file = recordPath(dir, record.fn, record.inputHash);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
}
