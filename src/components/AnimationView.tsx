import { useRef, useEffect } from 'react'
import type { Point, StateDatum } from '../lib/stateData'
import styles from './AnimationView.module.css'

interface AnimationViewProps {
  normalizedPoints: Point[]
  animationTargets: Point[]
  stateDatum: StateDatum
  onComplete: () => void
}

const DURATION_MS = 1200
const PADDING = 24

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/** Returns a transform function that maps from state-coordinate space → canvas px */
function makeTransform(
  bounds: [number, number, number, number],
  canvasW: number,
  canvasH: number,
): (p: Point) => Point {
  const [minX, minY, maxX, maxY] = bounds
  const stW = maxX - minX || 1
  const stH = maxY - minY || 1
  const drawW = canvasW - PADDING * 2
  const drawH = canvasH - PADDING * 2
  const scale = Math.min(drawW / stW, drawH / stH)
  const offsetX = PADDING + (drawW - stW * scale) / 2
  const offsetY = PADDING + (drawH - stH * scale) / 2
  return ([x, y]) => [(x - minX) * scale + offsetX, (y - minY) * scale + offsetY]
}

export function AnimationView({
  normalizedPoints,
  animationTargets,
  stateDatum,
  onComplete,
}: AnimationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement!
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    const ctx = canvas.getContext('2d')!
    const transform = makeTransform(stateDatum.bounds, canvas.width, canvas.height)

    const refPoints = stateDatum.polygonPoints.map(transform)
    const startPoints = normalizedPoints.map(transform)
    const endPoints = animationTargets.map(transform)

    const startTime = performance.now()

    const animate = (now: number) => {
      const progress = (now - startTime) / DURATION_MS
      const t = easeInOut(Math.min(progress, 1))

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Reference silhouette — fades in
      if (refPoints.length > 1) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(209, 209, 255, ${t * 0.5})`
        ctx.fillStyle = `rgba(126, 126, 190, ${t * 0.15})`
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 5])
        ctx.moveTo(refPoints[0][0], refPoints[0][1])
        for (let i = 1; i < refPoints.length; i++) {
          ctx.lineTo(refPoints[i][0], refPoints[i][1])
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.setLineDash([])
      }

      // User drawing — morphs toward reference
      if (startPoints.length > 1) {
        const interpolated = startPoints.map(([x, y], i) => {
          const [tx, ty] = endPoints[i] ?? [x, y]
          return [x + (tx - x) * t, y + (ty - y) * t] as Point
        })
        ctx.beginPath()
        ctx.strokeStyle = '#a5a5d8'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.moveTo(interpolated[0][0], interpolated[0][1])
        for (let i = 1; i < interpolated.length; i++) {
          ctx.lineTo(interpolated[i][0], interpolated[i][1])
        }
        ctx.closePath()
        ctx.stroke()
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        onCompleteRef.current()
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [normalizedPoints, animationTargets, stateDatum])

  return (
    <div className={styles.container}>
      <p className={styles.label}>Scoring…</p>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
