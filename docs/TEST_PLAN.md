# Manual test plan

Test the hosted app in your browser and report anything that doesn't match the expected result as a GitHub issue (see the last section). Nothing to install.

## What to test

- Site: https://fitcheck-chi-eight.vercel.app
- It deploys from `main`. The commit you tested is the latest one on `main` at the time; put it in every report.
- AI is **live**: real model calls on the project's Meta key. You don't need a key of your own.
- The app stops calling the model after **$7 a day** (all users together). Rough cost: a few cents per screenshot, about $0.02 per purchase check. If AI steps start failing with a budget message, stop for the day and note it in an issue.
- Use your own email for the account. No confirmation email is sent; you can use it right away.

## How to test

Test in Chrome on desktop and at phone width (DevTools device toolbar, 390 px).

### 1. New account

| # | Do | Expect |
| --- | --- | --- |
| 1.1 | Open the site while signed out | You land on `/login` with "Log in", "Sign up" and "Try the demo account" |
| 1.2 | "Sign up" with your email and a password of 6+ characters | You land on an empty closet: "Your closet is empty."; "Log out" top right (on a phone, at the bottom of Profile) |
| 1.3 | Log out, log in again with the same email and password | Back in your (empty) closet |
| 1.4 | Log in with a wrong password | A short error on the page |
| 1.5 | Open `/closet` in a private window | Sent to `/login` |

### 2. Add clothes by screenshot

Take screenshots of real product pages from different stores (one screen: product photo and name visible).

| # | Do | Expect |
| --- | --- | --- |
| 2.1 | Closet → "Add clothes", upload a screenshot | "Reading…" for about 10 s, then a card with a cropped product photo and filled-in fields |
| 2.2 | Check the card | Name, brand, type, colors and materials mostly right; the cropped photo is the product, not the page header or a face |
| 2.3 | Fix a field, "Save to closet" | "Saved"; the item shows in the closet grid |
| 2.4 | Add 5–8 items: tops, bottoms, shoes, one outerwear | Each one saves; the closet grid shows them all |
| 2.5 | Upload a screenshot with no product in it | "Couldn't spot a product there. Try another screenshot?" and nothing saved |
| 2.6 | Upload a file that isn't an image | A short message |

### 3. Item page

| # | Do | Expect |
| --- | --- | --- |
| 3.1 | Open an item | Name, type, colors, "Comfortable in __ to __ °F", how dressy, the feelings box, a grey "Delete" at the bottom |
| 3.2 | Edit the temperature range, save; reload | New range kept |
| 3.3 | Write a feeling ("Love the color, a bit tight at the shoulders"), Save; reload | Text kept |
| 3.4 | Hold "Hold to talk", say a sentence in English, release | The words appear in the feelings box for you to edit; Save keeps them |
| 3.5 | Delete → Cancel | Back to "Delete", item still there |
| 3.6 | Delete → Delete | Back in the closet, the item is gone; the browser Back button doesn't reopen it |

### 4. Profile and home

| # | Do | Expect |
| --- | --- | --- |
| 4.1 | Profile: fill height, weight, body shape and outfits wanted per occasion; Save; reload | Values kept |
| 4.2 | Switch units in · lb ↔ cm · kg | Numbers convert; switching back gives the same numbers |
| 4.3 | Weather: search a city, pick it | Home shows that city's low–high in your Profile's unit |
| 4.4 | Home | "Good for today" shows clothes whose range fits today's weather; the top bar has a black "Should I buy this?" button ("Buy?" on a phone) on every page |
| 4.5 | Profile: pick °C, Save; open home, an item, Edit details, then a purchase check card | Today's low–high, "Comfortable in" and the temperature boxes are all in whole °C; a box you don't touch saves its old value unchanged |

### 5. Should I buy this?

Do this after 2.4 and 4.1, so there is a closet and a profile to check against.

| # | Do | Expect |
| --- | --- | --- |
| 5.1 | Top bar → "Should I buy this?" ("Buy?" on a phone), upload a product screenshot, "Check it" | "Checking…", then a score like "47.5 / 100" |
| 5.2 | Look at the five parts | Suits you /40, Outfits /20, Revives /15, Fills a gap /15, Not a repeat /10; they add up to the total |
| 5.3 | Read every reason | Short, plain, about this item and your closet; no made-up items |
| 5.4 | Check an item close to one you own (same type and color) | "Not a repeat" is low and names that item |
| 5.5 | Check the same item 3 times | Total moves by at most about 3 points |
| 5.6 | Write good and bad feelings on a few items, then check again | "Suits you" reasons refer to those feelings |
| 5.7 | Go to the closet afterwards | The checked item was **not** added |

### 6. Demo account

| # | Do | Expect |
| --- | --- | --- |
| 6.1 | Log out → "Try the demo account" | Home with the demo persona's closet; "Log out" top right (on a phone, at the bottom of Profile) and no "Sign up" in the top bar |
| 6.2 | Open an item and Profile | No Edit, Save, Delete or voice button; instead "Demo account is read-only. Sign up to add your own." |
| 6.3 | Run "Should I buy this?" | Works and shows a score |

## Reporting a bug

Open a GitHub issue in dariafung/fitcheck, one bug per issue:

- **Title**: what is wrong and where, e.g. "Check page: total doesn't match the parts"
- **Commit**: the latest commit on `main` when you tested
- **Steps**: numbered, from a page URL
- **Expected** and **Actual**
- **Screenshot**
- **Browser and width**: e.g. Chrome 131, 390 px

Never paste a password or key into an issue.
