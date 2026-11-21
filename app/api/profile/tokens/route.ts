import { createToken, revokeTokens } from "@/lib/auth/api-token";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";

// POST → { token, createdAt, lastUsedAt }: makes the caller's Shortcut token
// (docs/SHORTCUT.md), replacing the one they had. This answer is the only
// place the token ever appears; the database keeps its hash. Not for the
// demo account.
export async function POST() {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  return Response.json(await createToken(createServerClient(), writer.userId), { status: 201 });
}

// DELETE → { revoked: true }: the caller's token stops working at once.
export async function DELETE() {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  await revokeTokens(createServerClient(), writer.userId);
  return Response.json({ revoked: true });
}
