import { useRef, useEffect, useCallback, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import type { Point } from '../lib/stateData'
import { useGameStore } from '../stores/gameStore'
import styles from './DrawingCanvas.module.css'

interface DrawingCanvasProps {
  onDone: () => void
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q'],
  )
  d.push('Z')
  return d.join(' ')
}

export function DrawingCanvas({ onDone }: DrawingCanvasProps) {
  const { currentState, drawnStrokes, addStroke } = useGameStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [activePoints, setActivePoints] = useState<[number, number, number][]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  const getPoint = useCallback(
    (e: PointerEvent): [number, number, number] => {
      const svg = svgRef.current
      if (!svg) return [0, 0, 0]
      const rect = svg.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top, e.pressure]
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      svg.setPointerCapture(e.pointerId)
      setIsDrawing(true)
      setActivePoints([getPoint(e)])
    },
    [getPoint],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing) return
      e.preventDefault()
      setActivePoints((pts) => [...pts, getPoint(e)])
    },
    [isDrawing, getPoint],
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing) return
      e.preventDefault()
      const finalPoints: Point[] = activePoints.map(([x, y]) => [x, y])
      if (finalPoints.length > 1) {
        addStroke(finalPoints)
      }
      setActivePoints([])
      setIsDrawing(false)
    },
    [isDrawing, activePoints, addStroke],
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('pointerdown', handlePointerDown)
    svg.addEventListener('pointermove', handlePointerMove)
    svg.addEventListener('pointerup', handlePointerUp)
    svg.addEventListener('pointercancel', handlePointerUp)
    return () => {
      svg.removeEventListener('pointerdown', handlePointerDown)
      svg.removeEventListener('pointermove', handlePointerMove)
      svg.removeEventListener('pointerup', handlePointerUp)
      svg.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp])

  const activeStroke = getStroke(activePoints, {
    size: 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })

  const completedPaths = drawnStrokes.map((stroke) => {
    const points3d: [number, number, number][] = stroke.map(([x, y]) => [x, y, 0.5])
    const freehandStroke = getStroke(points3d, {
      size: 4,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    })
    return getSvgPathFromStroke(freehandStroke)
  })

  const activePath = getSvgPathFromStroke(activeStroke)

  const totalStrokes = drawnStrokes.length + (isDrawing ? 1 : 0)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.stateName}>{currentState?.name}</h2>
        <p className={styles.instruction}>Draw the shape of this state</p>
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        style={{ touchAction: 'none' }}
      >
        {completedPaths.map((d, i) => (
          <path key={i} d={d} className={styles.stroke} />
        ))}
        {activePath && <path d={activePath} className={styles.activeStroke} />}
      </svg>

      <div className={styles.footer}>
        <button
          className={styles.clearBtn}
          onClick={() => {
            // Clear strokes by resetting – reach into store
            useGameStore.setState({ drawnStrokes: [] })
          }}
          disabled={totalStrokes === 0}
        >
          Clear
        </button>
        <button
          className={styles.doneBtn}
          onClick={onDone}
          disabled={drawnStrokes.length === 0}
        >
          Done
        </button>
      </div>
    </div>
  )
}
