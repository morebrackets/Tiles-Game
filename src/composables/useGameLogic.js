/**
 * Reactive game state for the Dominate (Ataxx-style) board game.
 *
 * Turn flow:
 *   1. Player/AI executes a move via selectCell() or executeMove().
 *   2. _endTurn() checks the resulting board:
 *        • Board full → endGame.
 *        • Next player has no legal moves AND current player has none → endGame.
 *        • Next player has no legal moves but current still does →
 *            fillRemainingBoard() (End-Game Rush) → endGame.
 *        • Otherwise → switch currentPlayer, increment turnCount.
 *   3. GameBoard.vue watches turnCount to trigger the AI when it's Red's turn.
 */

import { ref, computed } from 'vue'
import {
  BLUE,
  RED,
  createInitialBoard,
  getAllMoves,
  applyMove,
  fillRemainingBoard,
  isBoardFull,
  countPieces,
} from '../utils/gameUtils.js'

export function useGameLogic() {
  const board = ref(createInitialBoard())
  const currentPlayer = ref(BLUE)
  const selectedCell = ref(null)
  const validTargets = ref([])   // indices of valid destination cells for selectedCell
  const gameOver = ref(false)
  const winner = ref(null)        // 'blue' | 'red' | 'tie'
  const statusMessage = ref('')

  // Animation state
  const flippingCells = ref([])   // cells mid-flip animation
  const newPieceCell = ref(null)  // cell where a piece just landed

  // turnCount increments after every completed turn — GameBoard watches this
  // to know when to trigger the AI (avoids watch-value-unchanged edge cases).
  const turnCount = ref(0)

  const blueScore = computed(() => board.value.filter(c => c === BLUE).length)
  const redScore = computed(() => board.value.filter(c => c === RED).length)

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  function _getTargets(fromIdx) {
    return getAllMoves(board.value, currentPlayer.value)
      .filter(m => m.from === fromIdx)
      .map(m => m.to)
  }

  // ---------------------------------------------------------------------------
  // Public: human cell click handler
  // Returns true when a move was executed (so the caller can trigger AI check)
  // ---------------------------------------------------------------------------

  function selectCell(cellIdx) {
    if (gameOver.value) return false

    const piece = board.value[cellIdx]

    if (piece === currentPlayer.value) {
      // (Re-)select one of our own pieces
      selectedCell.value = cellIdx
      validTargets.value = _getTargets(cellIdx)
      return false
    }

    if (selectedCell.value !== null && validTargets.value.includes(cellIdx)) {
      // Execute move
      const move = getAllMoves(board.value, currentPlayer.value)
        .find(m => m.from === selectedCell.value && m.to === cellIdx)
      if (move) {
        _executeMove(move)
        return true
      }
    }

    // Click on empty/opponent cell without a valid selection — deselect
    selectedCell.value = null
    validTargets.value = []
    return false
  }

  // ---------------------------------------------------------------------------
  // Public: AI calls this directly with a fully-formed move object
  // ---------------------------------------------------------------------------

  function executeMove(move) {
    _executeMove(move)
  }

  // ---------------------------------------------------------------------------
  // Internal move application
  // ---------------------------------------------------------------------------

  function _executeMove(move) {
    const { newBoard, captured } = applyMove(board.value, move, currentPlayer.value)
    board.value = newBoard
    selectedCell.value = null
    validTargets.value = []

    // Trigger animations
    newPieceCell.value = move.to
    flippingCells.value = captured
    setTimeout(() => { newPieceCell.value = null }, 350)
    setTimeout(() => { flippingCells.value = [] }, 500)

    _endTurn()
  }

  // ---------------------------------------------------------------------------
  // Turn / end-game logic
  // ---------------------------------------------------------------------------

  function _endTurn() {
    if (isBoardFull(board.value)) {
      _endGame()
      return
    }

    const nextPlayer = currentPlayer.value === BLUE ? RED : BLUE
    const nextHasMoves = getAllMoves(board.value, nextPlayer).length > 0
    const currHasMoves = getAllMoves(board.value, currentPlayer.value).length > 0

    if (!nextHasMoves && !currHasMoves) {
      // Neither player can move — game over
      _endGame()
      return
    }

    if (!nextHasMoves) {
      // End-Game Rush: fill every remaining empty square with the active player
      board.value = fillRemainingBoard(board.value, currentPlayer.value)
      _endGame()
      return
    }

    // Normal turn transition
    currentPlayer.value = nextPlayer
    statusMessage.value = ''
    turnCount.value++
  }

  function _endGame() {
    gameOver.value = true
    const { blue, red } = countPieces(board.value)
    if (blue > red) winner.value = BLUE
    else if (red > blue) winner.value = RED
    else winner.value = 'tie'
    turnCount.value++   // wake up watcher so it can see gameOver=true and bail out
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  function resetGame() {
    board.value = createInitialBoard()
    currentPlayer.value = BLUE
    selectedCell.value = null
    validTargets.value = []
    gameOver.value = false
    winner.value = null
    statusMessage.value = ''
    flippingCells.value = []
    newPieceCell.value = null
    turnCount.value = 0
  }

  return {
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
  }
}
