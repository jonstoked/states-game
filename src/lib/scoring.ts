import type { Point, StateDatum } from './stateData'

const RASTER_SIZE = 200

export interface ScoringResult {
  score: number
  /** Normalized user polygon points (scaled to match state bounding box) */
  normalizedPoints: Point[]
  /** For each drawn point, the nearest point on the reference polygon */
  animationTargets: Point[]
}

/**
 * Normalize user drawing to match the state's bounding box.
 * Scales and translates the user strokes so they fill the same
 * bounding box as the reference polygon.
 */
export function normalizeDrawing(strokes: Point[][], stateDatum: StateDatum): Point[] {
  // Flatten all strokes into one polygon (auto-close last point to first)
  const allPoints: Point[] = strokes.flatMap((s) => s)
  if (allPoints.length < 3) return allPoints

  // Compute user drawing bounding box
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  const userW = maxX - minX || 1
  const userH = maxY - minY || 1

  const [stMinX, stMinY, stMaxX, stMaxY] = stateDatum.bounds
  const stW = stMaxX - stMinX
  const stH = stMaxY - stMinY

  // Uniform scale to fit, centered in state bounding box
  const scale = Math.min(stW / userW, stH / userH)
  const scaledW = userW * scale
  const scaledH = userH * scale
  const offsetX = stMinX + (stW - scaledW) / 2
  const offsetY = stMinY + (stH - scaledH) / 2

  return allPoints.map(([x, y]) => [
    (x - minX) * scale + offsetX,
    (y - minY) * scale + offsetY,
  ])
}

/**
 * Rasterize a polygon onto an offscreen canvas (RASTER_SIZE × RASTER_SIZE).
 * Returns a Uint8ClampedArray of 1s (filled) and 0s (empty).
 */
function rasterize(
  points: Point[],
  bounds: [number, number, number, number],
): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(RASTER_SIZE, RASTER_SIZE)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  if (!ctx || points.length < 3) return new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE)

  const [minX, minY, maxX, maxY] = bounds
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  const scaleX = RASTER_SIZE / w
  const scaleY = RASTER_SIZE / h

  ctx.clearRect(0, 0, RASTER_SIZE, RASTER_SIZE)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo((points[0][0] - minX) * scaleX, (points[0][1] - minY) * scaleY)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo((points[i][0] - minX) * scaleX, (points[i][1] - minY) * scaleY)
  }
  ctx.closePath()
  ctx.fill()

  const imageData = ctx.getImageData(0, 0, RASTER_SIZE, RASTER_SIZE)
  const mask = new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE)
  for (let i = 0; i < mask.length; i++) {
    // Alpha channel > 0 means filled
    mask[i] = imageData.data[i * 4 + 3] > 0 ? 1 : 0
  }
  return mask
}

/**
 * Compute IoU score (0–100) between two rasterized masks.
 */
function computeIoU(maskA: Uint8ClampedArray, maskB: Uint8ClampedArray): number {
  let intersection = 0
  let union = 0
  for (let i = 0; i < maskA.length; i++) {
    const a = maskA[i]
    const b = maskB[i]
    if (a && b) intersection++
    if (a || b) union++
  }
  if (union === 0) return 0
  return Math.round((intersection / union) * 100)
}

/**
 * For each point in drawnPoints, find the nearest point on the reference polygon.
 * Used for the scoring animation.
 */
export function computeAnimationTargets(
  drawnPoints: Point[],
  referencePoints: Point[],
): Point[] {
  return drawnPoints.map(([dx, dy]) => {
    let nearest: Point = referencePoints[0]
    let minDist = Infinity
    for (const [rx, ry] of referencePoints) {
      const d = (dx - rx) ** 2 + (dy - ry) ** 2
      if (d < minDist) {
        minDist = d
        nearest = [rx, ry]
      }
    }
    return nearest
  })
}

/**
 * Full scoring pipeline:
 * 1. Normalize user drawing to match state bounding box
 * 2. Rasterize both onto 200×200 offscreen canvas
 * 3. Compute IoU score
 * 4. Compute animation targets
 */
export function scoreDrawing(strokes: Point[][], stateDatum: StateDatum): ScoringResult {
  const normalizedPoints = normalizeDrawing(strokes, stateDatum)

  const refPoints = stateDatum.polygonPoints

  const maskUser = rasterize(normalizedPoints, stateDatum.bounds)
  const maskRef = rasterize(refPoints, stateDatum.bounds)
  const score = computeIoU(maskUser, maskRef)

  const animationTargets = computeAnimationTargets(normalizedPoints, refPoints)

  return { score, normalizedPoints, animationTargets }
}
