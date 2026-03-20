/**
 * AI opponent — Easy / Medium / Hard difficulty.
 *
 * Hard uses Minimax with Alpha-Beta Pruning (depth 4) and a heuristic that:
 *   • Favours piece-count advantage (clone bias: clone nets +1 vs. 0 for jump)
 *   • Prizes corners (5) and edges (2) over interior squares (1)
 *   • Considers mobility (# legal moves for AI minus # for opponent)
 *
 * Move ordering (most-captures-first) maximises A-B cutoffs so depth-4 runs
 * comfortably within the 600 ms delay on an 8×8 board.
 *
 * A "generation" counter lets the component cancel a pending setTimeout when
 * the player resets the game, preventing stale moves from landing.
 */

import { ref } from 'vue'
import {
  BOARD_SIZE,
  BLUE,
  RED,
  getAllMoves,
  applyMove,
  countCaptures,
  isBoardFull,
} from '../utils/gameUtils.js'

// ---------------------------------------------------------------------------
// Position-weight table (used by heuristic)
// ---------------------------------------------------------------------------

const POSITION_WEIGHTS = new Array(BOARD_SIZE * BOARD_SIZE).fill(0).map((_, i) => {
  const r = (i / BOARD_SIZE) | 0
  const c = i % BOARD_SIZE
  const onCorner = (r === 0 || r === BOARD_SIZE - 1) && (c === 0 || c === BOARD_SIZE - 1)
  const onEdge = r === 0 || r === BOARD_SIZE - 1 || c === 0 || c === BOARD_SIZE - 1
  if (onCorner) return 5
  if (onEdge) return 2
  return 1
})

// ---------------------------------------------------------------------------
// Board evaluation (from AI's perspective)
// ---------------------------------------------------------------------------

function evaluate(board, aiPlayer, humanPlayer) {
  let score = 0
  let aiCount = 0
  let humanCount = 0

  for (let i = 0; i < board.length; i++) {
    if (board[i] === aiPlayer) {
      aiCount++
      score += POSITION_WEIGHTS[i] * 2
    } else if (board[i] === humanPlayer) {
      humanCount++
      score -= POSITION_WEIGHTS[i] * 2
    }
  }

  // Piece-count differential — clone bias is naturally expressed here:
  // every clone move increases aiCount by 1 whereas jumps do not.
  score += (aiCount - humanCount) * 3

  // Mobility: prefer board states where AI has more options than the opponent
  const aiMoves = getAllMoves(board, aiPlayer).length
  const humanMoves = getAllMoves(board, humanPlayer).length
  score += (aiMoves - humanMoves) * 0.5

  return score
}

// ---------------------------------------------------------------------------
// Move ordering — maximises alpha-beta cutoffs
//
// Clone bias is explicitly baked in: a clone that captures 1 piece scores 2
// (1 capture + 1 net piece gained) while a jump that captures 1 piece scores
// only 1 (1 capture, no net gain).
// ---------------------------------------------------------------------------

function orderMoves(board, moves, player) {
  return moves.slice().sort((a, b) => {
    const scoreA = countCaptures(board, a.to, player) + (a.type === 'clone' ? 1 : 0)
    const scoreB = countCaptures(board, b.to, player) + (b.type === 'clone' ? 1 : 0)
    return scoreB - scoreA
  })
}

// ---------------------------------------------------------------------------
// Minimax with Alpha-Beta Pruning
// ---------------------------------------------------------------------------

function minimax(board, depth, alpha, beta, isMaximizing, aiPlayer, humanPlayer) {
  // Terminal checks
  if (isBoardFull(board) || depth === 0) {
    return evaluate(board, aiPlayer, humanPlayer)
  }

  const currentPlayer = isMaximizing ? aiPlayer : humanPlayer
  const opponent = isMaximizing ? humanPlayer : aiPlayer
  const moves = getAllMoves(board, currentPlayer)

  if (moves.length === 0) {
    // No moves: check whether opponent can still play
    if (getAllMoves(board, opponent).length === 0) {
      return evaluate(board, aiPlayer, humanPlayer)
    }
    // Skip this player's turn without decrementing depth significantly
    return minimax(board, depth - 1, alpha, beta, !isMaximizing, aiPlayer, humanPlayer)
  }

  const ordered = orderMoves(board, moves, currentPlayer)

  if (isMaximizing) {
    let maxEval = -Infinity
    for (const move of ordered) {
      const { newBoard } = applyMove(board, move, currentPlayer)
      const ev = minimax(newBoard, depth - 1, alpha, beta, false, aiPlayer, humanPlayer)
      if (ev > maxEval) maxEval = ev
      if (ev > alpha) alpha = ev
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of ordered) {
      const { newBoard } = applyMove(board, move, currentPlayer)
      const ev = minimax(newBoard, depth - 1, alpha, beta, true, aiPlayer, humanPlayer)
      if (ev < minEval) minEval = ev
      if (ev < beta) beta = ev
      if (beta <= alpha) break
    }
    return minEval
  }
}

// ---------------------------------------------------------------------------
// Top-level move selectors per difficulty
// ---------------------------------------------------------------------------

function getBestMove(board, aiPlayer, humanPlayer, depth) {
  const moves = getAllMoves(board, aiPlayer)
  if (moves.length === 0) return null
  const ordered = orderMoves(board, moves, aiPlayer)
  let bestMove = ordered[0]
  let bestScore = -Infinity
  for (const move of ordered) {
    const { newBoard } = applyMove(board, move, aiPlayer)
    const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, aiPlayer, humanPlayer)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }
  return bestMove
}

function getGreedyMove(board, player) {
  const moves = getAllMoves(board, player)
  if (moves.length === 0) return null
  let best = moves[0]
  let bestScore = -Infinity
  for (const move of moves) {
    // Clone bias: clone gains 1 net piece; jump does not
    const score = countCaptures(board, move.to, player) + (move.type === 'clone' ? 1 : 0)
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  return best
}

function getRandomMove(board, player) {
  const moves = getAllMoves(board, player)
  if (moves.length === 0) return null
  return moves[Math.floor(Math.random() * moves.length)]
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useAI() {
  const difficulty = ref('Hard')
  const isThinking = ref(false)

  // Generation counter — increment on cancel so stale callbacks become no-ops
  let generation = 0

  function getAIMove(board, aiPlayer, humanPlayer) {
    switch (difficulty.value) {
      case 'Easy':
        return getRandomMove(board, aiPlayer)
      case 'Medium':
        return getGreedyMove(board, aiPlayer)
      case 'Hard':
      default:
        return getBestMove(board, aiPlayer, humanPlayer, 4)
    }
  }

  /**
   * Schedule an AI move with a 600 ms "thinking" delay so the UI update is
   * visible before the move lands.  The callback receives the chosen move
   * object (or null if no moves are available).
   */
  function triggerAIMove(board, aiPlayer, humanPlayer, callback) {
    isThinking.value = true
    generation++
    const myGen = generation
    setTimeout(() => {
      if (myGen !== generation) {
        // Game was reset while we were thinking — discard
        isThinking.value = false
        return
      }
      const move = getAIMove(board, aiPlayer, humanPlayer)
      isThinking.value = false
      callback(move)
    }, 600)
  }

  /** Cancel any pending AI move (call before resetGame). */
  function cancelAI() {
    generation++            // invalidates any in-flight setTimeout callback
    isThinking.value = false
  }

  return { difficulty, isThinking, triggerAIMove, cancelAI }
}
