import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = "meta-model-api";

// Vercel sets META_API_KEY; locally the key lives only in the macOS keychain.
// Returns null when no key is available. Never log the value.
export async function getMetaApiKey(): Promise<string | null> {
  if (process.env.META_API_KEY) return process.env.META_API_KEY;
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      KEYCHAIN_SERVICE,
      "-w",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
