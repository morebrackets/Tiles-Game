<script setup>
/**
 * GameBoard — the single-page Dominate UI.
 *
 * Human plays Blue.  AI plays Red.
 *
 * AI is triggered by watching `turnCount`:
 *   • turnCount increments at the end of every turn (including game-over).
 *   • If it's Red's turn and the game isn't over, schedule an AI move.
 *   • The 600 ms delay in triggerAIMove creates a natural "thinking" pause.
 */
import { watch } from 'vue'
import { useGameLogic } from '../composables/useGameLogic.js'
import { useAI } from '../composables/useAI.js'

const {
  board,
  currentPlayer,
  selectedCell,
  validTargets,
  gameOver,
  winner,
  blueScore,
  redScore,
  statusMessage,
  flippingCells,
  newPieceCell,
  turnCount,
  selectCell,
  executeMove,
  resetGame,
  BLUE,
  RED,
} = useGameLogic()

const { difficulty, isThinking, triggerAIMove, cancelAI } = useAI()

// ---------------------------------------------------------------------------
// AI trigger — fires whenever turnCount changes (covers both turn switch AND
// the case where currentPlayer stays RED because Blue had no moves).
// ---------------------------------------------------------------------------

watch(turnCount, () => {
  if (gameOver.value || currentPlayer.value !== RED || isThinking.value) return
  triggerAIMove(board.value, RED, BLUE, (move) => {
    if (move && !gameOver.value) {
      executeMove(move)
    }
  })
})

// ---------------------------------------------------------------------------
// Human interaction
// ---------------------------------------------------------------------------

function handleCellClick(cellIdx) {
  if (isThinking.value || gameOver.value || currentPlayer.value === RED) return
  selectCell(cellIdx)
}

function handleReset() {
  cancelAI()   // invalidate any in-flight setTimeout
  resetGame()
}

// ---------------------------------------------------------------------------
// Derived display helpers
// ---------------------------------------------------------------------------

function turnLabel() {
  if (isThinking.value) return '🤔 AI is thinking…'
  return currentPlayer.value === BLUE ? '🔵 Your turn' : '🔴 AI\'s turn'
}

function winnerBanner() {
  if (winner.value === 'tie') return { emoji: '🤝', text: "It's a Tie!", sub: 'Great game!' }
  if (winner.value === BLUE)  return { emoji: '🎉', text: 'You Win!',    sub: `Blue ${blueScore.value} – Red ${redScore.value}` }
  return                               { emoji: '🤖', text: 'AI Wins!',   sub: `Red ${redScore.value} – Blue ${blueScore.value}` }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start gap-3 py-4 px-3 select-none">

    <!-- ── Title ──────────────────────────────────────────────────────────── -->
    <h1 class="text-3xl sm:text-4xl font-bold tracking-wide mt-1">
      🎮 Dominate
    </h1>

    <!-- ── Score bar ──────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-4 bg-gray-800 rounded-2xl px-5 py-3 shadow-lg w-full max-w-sm">
      <!-- Blue (human) -->
      <div class="flex items-center gap-2 flex-1">
        <div class="w-5 h-5 rounded-full piece-swatch piece-swatch-blue shrink-0"></div>
        <span class="text-blue-300 font-bold text-xl tabular-nums">{{ blueScore }}</span>
        <span class="text-gray-500 text-xs">You</span>
      </div>

      <!-- Centre turn dot -->
      <div class="flex flex-col items-center gap-1">
        <span class="text-gray-600 text-[10px] uppercase tracking-widest">Turn</span>
        <div
          :class="[
            'w-4 h-4 rounded-full transition-colors duration-300 shadow-lg',
            currentPlayer === BLUE ? 'bg-blue-500 shadow-blue-500/50' : 'bg-red-500 shadow-red-500/50',
          ]"
        ></div>
      </div>

      <!-- Red (AI) -->
      <div class="flex items-center gap-2 flex-1 justify-end">
        <span class="text-gray-500 text-xs">AI</span>
        <span class="text-red-300 font-bold text-xl tabular-nums">{{ redScore }}</span>
        <div class="w-5 h-5 rounded-full piece-swatch piece-swatch-red shrink-0"></div>
      </div>
    </div>

    <!-- ── Turn / thinking indicator ─────────────────────────────────────── -->
    <div
      :class="[
        'text-sm font-semibold px-4 py-1.5 rounded-full transition-all duration-300',
        isThinking
          ? 'bg-amber-900/60 text-amber-300 animate-pulse'
          : currentPlayer === BLUE
            ? 'bg-blue-900/50 text-blue-200'
            : 'bg-red-900/50 text-red-200',
        gameOver ? 'invisible' : '',
      ]"
    >
      {{ turnLabel() }}
    </div>

    <!-- ── Status message (skip notice, etc.) ─────────────────────────────── -->
    <div
      v-if="statusMessage"
      class="text-yellow-300 text-xs bg-yellow-900/30 border border-yellow-700/40 px-4 py-1.5 rounded-lg"
    >
      {{ statusMessage }}
    </div>

    <!-- ── Board ──────────────────────────────────────────────────────────── -->
    <div class="board-wrapper">
      <div
        class="board-grid"
        :class="{ 'pointer-events-none': isThinking || gameOver || currentPlayer === RED }"
      >
        <div
          v-for="i in 64"
          :key="i - 1"
          :class="[
            'cell',
            // checkerboard
            ((((i - 1) / 8) | 0) + ((i - 1) % 8)) % 2 === 0 ? 'cell-light' : 'cell-dark',
            // valid target
            validTargets.includes(i - 1) && board[i - 1] === null ? 'cell-target' : '',
            // selected
            selectedCell === (i - 1) ? 'cell-selected' : '',
            // clickable cursor only when it's the human's turn
            !gameOver && currentPlayer === BLUE && !isThinking ? 'cursor-pointer' : 'cursor-default',
          ]"
          @click="handleCellClick(i - 1)"
        >
          <!-- Valid-move dot (shown on empty target cells) -->
          <div
            v-if="validTargets.includes(i - 1) && board[i - 1] === null"
            class="valid-dot"
          ></div>

          <!-- Game piece -->
          <div
            v-if="board[i - 1] !== null"
            :class="[
              'piece',
              board[i - 1] === BLUE ? 'piece-blue' : 'piece-red',
              flippingCells.includes(i - 1) ? 'piece-flip'  : '',
              newPieceCell === (i - 1)       ? 'piece-place' : '',
            ]"
          ></div>
        </div>
      </div>

      <!-- ── Game-over overlay ─────────────────────────────────────────────── -->
      <Transition name="fade">
        <div v-if="gameOver" class="game-over-overlay">
          <div class="game-over-card">
            <div class="text-5xl mb-2">{{ winnerBanner().emoji }}</div>
            <div class="text-2xl font-bold mb-1">{{ winnerBanner().text }}</div>
            <div class="text-gray-400 text-sm mb-5">{{ winnerBanner().sub }}</div>
            <button
              class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold rounded-xl transition-all text-sm shadow-lg"
              @click="handleReset"
            >
              ↺ Play Again
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Controls ───────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 flex-wrap justify-center">

      <!-- Difficulty selector -->
      <div class="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
        <span class="text-gray-500 text-xs uppercase tracking-wider">AI</span>
        <div class="flex gap-1">
          <button
            v-for="level in ['Easy', 'Medium', 'Hard']"
            :key="level"
            :class="[
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              difficulty === level
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white',
            ]"
            @click="difficulty = level"
          >
            {{ level }}
          </button>
        </div>
      </div>

      <!-- Reset -->
      <button
        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white font-semibold rounded-xl transition-all text-sm shadow"
        @click="handleReset"
      >
        ↺ New Game
      </button>
    </div>

    <!-- ── Legend ─────────────────────────────────────────────────────────── -->
    <div class="flex gap-4 text-[11px] text-gray-600 flex-wrap justify-center">
      <div class="flex items-center gap-1">
        <div class="w-2.5 h-2.5 rounded-full bg-yellow-400/80"></div>
        <span>Selected</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></div>
        <span>Valid move</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
        <span>Your pieces (Blue)</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-2.5 h-2.5 rounded-full bg-red-500"></div>
        <span>AI pieces (Red)</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Board sizing — stays square, fills viewport on mobile ─────────────── */
.board-wrapper {
  position: relative;
  width: min(calc(100vw - 1.5rem), calc(100svh - 260px), 34rem);
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  width: 100%;
  height: 100%;
}

/* ── Individual cells ───────────────────────────────────────────────────── */
.cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* Slightly larger tap target feel via padding */
  padding: 4px;
  box-sizing: border-box;
  transition: filter 0.1s;
}

.cell:hover {
  filter: brightness(1.15);
}

.cell-light { background-color: #2d6a4f; }
.cell-dark  { background-color: #1b4332; }

/* Selected cell — gold inset ring */
.cell-selected {
  box-shadow: inset 0 0 0 3px rgba(250, 204, 21, 0.95);
  z-index: 1;
}

/* Valid-target cell — subtle green tint */
.cell-target {
  background-color: rgba(74, 222, 128, 0.18) !important;
}

/* ── Valid-move indicator dot ───────────────────────────────────────────── */
.valid-dot {
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.85);
  box-shadow: 0 0 8px 2px rgba(74, 222, 128, 0.5);
  pointer-events: none;
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */
.piece {
  width: 74%;
  height: 74%;
  border-radius: 50%;
  box-shadow:
    0 3px 8px rgba(0, 0, 0, 0.45),
    inset 0 2px 5px rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

.piece-blue {
  background: radial-gradient(circle at 36% 36%, #93c5fd, #1d4ed8);
}

.piece-red {
  background: radial-gradient(circle at 36% 36%, #fca5a5, #b91c1c);
}

/* Score swatches in the header */
.piece-swatch {
  box-shadow: 0 0 8px 1px rgba(255, 255, 255, 0.15);
}
.piece-swatch-blue { background: radial-gradient(circle at 36% 36%, #93c5fd, #1d4ed8); }
.piece-swatch-red  { background: radial-gradient(circle at 36% 36%, #fca5a5, #b91c1c); }

/* ── Piece flip animation (captures) ───────────────────────────────────── */
@keyframes piece-flip {
  0%   { transform: scale(1)    rotateY(0deg);   }
  30%  { transform: scale(0.6)  rotateY(90deg);  }
  60%  { transform: scale(1.12) rotateY(180deg); }
  100% { transform: scale(1)    rotateY(180deg); }
}

.piece-flip {
  animation: piece-flip 0.48s ease-in-out forwards;
}

/* ── Piece placement animation ──────────────────────────────────────────── */
@keyframes piece-place {
  0%   { transform: scale(0);    opacity: 0; }
  65%  { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}

.piece-place {
  animation: piece-place 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* ── Game-over overlay ──────────────────────────────────────────────────── */
.game-over-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(3px);
  z-index: 20;
}

.game-over-card {
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.25rem;
  padding: 1.75rem 2.25rem;
  text-align: center;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
}

/* ── Vue Transition (overlay fade) ─────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
