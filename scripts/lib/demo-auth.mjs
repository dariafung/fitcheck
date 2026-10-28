// The read-only demo account's sign-in: an auth user that shares the demo
// persona's id. Same email as DEMO_EMAIL in lib/auth/config.ts.
export const DEMO_EMAIL = "demo@example.com";

/**
 * Creates the demo auth user, or resets its password when it already exists.
 * @param {import("@supabase/supabase-js").SupabaseClient} db  secret-key client
 * @param {string} personaId
 * @param {string} password
 */
export async function ensureDemoAuthUser(db, personaId, password) {
  const existing = await db.auth.admin.getUserById(personaId);
  if (existing.data.user) {
    const { error } = await db.auth.admin.updateUserById(personaId, { password, email_confirm: true });
    if (error) throw error;
    return;
  }
  const { error } = await db.auth.admin.createUser({
    id: personaId,
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}
