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
  const allPoints: Point[] = strokes.flatMap((s) => s)
  console.log(`[Scoring] normalizeDrawing — input: ${strokes.length} stroke(s), ${allPoints.length} total points`)

  if (allPoints.length < 3) {
    console.warn('[Scoring] normalizeDrawing — too few points, skipping normalization')
    return allPoints
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  const userW = maxX - minX || 1
  const userH = maxY - minY || 1
  console.log(`[Scoring] user drawing bbox — x:[${minX.toFixed(1)}, ${maxX.toFixed(1)}] y:[${minY.toFixed(1)}, ${maxY.toFixed(1)}] size:${userW.toFixed(1)}×${userH.toFixed(1)}`)

  const [stMinX, stMinY, stMaxX, stMaxY] = stateDatum.bounds
  const stW = stMaxX - stMinX
  const stH = stMaxY - stMinY
  console.log(`[Scoring] reference bbox for "${stateDatum.name}" — x:[${stMinX.toFixed(1)}, ${stMaxX.toFixed(1)}] y:[${stMinY.toFixed(1)}, ${stMaxY.toFixed(1)}] size:${stW.toFixed(1)}×${stH.toFixed(1)}`)

  const scale = Math.min(stW / userW, stH / userH)
  const scaledW = userW * scale
  const scaledH = userH * scale
  const offsetX = stMinX + (stW - scaledW) / 2
  const offsetY = stMinY + (stH - scaledH) / 2
  console.log(`[Scoring] normalization — scale:${scale.toFixed(4)}, offset:(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`)

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
  label: string,
): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(RASTER_SIZE, RASTER_SIZE)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  if (!ctx || points.length < 3) {
    console.warn(`[Scoring] rasterize(${label}) — skipped, only ${points.length} point(s)`)
    return new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE)
  }

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
  let filledPixels = 0
  for (let i = 0; i < mask.length; i++) {
    mask[i] = imageData.data[i * 4 + 3] > 0 ? 1 : 0
    if (mask[i]) filledPixels++
  }
  const fillPct = ((filledPixels / mask.length) * 100).toFixed(1)
  console.log(`[Scoring] rasterize(${label}) — filled pixels: ${filledPixels}/${mask.length} (${fillPct}%)`)
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
  if (union === 0) {
    console.warn('[Scoring] computeIoU — union is 0, both masks empty')
    return 0
  }
  const score = Math.round((intersection / union) * 100)
  console.log(`[Scoring] IoU — intersection:${intersection} union:${union} ratio:${(intersection / union).toFixed(4)} → score:${score}`)
  return score
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
  const t0 = performance.now()
  console.group(`[Scoring] scoreDrawing — "${stateDatum.name}"`)
  console.log(`  strokes: ${strokes.length}, ref polygon points: ${stateDatum.polygonPoints.length}`)

  const normalizedPoints = normalizeDrawing(strokes, stateDatum)
  console.log(`  normalized points: ${normalizedPoints.length}`)

  const refPoints = stateDatum.polygonPoints
  const maskUser = rasterize(normalizedPoints, stateDatum.bounds, 'user')
  const maskRef = rasterize(refPoints, stateDatum.bounds, 'reference')
  const score = computeIoU(maskUser, maskRef)

  const animationTargets = computeAnimationTargets(normalizedPoints, refPoints)
  console.log(`  animation targets computed: ${animationTargets.length}`)

  const elapsed = (performance.now() - t0).toFixed(1)
  console.log(`  ✓ final score: ${score}/100 (${elapsed}ms)`)
  console.groupEnd()

  return { score, normalizedPoints, animationTargets }
}
