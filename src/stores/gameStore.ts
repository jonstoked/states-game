import { create } from 'zustand'
import type { StateDatum, Point } from '../lib/stateData'
import type { ScoringResult } from '../lib/scoring'

export type GamePhase = 'home' | 'drawing' | 'animating' | 'results'

function logTransition(from: GamePhase, to: GamePhase, detail?: string) {
  console.log(`[GameStore] phase: ${from} → ${to}${detail ? ` (${detail})` : ''}`)
}

interface GameState {
  phase: GamePhase
  states: StateDatum[]
  currentState: StateDatum | null
  drawnStrokes: Point[][]
  scoringResult: ScoringResult | null

  // Actions
  setStates: (states: StateDatum[]) => void
  startGame: (state: StateDatum) => void
  addStroke: (stroke: Point[]) => void
  submitDrawing: () => void
  setAnimating: () => void
  setResults: (result: ScoringResult) => void
  retry: () => void
  reset: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'home',
  states: [],
  currentState: null,
  drawnStrokes: [],
  scoringResult: null,

  setStates: (states) => {
    console.log(`[GameStore] states loaded: ${states.length} states`)
    set({ states })
  },

  startGame: (state) => {
    const { phase } = get()
    logTransition(phase, 'drawing', `state="${state.name}"`)
    set({
      phase: 'drawing',
      currentState: state,
      drawnStrokes: [],
      scoringResult: null,
    })
  },

  addStroke: (stroke) =>
    set((s) => {
      const next = [...s.drawnStrokes, stroke]
      console.log(`[GameStore] stroke added — total strokes: ${next.length}, points in stroke: ${stroke.length}`)
      return { drawnStrokes: next }
    }),

  submitDrawing: () => {
    const { drawnStrokes, phase, currentState } = get()
    if (drawnStrokes.length === 0) {
      console.warn('[GameStore] submitDrawing called with no strokes — ignoring')
      return
    }
    const totalPoints = drawnStrokes.reduce((sum, s) => sum + s.length, 0)
    console.log(
      `[GameStore] submitting drawing for "${currentState?.name}" — strokes: ${drawnStrokes.length}, total points: ${totalPoints}`,
    )
    logTransition(phase, 'animating', 'done button pressed')
    set({ phase: 'animating' })
  },

  setAnimating: () => {
    const { phase } = get()
    logTransition(phase, 'animating')
    set({ phase: 'animating' })
  },

  setResults: (result) => {
    const { phase } = get()
    logTransition(phase, 'results', `score=${result.score}`)
    set({
      phase: 'results',
      scoringResult: result,
    })
  },

  retry: () => {
    const { phase, currentState } = get()
    logTransition(phase, 'drawing', `retry "${currentState?.name}"`)
    set({
      phase: 'drawing',
      drawnStrokes: [],
      scoringResult: null,
    })
  },

  reset: () => {
    const { phase } = get()
    logTransition(phase, 'home', 'new game')
    set({
      phase: 'home',
      currentState: null,
      drawnStrokes: [],
      scoringResult: null,
    })
  },
}))
