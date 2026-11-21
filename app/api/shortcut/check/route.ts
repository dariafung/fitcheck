import { aiErrorResponse, extractItem, judgePairing, judgeRepeat, scorePurchase } from "@/lib/ai";
import { aiNotice } from "@/lib/ai/notices";
import { bearerToken, isLockedDemo, userForToken } from "@/lib/auth/api-token";
import { DEMO_READ_ONLY_ERROR } from "@/lib/auth/messages";
import { AI_FAILED_TEXT, BAD_TOKEN_TEXT, DEMO_TEXT, quickCheckBody, runQuickCheck } from "@/lib/check/quick-check";
import { createServerClient } from "@/lib/db/server";
import { withDaily, type DailyCaller } from "@/lib/limits/daily";

// Reading the screenshot and scoring it happen in one request.
export const maxDuration = 300;

// The image is the whole body, or the `screenshot` field of a form.
async function screenshotFrom(request: Request): Promise<Blob | null> {
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const file = (await request.formData().catch(() => null))?.get("screenshot");
    return file instanceof Blob ? file : null;
  }
  return request.blob().catch(() => null);
}

// A limit, the budget or a failed model: aiErrorResponse's answer plus a
// line to show. Rethrows anything else.
async function aiFailure(err: unknown): Promise<Response> {
  const res = aiErrorResponse(err);
  const body: { error: string; message: string } = await res.json();
  return Response.json({ ...body, text: aiNotice(body.error) ?? AI_FAILED_TEXT }, { status: res.status, headers: res.headers });
}

// POST a product-page screenshot (PNG, JPEG or WebP, up to 4 MB) with
// `Authorization: Bearer <token>` (made in Profile) → { score, verdict,
// title, text }. Reads the screenshot and runs the buy check against the
// token owner's closet in one go, for the iOS Shortcut (docs/SHORTCUT.md):
// no card to confirm, no cut-out, nothing stored. `text` is ready to show;
// a screenshot that can't be read or an accessory answers 200 with `text`
// saying so and a null score. Counts against the account's daily `read` and
// `check` limits, the same ones the site uses. 401 without a working token,
// 403 for the demo account, 429 at a limit.
export async function POST(request: Request) {
  const db = createServerClient();
  const token = bearerToken(request.headers.get("authorization"));
  const userId = token && (await userForToken(db, token));
  if (!userId) return Response.json({ error: "bad_token", text: BAD_TOKEN_TEXT }, { status: 401 });
  if (isLockedDemo(userId)) return Response.json({ error: DEMO_READ_ONLY_ERROR, text: DEMO_TEXT }, { status: 403 });

  const caller: DailyCaller = { id: userId, readOnly: false, sessionId: null };
  try {
    const check = await runQuickCheck(
      db,
      userId,
      await screenshotFrom(request),
      { extract: extractItem, judge: judgePairing, score: scorePurchase, repeat: judgeRepeat },
      (action, run, when) => withDaily(action, run, when, caller),
    );
    return Response.json(quickCheckBody(check), { status: check.kind === "no_user" ? 404 : 200 });
  } catch (err) {
    return aiFailure(err);
  }
}
