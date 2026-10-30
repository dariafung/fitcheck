import { connection } from "next/server";
import { isReadOnly } from "@/lib/auth/session";
import { loadStyleCardState, type StyleCardState } from "@/lib/closet/style-profile";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { StyleAutoUpdate } from "./style-auto-update";
import { StyleCardEmpty, StyleCardView } from "./style-card-view";

// Home's style card. Only reads the database: a stale card is rebuilt by
// StyleAutoUpdate after the page is up, so home never waits on the model.
// The demo account and the persona only ever see the seed's card.
export async function StyleCard() {
  await connection();
  const loaded = await loadState();
  if (!loaded) return null;
  const { state, readOnly } = loaded;
  const canRegenerate = state.canRegenerate && !readOnly;
  if (canRegenerate && state.stale) return <StyleAutoUpdate initial={state.card} />;
  if (state.card) return <StyleCardView card={state.card} />;
  return canRegenerate && !state.enough ? <StyleCardEmpty /> : null;
}

// Null when the card can't be read: it's extra, so home goes on without it.
async function loadState(): Promise<{ state: StyleCardState; readOnly: boolean } | null> {
  try {
    const userId = await currentUserId();
    const [state, readOnly] = await Promise.all([loadStyleCardState(createServerClient(), userId), isReadOnly()]);
    return { state, readOnly };
  } catch (err) {
    console.error("Could not load the style card:", err);
    return null;
  }
}
