import type { StateDatum, Point } from '../lib/stateData'
import type { ScoringResult } from '../lib/scoring'
import styles from './ResultView.module.css'

interface ResultViewProps {
  stateDatum: StateDatum
  result: ScoringResult
  onRetry: () => void
  onNewGame: () => void
  onShare: () => void
}

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return ''
  const parts = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
  parts.push('Z')
  return parts.join(' ')
}

function pointsToBounds(points: Point[]): {
  minX: number
  minY: number
  width: number
  height: number
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

function StateShape({
  points,
  label,
  className,
}: {
  points: Point[]
  label: string
  className: string
}) {
  if (points.length === 0) return null
  const { minX, minY, width, height } = pointsToBounds(points)
  const padding = 10
  const vb = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`

  return (
    <div className={className}>
      <p className={styles.shapeLabel}>{label}</p>
      <svg viewBox={vb} className={styles.shapeSvg} preserveAspectRatio="xMidYMid meet">
        <path d={pointsToSvgPath(points)} className={styles.shapePath} />
      </svg>
    </div>
  )
}

function scoreGrade(score: number): string {
  if (score >= 80) return 'Excellent!'
  if (score >= 60) return 'Great!'
  if (score >= 40) return 'Good effort!'
  if (score >= 20) return 'Keep practicing!'
  return 'Try again!'
}

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#a3e635'
  if (score >= 40) return '#facc15'
  if (score >= 20) return '#fb923c'
  return '#f87171'
}

export function ResultView({ stateDatum, result, onRetry, onNewGame, onShare }: ResultViewProps) {
  const { score, normalizedPoints } = result

  return (
    <div className={styles.container}>
      <div className={styles.scoreSection}>
        <div
          className={styles.scoreCircle}
          style={{ borderColor: scoreColor(score), color: scoreColor(score) }}
        >
          <span className={styles.scoreNumber}>{score}</span>
          <span className={styles.scoreLabel}>/ 100</span>
        </div>
        <p className={styles.scoreGrade}>{scoreGrade(score)}</p>
        <p className={styles.stateName}>{stateDatum.name}</p>
      </div>

      <div className={styles.shapesSection}>
        <StateShape
          points={stateDatum.polygonPoints}
          label="Reference"
          className={styles.referenceShape}
        />
        <StateShape
          points={normalizedPoints}
          label="Your drawing"
          className={styles.userShape}
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.shareBtn} onClick={onShare}>
          Share Challenge
        </button>
        <button className={styles.retryBtn} onClick={onRetry}>
          Retry {stateDatum.name}
        </button>
        <button className={styles.newGameBtn} onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  )
}
