import { useCallback, useEffect, useRef, useState } from "react";
import type { Country, Photo, Prefecture } from "../models/gallery";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat, transformExtent } from "ol/proj";
import { View } from "ol";
import Map, { type FrameState } from 'ol/Map.js';
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import { easeOut } from 'ol/easing';
import { getArea } from 'ol/sphere';
import { MultiPolygon, Point, Polygon } from "ol/geom";
import Feature, { FeatureLike } from "ol/Feature";
import { Select, SelectItem, Spinner } from "@heroui/react";
import { TbPhoto } from "react-icons/tb";
import './map_openlayers.css';
import 'ol/ol.css';

interface LocalizedPrefecture extends Prefecture {
  i18n: Record<string, string>;
  apiId?: number;
}

interface RegionsMapProps {
  photos: Photo[];
  overlayActive: boolean;
  onRegionSelect: (prefectureId: number, prefectureName: string) => void;
  onBack: () => void;
}

const JAPAN_COUNTRY: Country = {
  id: 2,
  name: "日本",
  code: "JPN",
  center: [137.5, 37.5],
  extent: [122.5, 20, 154.5, 46.5],
  zoom: [4.4, 3.7, 9],
};

function geoName(
  entity: { name: string; i18n?: Record<string, string> },
  locale: string,
  _context: { countryCode: string; level: string },
) {
  return entity.i18n?.[locale] ?? entity.name;
}

const t = (key: string) => ({
  "map.countries": "国家 / 地区",
  "map.select_country": "请选择一个国家或地区",
} as Record<string, string>)[key] ?? key;

// ---------------------------------------------------------------------------
// timings and tuning

const EASE_MS = 180          // hover / spotlight easing
const REVEAL_MS = 480        // per-region reveal fade
const REVEAL_SPAN_MS = 360   // west-to-east stagger across the country
const STAMP_MS = 340         // click "seal press" pulse
const ENTRY_MS = 900         // initial push-in
const FIT_MS = 460           // click focus animation
const NAV_DELAY_MS = 430     // click-to-navigation delay (lets the focus play)
const CLOSE_GRACE_MS = 420   // post-close click blackout while the veil fades
const HOVER_GRACE_MS = 110   // hit-test miss tolerance while crossing borders
const LABEL_APPEAR_MS = 180  // a newly admitted declutter label fades in
const LABEL_DISAPPEAR_MS = 150 // a displaced declutter label fades out

const RECEDE = 0.15          // how far non-hovered regions fade toward the page
const LABEL_FADE = 0.4       // how much their labels fade at the same time

// ---------------------------------------------------------------------------
// small color helpers

type Rgba = [number, number, number, number]

function parseColor(value: string): Rgba | null {
  const s = value.trim()
  if (!s) return null
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = [...hex].map((c) => parseInt(c + c, 16))
      return [r, g, b, hex.length === 4 ? a / 255 : 1]
    }
    if (hex.length === 6 || hex.length === 8) {
      const n = (i: number) => parseInt(hex.slice(i, i + 2), 16)
      return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1]
    }
    return null
  }
  const match = s.match(/rgba?\(([^)]+)\)/)
  if (!match) return null
  const parts = match[1].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const channel = (p: string) => p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p)
  const alpha = parts.length > 3 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1
  return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha]
}

const mix = (a: Rgba, b: Rgba, t: number): Rgba => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
]

const PRESS_DARKEN: Rgba = [0, 0, 0, 1]
const PRESS_LIGHTEN: Rgba = [255, 255, 255, 1]

const pressFill = (color: Rgba, dark: boolean, progress: number): Rgba =>
  mix(color, dark ? PRESS_LIGHTEN : PRESS_DARKEN, 0.12 * progress)

const rgba = (c: Rgba, alpha = 1) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${+(c[3] * alpha).toFixed(3)})`

/** Move `value` toward `target` by at most `step`. */
const approach = (value: number, target: number, step: number) =>
  Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step

interface FadeTween {
  value: number
  from: number
  target: number
  startedAt: number
  duration: number
}

const fadeTween = (value: number): FadeTween => ({
  value,
  from: value,
  target: value,
  startedAt: 0,
  duration: 0,
})

function advanceFade(fade: FadeTween, now: number): boolean {
  if (fade.value === fade.target) return false
  const progress = fade.duration <= 0
    ? 1
    : Math.min(1, (now - fade.startedAt) / fade.duration)
  fade.value = fade.from + (fade.target - fade.from) * easeOut(progress)
  if (progress >= 1) fade.value = fade.target
  return progress < 1
}

function retargetFade(fade: FadeTween, target: number, duration: number, now: number) {
  advanceFade(fade, now)
  fade.from = fade.value
  fade.target = target
  fade.startedAt = now
  fade.duration = duration
}

function setFade(fade: FadeTween, value: number, now: number) {
  fade.value = value
  fade.from = value
  fade.target = value
  fade.startedAt = now
  fade.duration = 0
}

// ---------------------------------------------------------------------------
// palette, resolved from the page's CSS custom properties

interface MapPalette {
  land: Rgba
  line: Rgba
  ink: Rgba
  inkSoft: Rgba
  sakuraWeak: Rgba
  sakuraDeep: Rgba
  accent: Rgba
}

const FALLBACK_PALETTE: MapPalette = {
  land: [221, 221, 221, 1],
  line: [255, 255, 255, 1],
  ink: [39, 39, 42, 1],
  inkSoft: [131, 129, 138, 1],
  sakuraWeak: [251, 227, 231, 1],
  sakuraDeep: [224, 118, 137, 1],
  accent: [193, 78, 99, 1],
}

// ---------------------------------------------------------------------------
// per-feature caches (WeakMaps, so switching countries frees them)

// A region's largest closed polygon drives click focus. The label point is
// derived from its unsimplified geometry once: if Text receives a polygon,
// OpenLayers simplifies it per resolution and recomputes the interior point,
// which makes concave regions such as Kyoto jump sideways while zooming.
const largestPartCache = new WeakMap<MultiPolygon, MultiPolygon>()
const labelPointCache = new WeakMap<MultiPolygon, Point>()

function largestPart(geometry: MultiPolygon): MultiPolygon {
  const cached = largestPartCache.get(geometry)
  if (cached) return cached
  let largest: Polygon | null = null
  let maxArea = 0
  for (const polygon of geometry.getPolygons()) {
    const area = getArea(polygon)
    if (area > maxArea) {
      maxArea = area
      largest = polygon
    }
  }
  const part = new MultiPolygon([(largest ?? geometry.getPolygon(0)).getCoordinates()])
  largestPartCache.set(geometry, part)
  return part
}

function fixedLabelPoint(geometry: MultiPolygon): Point {
  const cached = labelPointCache.get(geometry)
  if (cached) return cached
  const [x, y] = largestPart(geometry).getPolygon(0).getInteriorPoint().getCoordinates()
  const point = new Point([x, y])
  labelPointCache.set(geometry, point)
  return point
}

// canvas text does not inherit <html lang>, so the glyph forms of Han-unified
// characters must be picked by the font stack itself; latin stays on SF Pro.
const LABEL_FONT_STACKS = {
  zh: '"SF Pro SC","SF Pro Display","SF Pro Icons","PingFang SC","Helvetica Neue","Helvetica","Arial",sans-serif',
  ja: '"SF Pro Display","SF Pro Icons","Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Helvetica Neue","Helvetica","Arial",sans-serif',
}
const LABEL_PADDING = [3, 6, 3, 6]

// reusable style objects per feature: animation frames only mutate colors and
// the label font instead of allocating new Style/Fill/Stroke/Text objects for
// every feature on every frame
interface StyleShell {
  fill: Fill
  stroke: Stroke
  contourStroke: Stroke
  probeText: Text
  probeFill: Fill
  probeStroke: Stroke
  labelText: Text
  labelFill: Fill
  labelStroke: Stroke
  overlayText: Text
  overlayFill: Fill
  overlayStroke: Stroke
  probing: Style[]
  visible: Style[]
  overlay: Style[]
}

const styleShells = new WeakMap<object, StyleShell>()

function featureName(feature: FeatureLike, locale: string, countryCode: string): string {
  return geoName({
    name: feature.get('name') as string,
    i18n: feature.get('i18n') as Record<string, string>,
  }, locale, { countryCode, level: "prefecture" })
}

function shellFor(feature: FeatureLike, geometry: MultiPolygon): StyleShell {
  let shell = styleShells.get(feature)
  if (shell) return shell
  const fill = new Fill({ color: 'transparent' })
  const stroke = new Stroke({ color: 'transparent', width: 1.1 })
  const contourStroke = new Stroke({ color: 'transparent', width: 1.2 })
  const probeFill = new Fill({ color: 'transparent' })
  const probeStroke = new Stroke({ color: 'transparent', width: 1.75 })
  const labelFill = new Fill({ color: 'transparent' })
  const labelStroke = new Stroke({ color: 'transparent', width: 1.75 })
  const overlayFill = new Fill({ color: 'transparent' })
  const overlayStroke = new Stroke({ color: 'transparent', width: 1.75 })
  const probeText = new Text({
    overflow: true,
    fill: probeFill,
    stroke: probeStroke,
    padding: LABEL_PADDING,
  })
  const labelText = new Text({
    overflow: true,
    fill: labelFill,
    stroke: labelStroke,
    padding: LABEL_PADDING,
    // The visible copy follows the winner set measured by probeText. It must
    // not enter the declutter tree again while it fades in or out.
    declutterMode: 'none',
  })
  const overlayText = new Text({
    overflow: true,
    fill: overlayFill,
    stroke: overlayStroke,
    padding: LABEL_PADDING,
  })
  const base = new Style({ fill, stroke, zIndex: 1 })
  const contour = new Style({ stroke: contourStroke, zIndex: 3 })
  const labelGeometry = fixedLabelPoint(geometry)
  const probe = new Style({ geometry: labelGeometry, text: probeText, zIndex: 4 })
  const label = new Style({ geometry: labelGeometry, text: labelText, zIndex: 5 })
  const overlayLabel = new Style({ geometry: labelGeometry, text: overlayText, zIndex: 4 })
  shell = {
    fill, stroke, contourStroke,
    probeText, probeFill, probeStroke,
    labelText, labelFill, labelStroke,
    overlayText, overlayFill, overlayStroke,
    probing: [base, probe],
    visible: [base, probe, label],
    // the overlay draws its own label copy: its opaque fill sits above the
    // base layer's (decluttered) labels, so without one the hovered region
    // would lose its name
    overlay: [base, contour, overlayLabel],
  }
  styleShells.set(feature, shell)
  return shell
}

// ---------------------------------------------------------------------------

interface TicketInfo {
  id: number
  count: number
  color: string
}

// handed to the nested photo-list route as outlet context, so it knows it is
// riding on top of the living map (and keeps its navigation under /map)
export default function RegionsMap({ photos, overlayActive, onRegionSelect, onBack }: RegionsMapProps) {
  const darkmode = { value: false }
  const pageRef = useRef<HTMLDivElement>(null)
  const mapElement = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [country, setCountry] = useState<Country>(JAPAN_COUNTRY)
  const [countries] = useState<Country[]>([JAPAN_COUNTRY])
  const [prefectures, setPrefectures] = useState<LocalizedPrefecture[]>([])
  const [ticket, setTicket] = useState<TicketInfo | null>(null)
  const lastTicket = useRef<TicketInfo | null>(null)
  const theme = useRef<{ palette: MapPalette, dark: boolean }>({ palette: FALLBACK_PALETTE, dark: false })
  const repaint = useRef<(() => void) | null>(null)
  const selectRef = useRef(onRegionSelect)
  const backRef = useRef(onBack)
  selectRef.current = onRegionSelect
  backRef.current = onBack
  // the page is absolute (document-flow) so it follows macOS rubber-band
  // overscroll, but must be fixed while the photo list scrolls the document
  // above it; pinning outlives overlayActive until the exit animation ends,
  // when the collapsing document has clamped the scroll back to 0 — switching
  // earlier would yank the map off-screen at any scrolled position
  const [mapPinned, setMapPinned] = useState(overlayActive)
  const mapApi = useRef<{ clearHover: () => void, cancelNav: () => void } | null>(null)
  // mirror of the overlay state for the map-effect closures: they must ignore
  // clicks while the list is up and briefly after it closes (veil still fading)
  const overlayState = useRef({ active: overlayActive, closedAt: 0 })
  // navigate loses referential identity on every route change; depending on it
  // in the map effect would tear the map down the moment the overlay opens

  // resolve the page's theme-dependent CSS custom properties into concrete
  // colors; a theme flip only repaints the canvas instead of rebuilding the map
  const resolveTheme = useCallback((isDark: boolean) => {
    const el = pageRef.current
    if (!el) return
    const cssStyles = getComputedStyle(el)
    const cssColor = (name: string, fallback: Rgba): Rgba =>
      parseColor(cssStyles.getPropertyValue(name)) ?? fallback
    theme.current = {
      palette: {
        land: cssColor('--map-land', FALLBACK_PALETTE.land),
        line: cssColor('--map-line', FALLBACK_PALETTE.line),
        ink: cssColor('--map-ink', FALLBACK_PALETTE.ink),
        inkSoft: cssColor('--map-ink-soft', FALLBACK_PALETTE.inkSoft),
        sakuraWeak: cssColor('--sakura-weak', FALLBACK_PALETTE.sakuraWeak),
        sakuraDeep: cssColor('--sakura-deep', FALLBACK_PALETTE.sakuraDeep),
        accent: cssColor('--accent', FALLBACK_PALETTE.accent),
      },
      dark: isDark,
    }
  }, [])

  useEffect(() => {
    resolveTheme(darkmode.value)
    repaint.current?.()
    // the tip swatch color was mixed under the previous palette — hide the
    // tip rather than showing a stale tone; the next hover recolors it
    setTicket(null)
  }, [darkmode.value, resolveTheme])

  // a language switch only swaps the label font stack (glyph forms) and
  // repaints the canvas instead of rebuilding the map
  const mapLang = "zh-CN"
  const countryName = (value: Country) =>
    geoName(value, mapLang, { countryCode: value.code, level: "country" })
  const langRef = useRef(mapLang)
  useEffect(() => {
    langRef.current = mapLang
    repaint.current?.()
  }, [mapLang])

  useEffect(() => {
    if (ticket) lastTicket.current = ticket
  }, [ticket])

  const changeCountry = useCallback((next: Country) => {
    setPrefectures([])
    setTicket(null)
    setCountry(next)
  }, [])

  // Mirror the selection into ?country= (replace, off-router — the router's
  // history state must survive) so the view switcher and a later remount of
  // either view start from the same country. This is an invariant, not a
  // change handler: every navigation around the prefecture overlay (open,
  // scrim, Escape, the list's own back button) carries no search string and
  // wipes the param, so it is re-asserted whenever the map rests on /map.
  // The default country is omitted to keep plain /map URLs clean.
  useEffect(() => {
    if (!country || !countries.length || overlayActive) return
    if (window.location.pathname !== '/map') return
    const url = new URL(window.location.href)
    const wanted = country.id === countries[0].id ? null : country.code
    if (url.searchParams.get('country') === wanted) return
    if (wanted === null) url.searchParams.delete('country')
    else url.searchParams.set('country', wanted)
    window.history.replaceState(window.history.state, '', url)
  }, [country, countries, overlayActive])

  useEffect(() => {
    let cancelled = false
    const photoData = new globalThis.Map<string, { id: number; count: number }>()
    for (const photo of photos) {
      const prefecture = photo.metadata.city?.prefecture
      if (!prefecture) continue
      const current = photoData.get(prefecture.name)
      photoData.set(prefecture.name, {
        id: prefecture.id,
        count: (current?.count ?? 0) + 1,
      })
    }
    void fetch(`${import.meta.env.BASE_URL}geojson/JPN.json`)
      .then((response) => response.json())
      .then((collection: { features: Array<{ properties: { id: number; name: string; i18n: Record<string, string> } }> }) => {
        if (cancelled) return
        setPrefectures(collection.features.map(({ properties }) => ({
          id: properties.id,
          name: properties.name,
          i18n: properties.i18n,
          apiId: photoData.get(properties.name)?.id,
          country,
          photos_count: photoData.get(properties.name)?.count ?? 0,
          cities: [],
        })))
      })
    return () => {
      cancelled = true
    }
  }, [country, photos])

  useEffect(() => {
      if (!country || !prefectures.length) return
      if (!mapElement.current || !pageRef.current) return
      const targetEl = mapElement.current
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // ---- data ----------------------------------------------------------

      const prefById: Record<number, Prefecture> = {}
      let maxPhotos = 0
      for (const p of prefectures) {
        prefById[p.id] = p
        maxPhotos = Math.max(maxPhotos, p.photos_count ?? 0)
      }

      // the more photos a region holds, the deeper its sakura tint
      // (log scale, so a runaway region does not wash out all the others)
      const baseFill = (count: number): Rgba => {
        const { palette } = theme.current
        if (count <= 0) return palette.land
        const depth = Math.log1p(count) / Math.log1p(Math.max(maxPhotos, 1))
        return mix(palette.sakuraWeak, palette.sakuraDeep, depth)
      }

      // ---- animation state -----------------------------------------------
      // one rAF loop drives everything and stops when nothing is in motion

      const hover: Record<number, { value: number, target: number }> = {}
      // the spotlight (how far non-hovered regions recede) is a single global
      // value: it holds at 1 while any region is hovered — however fast the
      // pointer sweeps between regions — and only fades when it leaves them all
      let spotValue = 0
      let stamp: { id: number, start: number } | null = null
      const revealDelays: Record<number, number> = {}
      let revealStart = 0
      let revealUntil = 0
      let revealDone = reduceMotion
      let restingResolution = 1
      let entryActive = false
      let entryLabelIds: Set<number> | null = null
      let entryDataReady = false
      let entryViewReady = false
      let entryStarted = false
      let entryComplete = reduceMotion
      let beginEntry = () => {}
      const labelFades = new globalThis.Map<number, FadeTween>()
      let labelsReady = false
      let winnerStateReady = false
      let navTimer = 0
      let raf = 0
      let disposed = false
      let lastFrame = 0

      const revealAlpha = (id: number, now: number) => {
        if (revealDone) return 1
        if (!revealStart) return 0
        const progress = (now - revealStart - (revealDelays[id] ?? 0)) / REVEAL_MS
        if (progress <= 0) return 0
        if (progress >= 1) return 1
        return progress * (2 - progress)
      }

      // labels grow gently as the view zooms in; the font string is rebuilt
      // only when the rounded size or the label language actually changes (it
      // is asked for by every feature on every animation frame)
      let labelFontLang = ''
      const labelFontValues = new globalThis.Map<string, string>()
      const labelFont = (resolution: number) => {
        const size = Math.min(15.5, Math.max(12.5, 13 * Math.pow(restingResolution / resolution, 0.12))).toFixed(1)
        if (langRef.current !== labelFontLang) {
          labelFontLang = langRef.current
          labelFontValues.clear()
        }
        let value = labelFontValues.get(size)
        if (!value) {
          value = `600 ${size}px ${LABEL_FONT_STACKS[langRef.current.startsWith('zh') ? 'zh' : 'ja']}`
          labelFontValues.set(size, value)
        }
        return value
      }

      // ---- styling -------------------------------------------------------
      // shared core: updates the feature's cached style shell (fill, halo,
      // label) and returns it with the values the overlay needs for its
      // contour. The BASE layer must never render hover-dependent shapes
      // (contour), or the hover would enlarge its own hit area and flicker
      // along shared borders — the contour lives on the hover overlay, which
      // is excluded from hit-testing.

      const styleCore = (feature: FeatureLike, resolution: number) => {
        const geometry = feature.getGeometry()
        if (geometry?.getType() !== 'MultiPolygon') return
        const { palette, dark } = theme.current
        const id = feature.get('id') as number
        const now = performance.now()
        const alpha = revealAlpha(id, now)
        // Keep even fully transparent labels in the declutter pass. This lets
        // the entry setup capture the resting view's winning label set before
        // the stagger starts; otherwise labels join the collision tree late
        // and can evict an already-visible neighbour for a frame.
        const count = prefById[id]?.photos_count ?? 0
        const hoverValue = hover[id]?.value ?? 0

        // hover lifts the region within its own hue — deepen in light mode,
        // brighten in dark — while the rest recede toward the page; both
        // terms blend continuously so a region morphs straight from lifted
        // to receded without passing through its resting style
        let fillColor = baseFill(count)
        const recede = RECEDE * spotValue * (1 - hoverValue)
        if (recede > 0.001) {
          fillColor = mix(fillColor, palette.line, recede)
        }
        if (hoverValue > 0) {
          if (dark) {
            fillColor = mix(fillColor, [255, 255, 255, 1], 0.16 * hoverValue)
          } else if (count > 0) {
            fillColor = mix(mix(fillColor, palette.sakuraDeep, 0.38 * hoverValue), palette.ink, 0.06 * hoverValue)
          } else {
            fillColor = mix(fillColor, palette.ink, 0.12 * hoverValue)
          }
        }
        if (stamp?.id === id) {
          const pulse = Math.sin(Math.min(1, (now - stamp.start) / STAMP_MS) * Math.PI)
          // Press feedback is derived from the region's current fill: darken
          // it in light mode and lighten it in dark mode. No theme hue is
          // injected, so neutral and future country palettes stay themselves.
          fillColor = pressFill(fillColor, dark, pulse)
        }

        const shell = shellFor(feature, geometry as MultiPolygon)
        shell.fill.setColor(rgba(fillColor, alpha))
        shell.stroke.setColor(rgba(palette.line, 0.92 * alpha))

        // Labels use a compact semibold face with a narrow, tone-on-tone halo.
        // Everything but the hovered region falls quiet while a region is
        // lifted, and the active name picks up a restrained accent tint.
        const labelAlpha = alpha * (1 - LABEL_FADE * spotValue * (1 - hoverValue))
        const labelInk = mix(palette.ink, palette.accent, 0.22 * hoverValue)
        const labelHalo = mix(palette.line, fillColor, dark ? 0.18 : 0.28)
        const inkAlpha = labelAlpha * (0.9 + 0.1 * hoverValue)
        const haloAlpha = labelAlpha * (dark ? 0.78 : 0.72)
        // During the entry push-in, scale the complete text sprite (including
        // its halo and declutter box) by the same ratio as the map. This keeps
        // neighbouring boxes in the same collision relationship throughout
        // the camera move instead of letting labels replace one another.
        const entryScale = entryActive
          ? Math.min(1, restingResolution / resolution)
          : 1
        const name = featureName(feature, langRef.current, country.code)
        const font = labelFont(entryActive ? restingResolution : resolution)
        shell.probeText.setText(name)
        shell.probeText.setFont(font)
        shell.probeText.setScale(entryScale)
        shell.labelText.setText(name)
        shell.labelText.setFont(font)
        shell.labelText.setScale(entryScale)
        shell.overlayText.setText(name)
        shell.overlayText.setFont(font)
        shell.overlayText.setScale(entryScale * (1 + 0.045 * hoverValue))

        // probeText alone decides declutter membership. The visible copy only
        // reflects the per-label fade state and never changes that decision.
        const probeAlpha = reduceMotion ? labelAlpha : 0
        shell.probeFill.setColor(rgba(labelInk, probeAlpha * (0.9 + 0.1 * hoverValue)))
        shell.probeStroke.setColor(rgba(labelHalo, probeAlpha * (dark ? 0.78 : 0.72)))
        const visibility = entryActive
          ? (entryLabelIds?.has(id) ? 1 : 0)
          : (labelFades.get(id)?.value ?? 0)
        shell.labelFill.setColor(rgba(labelInk, inkAlpha * visibility))
        shell.labelStroke.setColor(rgba(labelHalo, haloAlpha * visibility))
        shell.overlayFill.setColor(rgba(labelInk, inkAlpha))
        shell.overlayStroke.setColor(rgba(labelHalo, haloAlpha))

        return { shell, fillColor, hoverValue, alpha, dark }
      }

      const boundaryStroke = new Stroke({
        color: 'transparent',
        width: 1.15,
        lineDash: [5, 4],
      })
      const boundaryStyle = new Style({ stroke: boundaryStroke, zIndex: 2 })

      const baseStyle = (feature: FeatureLike, resolution: number) => {
        if (feature.getGeometry()?.getType() === 'MultiLineString') {
          boundaryStroke.setColor(rgba(theme.current.palette.inkSoft, 0.82))
          return boundaryStyle
        }
        const core = styleCore(feature, resolution)
        if (!core) return
        const id = Number(feature.get('id'))
        if (entryActive) {
          if (!entryLabelIds) return core.shell.probing
          return entryLabelIds.has(id) ? core.shell.visible : core.shell.probing
        }
        if (reduceMotion) return core.shell.probing
        const fade = labelFades.get(id)
        return fade && (fade.value > 0 || fade.target > 0)
          ? core.shell.visible
          : core.shell.probing
      }

      const overlayStyle = (feature: FeatureLike, resolution: number) => {
        const core = styleCore(feature, resolution)
        if (!core) return
        // tone-on-tone contour: the region's own color pulled toward ink;
        // the overlay's layer opacity already follows the hover value
        const { palette } = theme.current
        core.shell.contourStroke.setColor(rgba(mix(core.fillColor, palette.ink, core.dark ? 0.35 : 0.45), 0.8 * core.alpha))
        core.shell.contourStroke.setWidth(1.2 + core.hoverValue * 0.8)
        return core.shell.overlay
      }

      // ---- layers --------------------------------------------------------

      const source = new VectorSource({
        url: `/geojson/${country.code}.json`,
        format: new GeoJSON(),
      })
      const featureById: Record<number, Feature> = {}

      const layerOptions = {
        renderBuffer: Math.max(window.outerWidth, window.outerHeight),
        // keep loading and restyling during view animations (entry push-in,
        // click fit) and wheel/drag interactions
        updateWhileAnimating: true,
        updateWhileInteracting: true,
      }

      const vectorLayer = new VectorLayer({
        ...layerOptions,
        source,
        className: 'map-land',
        declutter: true,
        style: baseStyle,
      })

      // hover lift overlays: TWO one-feature layers ("slots"), each carrying
      // a region whose opacity follows that region's own hover value. During
      // a handoff the outgoing region's fill/contour/label/drop-shadow fade
      // out in one slot while the incoming region fades in on the other —
      // everything stays continuous, nothing jumps between silhouettes.
      const makeHoverSlot = () => {
        const slotSource = new VectorSource()
        const layer = new VectorLayer({
          ...layerOptions,
          source: slotSource,
          className: 'map-hover-land',
          style: overlayStyle,
        })
        layer.setOpacity(0)
        return { layer, source: slotSource, id: null as number | null }
      }
      const hoverSlots = [makeHoverSlot(), makeHoverSlot()]

      const repaintAll = () => {
        vectorLayer.changed()
        for (const slot of hoverSlots) slot.layer.changed()
      }

      const syncOverlay = () => {
        // free slots whose region is no longer animating at all
        for (const slot of hoverSlots) {
          if (slot.id !== null && !(slot.id in hover)) {
            slot.id = null
            slot.source.clear(true)
            slot.layer.setOpacity(0)
          }
        }
        // the two most relevant regions (rising ones first) each get a slot
        const ids = Object.keys(hover).map(Number)
          .sort((a, b) => (hover[b].value + hover[b].target) - (hover[a].value + hover[a].target))
          .slice(0, hoverSlots.length)
        for (const id of ids) {
          if (hoverSlots.some((slot) => slot.id === id)) continue
          const slot = hoverSlots.find((s) => s.id === null)
            ?? hoverSlots.reduce((weakest, s) =>
              (hover[s.id!]?.value ?? 0) < (hover[weakest.id!]?.value ?? 0) ? s : weakest)
          slot.id = id
          slot.source.clear(true)
          if (featureById[id]) slot.source.addFeature(featureById[id])
        }
        for (const slot of hoverSlots) {
          const value = slot.id !== null ? hover[slot.id]?.value ?? 0 : 0
          if (slot.layer.getOpacity() !== value) slot.layer.setOpacity(value)
        }
      }

      // ---- animation loop ------------------------------------------------

      const tick = (now: number) => {
        raf = 0
        if (disposed) return
        const step = Math.min(64, now - lastFrame) / EASE_MS
        lastFrame = now
        let active = false
        let anyHover = false

        for (const key of Object.keys(hover)) {
          const id = Number(key)
          const h = hover[id]
          if (h.target === 1) anyHover = true
          h.value = approach(h.value, h.target, step)
          if (h.value !== h.target) active = true
          else if (h.target === 0) delete hover[id]
        }

        const spotTarget = anyHover ? 1 : 0
        spotValue = approach(spotValue, spotTarget, step)
        if (spotValue !== spotTarget) active = true

        syncOverlay()

        if (!revealDone && revealStart) {
          if (now >= revealUntil) revealDone = true
          else active = true
        }

        if (stamp && now - stamp.start >= STAMP_MS) stamp = null
        if (stamp) active = true

        for (const [id, fade] of labelFades) {
          if (advanceFade(fade, now)) active = true
          else if (fade.target === 0) labelFades.delete(id)
        }

        repaintAll()
        if (active) raf = requestAnimationFrame(tick)
      }

      const kick = () => {
        if (disposed || raf) return
        lastFrame = performance.now()
        raf = requestAnimationFrame(tick)
      }

      // once the geometry arrives, unveil the regions west to east, like ink
      // washing across the sheet
      source.on('featuresloadend', () => {
        if (disposed) return
        labelsReady = true
        let minX = Infinity
        let maxX = -Infinity
        const centers: [number, number][] = []
        for (const feature of source.getFeatures()) {
          const geometry = feature.getGeometry()
          if (geometry?.getType() !== 'MultiPolygon') continue
          const id = Number(feature.get('id'))
          if (!Number.isFinite(id) || !prefById[id]) continue
          // the id index is needed regardless of the reveal (the hover
          // overlay relies on it, also under prefers-reduced-motion)
          featureById[id] = feature
          if (revealDone) continue
          const extent = largestPart(geometry as MultiPolygon).getExtent()
          const cx = (extent[0] + extent[2]) / 2
          centers.push([id, cx])
          minX = Math.min(minX, cx)
          maxX = Math.max(maxX, cx)
        }
        if (revealDone) return
        if (!centers.length) {
          revealDone = true
          return
        }
        const span = maxX - minX || 1
        for (const [id, cx] of centers) {
          revealDelays[id] = ((cx - minX) / span) * REVEAL_SPAN_MS
        }
        entryDataReady = true
        beginEntry()
      })

      // if the geojson fails to load there is nothing to reveal; make sure
      // whatever renders later is not stuck at zero opacity
      source.on('featuresloaderror', () => {
        revealDone = true
        vectorLayer.changed()
      })

      // ---- map and view --------------------------------------------------

      const view = new View({
        center: fromLonLat(country.center),
        zoom: country.zoom[0] - 0.5,
        minZoom: country.zoom[1],
        maxZoom: country.zoom[2],
        extent: transformExtent(country.extent, 'EPSG:4326', 'EPSG:3857'),
        // without this, the extent constraint silently swallows wheel
        // zoom-out as soon as the view already covers most of the country
        showFullExtent: true,
      })
      restingResolution = view.getResolution() ?? 1

      const olMap = new Map({
        target: targetEl,
        view,
        layers: [vectorLayer, hoverSlots[0].layer, hoverSlots[1].layer],
        controls: [],
        // no double-click zoom: the second click of an impatient double-click
        // would cancel the click-focus fit mid-flight and strand the view at
        // a random close-up (onFocusOnly matches OL's own default)
        interactions: defaultInteractions({ onFocusOnly: true, doubleClickZoom: false }),
      })
      repaint.current = repaintAll
      if (import.meta.env.DEV) {
        // exposed for e2e checks only
        (window as unknown as { __boarMap?: Map }).__boarMap = olMap
      }

      const labelIdsFromFrame = (frameState: FrameState | null) => {
        const declutterGroup = vectorLayer.getDeclutter()
        const entries = declutterGroup
          ? frameState?.declutter?.[declutterGroup]?.all() ?? []
          : []
        return new Set(entries
          .map(({ value }) => Number(value.get('id')))
          .filter((id) => Number.isFinite(id) && prefById[id]))
      }

      const syncLabelWinners = (winners: Set<number>, now: number, immediate: boolean) => {
        let changed = false
        for (const [id, fade] of labelFades) {
          const target = winners.has(id) ? 1 : 0
          if (fade.target === target) continue
          if (immediate) setFade(fade, target, now)
          else retargetFade(
            fade,
            target,
            target ? LABEL_APPEAR_MS : LABEL_DISAPPEAR_MS,
            now,
          )
          changed = true
        }
        for (const id of winners) {
          if (labelFades.has(id)) continue
          const fade = fadeTween(immediate ? 1 : 0)
          labelFades.set(id, fade)
          if (!immediate) retargetFade(fade, 1, LABEL_APPEAR_MS, now)
          changed = true
        }
        winnerStateReady = true
        return changed
      }

      // Zooming itself does nothing to label opacity. After each rendered
      // frame, only ids whose declutter membership changed are retargeted.
      olMap.on('postrender', (event) => {
        if (disposed || reduceMotion || !labelsReady || entryActive || !entryComplete) return
        const winners = labelIdsFromFrame(event.frameState)
        // Ignore transient empty trees while a source/layer is rebuilding.
        if (!winners.size) return
        const immediate = !winnerStateReady
        if (!syncLabelWinners(winners, performance.now(), immediate)) return
        if (immediate) repaintAll()
        else kick()
      })

      // Capture decluttering once at the legal resting view, before any label
      // is visible. The same winners then stay present throughout the camera
      // push-in, so neither the reveal stagger nor a changing resolution can
      // swap neighbouring names mid-animation.
      beginEntry = () => {
        if (disposed || reduceMotion || entryStarted || !entryDataReady || !entryViewReady) return
        entryStarted = true
        // Guard the capture frame too: a resolution change in this tiny window
        // belongs to the fixed-winner entry sequence.
        entryActive = true
        olMap.once('postrender', (event) => {
          if (disposed) return
          const winners = labelIdsFromFrame(event.frameState)
          entryLabelIds = winners.size ? winners : null
          if (winners.size) syncLabelWinners(winners, performance.now(), true)

          revealStart = performance.now()
          revealUntil = revealStart + REVEAL_SPAN_MS + REVEAL_MS + 40
          kick()

          const restingZoom = view.getZoom()
          if (restingZoom === undefined) {
            entryActive = false
            entryComplete = true
            entryLabelIds = null
            repaintAll()
            return
          }
          view.animate(
            { zoom: restingZoom - 0.3, duration: 0 },
            { zoom: restingZoom, duration: ENTRY_MS, easing: easeOut },
            (completed) => {
              if (disposed) return
              entryActive = false
              entryComplete = true
              entryLabelIds = null
              repaintAll()
              if (!completed) kick()
            },
          )
        })
        vectorLayer.changed()
      }

      // The first rendered frame is the earliest point at which the real
      // viewport size has constrained the configured view to a legal resting
      // resolution. It also becomes the label-size baseline.
      olMap.once('postrender', () => {
        if (disposed) return
        restingResolution = view.getResolution() ?? restingResolution
        entryViewReady = true
        vectorLayer.changed()
        beginEntry()
      })

      // ---- pointer and hover ---------------------------------------------

      const setCursor = (cursor: string) => {
        targetEl.style.cursor = cursor
      }

      // hit-test the base layer only: the hover overlay duplicates the
      // hovered region (including its label box, un-decluttered) on top, and
      // letting it intercept hit-tests made the hover stick to the previous
      // region and flicker along shared borders
      const featureAt = (pixel: number[]) =>
        olMap.forEachFeatureAtPixel(pixel, (feature) => {
          const id = Number(feature.get('id'))
          // Alpha-zero features now carry a transparent label style solely to
          // reserve their declutter box. Keep the original hit-test timing so
          // an unrevealed region cannot be hovered through that invisible
          // geometry.
          return feature.getGeometry()?.getType() === 'MultiPolygon' &&
            prefById[id] && revealAlpha(id, performance.now()) > 0
            ? feature
            : undefined
        }, { layerFilter: (layer) => layer === vectorLayer })

      const setHoverTargets = (id: number | null) => {
        let changed = false
        for (const key of Object.keys(hover)) {
          const hid = Number(key)
          if (hid !== id && hover[hid].target !== 0) {
            hover[hid].target = 0
            changed = true
          }
        }
        if (id !== null) {
          const h = hover[id] ?? (hover[id] = { value: 0, target: 0 })
          if (h.target !== 1) {
            h.target = 1
            changed = true
          }
        }
        if (!changed) return
        if (reduceMotion) {
          for (const key of Object.keys(hover)) {
            const h = hover[Number(key)]
            h.value = h.target
          }
          spotValue = id !== null ? 1 : 0
          syncOverlay()
          repaintAll()
        } else {
          kick()
        }
      }

      // the tip hides whenever the view is in motion — dragging, kinetic
      // glide after release, wheel/fit animations — and settles again at rest
      let mapMoving = false
      let lastPixel: number[] | null = null
      let hoverClearTimer = 0

      const cancelHoverClear = () => {
        if (hoverClearTimer) {
          window.clearTimeout(hoverClearTimer)
          hoverClearTimer = 0
        }
      }

      const clearHover = () => {
        cancelHoverClear()
        setHoverTargets(null)
        setTicket(null)
        setCursor('')
      }
      mapApi.current = {
        clearHover,
        cancelNav: () => {
          if (navTimer) {
            window.clearTimeout(navTimer)
            navTimer = 0
          }
        },
      }

      const showAt = (pixel: number[]) => {
        const feature = featureAt(pixel)
        const id = feature ? feature.get('id') as number : null
        if (feature && id !== null) {
          cancelHoverClear()
          setHoverTargets(id)
          const count = prefById[id]?.photos_count ?? 0
          setTicket((prev) => prev?.id === id ? prev : {
            id,
            count,
            color: rgba(baseFill(count)),
          })
          setCursor('pointer')
        } else if (!hoverClearTimer) {
          // a fast pointer skims the hairline gaps between regions, where the
          // hit-test momentarily comes up empty — only clear the hover if the
          // pointer is still off-region a beat later, so the spotlight and
          // tip don't stutter at every border crossing
          hoverClearTimer = window.setTimeout(() => {
            hoverClearTimer = 0
            clearHover()
          }, HOVER_GRACE_MS)
        }
      }

      // keep the tip anchored to the pointer even while hidden, so it
      // reappears in place without jumping
      const positionTip = (pixel: number[]) => {
        const tip = tipRef.current
        if (!tip) return
        const [px, py] = pixel
        const width = tip.offsetWidth || 160
        const height = tip.offsetHeight || 40
        const flip = px + 18 + width > targetEl.clientWidth - 12
        const tx = flip ? px - width - 16 : px + 18
        let ty = py - height - 14
        if (ty < 12) ty = py + 22
        tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`
      }

      olMap.on('pointermove', (e) => {
        // no hover concept under a finger: skip tip/highlight for touch
        if ((e.originalEvent as PointerEvent).pointerType === 'touch') return
        lastPixel = e.pixel
        positionTip(e.pixel)

        if (e.dragging || mapMoving) {
          if (e.dragging) setCursor('grabbing')
          setTicket(null)
          // a missed hit-test while the map moves is transient — keep the
          // current highlight instead of flickering
          const id = featureAt(e.pixel)?.get('id') as number | undefined
          if (id !== undefined) setHoverTargets(id)
          return
        }
        showAt(e.pixel)
      })

      olMap.on('movestart', () => {
        mapMoving = true
        setTicket(null)
      })
      olMap.on('moveend', () => {
        mapMoving = false
        // the click-focus fit outlives the navigation delay — without the
        // overlay guard this would re-lift the region and re-show the tip at
        // the stale pointer pixel, ghosting through the veil
        if (lastPixel && !overlayState.current.active && !navTimer) showAt(lastPixel)
      })

      const viewport = olMap.getViewport()
      const onPointerLeave = () => {
        lastPixel = null
        clearHover()
      }
      viewport.addEventListener('pointerleave', onPointerLeave)

      olMap.on('click', (e) => {
        // pointer-events CSS already shields the canvas while the list is up,
        // but the shield lifts with the route — not with the fading veil — so
        // the second click of a double-click on the veil must die here
        const overlay = overlayState.current
        if (overlay.active || performance.now() - overlay.closedAt < CLOSE_GRACE_MS) return
        const feature = featureAt(e.pixel)
        if (!feature || navTimer) return
        const id = feature.get('id') as number
        const selectedPrefecture = prefById[id] as LocalizedPrefecture | undefined
        if (!selectedPrefecture?.apiId) return

        const finishSelection = () => {
          selectRef.current(
            selectedPrefecture.apiId!,
            geoName(selectedPrefecture, mapLang, {
              countryCode: country.code,
              level: "prefecture",
            }),
          )
        }
        if (reduceMotion) {
          finishSelection()
          return
        }
        // press the seal, lean in, then let the photo list rise on top; focus
        // on the region's main landmass only, ignoring far-flung islands
        stamp = { id, start: performance.now() }
        kick()
        const geometry = feature.getGeometry()
        if (geometry?.getType() === 'MultiPolygon') {
          view.cancelAnimations()
          view.fit(largestPart(geometry as MultiPolygon).getExtent(), {
            duration: FIT_MS,
            easing: easeOut,
            padding: [96, 96, 96, 96],
            maxZoom: (view.getZoom() ?? country.zoom[0]) + 1.3,
          })
        }
        const selectionDelay = NAV_DELAY_MS
        navTimer = window.setTimeout(() => {
          // the map outlives the navigation now — a stale timer id would
          // swallow every later click
          navTimer = 0
          // the page-fade exit delays teardown past the URL change; an armed
          // click must not override wherever the user just navigated
          if (!/^\/map(\/|$)/.test(window.location.pathname)) return
          // the view switcher keeps the pathname and only flips ?view= — a
          // user who just chose the photos view must not be dragged back
          if (new URLSearchParams(window.location.search).get('view') === 'photos') return
          finishSelection()
        }, selectionDelay)
      })

      const resizeObserver = new ResizeObserver(() => olMap.updateSize())
      resizeObserver.observe(targetEl)

      // ---- teardown ------------------------------------------------------

      return () => {
        disposed = true
        if (raf) cancelAnimationFrame(raf)
        if (navTimer) window.clearTimeout(navTimer)
        if (hoverClearTimer) window.clearTimeout(hoverClearTimer)
        viewport.removeEventListener('pointerleave', onPointerLeave)
        resizeObserver.disconnect()
        olMap.setTarget(undefined)
        if (import.meta.env.DEV) {
          const devWindow = window as unknown as { __boarMap?: Map }
          if (devWindow.__boarMap === olMap) delete devWindow.__boarMap
        }
        repaint.current = null
        mapApi.current = null
      }
    }, [country, mapLang, prefectures]
  )

  // when the photo list opens on top, the map lets go of its hover state and
  // drops any still-armed click navigation (the overlay may have opened via
  // browser Back — a stale timer would navigate on top of it); on close it
  // simply stays where the click focus left it
  useEffect(() => {
    const state = overlayState.current
    if (overlayActive) {
      state.active = true
      setMapPinned(true)
      mapApi.current?.cancelNav()
      mapApi.current?.clearHover()
    } else {
      if (state.active) state.closedAt = performance.now()
      state.active = false
      const timer = window.setTimeout(() => setMapPinned(false), 200)
      return () => window.clearTimeout(timer)
    }
  }, [overlayActive])

  useEffect(() => {
    if (!overlayActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      // dialogs and popovers prevent-default the Escapes they consume
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // the page-fade exit keeps this listener alive briefly after leaving /map
      if (!/^\/map(\/|$)/.test(window.location.pathname)) return
      backRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [overlayActive])

  // the map's dark palette is driven by our own is-dark class (not the global
  // .dark class): the <html> class is only updated in a parent effect, so it is
  // still stale when this component resolves its palette on a theme switch
  const pageClass = `map-page${darkmode.value ? ' is-dark' : ''}${overlayActive ? ' has-overlay' : ''}${mapPinned ? ' is-pinned' : ''}`
  const loading = !country || !prefectures.length
  const shownTicket = ticket ?? lastTicket.current
  const shownPrefecture = shownTicket
    ? prefectures.find((prefecture) => prefecture.id === shownTicket.id)
    : undefined

  return <div className={pageClass} ref={pageRef}>
      {
        country && <>
          <div className='map-canvas' ref={mapElement}/>

          <div
            className={`pointer-events-none absolute inset-x-0 top-20 mx-auto w-full max-w-5xl pl-4 md:pl-68 transition-opacity duration-300 ${overlayActive ? 'opacity-0' : 'opacity-100'}`}>
            <Select
              key={mapLang}
              items={countries}
              label={t('map.countries')}
              placeholder={t('map.select_country')}
              selectedKeys={[country.id.toString()]}
              renderValue={() => countryName(country)}
              onChange={(e) => {
                const next = countries.find((c) => c.id.toString() === e.target.value)
                if (next && next.id !== country.id) {
                  changeCountry(next)
                }
              }}
              className={`${overlayActive ? 'pointer-events-none' : 'pointer-events-auto'} w-[20rem]`}
              isDisabled={overlayActive}
            >
              {(c) => <SelectItem key={c.id} textValue={countryName(c)}>
                {countryName(c)}
              </SelectItem>}
            </Select>
          </div>

          <div className={`map-tip${ticket ? ' is-visible' : ''}`} ref={tipRef} aria-hidden='true'>
            <div className='map-tip-card'>
              <i className='map-tip-swatch' style={shownTicket ? { background: shownTicket.color } : undefined}/>
              <span className='map-tip-name'>
                {shownPrefecture
                  ? geoName(shownPrefecture, mapLang, {
                    countryCode: country.code,
                    level: "prefecture",
                  })
                  : ""}
              </span>
              <span className={`map-tip-count${(shownTicket?.count ?? 0) > 0 ? '' : ' is-zero'}`}>
                <TbPhoto size={13}/>
                {shownTicket?.count ?? 0}
              </span>
            </div>
          </div>
        </>
      }

      {
        loading &&
        <div className='map-loading'>
          <Spinner/>
        </div>
      }

      {/* the veil that turns the map into a background; clicking it goes back */}
      <div className='map-scrim' aria-hidden='true' onClick={() => backRef.current()}/>
    </div>
}
