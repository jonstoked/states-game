import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { geoAlbersUsa } from 'd3-geo'
import type { GeoGeometryObjects } from 'd3-geo'

const STATES_URL = '/states-10m.json'

export type Point = [number, number]

export interface StateDatum {
  id: string
  name: string
  slug: string
  /** Largest polygon ring projected to a 960×600 canvas */
  polygonPoints: Point[]
  /** All rings (for multi-polygon states) */
  allRings: Point[][]
  /** Bounding box in projected space [minX, minY, maxX, maxY] */
  bounds: [number, number, number, number]
}

// Projection to 960×600 canvas (standard AlbersUSA)
const CANVAS_W = 960
const CANVAS_H = 600

const projection = geoAlbersUsa().scale(1300).translate([CANVAS_W / 2, CANVAS_H / 2])

function projectRing(ring: number[][]): Point[] {
  return ring
    .map((c) => projection(c as [number, number]))
    .filter((p): p is Point => p !== null)
}

function extractRings(geometry: GeoGeometryObjects): Point[][] {
  if (!geometry) return []
  const rings: Point[][] = []
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      const projected = projectRing(ring)
      if (projected.length > 2) rings.push(projected)
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        const projected = projectRing(ring)
        if (projected.length > 2) rings.push(projected)
      }
    }
  }
  return rings
}

function boundsFromPoints(rings: Point[][]): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return [minX, minY, maxX, maxY]
}

function stateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

let _statesCache: StateDatum[] | null = null

export async function loadStates(): Promise<StateDatum[]> {
  if (_statesCache) return _statesCache

  const response = await fetch(STATES_URL)
  const topology = (await response.json()) as Topology<{
    states: GeometryCollection<{ name: string }>
  }>

  // Pass 'states' as a string key — always returns FeatureCollection
  const fc = feature(topology, 'states')

  const states: StateDatum[] = []

  for (const f of fc.features) {
    const name: string = (f.properties as { name: string }).name
    const id: string = String(f.id ?? '')
    const geometry = f.geometry as GeoGeometryObjects

    const allRings = extractRings(geometry)
    if (allRings.length === 0) continue

    // Largest ring by point count = main land mass
    const polygonPoints = allRings.reduce((a, b) => (a.length >= b.length ? a : b))
    const bounds = boundsFromPoints(allRings)

    // Validate that all points projected correctly
    if (bounds[0] === Infinity) continue

    states.push({
      id,
      name,
      slug: stateSlug(name),
      polygonPoints,
      allRings,
      bounds,
    })
  }

  // Sort alphabetically for consistent ordering
  states.sort((a, b) => a.name.localeCompare(b.name))
  _statesCache = states
  return states
}

// Set to a state slug (e.g. 'colorado') to always use that state during testing, or null for random.
const DEBUG_FORCE_STATE: string | null = 'colorado'

export function getRandomState(states: StateDatum[]): StateDatum {
  if (DEBUG_FORCE_STATE) {
    const forced = states.find((s) => s.slug === DEBUG_FORCE_STATE)
    if (forced) {
      console.log(`[stateData] DEBUG_FORCE_STATE="${DEBUG_FORCE_STATE}" → using ${forced.name}`)
      return forced
    }
    console.warn(`[stateData] DEBUG_FORCE_STATE="${DEBUG_FORCE_STATE}" not found, falling back to random`)
  }
  return states[Math.floor(Math.random() * states.length)]
}

export function findStateBySlug(states: StateDatum[], slug: string): StateDatum | undefined {
  return states.find((s) => s.slug === slug)
}
