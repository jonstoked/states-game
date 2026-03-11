import { create } from 'zustand'
import type { StateDatum, Point } from '../lib/stateData'
import type { ScoringResult } from '../lib/scoring'

export type GamePhase = 'home' | 'drawing' | 'animating' | 'results'

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
  reset: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'home',
  states: [],
  currentState: null,
  drawnStrokes: [],
  scoringResult: null,

  setStates: (states) => set({ states }),

  startGame: (state) =>
    set({
      phase: 'drawing',
      currentState: state,
      drawnStrokes: [],
      scoringResult: null,
    }),

  addStroke: (stroke) =>
    set((s) => ({
      drawnStrokes: [...s.drawnStrokes, stroke],
    })),

  submitDrawing: () => {
    const { drawnStrokes } = get()
    if (drawnStrokes.length === 0) return
    set({ phase: 'animating' })
  },

  setAnimating: () => set({ phase: 'animating' }),

  setResults: (result) =>
    set({
      phase: 'results',
      scoringResult: result,
    }),

  reset: () =>
    set({
      phase: 'home',
      currentState: null,
      drawnStrokes: [],
      scoringResult: null,
    }),
}))
