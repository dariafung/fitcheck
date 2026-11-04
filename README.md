# fitcheck

Before you buy a piece of clothing, fitcheck tells you if it suits you, how many outfits it makes with what you already own, and whether it fills a gap in your closet or creates one.

**Live app: https://fitcheck-chi-eight.vercel.app**

Demo video: _coming soon_

Built for the Meta Global AI Developer Hackathon (Indie track).

## Try it

On the login page, click **Try the demo account**. It's a read-only account for a made-up persona, figment, with 18 items and 10 days of logged outfits. figment passes on two pieces (see how many people would want each) and has secondhand pieces from other made-up users under the **Suits you** tab. In the demo account, those buyer counts and Suits you come from cached checks in the seed: the other users (seed neighbors) have only a name and sizes, and their scores and reasons were written for the demo, not by the AI.

Or **Sign up** with a name, any email and a password (no confirmation email) and start from an empty closet.

Things to try first:

1. **Should I buy this?** (top of home): upload a screenshot of a product page. You get a score out of 100 with a one-line verdict, split into five parts, each with a short reason, and the closest piece you already own beside it.
2. **Calendar** (top bar): see what was worn, which items sit idle, and a few AI insights.
3. **Profile** (your own account; the demo Profile is read-only): switch to °C and see every temperature on the site change.

## What it does

- **Add clothes from a screenshot**: Spark reads the product page, crops out the product photo and fills in brand, type, colors, material and size.
- **Feelings**: write or say how a piece feels on you ("love the color, tight at the shoulders"). Spark turns it into structured notes you never have to fill in.
- **Voice feelings**: hold to talk, up to 3 minutes, English.
- **Closet**: a grid of everything you own, on phone and desktop, with quick filters (not worn lately, top occasions) and a sort by newest or by how often you wore each piece.
- **Pairing**: rules plus Spark decide which pieces go together; code builds full outfits from that.
- **Purchase check**: a 0–100 score = suits you (40) + outfits it makes (20) + items it brings back into use (15) + fills a gap (15) + not a repeat (10), with a verdict from Worth buying to Skip this one. The item you check is never saved.
- **Outfit boards**: sample outfits shown as a flat lay of your own item photos. On-model photos are cleaned up to the garment alone by Muse Image.
- **Style card**: one card on home that sums up what works for you and what to skip.
- **Outfit calendar**: log what you wore; see wear counts, idle items and what you say vs. what you wear.
- **Good for today**: clothes that fit today's weather where you are.
- **Profile**: measurements, body shape, sizes, outfits wanted per occasion, °F / °C.
- **Resale matching**: pass on an item with its size, asking price and condition to see how many people would likely want it. Buyers see what suits them under the **Suits you** tab, with the seller's name and nothing to contact them with. With resale matching off in Profile, there is no such tab.

## Meta models

Every AI call goes through the Meta Model API.

| Model | Used for |
| --- | --- |
| Muse Spark 1.3 | Reading product screenshots (with web search), turning feelings into structured notes, judging which items pair, scoring the purchase check, spotting repeats, the style card, outfit calendar insights |
| Muse Image | Cutting an on-model product photo down to the garment on white |
| Muse Voice Transcribe | Turning voice feelings into text |

## Tech stack

Next.js 16 (App Router) · Supabase (Postgres + Storage) · Vercel · `openai` SDK pointed at the Meta Model API · zod · sharp · Open-Meteo for weather

## Image credits

The product photos in `seed/images/` and `fixtures/images/` belong to their brands (ZARA, HOLLISTER, lululemon, ASICS, Aritzia). They are used only to demo and test this hackathon project, and fitcheck isn't affiliated with these brands.

## Run it locally

You need Node 24, Docker (for local Supabase) and pnpm 12.

```sh
pnpm install
pnpm db:start     # local Supabase
pnpm db:reset     # apply migrations (wipes local data)
pnpm env:local    # write .env.local for local Supabase
pnpm seed         # load the demo persona and demo account
pnpm dev          # http://localhost:5110
```

The AI layer has three modes, set with `AI_MODE` in `.env.local`:

- `mock` (default): fake answers, no key needed, costs nothing
- `replay`: plays back real responses recorded in `fixtures/ai/`; inputs that weren't recorded fail
- `live`: real calls; needs `META_API_KEY` (on macOS it can also come from the keychain item `meta-model-api`)

Tests: `pnpm test` (unit), `pnpm test:integration` (needs local Supabase), `pnpm test:e2e` (run `pnpm build` first).

More detail: [docs/SPEC.md](docs/SPEC.md) · Manual test plan: [docs/TEST_PLAN.md](docs/TEST_PLAN.md)
