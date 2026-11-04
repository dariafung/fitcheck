# fitcheck · Hackathon Spec

Last updated: 2026-10-27

## Overview

fitcheck is an AI wardrobe web app. Before you buy a piece, it tells you whether it suits you, how many items in your closet it pairs with, and whether it closes a gap or creates one. The demo flow: add clothes from screenshots → write or say how each piece feels → check an item you want to buy → see the score, the reasons and an outfit preview.

- **Event**: Meta Global AI Developer Hackathon, Indie track, solo
- **Deadline**: 2026-11-04 9:00 PM ET (8:00 PM CT); target submission 5:00 PM CT that day
- **Judging**: Impact 30% · Use of Meta AI tooling 25% · Technical depth 20% · Demo (incl. video) 25%
- **Priorities**: P0 = the demo fails without it; P1 = bonus, built once the main flow is stable; P2 = only if time allows

## P0: main demo flow

With all of P0 done and deployed, judges can walk through "add clothes → feelings → purchase check" themselves.

| # | Feature | What it does | Done when | Model |
| --- | --- | --- | --- | --- |
| P0-1 | Profile | Body measurements (height and weight required; shown in in / lb or cm / kg, stored in cm / kg), body shape (one of five, required), temperature unit (°F or °C, required; every temperature on the site is shown and typed in it, stored in whole °F), lifestyle mix (outfits wanted per season for each occasion: work / school / social / sport / home), weather location for home's "Good for today" (device location by default, or a picked city) | Can be saved and edited; used by the purchase check | — |
| P0-2 | Add items: screenshot | Upload a screenshot of the product page → Spark identifies the product and points at the product photo → `web_search` fills in material, fit, etc. → user confirms or edits. The product photo is cropped out of the screenshot and framed the same way as every item photo: a plain light background swapped for white in code, trimmed to the garment (not page text or a neighbouring photo taken in with it) and centered on a white 4:5 canvas with a 10% margin (an on-model photo, or one on a backdrop that can't be made white this way, is cut out by Muse Image first, see P1-2). Spark also reads the size chosen on the screenshot (as written, halves as .5). Code writes the brand the way the user already saved it, else as on the brand's logo from a built-in list of common brands; the brand box suggests both while typing. The product name drops store notes ("*Updated"), ®/™ and a leading brand, and all-caps names are written in title case (Spark is asked to; code makes sure). Produces an item card | All 15–20 items of the demo persona added from screenshots with mostly correct attributes; user can edit tags | Spark 1.3 + web_search |
| P0-3 | Free-text feelings | One text box per item, write anything; the backend extracts flattering, liked, occasions, mood, and one entry per aspect the text mentions (color, feel, fit with body area, length, style, other): good or bad, what was said, and what it means | Raw text saved; structured fields generated without the user seeing or filling them | Spark 1.3 |
| P0-4 | Wardrobe grid | Grid of all items; open one to see details and feelings. Category tabs, then quick filters: "Not worn lately" and the two most common occasions. A sort menu: Newest / Most worn / Least worn, counted from the outfit calendar's last 30 days | Works in mobile and desktop browsers | — |
| P0-5 | Pairing | Rule pre-filter (complementary categories, formality, overlapping temperature ranges, obvious color clashes) → Spark judges pairs in batches, results cached → code enumerates complete outfits: top + bottom + shoes, or one-piece + shoes; outerwear optional by temperature; accessories don't count | Spot checks of the persona's pairings look mostly right | Spark 1.3 |
| P0-6 | **Purchase check** | Starts from the banner at the top of home. Match score 0–100 = suits you 40 + outfits 20 + revives 15 + fills a gap 15 + not a repeat 10; each part and the total keep one decimal. Suits you: the model scores 5 questions 0–8 each against every item the user wrote a feeling about, good and bad; a question with no related feeling isn't asked and gets 4. When the user has a style card (P1-3), its suits / skip lines go along too, even a stale one; the placeholder card or one too thin to show is left out. The model also sees the item's photo and the photos of the 6 closest felt items, shrunk to 512 px; anything without a readable photo goes as text. Not a repeat: `judgeRepeat` scores 0–10 and names the most similar owned item. Outfits, revives and gaps are counted in code (see Gap algorithm). Body-shape rules get low weight and only feed the reasons. If the model leaves an answer out or goes out of range, retry up to 3 times; still incomplete → no score, the page shows a short notice and Try again. One item at a time; accessories are not checked. Under the score, a one-line verdict from the score alone: WORTH BUYING 75+, A GOOD ADD 60–74, THINK TWICE 40–59, SKIP THIS ONE below 40. "Closest in your closet" shows the checked item beside the owned item `judgeRepeat` named. With an empty closet there is nothing to compare with: no score and no verdict | Two demo items give stable results: one closes a gap, one creates a gap. The item being checked is never stored or cached; each check asks the model again, so the AI-scored parts vary a little between runs. Same input, 3 runs: the direction holds (the item that suits them better always scores higher); on the persona's real closet with photos (15 felt items), suits you varied by up to 6 of 40 points (1–4 with the style card), and not a repeat by up to 1 of 10 | Spark 1.3 |
| P0-7 | Demo data + deploy | Email + password sign-up, no email confirmation; new accounts start with an empty closet; read-only demo account of the fictional persona ("Try the demo account", the login page's first button); sign-up asks for a name (2–30 characters, may repeat; what others see, changeable in Profile, never taken from the email; "fitcheck member" for older accounts that were named after their email); the demo Profile is locked except the in · lb / cm · kg switch, which is only kept in the browser; signed-in users are sent from /login to home, and from /signup too unless it's the demo account; daily AI budget $15 kept in the DB; daily cron drops orphan photos and old voice recordings; rate limits on hold | Judges can use it from the link; a full run shows no JS errors (4xx/5xx "Failed to load resource" lines don't count) | — |

## P1: bonus

P1 makes the demo memorable and lifts the Meta tooling score. Each item has a fallback, so none of them can sink the main flow.

| # | Feature | What it does | Done when | Model | Fallback |
| --- | --- | --- | --- | --- | --- |
| P1-1 | Voice feelings | Hold to talk, up to 3 minutes → converted to 16 kHz WAV in the browser → uploaded straight to Supabase Storage → transcribed on the server → same structuring flow as P0-3; English only | Recording works in Chrome and Safari; English transcribes | Voice Transcribe | Typing only |
| P1-2 | Outfit boards | Each sample outfit in the purchase check (2–4 pieces) is laid out as an outfit board: the real item photos on white, each piece on its own, staggered like a flat-lay collage, **no human body**. Plain light backgrounds are cut away in code for free. An on-model photo is redrawn by Muse Image as the garment alone on white when it comes in: when an item is added (only the cut-out is stored, framed like every item photo; a flat-lay on a backdrop code can't make white is cut out too) and when an item is checked (not stored); the card says "Photo cleaned up by AI." and offers the original (framed on white, a plain light background swapped for white for free) until it is saved. If the model fails or the budget is spent, the original is used without a word. "Style it with AI" under a board has Muse Image draw that whole outfit as one board from the photos (about 14 s, $0.01), labeled "AI-generated", one outfit at a time; the picture is kept only on the page, never stored or cached, and the read-only demo account can use it on the shared daily budget. Web and image search turned off | Colors and styles are recognizable at a glance; no person on any board | Muse Image | Original photo kept; boards fall back to rows of photos |
| P1-3 | Style profile | One card on home, left of "Good for today" (under it on a phone), summing up all active items and their feelings: a headline, then one row per topic (colors, fit, fabrics, length, style, where you wear it) with what works and what to skip. Written as conclusions; it may use the notes' own words. Needs 3 parsed feelings; rebuilt when home opens after the closet changed, at most once a minute per user; the demo account shows a seeded card | Every statement has sources (items and their feelings) in the backend; the card doesn't show them | Spark 1.3 | Used in the backend only, card not shown |
| P1-4 | Daily outfit insights | Calendar in the top bar: tick what you wore on a day (today or up to 30 days back), several outfits a day, each with an optional occasion; 10 days of seed data (on the hosted demo pinned to the hackathon, Oct 26 – Nov 4, with `SEED_LAST_DAY=2026-11-04`; the seed warns when that day is still ahead, so run it on Nov 4 or later), written out by hand for the persona (made up from whatever the closet holds when there's no plan), show wear counts (per outfit), idle items, "what you say vs. what you wear" and outfits per occasion against the lifestyle mix; Spark writes up to 3 insights, cached and redone at most once a day when the log changes; can be turned off in Profile (the log is kept) | At least one insight worth showing in the video | Spark 1.3 | Stats only, no generated insight |
| P1-5 | Resale matching (lite) | Mark an item "pass on" (it needs a size, typed as on the label, an asking price in US dollars and a condition: New with tags, Like new, Good or Fair; all editable on the item page, where the seller sees "Asking $XX · Like new"). Opted-in users whose profile sizes fit get the buy check run from their side (at most 5 new ones each time the item is opened; scores are cached until the item, or the buyer's closet, feelings, profile or style card, changes); the seller sees only how many buyers score 60+, with one identical anonymous avatar each (up to 5, then "+N"); never who they are or their scores. Buyers see their own 60+ matches in the "Suits you" tab in the top bar, read from the cached checks only (opening it runs no check); with resale matching off in Profile there is no tab and no page: photo, name, size, asking price, condition, their own reasons and the seller's picked name ("from figment"); look only, no messages or contact. The demo persona, figment, is both a seller and a buyer. The seed adds a few seed neighbors: other seed users with only a name and sizes, no closet or feelings, apart from the 4–6 pieces they pass on (with photos, prices and conditions). Re-seeding removes any seed user no longer in the seed, with everything they own. They are the only buyers figment's two passing-on pieces are matched with, and the sellers in figment's "Suits you" ("from Maya"). Every match between them is seeded as a cached check whose fingerprint the seed works out with the app's own code, so opening either side never runs a check; a buyer without clothes is never checked anyway (a check on an empty closet means nothing). Those seeded scores and reasons are written for the demo, not model output. No transactions | Matches and scores make sense | Spark 1.3 (the buy check's calls) | Shown as a mockup in the video |

## P2: only if time allows

| # | Feature | What it does | Model |
| --- | --- | --- | --- |
| P2-1 | SAM cutout | While reading product images, Spark also classifies them as flat-lay or on-model; only on-model images go to SAM, prompted with the category (e.g. "jacket"), producing a transparent cutout | Spark 1.3 + SAM 3.1 |
| P2-2 | Photo entry | Older clothes with no product page: upload a photo, SAM cuts it out, Spark tags it | Spark 1.3 + SAM 3.1 |
| P2-3 | Gap recommendations | When a gap is found, suggest the type of item that would fill it; mention the affiliate-commission model in the pitch, no real integration | Spark 1.3 |

Rule: once P0 and P1 are done and at least half a day remains, build P2-1 → P2-2 → P2-3 in that order.

## Out of scope

- Multi-user sign-up and full auth: one demo account only
- Resale transactions, payments, shipping
- Real affiliate-network or Amazon Creators API integration
- Fetching store pages: items are added from screenshots only
- Native mobile app and app store release

## Tech plan

All AI goes through the Meta Model API (`https://api.meta.ai/v1`). No contributor models, because the data includes body measurements.

**Stack**

| Layer | Choice |
| --- | --- |
| Frontend + backend | Next.js (App Router); every AI call goes through a Route Handler, not a Server Action; create-next-app's anonymous feedback option turned off |
| Database + storage | Supabase; no ORM, supabase-js + SQL migration files; secret key used server-side only; RLS on for every table with no policies; a daily scheduled ping keeps the free project from pausing |
| Deploy | Vercel Hobby (functions up to 300 s; request body up to 4.5 MB, so large files upload straight to storage) |
| Model calls | `openai` SDK + Responses API; `zod` for output schemas, one retry when validation fails |
| Images | `sharp` for server-side image processing (cropping product photos out of screenshots) |
| SAM mask decoding | `@meta-sam/parser` (added in P2) |

**Item entry** (screenshot only)

1. The user uploads a screenshot of the product page; the browser narrows it to 1600 px wide and keeps it under 4 MB (the request limit is 4.5 MB); the screenshot itself is not stored
2. Spark identifies the product, says where the product photo sits in the screenshot, picks one color family from a fixed list (the store's color names are kept too), estimates the temperatures (°F) it is comfortable in from type and material, and `web_search` fills in attributes with sources
3. Code checks that box, grows it by 8% on every side so a sleeve or strap the model cut off is back in, and crops the product photo (WebP in storage); a box that is off falls back to the whole screenshot and is flagged for the user to check. Whether the background is plain enough to make white is judged on the model's own box (the padding may take in page text). Code swaps a plain light background for white and frames it on the white 4:5 canvas, centered on the garment: the biggest piece of non-white pixels and any piece at least a quarter its size, leaving out the product name, badges and the edge of a neighbouring photo. The purchase check frames its photo the same way; an on-model photo, or one on a backdrop code can't make white, is cut out by Muse Image first
4. The user confirms or edits the card, then saves

We don't fetch store pages: large retailers block it (tested: Zara, Uniqlo, H&M, ASOS, Shein, lululemon), and data-center IPs after deploy fare even worse. All demo items are preloaded.

**AI layer**: every model call goes through one module with fixed JSON inputs and outputs (enforced with Spark structured output). Start with a mock implementation to get the UI working, then switch to real models.

| Function | Input → output | Model |
| --- | --- | --- |
| `extractItem` | Product data / page text / screenshot + images (may call web_search) → normalized tags + on-model flag | Spark 1.3 |
| `parseFeeling` | Free text → structured feelings | Spark 1.3 |
| `transcribe` | Recording → text | Voice Transcribe |
| `judgePairing` | Two items → pairs or not + reason | Spark 1.3 |
| `scorePurchase` | New item + profile + every item with a feeling + the style card when there is one + photos of the new item and the 6 closest felt items + fit questions → a 0–8 score and reason per question | Spark 1.3 |
| `judgeRepeat` | New item + all active items → not-a-repeat score 0–10 + the most similar item + reason | Spark 1.3 |
| `renderOutfit` | 2–4 item photos, each with a line saying what it is → one outfit board drawn on white, no person (Style it with AI, P1-2) | Muse Image |
| `buildProfile` | Active items + parsed feelings → headline + what works / what to skip per topic, each citing items | Spark 1.3 |
| `summarizeWear` | 30 days of wear counts per active item + their feelings + outfits per occasion → up to 3 insights, each citing items | Spark 1.3 |
| `segmentGarment` | On-model image (or one on a busy backdrop) + category word → the garment alone on white (P1-2; SAM 3.1 may replace it in P2-1) | Muse Image |

**Gap algorithm**: keep an "item → items it pairs with" table and let code enumerate complete outfits. Three parts for a new item, all linear: outfits it forms, 2.5 each, up to 20; owned items that had no outfit and now have one, 4 each, up to 15 (the new item itself doesn't count); fills a gap, for occasions the user wants outfits for: each added outfit earns 5 × how short the occasion was (short ÷ wanted, before the new item), only up to the shortfall, occasions added up to 15, and an occasion that already has enough earns 0. If it forms no outfit at all, we say what's missing for each way to build an outfit around it (shoes: a top and bottom, or a one-piece); when the closet has none of those categories it's a plain note that says what does go with it and what's missing ("Your tops could go with this, but you have no shoes yet", or "Nothing in your closet to wear these with yet" when nothing does), otherwise a warning that it creates a gap. Constants get tuned during testing.

**Engineering conventions**

- The AI layer has three modes: mock (fake data), live (real calls) and replay (real responses recorded and replayed by input hash, so development costs nothing and the demo has a safety net)
- Stable results come from caching, code-counted parts and narrow integer model scores, not from tuning temperature
- The Meta console has no hard spending cap: the app keeps a daily budget counter and rate-limits by IP
- Muse Image requests turn off `enable_web_search`, `enable_image_search` and `enable_shell`; a cleaned-up photo replaces the original before the item is saved, and the item being checked is never stored
- Secrets live only in the keychain, `.env.local` and Vercel environment variables, never in git
- Weather: Open-Meteo forecast and geocoding (free, no key, credited on the page). Location order: picked city → device location → Vercel IP headers; with none of them there is no weather: home lists everything under "Set your city to see what's good for today.", linking to the weather setting (no default city). The location and the unit choice live in browser cookies, never in the database; automated tests use `WEATHER_MODE=fixed` and never call Open-Meteo

## Data model

| Table | Main fields | Priority |
| --- | --- | --- |
| `users` | Name others see (display_name), measurements, body shape, lifestyle mix, sizes (top and bottom XS–XXL, shoe as W7.5 / M9), resale opt-in, outfit calendar on / off | P0 |
| `items` | Source URL, entry method, images, AI tags, user-corrected tags, on-model flag, status (active / passing on), size as typed | P0 |
| `item_feelings` | Raw text, source (typed / voice), structured fields | P0 |
| `pairings` | Item A, item B, pairs or not, reason, source (rule / AI) | P0 |
| `style_profiles` | One per user: headline, suits, avoid (each with topic and source items), input hash, generated at | P1 |
| `outfit_logs` | One row per outfit (several a day): date, items (sorted, unique per day), occasion | P1 |
| `wear_insights` | One per user: insights about the outfit log, input hash, generated at | P1 |
| `resale_matches` | Passing-on item × buyer: buy check score, what the seller may see, the buyer's own reasons, fingerprint, checked at | P1 |
| `resale_buyers` | Unused: buyers are opted-in users | P1 |

## Schedule

First version of all P0 done by 10/30. At the 10/31 checkpoint, if the purchase check is still unstable, cut P1-2 (outfit preview) and P1-5 (resale) and give the time back to the main flow.

| Date | Tasks | Features |
| --- | --- | --- |
| Mon 10/26 | Confirm API access; scaffold Next.js, create tables; fetch test script on 10–15 links (led to screenshot-only entry) | Setup |
| Tue 10/27 | Screenshot entry + `extractItem`; small test: screenshot + search, outfit image fidelity (1–2 hours) | P0-2, P1-2 |
| Wed 10/28 | Typed and voice feelings, profile, wardrobe grid; enter the demo persona's wardrobe | P0-1/3/4, P1-1 |
| Thu 10/29 | Pairing: rules + Spark, build the pairings table | P0-5 |
| Fri 10/30 | Purchase check: score, gaps, pairing count | P0-6 |
| Sat 10/31 | Tune prompts on 5–8 test items; **checkpoint** | P0-6 |
| Sun 11/1 | Outfit preview + style profile | P1-2, P1-3 |
| Mon 11/2 | Daily outfit insights + resale matching (lite) | P1-4, P1-5 |
| Tue 11/3 | Deploy; full run-through with no JS errors; fix bugs; P2 if time allows | P0-7, P2 |
| Wed 11/4 | Record the demo video, write the submission; **submit before 5:00 PM CT** | Delivery |

## Risks and open items

| Risk | Mitigation |
| --- | --- |
| Store pages block fetching, worse from data-center IPs after deploy | Entry is screenshot + search only; demo items preloaded |
| Screenshot + search misses details such as material | Verify in the small test; if missing, the user pastes that block of text |
| Muse Image fidelity too low | Small test passed on an on-model photo (low effort, about 10 s); the user can keep the original photo before saving; boards use real photos |
| Purchase check results unstable | Outfits, revives and gaps counted in code; the model only gives integer scores (0–8, 0–10) with reasons; caching; 10/31 checkpoint |
| Charges go to the card once credits run out | In-app daily budget + rate limits; watch usage |
| Supabase free project pauses after a week idle | Daily scheduled ping |
| Judges break the demo data | Demo account is read-only on the server (`DEMO_WRITABLE=1` lifts it for a while, e.g. to record the video; re-seed afterwards); everyone else gets their own account |
| Screenshot content | Only the cropped product photo is kept, shown only to that user |

**Open items**

- [x] Database and storage: Supabase
- [x] Deploy: Vercel Hobby
- [x] Voice entry: P1, up to 3 minutes
- [x] Meta API credits received
- [ ] Small test: screenshot + search coverage, flat-lay outfit image fidelity (under $0.50; waiting on assets and key)
- [x] The demo persona's 15–20 items (screenshots)
- [ ] How long the judging period lasts (check the event page)
