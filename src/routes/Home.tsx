import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { loadStates, getRandomState } from '../lib/stateData'
import { scoreDrawing } from '../lib/scoring'
import type { ScoringResult } from '../lib/scoring'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { AnimationView } from '../components/AnimationView'
import { ResultView } from '../components/ResultView'
import { ShareModal } from '../components/ShareModal'
import styles from './Home.module.css'

export function Home() {
  const {
    phase,
    states,
    currentState,
    drawnStrokes,
    scoringResult,
    setStates,
    startGame,
    submitDrawing,
    setResults,
    reset,
  } = useGameStore()

  const [loading, setLoading] = useState(true)
  const [showShare, setShowShare] = useState(false)
  // Hold computed result during the animation phase so it's stable
  const pendingResultRef = useRef<ScoringResult | null>(null)

  useEffect(() => {
    console.log('[Home] loading state data…')
    loadStates()
      .then((s) => {
        console.log(`[Home] state data ready — ${s.length} states loaded`)
        setStates(s)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[Home] failed to load states:', err)
      })
  }, [setStates])

  // Compute score once when entering animating phase
  useEffect(() => {
    if (phase === 'animating' && currentState && drawnStrokes.length > 0) {
      console.log('[Home] phase=animating detected — triggering scoreDrawing')
      pendingResultRef.current = scoreDrawing(drawnStrokes, currentState)
    }
  }, [phase, currentState, drawnStrokes])

  const handleStart = useCallback(() => {
    const state = getRandomState(states)
    startGame(state)
  }, [states, startGame])

  const handleDone = useCallback(() => {
    submitDrawing()
  }, [submitDrawing])

  const handlePlayAgain = useCallback(() => {
    pendingResultRef.current = null
    reset()
  }, [reset])

  const handleAnimationComplete = useCallback(() => {
    if (pendingResultRef.current) {
      console.log('[Home] animation complete — transitioning to results')
      setResults(pendingResultRef.current)
    }
  }, [setResults])

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p>Loading state data…</p>
      </div>
    )
  }

  if (phase === 'home') {
    return (
      <div className={styles.homeScreen}>
        <div className={styles.hero}>
          <h1 className={styles.title}>States</h1>
          <p className={styles.subtitle}>How well do you know the shapes of US states?</p>
        </div>
        <button className={styles.startBtn} onClick={handleStart}>
          Draw a Random State
        </button>
      </div>
    )
  }

  if (phase === 'drawing') {
    return <DrawingCanvas onDone={handleDone} />
  }

  if (phase === 'animating' && currentState && pendingResultRef.current) {
    const result = pendingResultRef.current
    return (
      <AnimationView
        normalizedPoints={result.normalizedPoints}
        animationTargets={result.animationTargets}
        stateDatum={currentState}
        onComplete={handleAnimationComplete}
      />
    )
  }

  if (phase === 'results' && currentState && scoringResult) {
    return (
      <>
        <ResultView
          stateDatum={currentState}
          result={scoringResult}
          onPlayAgain={handlePlayAgain}
          onShare={() => setShowShare(true)}
        />
        {showShare && (
          <ShareModal
            stateSlug={currentState.slug}
            stateName={currentState.name}
            score={scoringResult.score}
            onClose={() => setShowShare(false)}
          />
        )}
      </>
    )
  }

  // Fallback: animating but pendingResult not yet computed — show brief loading
  if (phase === 'animating') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return null
}
