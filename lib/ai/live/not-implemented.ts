import { AiNotConfiguredError } from "../errors";

// Placeholder live implementation until the real call is written.
export function notImplemented(fn: string) {
  return async (): Promise<never> => {
    throw new AiNotConfiguredError(fn, "live mode is not implemented yet");
  };
}
