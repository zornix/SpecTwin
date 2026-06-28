/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  config.ts — the only file you should need to touch for content / art-direction.
 *  Everything tunable lives here: colors, instance count, beat timings, copy.
 *  See README.md for the three most common edits (N, accent, spec/price strings).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Art-direction tokens. ONE saturated signal accent — used only for the cheapest
 *  price highlight and the CTA. Swap `accent` to re-skin the single signal color. */
export const COLORS = {
  paper: '#F4F1E9', // warm off-white background — matches the site --paper
  ink: '#151310', // near-black ink — matches the site --ink
  inkSoft: '#6B655B', // muted ink for secondary mono labels
  accent: '#E2552B', // Spectwin orange — cheapest price + score + CTA
} as const

/** Number of comparable pairs — one per vertical scroll section, each with its
 *  own product card. Kept small + readable. */
export const INSTANCES = {
  desktop: 6,
  mobile: 6,
} as const

/**
 * GLB material families, matched by NAME PREFIX (never by index).
 *
 * The exported model's material names carry a drifting numeric suffix
 * (`black.001` → `black.002`, `glass.004` → `glass.001`, `steel.001` → `steel.002`),
 * and the brand logo spans two slots (`logometal`, `logowhite`). Matching by the
 * family prefix below survives that drift. If you swap in a model using the brief's
 * `Logo_Brand` / `Frame_Body` naming, add those prefixes here.
 */
export const MATERIALS = {
  logo: ['logo'], // brand logo — excluded from copies, gets the dissolve on the hero
  frame: ['black'], // acetate frame body
  lens: ['glass'], // lenses
  metal: ['steel'], // hinges / bolts / front plate
} as const

const startsWithAny = (name: string | undefined, prefixes: readonly string[]) =>
  !!name && prefixes.some((p) => name.toLowerCase().startsWith(p))

/** True if a material name is part of the brand logo. */
export const isLogoMaterial = (name: string | undefined) => startsWithAny(name, MATERIALS.logo)
export const isFrameMaterial = (name: string | undefined) => startsWithAny(name, MATERIALS.frame)
export const isLensMaterial = (name: string | undefined) => startsWithAny(name, MATERIALS.lens)
export const isMetalMaterial = (name: string | undefined) => startsWithAny(name, MATERIALS.metal)

/**
 * The 5 scroll beats as [start, end] fractions of scroll.offset (0→1).
 * These are the single source of truth for choreography timing — nudge a number
 * here and both the 3D scene and the text overlays re-sync automatically.
 */
export const BEATS = {
  hero: [0.0, 0.12], // first pair gets its moment: drei <Float> idle
  erase: [0.12, 0.3], // camera zooms the logo; it visibly dissolves (done ~0.30)
  // After 0.34 the experience becomes a vertical scroll — see STACK.sections.
} as const

/** Number of scrollable "pages" (viewport heights) ScrollControls allocates:
 *  ~1 for the intro/erase + 1 per comparable pair + 1 for the spec-analysis dwell.
 *  More = longer scroll. */
export const SCROLL_PAGES = 8

/**
 * After the erase intro, the comparable pairs are stacked VERTICALLY — one per
 * screen. The camera dollies straight down; each pair sits on the LEFT so the
 * right half is free for its product card. `sections` is the scroll-offset range
 * mapped to `sectionFloat ∈ [0, N-1]` (which pair is centered).
 */
export const STACK = {
  spacingY: 3.4, // vertical gap between pairs (≈ one viewport tall)
  pairX: -1.4, // pairs offset to the left
  angle: -0.3, // 3/4 product pose (radians)
  camZ: 5.2, // camera distance
  camY: 0.0, // camera vertical offset relative to the centered pair
  camLookX: -0.55, // look slightly right of the pair → pair renders left
  sections: [0.34, 0.985] as const,
} as const

/**
 * SPEC-ANALYSIS dwell. At the START of the vertical sections the camera HOLDS on the
 * first comparable pair for `span` of scroll.offset while technical spec callouts draw
 * on — showcasing the spec-based matching — then the normal dolly resumes. `sectionFloat`
 * (lib/scroll.ts) carves this hold out of STACK.sections so the camera AND the price card
 * stay in lockstep (both show pair 0 through the dwell). Plays once; replays on scroll-up.
 *   span    — offset width of the hold (≈ 0.7 viewport at SCROLL_PAGES=8; keep ≤ 0.12)
 *   stagger — per-spec reveal delay (reveal units)
 *   drawDur — draw-on duration per spec (reveal units); last spec ends at 4·stagger+drawDur
 */
export const DWELL = { span: 0.12, stagger: 0.14, drawDur: 0.12 } as const

/** Geometry-derived anchor families the callout leaders point at (see lib/specAnchors.ts). */
export type SpecAnchorKey = 'frameFront' | 'frameTop' | 'lensCenter' | 'templeTip' | 'bridgeTop'

export type Spec = {
  key: SpecAnchorKey
  label: string // the measurement name (mono, inkSoft)
  value: string // the measured value (mono, accent)
  row: number // fixed row in the left-of-card callout column (0 = top)
  mobile: boolean // kept on narrow screens (the rest drop to avoid clutter)
}

/**
 * The specs we "read" off the frame to find matches. Values are the ONE frame's real
 * measurements (every comparable pair is the same frame shape) — the story is "these
 * specs, matched across brands," reinforced by the price card counting down. Edit freely.
 */
export const SPECS: readonly Spec[] = [
  { key: 'frameFront', label: 'MATERIAL', value: 'Acetate', row: 0, mobile: true },
  { key: 'frameTop', label: 'FRAME HEIGHT', value: '44 mm', row: 1, mobile: true },
  { key: 'lensCenter', label: 'LENS CATEGORY', value: 'N3 · Cat.3', row: 2, mobile: true },
  { key: 'templeTip', label: 'TEMPLE LENGTH', value: '145 mm', row: 3, mobile: false },
  { key: 'bridgeTop', label: 'BRIDGE', value: '18 mm', row: 4, mobile: false },
] as const

/**
 * Subtle frame colorways for the spawned copies (applied as per-instance
 * `instanceColor` on the frame body only). Mostly the PRADA black, with a few
 * muted finishes so the row reads as look-alikes — still clearly the same frame.
 * `weights` biases the deterministic pick toward black. Edit freely.
 */
export const COLORWAYS = {
  colors: ['#15130f', '#5b3a29', '#2f3640', '#6b6557'] as const, // black, tortoise, slate, taupe
  weights: [6, 1, 1, 1] as const, // black ~6× as likely as each muted tone
} as const

/** Camera offset (relative to the model's logo center) for the ERASE zoom.
 *  The camera sits at logoCenter + this offset and looks at the logo. */
export const ERASE_CAM = [1.7, 0.55, 1.4] as const

/**
 * Product cards — one per copy, anchored under its frame (drei <Html>).
 *  `original` = the designer reference price used to derive each discount %.
 *  `y` = how far below the frame the card sits (normalized world units).
 *  `BRANDS` / `PRICES_ROW` are read left→right across the row (descending price,
 *  so the discount grows and the cheapest/last card is highlighted in the accent).
 *  Length must be ≥ INSTANCES.desktop. Swap freely — fictional names by default.
 */
export const CARD = { original: 310, y: -1.5 } as const

export const BRANDS = [
  'LUMA', 'KITS', 'PAIR', 'ROAM', 'VELA', 'NORD', 'AXIS', 'MERIDIAN', 'OPTYX', 'FENN',
] as const

export const PRICES_ROW = [249, 199, 159, 129, 99, 79, 59, 44, 32, 24] as const

/**
 * Match-accuracy score per pair (0–100). Arbitrary, deliberately HIGH values that
 * vary a few points so the odometer has a satisfying roll between pairs. These are
 * a demo signal, not derived from the (mock) specs.
 */
export const SCORES = [99, 96, 98, 94, 97, 95, 93, 98, 92, 96] as const

export type Product = { brand: string; price: number; discount: number; score: number }

/** Build the per-copy product list (brand + price + derived discount % + match score). */
export const buildProducts = (count: number): Product[] =>
  Array.from({ length: count }, (_, i) => {
    const price = PRICES_ROW[i % PRICES_ROW.length]
    return {
      brand: BRANDS[i % BRANDS.length],
      price,
      discount: Math.round((1 - price / CARD.original) * 100),
      score: SCORES[i % SCORES.length],
    }
  })

/**
 * Copy for the narrative overlay (NarrativeOverlay.tsx). Each line is pinned to a
 * scroll beat so the words track the 3D story — and the story is what we actually
 * do: we don't make sunglasses, we MATCH them. Name a designer original, look past
 * its logo to the frame's specs, then surface spec-matched comparable pairs from
 * other brands for far less. The logo dissolving = "we read the specs, not the
 * brand." Per-product brand/price/discount live on the cards — see BRANDS /
 * PRICES_ROW / CARD above.
 */
export const TEXT = {
  brand: 'The original', // the designer original the shopper likes; struck during ERASE
  matched: 'its spec twin', // what the logo resolves into: we match on specs, not brand
  heroEyebrow: 'DESIGNER ORIGINAL', // mono label above the brand on the hero
  heroNote: 'Love the frame — not the $310?', // hero sub-line (the shopper's problem)
  eraseSub: 'We read the specs, not the logo.', // erase sub-line (how the match works)
  headline: 'Every frame has a twin.', // pinned through the pairs (the Spectwin anchor)
  headlineSub: 'Spec-matched alternatives from brands you can actually afford.',
  cta: 'Find your twin', // end CTA (arrow appended in markup)
} as const
