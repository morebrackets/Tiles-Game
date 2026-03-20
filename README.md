# 🎮 Tiles Strategy Game

A responsive, browser-based tiles strategy game inspired by the 1990s game Dominate (Ataxx-style). Built with Vue 3 and Tailwind CSS.

![Game screenshot](https://github.com/user-attachments/assets/37ceae7a-df0e-4f4a-863a-c00903119eee)

---

## How to run

```bash
npm install
npm run dev        # development server
npm run build      # production build
npm run preview    # preview production build
```

---

## Game rules

| Move type | Distance | Effect |
|-----------|----------|--------|
| **Clone** | 1 square (Chebyshev) | Duplicate your piece to the target square |
| **Jump**  | 2 squares (Chebyshev) | Move your piece to the target (old square empties) |

After every move, **all opponent pieces** in the 8 surrounding squares are **captured** (flipped to your colour).

The game ends when:
- The board is full, **or**
- A player has no legal moves — the remaining empty squares are automatically filled by the other player (*End-Game Rush*).

The player with the most pieces wins.

---

## AI opponent

Three difficulty levels control how the Red (AI) player thinks:

| Difficulty | Strategy |
|------------|----------|
| **Easy**   | Random valid move |
| **Medium** | Greedy — maximises captures this turn (with clone bias) |
| **Hard**   | Minimax with Alpha-Beta Pruning, 4 plies deep |

### Hard heuristic
- **Piece count** differential (× 3 weight) — clone bias is inherent: a clone gains a net piece, a jump does not
- **Positional weights** — corners (5) › edges (2) › interior (1)
- **Mobility** — favour moves that reduce the opponent's options (× 0.5)

### Clone bias
In move ordering and the greedy selector, a clone move receives `+1` to its score on top of capture count, so *"clone + 1 capture"* always ranks above *"jump + 1 capture"*.

---

## Tech stack

- **Vue 3** (Composition API, `<script setup>`)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Vite 8**
- No other runtime dependencies
