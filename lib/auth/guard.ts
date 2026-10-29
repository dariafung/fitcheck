import { currentUserId } from "../db/current-user";
import { DEMO_READ_ONLY, DEMO_READ_ONLY_ERROR } from "./messages";
import { isReadOnly } from "./session";

// First line of every route that writes. The demo account gets a 403 before
// anything is read, stored or sent to the model; anyone else gets their id.
// The pages hide these actions from the demo account, so this only answers
// requests made around them.
export async function requireWriter(): Promise<{ userId: string } | { denied: Response }> {
  if (await isReadOnly()) {
    return {
      denied: Response.json({ error: DEMO_READ_ONLY_ERROR, message: DEMO_READ_ONLY }, { status: 403 }),
    };
  }
  return { userId: await currentUserId() };
}
