/**
 * Pure game-logic helpers — all operate on flat arrays of length 64.
 * Using bitwise `| 0` for integer division keeps hot paths fast.
 */

export const BOARD_SIZE = 8
export const BLUE = 'blue'
export const RED = 'red'

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

export function idx(row, col) {
  return row * BOARD_SIZE + col
}

export function rowOf(i) {
  return (i / BOARD_SIZE) | 0
}

export function colOf(i) {
  return i % BOARD_SIZE
}

export function createInitialBoard() {
  const board = new Array(BOARD_SIZE * BOARD_SIZE).fill(null)
  // Blue: top-left and bottom-right
  board[idx(0, 0)] = BLUE
  board[idx(BOARD_SIZE - 1, BOARD_SIZE - 1)] = BLUE
  // Red: top-right and bottom-left
  board[idx(0, BOARD_SIZE - 1)] = RED
  board[idx(BOARD_SIZE - 1, 0)] = RED
  return board
}

// ---------------------------------------------------------------------------
// Move generation (Chebyshev distance: clone=1, jump=2)
// ---------------------------------------------------------------------------

export function getAllMoves(board, player) {
  const moves = []
  for (let from = 0; from < board.length; from++) {
    if (board[from] !== player) continue
    const r1 = rowOf(from)
    const c1 = colOf(from)
    for (let r2 = 0; r2 < BOARD_SIZE; r2++) {
      for (let c2 = 0; c2 < BOARD_SIZE; c2++) {
        const to = r2 * BOARD_SIZE + c2
        if (board[to] !== null) continue
        const dist = Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2))
        if (dist === 1) {
          moves.push({ from, to, type: 'clone' })
        } else if (dist === 2) {
          moves.push({ from, to, type: 'jump' })
        }
      }
    }
  }
  return moves
}

// ---------------------------------------------------------------------------
// Move application — returns { newBoard, captured }
// ---------------------------------------------------------------------------

export function applyMove(board, move, player) {
  const newBoard = board.slice()   // flat-array copy for performance
  const opponent = player === BLUE ? RED : BLUE
  const captured = []

  newBoard[move.to] = player
  if (move.type === 'jump') newBoard[move.from] = null

  // Capture all adjacent opponent pieces
  const tr = rowOf(move.to)
  const tc = colOf(move.to)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = tr + dr
      const nc = tc + dc
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue
      const ni = nr * BOARD_SIZE + nc
      if (newBoard[ni] === opponent) {
        newBoard[ni] = player
        captured.push(ni)
      }
    }
  }

  return { newBoard, captured }
}

// ---------------------------------------------------------------------------
// Count captures without mutating the board (used by AI heuristics)
// ---------------------------------------------------------------------------

export function countCaptures(board, to, player) {
  const opponent = player === BLUE ? RED : BLUE
  const tr = rowOf(to)
  const tc = colOf(to)
  let n = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = tr + dr
      const nc = tc + dc
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue
      if (board[nr * BOARD_SIZE + nc] === opponent) n++
    }
  }
  return n
}

// ---------------------------------------------------------------------------
// End-Game Rush: fill every remaining empty square with `player`
// ---------------------------------------------------------------------------

export function fillRemainingBoard(board, player) {
  const newBoard = board.slice()
  for (let i = 0; i < newBoard.length; i++) {
    if (newBoard[i] === null) newBoard[i] = player
  }
  return newBoard
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function isBoardFull(board) {
  return board.every(c => c !== null)
}

export function countPieces(board) {
  let blue = 0
  let red = 0
  for (let i = 0; i < board.length; i++) {
    if (board[i] === BLUE) blue++
    else if (board[i] === RED) red++
  }
  return { blue, red }
}
