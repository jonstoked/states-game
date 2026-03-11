import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadStates, findStateBySlug } from '../lib/stateData'
import type { StateDatum, Point } from '../lib/stateData'
import styles from './StateChallenge.module.css'

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return ''
  const parts = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
  parts.push('Z')
  return parts.join(' ')
}

export function StateChallenge() {
  const { stateSlug } = useParams<{ stateSlug: string }>()
  const [state, setState] = useState<StateDatum | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStates().then((states) => {
      const found = stateSlug ? findStateBySlug(states, stateSlug) : undefined
      setState(found ?? null)
      setLoading(false)
    })
  }, [stateSlug])

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!state) {
    return (
      <div className={styles.notFound}>
        <h2>State not found</h2>
        <Link to="/" className={styles.homeLink}>
          Go Home
        </Link>
      </div>
    )
  }

  const { minX, minY, width, height } = (() => {
    const pts = state.polygonPoints
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const [x, y] of pts) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY }
  })()

  const padding = 20
  const vb = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.invite}>Can you draw this?</p>
        <svg viewBox={vb} className={styles.stateSvg} preserveAspectRatio="xMidYMid meet">
          <path d={pointsToSvgPath(state.polygonPoints)} className={styles.statePath} />
        </svg>
        <p className={styles.stateName}>{state.name}</p>
        <Link to="/" className={styles.playBtn}>
          Accept the Challenge →
        </Link>
      </div>
    </div>
  )
}
