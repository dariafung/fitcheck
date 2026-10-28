# Manual test plan

Run the app on your own machine and walk through the cases below. Report anything that doesn't match the expected result as a GitHub issue (see the last section).

## What to test

- Branch: `integ`. Pull before each test session; the commit you tested goes in every report.
- AI runs in **mock mode**: no API key, no cost. AI answers are fixed placeholders such as "Mock: nothing to go on." Judge the flow, layout and errors, not the quality of AI text.
- Every page currently acts as the demo persona (a fictional student with 3 items).
- Not in yet, skip these: login and sign-up, the demo account, voice feelings, deleting an item, the hosted site.

## One-time setup

You need Node 24 and Docker (Docker Desktop or OrbStack) running. pnpm is called through `npx`; no global install.

1. `git clone https://github.com/dariafung/fitcheck.git && cd fitcheck && git switch integ`
2. `npx -y pnpm@12.15.0 install`
3. `npx -y pnpm@12.15.0 db:start` starts a local Supabase in Docker. The first run downloads images and takes a few minutes.
4. `npx -y pnpm@12.15.0 env:local` writes `.env.local` with the local keys and `AI_MODE=mock`. Never commit or paste this file.
5. `npx -y pnpm@12.15.0 seed` loads the demo persona.
6. `npx -y pnpm@12.15.0 dev`, then open http://localhost:5110.

After `git pull`: repeat step 2, run `npx -y pnpm@12.15.0 exec supabase migration up --local`, then step 5.

A failing setup step is a bug too: report the command and its output.

## Test cases

Test in Chrome on desktop and at phone width (DevTools device toolbar, 390 px). Keep the DevTools console open: **any red error in the console is a bug**, even if the page looks fine.

### 1. Home

| # | Do | Expect |
| --- | --- | --- |
| 1.1 | Open `/` | A large "Should I buy this?" card at the top, "Good for today" below it |
| 1.2 | First visit: the browser asks for your location. Allow it | The weather line shows "Near you" with today's low–high in °F |
| 1.3 | Block the location instead (new incognito window) | No error; weather falls back to a guessed city |
| 1.4 | Look at "Good for today" | Only clothes whose "Comfortable in" range overlaps today's weather; a "See all clothes" link |
| 1.5 | Click "Change" in the weather line | Goes to the profile page, weather section |

### 2. Closet

| # | Do | Expect |
| --- | --- | --- |
| 2.1 | Click "Closet" in the top bar | Grid of all active clothes with a color swatch each |
| 2.2 | Switch to the "Passing on" tab | URL gets `?tab=passing-on`; an empty state if nothing is there |
| 2.3 | Open an item | Details: name, type, colors, "Comfortable in __ to __ °F", how dressy, the feelings box |
| 2.4 | Edit the temperature range, save | New range shows; reload keeps it |
| 2.5 | Enter a low above the high | "Low should be at or below high." and nothing saved |
| 2.6 | Write a feeling ("Love the color, a bit tight at the shoulders") and save | Text saved and still there after reload |

### 3. Add clothes by screenshot

| # | Do | Expect |
| --- | --- | --- |
| 3.1 | Closet → "Add clothes" (`/closet/add`) | Upload area with the hint to take one screen, product photo and name visible |
| 3.2 | Upload a screenshot of a product page | "Reading…", then a card with a cropped product photo and editable fields |
| 3.3 | Change a field (e.g. main color), "Save to closet" | "Saved"; the item appears in the closet grid |
| 3.4 | Upload a file that isn't an image, or a tiny image | A short message on the page, no red console error |
| 3.5 | Upload a very long full-page screenshot | Still works; product photo not squashed |

### 4. Profile

| # | Do | Expect |
| --- | --- | --- |
| 4.1 | Click "Profile" | Height and weight (required), bust / waist / hips / inseam (optional), body shape (pick one of 5), outfits wanted per season for work / school / social / sport / home |
| 4.2 | Switch units in · lb ↔ cm · kg | Numbers convert; switching back gives the same numbers |
| 4.3 | Clear height, Save | Blocked with a message |
| 4.4 | Change something, Save, reload | Change kept. **Put it back afterwards** (the persona is pear-shaped; school 3, social 2, sport 3, home 3, work 0) |
| 4.5 | Weather: search a city (e.g. "Chicago"), pick it | Home page weather line now says "Chicago"; "Use my location" switches back |

### 5. Should I buy this?

| # | Do | Expect |
| --- | --- | --- |
| 5.1 | Home → "Should I buy this?" | Screenshot upload, same as adding clothes |
| 5.2 | Upload a screenshot, fix the card, "Check it" | "Checking…", then a score like "47.5 / 100" |
| 5.3 | Look at the five parts | Suits you /40, Outfits /20, Revives /15, Fills a gap /15, Not a repeat /10; each part may have one decimal and they add up to the total |
| 5.4 | Open "Why" under Suits you | Five questions, each with a score like "4/8" and a short reason |
| 5.5 | Look below the parts | "You could wear it like this" with outfit pieces |
| 5.6 | Pick "Accessory" as the type and check | A note that accessories aren't scored yet, no score |
| 5.7 | "Check another" | Back to the upload step |
| 5.8 | Go to the closet afterwards | The checked item was **not** added to the closet |

## Automated tests (optional)

- Unit: `npx -y pnpm@12.15.0 test`
- Integration (needs `db:start`): `npx -y pnpm@12.15.0 test:integration`
- End-to-end: `npx -y pnpm@12.15.0 exec playwright install chromium` once, then `npx -y pnpm@12.15.0 build` and `npx -y pnpm@12.15.0 test:e2e`

All three should pass on `integ`. A failure is worth an issue.

## Reporting a bug

Open a GitHub issue in dariafung/fitcheck, one bug per issue:

- **Title**: what is wrong and where, e.g. "Check page: total doesn't match the parts"
- **Commit**: output of `git rev-parse --short HEAD`
- **Steps**: numbered, from a page URL
- **Expected** and **Actual**
- **Screenshot** and any red console error, copied as text
- **Browser and width**: e.g. Chrome 131, 390 px
