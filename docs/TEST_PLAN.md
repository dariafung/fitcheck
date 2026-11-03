# Manual test plan

Test the hosted app in your browser and report anything that doesn't match the expected result as a GitHub issue (see the last section). Nothing to install.

## What to test

- Site: https://fitcheck-chi-eight.vercel.app
- It deploys from `main`. The commit you tested is the latest one on `main` at the time; put it in every report.
- AI is **live**: real model calls on the project's Meta key. You don't need a key of your own.
- The app stops calling the model after **$7 a day** (all users together). Rough cost: a few cents per screenshot, about $0.02 per purchase check, about $0.01 per "Style it with AI". If AI steps start failing with a budget message, stop for the day and note it in an issue.
- Use your own email for the account. No confirmation email is sent; you can use it right away.
- Section 9 (resale) needs a second account. Use another email of yours.

## How to test

Test in Chrome on desktop and at phone width (DevTools device toolbar, 390 px). Go through the sections in order: later ones use the closet, profile and feelings from earlier ones.

### 1. New account

| # | Do | Expect |
| --- | --- | --- |
| 1.1 | Open the site while signed out | You land on `/login` with "Log in", "Sign up" and "Try the demo account" |
| 1.2 | "Sign up" with a name (2–30 characters), your email and a password of 6+ characters; try once with no name first | You land on an empty closet: "Your closet is empty."; "Log out" top right (on a phone, at the bottom of Profile) |
| 1.3 | Log out, log in again with the same email and password | Back in your (empty) closet |
| 1.4 | Log in with a wrong password | A short error on the page |
| 1.5 | Open `/closet` in a private window | Sent to `/login` |

### 2. Top bar

| # | Do | Expect |
| --- | --- | --- |
| 2.1 | Look at the top bar on desktop | "FITCHECK", "Closet", "Calendar" on the left; "Profile" and "Log out" on the right; no purchase-check button |
| 2.2 | Same at 390 px | No "Log out" in the bar (it's at the bottom of Profile); nothing wraps or overflows |
| 2.3 | Click each link on a few pages | FITCHECK → home, Closet → `/closet`, Calendar → `/calendar`, Profile → `/profile`; the bar is the same on every page |
| 2.4 | Open home, the closet, an item, "Add clothes", Calendar, Profile and the purchase check | The link for the page you're on is black, the rest gray (FITCHECK is black on home); an item and "Add clothes" count as Closet; on the purchase check all are gray; "Log out" is always gray |
| 2.5 | Look at the top of home on desktop and at 390 px | Home's title "Thinking of buying something?" with a black "Should I buy this?" button under it, both on the left; at 390 px both are centered and the button is full width; it comes before "Your style" and "Good for today" |

### 3. Add clothes by screenshot

Take screenshots of real product pages from different stores (one screen: product photo and name visible). Include at least one where the product is shown on a model.

| # | Do | Expect |
| --- | --- | --- |
| 3.1 | Closet → "Add clothes", "Choose a screenshot" | "Reading your screenshot…" for about 10 s, then a "Look right?" card with the product photo on white and filled-in fields |
| 3.2 | Check the card | Name, brand, size, type, colors and materials mostly right; the photo is the product, not the page header or a face |
| 3.3 | Look at the name | No ®, ™, "*Updated" or brand in front; not in all caps |
| 3.4 | Click into Brand, type the first letters of a brand | A list of matching brands drops down (yours first, then common ones); picking one fills it in with the logo's spelling |
| 3.5 | Upload a screenshot where the product is worn by a model | "AI is cutting out the photo…", then the piece alone on white, no person; "Photo cleaned up by AI." with "Use original photo" |
| 3.6 | "Use original photo" | The store's photo, framed on white, replaces the cut-out |
| 3.7 | Fix a field, "Save to closet" | "<name> is in your closet." with "See closet" and "Add another"; the item shows in the closet grid |
| 3.8 | Add 5–8 items: tops, bottoms, shoes, one outerwear | Each one saves; the closet grid shows them all, every photo on white |
| 3.9 | Upload a screenshot with no product in it | "Couldn't spot a product there. Try another screenshot?" and nothing saved |
| 3.10 | Upload a screenshot of a bag, belt or hat | "We only do clothes and shoes for now." and nothing saved |
| 3.11 | Drop or paste a file that isn't an image | A short message, nothing saved |

### 4. Add clothes by photo (comes with the `f/entry-photo` merge)

Skip this section until photo entry is on `main`. Take photos of 2–3 clothes you own: one laid flat, one on a hanger, one worn.

| # | Do | Expect |
| --- | --- | --- |
| 4.1 | Closet → "Add clothes" | "Add a photo" next to "Choose a screenshot"; on a phone it offers the camera or your photo library |
| 4.2 | "Add a photo", pick a photo | "Reading your photo…", then "AI is cutting out the photo…", then a card with the piece alone on white |
| 4.3 | Check the card | A plain name (color + type), type, colors, fit and fabric filled in; brand and size only if a label is readable; "Photo cleaned up by AI." with no "Use original photo" |
| 4.4 | Use the worn photo | The card's photo shows only the piece: no face, body or room |
| 4.5 | "Save to closet", open the item | The cut-out is the item's photo |
| 4.6 | Pick a photo with no clothes in it | "Couldn't spot any clothes there. Try another photo?" and nothing saved |

### 5. Item page

| # | Do | Expect |
| --- | --- | --- |
| 5.1 | Open an item | Name, type, colors, size (if it has one), "Comfortable in __ to __°F", how dressy, "Edit details", "Pass it on", the feelings box, a grey "Delete" at the bottom |
| 5.2 | "Edit details", change the temperature range, save; reload | New range kept |
| 5.3 | Write a feeling ("Love the color, a bit tight at the shoulders"), Save; reload | Text kept |
| 5.4 | Hold "Hold to talk", say a sentence in English, release | The words appear in the feelings box for you to edit; Save keeps them |
| 5.5 | Delete → Cancel | Back to "Delete", item still there |
| 5.6 | Delete → Delete | Back in the closet, the item is gone; the browser Back button doesn't reopen it |

### 6. Profile and home

| # | Do | Expect |
| --- | --- | --- |
| 6.1 | Profile: fill height, weight, body shape, sizes and outfits wanted per occasion; Save; reload | Values kept |
| 6.2 | Switch units in · lb ↔ cm · kg | Numbers convert; switching back gives the same numbers |
| 6.3 | Weather: search a city, pick it | Home shows that city's low–high in your Profile's unit |
| 6.4 | Home | "Good for today" shows clothes whose range fits today's weather; "Change" goes to the weather setting in Profile |
| 6.5 | Profile: pick °C, Save; open home, an item, "Edit details", then a purchase check card | Today's low–high, "Comfortable in" and the temperature boxes are all in whole °C; a box you don't touch saves its old value unchanged |
| 6.6 | Pick °F again, Save | Everything is back in °F with the same numbers as before |
| 6.7 | Home with feelings on fewer than 3 items | Under "Your style": "Say how 3 pieces feel and we'll sum up your style." |
| 6.8 | Write feelings on 3+ items, open home | "Your style" fills in: a headline, then rows (Colors, Fit, Fabrics…) with what works and "Skip: …"; it matches what you wrote |

### 7. Should I buy this?

Do this after sections 3, 5 and 6, so there is a closet, feelings and a profile to check against.

| # | Do | Expect |
| --- | --- | --- |
| 7.1 | Home → "Should I buy this?" (the banner at the top), upload a product screenshot | "Reading…", then a "Look right?" card like in 3.1 (clean name, brand suggestions, a cut-out for an on-model photo) |
| 7.2 | "Check it" | "Checking…", then the photo, a score like "47.5 / 100" and a one-line summary |
| 7.3 | Look at the five parts | Suits you /40, Outfits /20, Revives /15, Fills a gap /15, Not a repeat /10; they add up to the total |
| 7.4 | Read every reason, open "Why" under Suits you | Short, plain, about this item and your closet; no made-up items |
| 7.5 | Check an item close to one you own (same type and color) | "Not a repeat" is low and names that item |
| 7.6 | Check the same item 3 times | Outfits, Revives and Fills a gap stay the same; Suits you moves by a few points (up to about 6), Not a repeat by about 1 |
| 7.7 | Check an item that you've written about in a feeling (e.g. the color you love, the fit you hate) | "Suits you" reasons refer to those feelings |
| 7.8 | Check shoes when your closet has no shoes, or a top when it has no bottoms | A note that says what's missing to make an outfit |
| 7.9 | Under "You could wear it like this" | Sample outfits laid out as flat-lay boards of the real photos on white, the checked piece marked "New"; no person |
| 7.10 | "Style it with AI" under one board | "AI is styling this outfit…" for about 15 s, then one picture of the whole outfit on white, tagged "AI-generated", no person; the pieces are recognizable |
| 7.11 | While it's styling, look at the other boards | Their "Style it with AI" can't be clicked until this one is done |
| 7.12 | "Show real photos", then "Show AI look" | Switches between the board and the AI picture without asking again |
| 7.13 | "Check another" or reload, then check the same item | The AI picture is gone; "Style it with AI" is back |
| 7.14 | Go to the closet afterwards | The checked item was **not** added |

### 8. Outfit calendar

| # | Do | Expect |
| --- | --- | --- |
| 8.1 | Top bar → "Calendar" | This month's grid, today picked; beside it (below on a phone) today's panel ready to log: "What did you wear?" |
| 8.2 | Tap 2–4 pieces, pick an occasion under "Where to?", Save | The outfit shows in the day panel ("Outfit 1") and its photos in the day's cell |
| 8.3 | "Add another outfit" on the same day, log a second one | Both show; the cell says 2 outfits |
| 8.4 | Edit an outfit, change a piece, Save; then Delete → Delete | Changes kept; the deleted outfit is gone |
| 8.5 | Pick a day more than 30 days back (← to last month) | You can see it but not log: "Too far back to change." when it has outfits |
| 8.6 | Under the calendar, "Last 30 days" | "N days logged · N outfits"; "Most worn" and "Not worn" lists with "Once" / "N times"; "By occasion" with outfits logged and how many you want a season |
| 8.7 | Open an item you logged | A "Worn" line: "N times in the last 30 days, last on <day>" |
| 8.8 | With fewer than 7 days logged | "What we noticed": "Log N more days to get insights." |
| 8.9 | Log outfits on 7 different days (today and the days before), reload | "Reading your log…", then up to 3 insights, each with the photos of the items it's about, and "Written by AI from your log and notes." The insights match your log |
| 8.10 | Log one more outfit the same day, reload | The same insights, now with "As of <today>" (they are redone at most once a day, Chicago time) |
| 8.11 | Profile → "Outfit calendar", turn it off | "Calendar" leaves the top bar; `/calendar` says "Your outfit calendar is off." with a link to turn it on |
| 8.12 | Turn it back on | Calendar is back with your log intact |

### 9. Resale matching

Use two accounts: A (yours from section 1) and B (a second one).

| # | Do | Expect |
| --- | --- | --- |
| 9.1 | A: open an item with no size, "Pass it on" | Size, Price (USD) and Condition boxes, "Pass it on" and Cancel; each one empty or wrong says so |
| 9.2 | Type a size as on the label (e.g. "S"), a price (e.g. 24.50) and a condition, "Pass it on" | "Passing on. It's left out of your outfits and buy checks." with "Size S · Asking $24.50 · Like new · Edit"; a "Matching buyers" section below |
| 9.3 | Closet → "Passing on" tab | The item is there and not under "Wearing"; it's left out of "Good for today", the calendar's picker and new buy checks |
| 9.4 | A: "Matching buyers" before anyone else has opted in | "Looking for buyers…", then "No active buyers right now." and "Try the demo account to see how matching works." |
| 9.5 | B: sign up, fill Profile with sizes that fit A's item, tick "I'd take secondhand clothes", Save; add a few clothes with feelings | Saved |
| 9.6 | A: reopen the item | Either a line saying how many people would want it, with one identical anonymous avatar per person (at most 5, then "+N"), or "No one's a strong match yet." No names, emails or scores anywhere |
| 9.7 | A: "Edit", change the size to one B doesn't wear | "No buyers for this one right now." |
| 9.8 | A: "Keep wearing it" | The item is back in "Wearing" and in outfits; "Matching buyers" is gone |
| 9.9 | A: pass the item on again with a size B wears and reopen it; B: home | If B's check scored 60+: "Suits you" with A's item, its size, price and condition, B's reasons and "from" A's name; no email, score, or way to contact A. Otherwise no "Suits you" |
| 9.10 | A: Profile, change the name, Save; B: reload home | Saved; B's "Suits you" says "from" A's new name. A never sees B's name |

### 10. Demo account

| # | Do | Expect |
| --- | --- | --- |
| 10.1 | Log out → "Try the demo account" | Home with the demo persona's closet; "Log out" top right (on a phone, at the bottom of Profile) and no "Sign up" in the top bar |
| 10.2 | Closet | 16 items under "Wearing", 2 under "Passing on" (a gray tee and gray fleece shorts) |
| 10.3 | Open an item and Profile | No Edit, Save, Delete, "Pass it on" or voice button; instead "Demo account is read-only. Sign up to add your own." No Resale section in Profile |
| 10.4 | Home | "Your style" card filled in |
| 10.5 | Calendar | Opens on the month with the persona's 10 logged days; the stats are filled in; "What we noticed" shows up to 3 insights; picking a day shows its outfits and the read-only note, no "Log an outfit" |
| 10.6 | Open the gray tee, then the gray fleece shorts | "Matching buyers": "3 people would likely want this." on the tee and "2 people would likely want this." on the shorts and that many identical anonymous avatars; no names or scores |
| 10.7 | Run "Should I buy this?" | Works and shows a score |
| 10.8 | "Style it with AI" under a sample outfit | Works as in 7.10 |
| 10.9 | Home | "Suits you" lists the other made-up users' pieces: photo, name, size, price and condition, reasons, and "from Maya" (or Priya, Lena…); nothing to press, no emails or scores |

## Reporting a bug

Open a GitHub issue in dariafung/fitcheck, one bug per issue:

- **Title**: what is wrong and where, e.g. "Check page: total doesn't match the parts"
- **Commit**: the latest commit on `main` when you tested
- **Steps**: numbered, from a page URL
- **Expected** and **Actual**
- **Screenshot**
- **Browser and width**: e.g. Chrome 131, 390 px
- **Account**: your own or the demo

Never paste a password or key into an issue.
