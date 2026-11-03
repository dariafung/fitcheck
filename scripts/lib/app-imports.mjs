// Import this before loading app modules (lib/…) from a script; see
// app-imports-hooks.mjs.
import { register } from "node:module";

register("./app-imports-hooks.mjs", import.meta.url);
