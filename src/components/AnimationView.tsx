import { useRef, useEffect, useCallback } from 'react'
import type { Point, StateDatum } from '../lib/stateData'
import styles from './AnimationView.module.css'

interface AnimationViewProps {
  normalizedPoints: Point[]
  animationTargets: Point[]
  stateDatum: StateDatum
  onComplete: () => void
}

const DURATION_MS = 1200

export function AnimationView({
  normalizedPoints,
  animationTargets,
  stateDatum,
  onComplete,
}: AnimationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  const draw = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const t = easeInOut(Math.min(progress, 1))

      // Draw animated user points moving toward reference
      if (normalizedPoints.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = '#7e7ebe'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'

        const interpolated: Point[] = normalizedPoints.map(([x, y], i) => {
          const [tx, ty] = animationTargets[i] ?? [x, y]
          return [x + (tx - x) * t, y + (ty - y) * t]
        })

        ctx.moveTo(interpolated[0][0], interpolated[0][1])
        for (let i = 1; i < interpolated.length; i++) {
          ctx.lineTo(interpolated[i][0], interpolated[i][1])
        }
        ctx.closePath()
        ctx.stroke()
      }

      // Draw reference state outline at increasing opacity
      const refPoints = stateDatum.polygonPoints
      if (refPoints.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(209, 209, 255, ${t * 0.6})`
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        ctx.moveTo(refPoints[0][0], refPoints[0][1])
        for (let i = 1; i < refPoints.length; i++) {
          ctx.lineTo(refPoints[i][0], refPoints[i][1])
        }
        ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])
      }
    },
    [normalizedPoints, animationTargets, stateDatum],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Size canvas to container
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }
    resize()

    startTimeRef.current = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const progress = elapsed / DURATION_MS

      draw(progress)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        onComplete()
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [draw, onComplete])

  return (
    <div className={styles.container}>
      <p className={styles.label}>Scoring…</p>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
