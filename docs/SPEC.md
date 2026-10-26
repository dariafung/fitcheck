# fitcheck · Hackathon Spec

Last updated: 2026-10-26

## Overview

fitcheck is an AI wardrobe web app. Before you buy a piece, it tells you whether it suits you, how many items in your closet it pairs with, and whether it closes a gap or creates one. The demo flow: add clothes by link or screenshot → write or say how each piece feels → check an item you want to buy → see the score, the reasons and an outfit preview.

- **Event**: Meta Global AI Developer Hackathon, Indie track, solo
- **Deadline**: 2026-11-04 9:00 PM ET (8:00 PM CT); target submission 5:00 PM CT that day
- **Judging**: Impact 30% · Use of Meta AI tooling 25% · Technical depth 20% · Demo (incl. video) 25%
- **Priorities**: P0 = the demo fails without it; P1 = bonus, built once the main flow is stable; P2 = only if time allows

## P0: main demo flow

With all of P0 done and deployed, judges can walk through "add clothes → feelings → purchase check" themselves.

| # | Feature | What it does | Done when | Model |
| --- | --- | --- | --- | --- |
| P0-1 | Profile | Body measurements, body shape, lifestyle mix (work / social / sport / home) | Can be saved and edited; used by the purchase check | — |
| P0-2 | Add items: link + screenshot | Shopify stores and Amazon: paste a link and we fetch the page. Large retailers (e.g. lululemon): upload a screenshot of the product page → Spark identifies the product → `web_search` fills in material, fit, etc. → user confirms. Produces an item card | All 15–20 items of the demo persona added; 3–5 lululemon items added from screenshots with mostly correct attributes; user can edit tags | Spark 1.3 + web_search |
| P0-3 | Free-text feelings | One text box per item, write anything; the backend extracts flattering, liked, body areas, occasions, mood | Raw text saved; structured fields generated without the user seeing or filling them | Spark 1.3 |
| P0-4 | Wardrobe grid | Grid of all items; open one to see details and feelings | Works in mobile and desktop browsers | — |
| P0-5 | Pairing | Rule pre-filter (complementary categories, formality, season, obvious color clashes) → Spark judges pairs in batches, results cached → code enumerates complete outfits: top + bottom + shoes, or one-piece + shoes; outerwear optional by season; accessories don't count | Spot checks of the persona's pairings look mostly right | Spark 1.3 |
| P0-6 | **Purchase check** | Four gap metrics computed in code: how many existing items it revives, how many outfits the new item forms, whether the gap for frequent occasions shrinks, whether it duplicates something owned (tuned during testing). Match score 0–100 computed in code; the model only answers yes/no questions and writes the reasons. Main signal: items the user marked as flattering or liked; body-shape rules get low weight and only feed the reasons | Two demo items give stable results: one closes a gap, one creates a gap; three runs on the same item agree (cache + deterministic scoring) | Spark 1.3 |
| P0-7 | Demo data + deploy | Fictional demo persona; demo items preloaded; seed data read-only; visitor data isolated with one-click reset; rate limits + daily budget | Judges can use it from the link; a full run shows no console errors | — |

## P1: bonus

P1 makes the demo memorable and lifts the Meta tooling score. Each item has a fallback, so none of them can sink the main flow.

| # | Feature | What it does | Done when | Model | Fallback |
| --- | --- | --- | --- | --- | --- |
| P1-1 | Voice feelings | Hold to talk, up to 3 minutes → converted to 16 kHz WAV in the browser → uploaded straight to Supabase Storage → transcribed on the server → same structuring flow as P0-3; language auto-detected | Recording works in Chrome and Safari; Chinese and English both transcribe | Voice Transcribe | Typing only |
| P1-2 | Outfit preview | In the purchase check, combine "new item + 2 owned items" into one flat-lay / invisible-mannequin outfit image, **no human body**; web and image search turned off; shown side by side with a collage of the real item photos, labeled as AI-generated | Colors and styles are recognizable at a glance; demo outfits pre-generated | Muse Image | Collage only |
| P1-3 | Style profile | One card summarizing all items and feelings: what suits you, what to avoid, frequent occasions | Every statement on the card traces back to specific items or feelings | Spark 1.3 | Used in the backend only, card not shown |
| P1-4 | Daily outfit insights | Tick what you wore today; 30 days of seed data show wear counts, idle items and "what you say vs. what you wear" | At least one insight worth showing in the video | Spark 1.3 | Stats only, no generated insight |
| P1-5 | Resale matching (lite) | Mark an item "pass on"; rank the top 3 of 5–10 preset buyers with reasons; no transactions | Ranking and reasons make sense | Spark 1.3 | Shown as a mockup in the video |

## P2: only if time allows

| # | Feature | What it does | Model |
| --- | --- | --- | --- |
| P2-1 | SAM cutout | While reading product images, Spark also classifies them as flat-lay or on-model; only on-model images go to SAM, prompted with the category (e.g. "jacket"), producing a transparent cutout | Spark 1.3 + SAM 3.1 |
| P2-2 | Photo entry | Older clothes with no link: upload a photo, SAM cuts it out, Spark tags it | Spark 1.3 + SAM 3.1 |
| P2-3 | Gap recommendations | When a gap is found, suggest the type of item that would fill it; mention the affiliate-commission model in the pitch, no real integration | Spark 1.3 |

Rule: once P0 and P1 are done and at least half a day remains, build P2-1 → P2-2 → P2-3 in that order.

## Out of scope

- Multi-user sign-up and full auth: one demo account only
- Resale transactions, payments, shipping
- Real affiliate-network or Amazon Creators API integration
- Site-wide crawling: we only fetch the one page a user pastes
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
| Web pages and images | `cheerio` to parse pages, `turndown` to turn page content into text, `sharp` for server-side image processing |
| SAM mask decoding | `@meta-sam/parser` (added in P2) |

**Item entry** (results from all steps are merged, not first-success-wins)

1. Shopify: when the response has `powered-by: Shopify`, append `.json` to the product URL for product data
2. JSON-LD and Open Graph tags on the page
3. Embedded page JSON (e.g. `__NEXT_DATA__`), trimmed and passed straight to Spark
4. Cleaned page text + 1–3 product images
5. Large retailers that block fetching (tested: Zara, Uniqlo, H&M, ASOS, Shein, lululemon): the user uploads a screenshot → Spark identifies the product → `web_search` fills in attributes with sources

Whatever fields the first steps return, Spark always runs once: it treats known fields as facts and fills in fit, formality and season. Pasted URLs get an SSRF check, re-validated after redirects. Once deployed we fetch from data-center IPs, which is even harder, so all demo items are preloaded.

**AI layer**: every model call goes through one module with fixed JSON inputs and outputs (enforced with Spark structured output). Start with a mock implementation to get the UI working, then switch to real models.

| Function | Input → output | Model |
| --- | --- | --- |
| `extractItem` | Product data / page text / screenshot + images (may call web_search) → normalized tags + on-model flag | Spark 1.3 |
| `parseFeeling` | Free text → structured feelings | Spark 1.3 |
| `transcribe` | Recording → text | Voice Transcribe |
| `judgePairing` | Two items → pairs or not + reason | Spark 1.3 |
| `scorePurchase` | New item + profile + flattering/liked anchor items → yes/no answers with reasons (score, gaps and outfit count are computed in code) | Spark 1.3 |
| `renderOutfit` | 3 item images → one outfit image | Muse Image |
| `buildProfile` | All items + feelings → style profile | Spark 1.3 |
| `segmentGarment` | On-model image + category word → transparent cutout (P2) | SAM 3.1 |

**Gap algorithm**: keep an "item → items it pairs with" table and let code enumerate complete outfits. Four metrics for a new item: how many existing items that couldn't form an outfit it revives (the new item itself is not counted), how many outfits the new item forms, whether the gap for frequent occasions shrinks, and whether it duplicates an owned item. If it forms no outfit at all, it creates a gap, and we say which slot is missing. Thresholds get tuned during testing.

**Engineering conventions**

- The AI layer has three modes: mock (fake data), live (real calls) and replay (real responses recorded and replayed by input hash, so development costs nothing and the demo has a safety net)
- Stable results come from caching and code-computed scores, not from tuning temperature
- The Meta console has no hard spending cap: the app keeps a daily budget counter and rate-limits by IP
- Muse Image requests turn off `enable_web_search` and `enable_image_search`; generated images are copied to our storage right away and cached by "item ids + prompt version"
- Secrets live only in the keychain, `.env.local` and Vercel environment variables, never in git

## Data model

| Table | Main fields | Priority |
| --- | --- | --- |
| `users` | Measurements, body shape, lifestyle mix, resale opt-in | P0 |
| `items` | Source URL, entry method, images, AI tags, user-corrected tags, on-model flag, status (active / idle / passing on) | P0 |
| `item_feelings` | Raw text, source (typed / voice), structured fields | P0 |
| `pairings` | Item A, item B, pairs or not, reason, source (rule / AI) | P0 |
| `purchase_checks` | Product, match score, gap result, paired items, reasons, outfit image | P0 |
| `style_profiles` | Suits, avoid, frequent occasions, generated at | P1 |
| `outfit_logs` | Date, items, occasion | P1 |
| `resale_buyers` | Preset buyer profiles and preferences | P1 |

## Schedule

First version of all P0 done by 10/30. At the 10/31 checkpoint, if the purchase check is still unstable, cut P1-2 (outfit preview) and P1-5 (resale) and give the time back to the main flow.

| Date | Tasks | Features |
| --- | --- | --- |
| Mon 10/26 | Confirm API access; scaffold Next.js, create tables; fetch test script on 10–15 links | Setup |
| Tue 10/27 | Link + screenshot entry + `extractItem`; small test: screenshot + search, outfit image fidelity (1–2 hours) | P0-2, P1-2 |
| Wed 10/28 | Typed and voice feelings, profile, wardrobe grid; enter the demo persona's wardrobe | P0-1/3/4, P1-1 |
| Thu 10/29 | Pairing: rules + Spark, build the pairings table | P0-5 |
| Fri 10/30 | Purchase check: score, gaps, pairing count | P0-6 |
| Sat 10/31 | Tune prompts on 5–8 test items; **checkpoint** | P0-6 |
| Sun 11/1 | Outfit preview + style profile | P1-2, P1-3 |
| Mon 11/2 | Daily outfit insights + resale matching (lite) | P1-4, P1-5 |
| Tue 11/3 | Deploy; full run-through with no console errors; fix bugs; P2 if time allows | P0-7, P2 |
| Wed 11/4 | Record the demo video, write the submission; **submit before 5:00 PM CT** | Delivery |

## Risks and open items

| Risk | Mitigation |
| --- | --- |
| Large retailers block fetching, worse from data-center IPs after deploy | Large retailers go through screenshot + search; demo items preloaded |
| Screenshot + search misses details such as material | Verify in the small test; if missing, the user pastes that block of text |
| Muse Image fidelity too low | Verify in the small test; otherwise show the collage only |
| Purchase check results unstable | Code-computed scores, model only answers yes/no and writes reasons; caching; 10/31 checkpoint |
| Charges go to the card once credits run out | In-app daily budget + rate limits; watch usage |
| Supabase free project pauses after a week idle | Daily scheduled ping |
| Judges break the demo data | Read-only seed data; visitor isolation + reset |
| Scraping compliance | Fetch one page only when the user pastes a link; images shown only to that user; keep the source link |

**Open items**

- [x] Database and storage: Supabase
- [x] Deploy: Vercel Hobby
- [x] Voice entry: P1, up to 3 minutes
- [x] Meta API credits received
- [ ] Small test: screenshot + search coverage, flat-lay outfit image fidelity (under $0.50; waiting on assets and key)
- [ ] The demo persona's 15–20 items (links or screenshots)
- [ ] How long the judging period lasts (check the event page)
