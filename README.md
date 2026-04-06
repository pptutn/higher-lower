# ♠ Higher / Lower ♥

A card prediction game played against a shuffled 52-card deck. Select a pile, guess whether the next draw will be higher, lower, or the same — finish with the fewest wrong guesses possible.

**[Play now →](https://pptutn.github.io/higher-lower/)**

---

```
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│K    │  │7    │  │A    │  │Q    │  │3    │  │J    │  │5    │  │9    │  │2    │
│  ♠  │  │  ♥  │  │  ♦  │  │  ♣  │  │  ♠  │  │  ♦  │  │  ♥  │  │  ♣  │  │  ♠  │
│    K│  │    7│  │    A│  │    Q│  │    3│  │    J│  │    5│  │    9│  │    2│
└─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘
   ×1       ×1       ×1       ×1       ×1       ×1       ×1       ×1       ×1
```

---

## How to Play

1. **Select a pile** — tap or click any of the nine face-up cards
2. **Make your guess** — will the next card drawn be Higher, Lower, or the Same value?
3. **See the result** — a card is drawn from the deck and placed on the pile
4. **Wrong guess = −1 point.** Correct guesses cost nothing.
5. Repeat for all 43 draws. The closer to 0, the better.

### Card Values

| Card | A | 2–10 | J | Q | K |
|------|---|------|---|---|---|
| Value | 1 | Face value | 11 | 12 | 13 |

### Scoring Tiers

| Score | Rating |
|-------|--------|
| 0 | Perfect |
| −1 to −5 | Excellent |
| −6 to −10 | Very Good |
| −11 to −16 | Good |
| −17 to −22 | Average |
| −23 or below | Keep Trying |

---

## Features

- **Hints** — toggle probability display showing the likelihood of each outcome based on cards not yet seen
- **Sudden Death** — wrong guesses kill the pile (card flips face-down, pile locked). Must be enabled before the first turn.
- **Keyboard shortcuts** — `1–9` select a pile, `H` / `L` / `S` guess, `Enter` / `Space` advance
- **Mobile optimised** — fixed action panel, auto-advance on result, touch-friendly tap targets
- **How to Play** — `?` button opens an in-game rules sheet

---

## Tech

No dependencies, no build step, no framework.

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~110 | Structure and markup only |
| `style.css` | ~750 | All styles and responsive layout |
| `game.js` | ~650 | All game logic |

- ASCII art cards rendered in `<pre>` elements with monospace font
- Fisher-Yates shuffle over a standard 52-card deck
- Probability hints calculated from remaining unseen cards
- Strict CSP (`default-src 'none'`, `style-src 'self'`, `script-src 'self'`)

---

## Running Locally

```bash
git clone https://github.com/pptutn/higher-lower.git
cd higher-lower
```

Then serve with any static file server — required because the browser blocks
`file://` requests for external CSS/JS under the `script-src 'self'` CSP.

```bash
# Python
python3 -m http.server

# Node
npx serve .
```

Then open `http://localhost:8000` (or whichever port is shown).
