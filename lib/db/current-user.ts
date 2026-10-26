// One demo account for now. P0-7 visitor isolation replaces this with a
// per-visitor id; every lane reads the current user from here only.
export const DEMO_USER_ID = "f97fc346-9acc-4404-bc52-9a6ba86a9bce";

export function currentUserId(): string {
  return DEMO_USER_ID;
}
