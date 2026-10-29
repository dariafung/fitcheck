import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Server traces under `.next/server/app` that leave out any of `files`
 * (paths relative to the project root). Vercel ships only traced files, so a
 * route missing one cannot read it in production.
 * @param {string} root project root
 * @param {string[]} files
 * @returns {{ trace: string, missing: string[] }[]}
 */
export function tracesMissing(root, files) {
  const appDir = path.join(root, ".next", "server", "app");
  const traces = readdirSync(appDir, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith(".nft.json"),
  );
  if (traces.length === 0) throw new Error(`No server traces under ${appDir}; run next build first.`);
  return traces.flatMap((trace) => {
    const file = path.join(appDir, trace);
    const traced = new Set(
      JSON.parse(readFileSync(file, "utf8")).files.map((f) =>
        path.relative(root, path.resolve(path.dirname(file), f)),
      ),
    );
    const missing = files.filter((f) => !traced.has(f));
    return missing.length > 0 ? [{ trace, missing }] : [];
  });
}

/**
 * Files under `dir` (relative to `root`), as relative paths.
 * @param {string} root
 * @param {string} dir
 */
export function listFiles(root, dir) {
  return readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)));
}
