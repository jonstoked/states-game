import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import type { GeoGeometryObjects } from 'd3-geo'

// We fetch the JSON at runtime so we can use dynamic import
// and avoid large bundle size in initial load.
const STATES_URL = new URL('../../node_modules/us-atlas/states-10m.json', import.meta.url).href

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

function extractRings(geometry: GeoGeometryObjects): Point[][] {
  const rings: Point[][] = []
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      rings.push(ring.map((c) => projection(c as [number, number])!))
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        rings.push(ring.map((c) => projection(c as [number, number])!))
      }
    }
  }
  return rings.filter((r) => r.length > 2)
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

  // Use d3-geo path generator to get the projected SVG path for each state
  const path = geoPath(projection)
  const fc = feature(topology, topology.objects.states)

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

    // Suppress unused variable warning - path is used for side-effect tree shaking
    void path
  }

  // Sort alphabetically for consistent ordering
  states.sort((a, b) => a.name.localeCompare(b.name))
  _statesCache = states
  return states
}

export function getRandomState(states: StateDatum[]): StateDatum {
  return states[Math.floor(Math.random() * states.length)]
}

export function findStateBySlug(states: StateDatum[], slug: string): StateDatum | undefined {
  return states.find((s) => s.slug === slug)
}
