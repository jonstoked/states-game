import { useEffect, useState, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import { loadStates, getRandomState } from '../lib/stateData'
import { scoreDrawing } from '../lib/scoring'
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

  useEffect(() => {
    loadStates().then((s) => {
      setStates(s)
      setLoading(false)
    })
  }, [setStates])

  const handleStart = useCallback(() => {
    const state = getRandomState(states)
    startGame(state)
  }, [states, startGame])

  const handleDone = useCallback(() => {
    submitDrawing()
  }, [submitDrawing])

  const handlePlayAgain = useCallback(() => {
    reset()
  }, [reset])

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

  if (phase === 'animating' && currentState) {
    // Run scoring synchronously and trigger animation
    const tempResult = scoringResult ?? scoreDrawing(drawnStrokes, currentState)
    return (
      <AnimationView
        normalizedPoints={tempResult.normalizedPoints}
        animationTargets={tempResult.animationTargets}
        stateDatum={currentState}
        onComplete={() => {
          setResults(tempResult)
        }}
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

  return null
}
