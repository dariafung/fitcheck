// The daily AI limits (lib/limits/daily.ts). No imports: e2e specs read these too.

// Each account, and each login session of the demo account, per Chicago day.
export const DAILY_LIMITS = {
  // Reading a screenshot or photo: adding an item, or a buy check.
  read: 20,
  // Cutting an on-model photo out onto white.
  cutout: 20,
  // Scoring a buy check (Try again counts too).
  check: 10,
  // Style it with AI.
  style: 10,
  // Voice notes turned into text.
  voice: 20,
  // Saved feelings read into fields.
  feeling: 40,
  // Rebuilding the style card on home.
  style_card: 10,
  // Openings of a passing-on item that check new buyers.
  buyers: 5,
  // POST /api/pairings calls that ask the model.
  pairings: 10,
} as const;

export type DailyAction = keyof typeof DAILY_LIMITS;

// The demo account as a whole, on top of its per-session limits; actions
// the demo account can't take, or that only fill its caches, have none.
export const DEMO_DAILY_LIMITS: Partial<Record<DailyAction, number>> = {
  read: 80,
  cutout: 80,
  check: 50,
  style: 50,
};

// The last part of the day's budget only the demo account may spend, so
// other accounts can't lock the judges out.
export const DEMO_RESERVE_USD = 2;

export const SIGNUPS_PER_IP_PER_DAY = 10;
