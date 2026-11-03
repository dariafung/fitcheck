// Module hooks for scripts that load the app's own TypeScript (lib/…): those
// files import with the "@/" alias and without file extensions, which plain
// Node doesn't resolve. Registered by app-imports.mjs.
const ROOT = new URL("../../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
  try {
    return await nextResolve(target, context);
  } catch (err) {
    const local = target.startsWith(".") || target.startsWith("file:");
    if (!local || err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
    for (const suffix of [".ts", "/index.ts"]) {
      try {
        return await nextResolve(`${target}${suffix}`, context);
      } catch {
        // Try the next one.
      }
    }
    throw err;
  }
}
