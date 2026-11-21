# One-tap purchase check from an iOS Shortcut

Look at a product page on your iPhone, tap the back of the phone (or press the Action Button), and a few lines come back: what fitcheck read, the score, the verdict and the parts.

```
Feel Good Oversized Hoodie (top)
72.5/100 · A GOOD ADD
Suits you 30/40
Outfits 12.5/20
Revives 8/15
Fills a gap 13/15
Not a repeat 9/10
```

The Shortcut takes a screenshot and sends it to fitcheck with your personal token. fitcheck reads it, checks it against your closet and answers. Nothing is saved: not the screenshot, not the item. There is no "add to closet" here; use the site for that.

Lines marked **to check on device** describe how the Shortcuts app behaves and have not been tried on a phone yet. See "Shortcut check" in [TEST_PLAN.md](TEST_PLAN.md).

## What you need

- An iPhone with the Shortcuts app.
- Your own fitcheck account with a few clothes in it. The demo account can't make a token.

## 1. Make your token

1. Open fitcheck in a browser and go to **Profile**.
2. In the **Shortcut** block, tap **Create token**.
3. Tap **Copy**. The token starts with `fc_` and is shown this one time only. If you lose it, make a new one; the old one stops working.

Treat the token like a password. Anyone who has it can run checks as you and use up your daily checks. It can't open your closet in a browser or change anything.

## 2. Build the Shortcut

Open **Shortcuts**, tap **+**, name it "fitcheck", and add these actions in order.

| # | Action | Settings |
| --- | --- | --- |
| 1 | **Take Screenshot** | None |
| 2 | **Convert Image** | Convert **Screenshot** to **JPEG**. Leave quality near the middle. Turn **Preserve Metadata** off |
| 3 | **Get Contents of URL** | See below |
| 4 | **Get Dictionary Value** | Get **Value** for `text` in **Contents of URL** |
| 5 | **Show Result** | Show **Dictionary Value** |

Settings for **Get Contents of URL** (tap the arrow on the action to show them all):

- **URL**: `https://fitcheck-chi-eight.vercel.app/api/shortcut/check`
- **Method**: POST
- **Headers**: add one. Key `Authorization`, value `Bearer ` followed by your token, with one space between: `Bearer fc_...`. **This is where the token goes.**
- **Request Body**: **File**, and pick **Converted Image** as the file.

Why JPEG: fitcheck takes PNG, JPEG or WebP up to 4 MB. A PNG screenshot of a photo-heavy page can be bigger than that; the same screenshot as JPEG is far smaller.

To check on device:

- That **Request Body: File** sends the image as the whole body. If your version of Shortcuts only offers **Form**, use it: add one field of type **File** with the key `screenshot` and the value **Converted Image**. fitcheck accepts both.
- That a JPEG at middle quality from your phone stays under 4 MB. If fitcheck answers "That screenshot is too big", lower the quality in step 2, or add a **Resize Image** action (width 1170) between steps 1 and 2.
- That the action names and settings above match your iOS version; they were written from memory of the Shortcuts app, not from a phone.
- That **Get Contents of URL** waits long enough: fitcheck reads the page and scores it in one request, which takes longer than either step on the site. How long Shortcuts waits before giving up is not known.
- That **Show Result** is the nicest way to show a few lines. **Show Alert** and **Show Notification** take the same **Dictionary Value**.

Run it once from inside Shortcuts with a product page open in Safari behind it, and allow the Shortcut to connect to the fitcheck address when iOS asks.

## 3. Bind it to a tap

**Back Tap** (iPhone 8 and later): Settings → Accessibility → Touch → Back Tap → Double Tap (or Triple Tap) → scroll to **Shortcuts** → fitcheck.

**Action Button** (iPhone 15 Pro and later): Settings → Action Button → swipe to **Shortcut** → Choose a Shortcut → fitcheck.

To check on device:

- That these Settings paths and the phone models are right for your iOS version.
- That the screenshot taken this way shows the app you were in, not the Shortcuts app or a banner on top of it.
- That the result shows over the app you were in, without leaving it.

## What comes back

The endpoint answers JSON. The Shortcut only shows `text`.

| Field | What it is |
| --- | --- |
| `score` | 0–100, or `null` when nothing was scored |
| `verdict` | WORTH BUYING, A GOOD ADD, THINK TWICE or SKIP THIS ONE; `null` with no score |
| `title` | The product name as read; `null` when no product was read |
| `text` | A few short lines, ready to show |
| `error` | Only when something went wrong: a short code |

The first line of `text` is the name and type fitcheck read from the screenshot. If that's wrong, the score is about the wrong thing: take the screenshot with the product's name and photo in view and try again.

| You see | Why |
| --- | --- |
| A last line starting "Creates a gap" or "Nothing in your closet to wear…" | The item makes no outfit with your closet; the line says what's missing |
| "Nothing in your closet to compare it with yet…" | Your closet is empty. Add a few pieces on the site first |
| "We only check clothes and shoes." | The screenshot shows an accessory |
| "Couldn't spot a product there…" | No product page in the screenshot |
| "That screenshot is too big…" | Over 4 MB. Convert to JPEG, or lower its quality |
| "The AI didn't finish this time. Run it again." | The scoring didn't complete; this one doesn't count against your day |
| "That token doesn't work…" | The token is missing, mistyped, or was revoked or replaced (HTTP 401) |
| "The demo account can't use the Shortcut…" | HTTP 403 |
| "That's your AI limit for today. Try again tomorrow." | HTTP 429. The Shortcut shares your daily limits with the site: each run uses one screenshot read and one check |
| "Adding and checking are paused for today…" | HTTP 429. The whole site's daily AI budget is spent |

To check on device: that the Shortcut still shows `text` when the answer is a 401, 403 or 429, rather than stopping with its own error.

## Stop using it

In **Profile → Shortcut**, tap **Revoke**. The token stops working at once. Do this before you share the Shortcut with anyone, or delete the token from the header first: a shared Shortcut carries the token inside it.

## Try the endpoint without a phone

```sh
curl -X POST https://fitcheck-chi-eight.vercel.app/api/shortcut/check \
  -H "Authorization: Bearer $FITCHECK_TOKEN" \
  -H "Content-Type: image/jpeg" \
  --data-binary @screenshot.jpg
```

Keep the token in an environment variable or your keychain, not in a file in the repo.
