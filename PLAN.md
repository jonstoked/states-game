# States Drawing Game — Plan

## Stack

- **Vite + React + TypeScript** — project scaffold
- **Zustand** — game phase + drawing state
- **Raw Canvas + `perfect-freehand`** — mobile drawing (pointer events, smooth strokes)
- **`us-atlas` + `topojson-client` + `d3-geo`** — state boundary data & projection
- **CSS Modules** — styling (no Tailwind)
- **ESLint + Prettier** — linting/formatting
- **Vercel** — deployment (zero-config Vite)
- **`gh` CLI** — repo creation

## Color Palette (Phantom-inspired)

| Token | Value |
|---|---|
| Background | `#1a1a2e` |
| Surface | `#24243e` |
| Primary purple | `#7e7ebe` |
| Accent/highlight | `#d1d1ff` |
| Text | `#ffffff` |
| Muted text | `#a3a3e1` |

## Architecture

```
flowchart TD
    Home[Home Screen] -->|random state| Drawing[Drawing Canvas]
    Drawing -->|"Done button"| Scoring[Scoring + Animation]
    Scoring -->|IoU computed| Results[Results View]
    Results -->|share| Share[Share Modal]
    Share -->|navigator.share| NativeShare["Native Share Sheet"]
```

## Game Flow

1. **Home** — shows game title + "Draw a Random State" button
2. **Drawing** — full-screen SVG canvas, state name displayed, "Done" + "Clear" buttons; draws smooth strokes via `perfect-freehand`
3. **Scoring animation** — normalize drawing over reference → animate each drawn point to nearest reference outline point via `requestAnimationFrame` (1.2s)
4. **Results** — reference silhouette + user drawing side-by-side, score (0–100) prominently displayed with grade label
5. **Share** — "Share Challenge" button → `navigator.share({ url: 'site.com/{state-slug}' })`; the `/state-slug` route shows state silhouette + "Can you draw this?" invite

## Scoring Algorithm (IoU)

```
1. Flatten all strokes → polygon points
2. Normalize: scale + translate to match state bounding box (projected coords)
3. Rasterize user polygon → offscreen canvas A (200×200)
4. Rasterize reference state polygon → offscreen canvas B (200×200)
5. score = count(A ∩ B) / count(A ∪ B) × 100
```

Point-to-nearest-reference is used **only for the animation**, not scoring.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/stateData.ts` | Load `us-atlas` TopoJSON at runtime, project with `d3.geoAlbersUsa()`, extract per-state polygon points and bounding boxes |
| `src/lib/scoring.ts` | Normalize transform, offscreen canvas IoU, animation targets |
| `src/stores/gameStore.ts` | Zustand store: phase, currentState, drawnStrokes, scoringResult |
| `src/components/DrawingCanvas.tsx` | SVG canvas, pointer event handlers, `perfect-freehand` stroke rendering |
| `src/components/AnimationView.tsx` | Canvas `requestAnimationFrame` loop animating drawn points → reference |
| `src/components/ResultView.tsx` | Side-by-side state SVGs + score + grade |
| `src/components/ShareModal.tsx` | Web Share API / clipboard fallback |
| `src/routes/Home.tsx` | Game orchestration: phase routing, state loading, scoring |
| `src/routes/StateChallenge.tsx` | Shareable challenge page showing state silhouette |

## Routes

| Route | Component |
|---|---|
| `/` | `Home` — home screen or active game |
| `/:stateSlug` | `StateChallenge` — shareable invite page |

## State Data Pipeline

1. Fetch `us-atlas/states-10m.json` at runtime (cached after first load)
2. `topojson.feature()` converts TopoJSON → GeoJSON FeatureCollection
3. `geoAlbersUsa().scale(1300).translate([480, 300])` projects each `[lng, lat]` → `[x, y]`
4. Extract largest polygon ring per state as `polygonPoints`
5. Compute `bounds: [minX, minY, maxX, maxY]` from projected points

## Dependencies

```
perfect-freehand       # smooth pointer stroke rendering
us-atlas               # pre-built US state TopoJSON
topojson-client        # TopoJSON → GeoJSON conversion
@types/topojson-client
d3-geo                 # AlbersUSA projection + path generator
@types/d3-geo
zustand                # lightweight state management
react-router-dom       # client-side routing
```

## Deployment

1. Connect GitHub repo to Vercel via GitHub integration
2. Vercel auto-detects Vite — zero config needed
3. Set `vite.config.ts` base to `/` (default)
