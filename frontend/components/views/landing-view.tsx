"use client"

import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BarChart3, Newspaper, Crosshair, TrendingUp, Shield, Zap, ArrowRight, Radio, Database } from 'lucide-react'

// ─────────────────────────────────────────────
// DATA LAYER — Polymarket Gamma API, no backend
// ─────────────────────────────────────────────

const GAMMA = "https://gamma-api.polymarket.com"

interface PolyEvent {
  id: string
  title: string
  slug: string
  image: string
  volume: number
  volume24hr: number
  liquidity: number
  yesPrice: number
  noPrice: number
  category: string
}

function safeJSON(x: unknown): unknown[] {
  if (Array.isArray(x)) return x as unknown[]
  if (typeof x === 'string') { try { return JSON.parse(x) as unknown[] } catch { return [] } }
  return []
}

function detectCategory(title: string): string {
  const t = title.toLowerCase()
  if (/nfl|nba|nhl|mlb|ufc|tennis|f1|premier league|la liga|super bowl|playoff|championship|lakers|celtics|warriors|chiefs|eagles|cowboys|fight|bout|grand prix|grand slam|mvp|draft|world cup|serie a|bundesliga|match|game \d|round of/.test(t)) return 'sports'
  if (/bitcoin|btc|eth|ethereum|crypto|solana|defi|token|blockchain|halving/.test(t)) return 'crypto'
  if (/trump|biden|election|president|congress|senate|democrat|republican|governor|vote|executive order|impeach|cabinet|supreme court/.test(t)) return 'politics'
  if (/fed |rate cut|gdp|inflation|recession|treasury|stock|s&p|nasdaq|tariff|trade war|interest rate|cpi|unemployment/.test(t)) return 'economy'
  return 'other'
}

async function fetchPolymarketEvents(limit = 30): Promise<PolyEvent[]> {
  try {
    const res = await fetch(
      `${GAMMA}/events?active=true&limit=${limit}&order=volume24hr&ascending=false&closed=false`
    )
    if (!res.ok) return []
    const raw = await res.json() as Record<string, unknown>[]
    return raw
      .filter((e) => e.title && Array.isArray(e.markets) && (e.markets as unknown[]).length > 0)
      .map((e) => {
        const markets = e.markets as Record<string, unknown>[]
        const m = markets[0]
        const prices = safeJSON(m?.outcomePrices).map(Number)
        return {
          id: String(e.id ?? ''),
          title: String(e.title ?? ''),
          slug: String(e.slug ?? ''),
          image: String(e.image ?? e.icon ?? ''),
          volume: parseFloat(String(e.volume ?? '0')),
          volume24hr: parseFloat(String(e.volume24hr ?? '0')),
          liquidity: parseFloat(String(e.liquidity ?? '0')),
          yesPrice: prices[0] ?? 0,
          noPrice: prices[1] ?? 0,
          category: detectCategory(String(e.title ?? '')),
        }
      })
  } catch { return [] }
}

function fmtVol(v: number): string {
  return v >= 1e9 ? `${(v/1e9).toFixed(1)}B`
    : v >= 1e6 ? `${(v/1e6).toFixed(1)}M`
    : v >= 1e3 ? `${(v/1e3).toFixed(0)}K`
    : `${v.toFixed(0)}`
}

function likelihood(y: number): { label: string; color: string } {
  const p = y * 100
  if (p >= 85) return { label: 'VERY LIKELY', color: '#00FF88' }
  if (p >= 65) return { label: 'LIKELY', color: '#00FF88' }
  if (p >= 45) return { label: 'TOSS-UP', color: '#777777' }
  if (p >= 25) return { label: 'UNLIKELY', color: '#FF3344' }
  return { label: 'VERY UNLIKELY', color: '#FF3344' }
}

// ─────────────────────────────────────────────
// GLSL SHADERS
// ─────────────────────────────────────────────

const VERTEX_SHADER = `
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform vec2 uMouse;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vDisplacement;
varying float vElevation;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main() {
  float n1 = snoise(position * uFrequency + uTime * 0.25) * uAmplitude;
  float n2 = snoise(position * uFrequency * 2.2 + uTime * 0.4) * uAmplitude * 0.35;
  float n3 = snoise(position * uFrequency * 4.5 + uTime * 0.12) * uAmplitude * 0.12;
  float mouseEffect = dot(normalize(position.xy), uMouse) * 0.08;
  float displacement = n1 + n2 + n3 + mouseEffect;
  vec3 newPos = position + normal * displacement;
  vNormal = normalize(normalMatrix * normal);
  vViewPosition = (modelViewMatrix * vec4(newPos, 1.0)).xyz;
  vDisplacement = displacement;
  vElevation = n1;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
`

const FRAGMENT_SHADER = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vDisplacement;
varying float vElevation;

void main() {
  vec3 viewDir = normalize(-vViewPosition);
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.5);
  float baseBrightness = 0.015 + smoothstep(-0.2, 0.4, vDisplacement) * 0.06;
  vec3 baseColor = vec3(baseBrightness);
  vec3 deepColor = vec3(0.0, 0.02, 0.03);
  baseColor = mix(deepColor, baseColor, smoothstep(-0.3, 0.1, vElevation));
  vec3 glowColor = vec3(0.7, 0.8, 1.0);
  float ridge = smoothstep(0.2, 0.25, vDisplacement) * smoothstep(0.35, 0.25, vDisplacement);
  vec3 ridgeColor = vec3(0.0, 1.0, 0.53) * ridge * 0.15;
  vec3 finalColor = baseColor + glowColor * fresnel * 0.5 + ridgeColor;
  float alpha = 0.85 + fresnel * 0.15;
  gl_FragColor = vec4(finalColor, alpha);
}
`

// ─────────────────────────────────────────────
// CUSTOM CURSOR
// ─────────────────────────────────────────────

function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })
  const hovered = useRef(false)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove)

    let raf: number
    const loop = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.1
      pos.current.y += (target.current.y - pos.current.y) * 0.1
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${target.current.x - 3}px, ${target.current.y - 3}px)`
      }
      if (ringRef.current) {
        const scale = hovered.current ? 2.5 : 1
        ringRef.current.style.transform = `translate(${pos.current.x - 20}px, ${pos.current.y - 20}px) scale(${scale})`
      }
      raf = requestAnimationFrame(loop)
    }
    loop()

    const onEnter = () => { hovered.current = true }
    const onLeave = () => { hovered.current = false }
    const interactives = document.querySelectorAll('a, button, [data-hover]')
    interactives.forEach(el => {
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
    })

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
      interactives.forEach(el => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
      })
    }
  }, [])

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-white rounded-full pointer-events-none z-[9999] hidden md:block"
        style={{ willChange: 'transform' }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-10 h-10 border border-white/20 rounded-full pointer-events-none z-[9999] mix-blend-difference hidden md:block"
        style={{ willChange: 'transform', transition: 'transform 0.15s cubic-bezier(0.22, 0.61, 0.36, 1)' }}
      />
    </>
  )
}

// ─────────────────────────────────────────────
// WORD REVEAL
// ─────────────────────────────────────────────

function WordReveal({
  text, active, className, delay = 0
}: {
  text: string; active: boolean; className?: string; delay?: number
}) {
  return (
    <span className={className}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.3em]">
          <span
            className="inline-block"
            style={{
              transitionProperty: 'transform, opacity',
              transitionDuration: '0.6s',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: `${delay + i * 50}ms`,
              transform: active ? 'translateY(0)' : 'translateY(110%)',
              opacity: active ? 1 : 0,
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────
// SCROLL REVEAL HOOK
// ─────────────────────────────────────────────

function useReveal(type: 'fade' | 'clip' | 'slide' = 'fade', delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => setVisible(true), delay)
        obs.disconnect()
      }
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])

  const styleMap: Record<string, React.CSSProperties> = {
    fade: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(50px)',
      transition: 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    clip: {
      clipPath: visible ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)',
      transition: 'clip-path 1.4s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    slide: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(-60px)',
      transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
    },
  }

  return { ref, style: styleMap[type] }
}

// ─────────────────────────────────────────────
// ANIMATED NUMBER
// ─────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let current = 0
        const step = Math.max(1, Math.ceil(value / 40))
        const iv = setInterval(() => {
          current += step
          if (current >= value) { setDisplay(value); clearInterval(iv) }
          else setDisplay(current)
        }, 25)
        obs.disconnect()
      }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])

  return (
    <span ref={ref} style={{ fontFamily: 'IBM Plex Mono' }}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  )
}

// ─────────────────────────────────────────────
// EVENT CARD
// ─────────────────────────────────────────────

function EventCard({ event, index }: { event: PolyEvent; index: number }) {
  const yesPct = Math.round(event.yesPrice * 100)
  const noPct = 100 - yesPct
  const lk = likelihood(event.yesPrice)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 70 + 200)
    return () => clearTimeout(t)
  }, [index])

  return (
    <a
      href={`https://polymarket.com/event/${event.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#050505] border border-[#0F0F0F] p-5 group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget as HTMLElement
        t.style.transform = 'translateY(-4px)'
        t.style.borderColor = '#1A1A1A'
        t.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget as HTMLElement
        t.style.transform = 'translateY(0)'
        t.style.borderColor = '#0F0F0F'
        t.style.boxShadow = 'none'
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        {event.image && (
          <img
            src={event.image}
            alt=""
            className="w-12 h-12 object-cover flex-shrink-0 bg-[#0A0A0A]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-white leading-snug line-clamp-2 group-hover:text-white/80"
            style={{ fontFamily: 'Syne', fontWeight: 500, fontSize: 14, letterSpacing: '-0.01em' }}
          >
            {event.title}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, letterSpacing: '0.2em', color: lk.color }}>
              {lk.label}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#444' }}>•</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: lk.color }}>
              {yesPct}%
            </span>
          </div>
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#444' }} className="flex-shrink-0">↗</span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#00FF88' }}>YES {yesPct}¢</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#FF3344' }}>NO {noPct}¢</span>
        </div>
        <div className="w-full h-1 bg-[#FF3344]/15 overflow-hidden">
          <div
            className="h-full bg-[#00FF88]"
            style={{
              width: `${yesPct}%`,
              boxShadow: '0 0 8px rgba(0, 255, 136, 0.2)',
              transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
          {fmtVol(event.volume)} VOL
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
          {fmtVol(event.volume24hr)} 24H
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
          {fmtVol(event.liquidity)} LIQ
        </span>
      </div>
    </a>
  )
}

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-[#050505] border border-[#0F0F0F] p-5 animate-pulse">
      <div className="flex gap-3 mb-4">
        <div className="w-12 h-12 bg-[#0A0A0A] flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-[#0A0A0A] w-3/4 mb-2" />
          <div className="h-3 bg-[#0A0A0A] w-1/3" />
        </div>
      </div>
      <div className="h-1 bg-[#0A0A0A] mb-3" />
      <div className="h-3 bg-[#0A0A0A] w-1/2" />
    </div>
  )
}

// ─────────────────────────────────────────────
// COUNCIL CONFIG
// ─────────────────────────────────────────────

const COUNCIL_AGENTS = [
  { icon: BarChart3, name: 'FUNDAMENTALS', desc: 'Orderbook depth, volume flow, liquidity analysis', color: '#00FF88', doomer: false },
  { icon: Newspaper, name: 'SENTIMENT', desc: 'News feeds, social media, public opinion', color: '#777777', doomer: false },
  { icon: Crosshair, name: 'SNIPER', desc: 'Price microstructure, momentum, mean reversion', color: '#777777', doomer: false },
  { icon: TrendingUp, name: 'NARRATIVE', desc: 'Viral potential, upcoming catalysts, trend analysis', color: '#777777', doomer: false },
  { icon: Shield, name: 'DOOMER', desc: 'Risk detection. Finds reasons to NOT trade. Has veto power.', color: '#FF3344', doomer: true },
]

const HOW_IT_WORKS = [
  { num: '01', icon: Database, title: 'COLLECT', desc: 'Polymarket CLOB API, news feeds, social sentiment. 30-second refresh cycle. No data gaps.' },
  { num: '02', icon: Zap, title: 'ANALYZE', desc: '5 AI agents debate every market independently. The Doomer agent vetoes bad trades. Judge decides.' },
  { num: '03', icon: ArrowRight, title: 'SIGNAL', desc: 'Edge %, Kelly-criterion sizing. Every prediction logged publicly. Zero exceptions.' },
]

const CATEGORIES = ['ALL', 'POLITICS', 'CRYPTO', 'SPORTS', 'ECONOMY']

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─────────────────────────────────────────────
// MAIN LANDING VIEW
// ─────────────────────────────────────────────

export function LandingView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [events, setEvents] = useState<PolyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadPhase, setLoadPhase] = useState(0)
  const [activeCategory, setActiveCategory] = useState('ALL')

  // Three.js refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseX = useRef(0)
  const mouseY = useRef(0)
  const scrollYRef = useRef(0)

  // Section reveal hooks — all at top level
  const marketsReveal = useReveal('clip')
  const howItWorksReveal = useReveal('fade')
  const councilReveal = useReveal('slide')
  const trackRecordReveal = useReveal('fade')

  // ── Data fetch ──
  useEffect(() => {
    fetchPolymarketEvents(30)
      .then((data) => { setEvents(data); setLoading(false) })
      .catch(() => setLoading(false))
    const iv = setInterval(() => {
      fetchPolymarketEvents(30).then(setEvents).catch(() => {})
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  // ── Load phase orchestration ──
  useEffect(() => {
    const timers = [
      setTimeout(() => setLoadPhase(1), 300),
      setTimeout(() => setLoadPhase(2), 700),
      setTimeout(() => setLoadPhase(3), 900),
      setTimeout(() => setLoadPhase(4), 1500),
      setTimeout(() => setLoadPhase(5), 1900),
      setTimeout(() => setLoadPhase(6), 2500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // ── Scroll tracking ──
  useEffect(() => {
    const onScroll = () => { scrollYRef.current = window.scrollY }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Mouse tracking (normalized -1..1) ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.current = (e.clientX / window.innerWidth) * 2 - 1
      mouseY.current = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // ── THREE.JS SCENE ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let destroyed = false
    const W = () => window.innerWidth
    const H = () => window.innerHeight

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W(), H())
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 100)
    camera.position.z = 8

    // ── Morphing Sphere ──
    const sphereGeo = new THREE.IcosahedronGeometry(2.8, 5)
    const sphereMat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0.35 },
        uFrequency: { value: 1.8 },
        uMouse: { value: new THREE.Vector2(0, 0) },
      },
      transparent: true,
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.x = 2.5
    scene.add(sphere)

    // ── Orbital Particles ──
    const ORBIT_COUNT = 1500
    const orbitGeo = new THREE.BufferGeometry()
    const orbitPos = new Float32Array(ORBIT_COUNT * 3)
    const orbitRadii = new Float32Array(ORBIT_COUNT)
    const orbitSpeeds = new Float32Array(ORBIT_COUNT)
    const orbitAngles = new Float32Array(ORBIT_COUNT)

    for (let i = 0; i < ORBIT_COUNT; i++) {
      orbitRadii[i] = 4 + Math.random() * 8
      orbitAngles[i] = Math.random() * Math.PI * 2
      orbitSpeeds[i] = 0.05 + Math.random() * 0.15
      const r = orbitRadii[i]
      const a = orbitAngles[i]
      const tilt = (Math.random() - 0.5) * 2
      orbitPos[i * 3] = Math.cos(a) * r + 2.5
      orbitPos[i * 3 + 1] = tilt * 3 + Math.sin(a * 3) * 0.5
      orbitPos[i * 3 + 2] = Math.sin(a) * r
    }
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3))
    const orbitMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.025,
      transparent: true,
      opacity: 0.25,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const orbitParticles = new THREE.Points(orbitGeo, orbitMat)
    scene.add(orbitParticles)

    function updateOrbits(t: number) {
      const posAttr = orbitGeo.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < ORBIT_COUNT; i++) {
        orbitAngles[i] += orbitSpeeds[i] * 0.001
        const r = orbitRadii[i]
        const a = orbitAngles[i]
        arr[i * 3] = Math.cos(a + t * 0.02) * r + 2.5
        arr[i * 3 + 2] = Math.sin(a + t * 0.02) * r
      }
      posAttr.needsUpdate = true
    }

    // ── Neural Network ──
    const NET_NODES = 60
    const netPos = new Float32Array(NET_NODES * 3)
    for (let i = 0; i < NET_NODES; i++) {
      netPos[i * 3] = (Math.random() - 0.5) * 20 + 2.5
      netPos[i * 3 + 1] = (Math.random() - 0.5) * 20
      netPos[i * 3 + 2] = (Math.random() - 0.5) * 12
    }
    const edges: number[] = []
    for (let i = 0; i < NET_NODES; i++) {
      for (let j = i + 1; j < NET_NODES; j++) {
        const d = Math.hypot(
          netPos[i * 3] - netPos[j * 3],
          netPos[i * 3 + 1] - netPos[j * 3 + 1],
          netPos[i * 3 + 2] - netPos[j * 3 + 2]
        )
        if (d < 5) edges.push(i, j)
      }
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(netPos, 3))
    lineGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(edges), 1))
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.03,
      blending: THREE.AdditiveBlending,
    })
    const network = new THREE.LineSegments(lineGeo, lineMat)
    scene.add(network)

    // ── Planetary Rings ──
    for (let ring = 0; ring < 3; ring++) {
      const radius = 4.5 + ring * 1.5
      const ringGeo = new THREE.RingGeometry(radius, radius + 0.015, 128)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true,
        opacity: 0.04 + ring * 0.01,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      ringMesh.rotation.x = Math.PI / 2 + (ring - 1) * 0.3
      ringMesh.rotation.z = ring * 0.2
      ringMesh.position.x = 2.5
      scene.add(ringMesh)
    }

    // ── Post-processing (optional, dynamic import) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let composer: any = null
    let useComposer = false

    ;(async () => {
      try {
        const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
        const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js')
        const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
        if (destroyed) return
        composer = new EffectComposer(renderer)
        composer.addPass(new RenderPass(scene, camera))
        const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.25, 0.6, 0.9)
        composer.addPass(bloom)
        useComposer = true
      } catch {
        // fallback: no bloom
      }
    })()

    // ── Animation Loop ──
    const clock = new THREE.Clock()

    function animate() {
      if (destroyed) return
      requestAnimationFrame(animate)

      const t = clock.getElapsedTime()
      const scrollPct = Math.min(scrollYRef.current / (H() * 2), 1)

      sphereMat.uniforms.uTime.value = t
      sphereMat.uniforms.uMouse.value.set(mouseX.current, mouseY.current)
      sphere.rotation.y = t * 0.1
      sphere.position.y = -scrollPct * 4
      sphere.scale.setScalar(Math.max(0.1, 1 - scrollPct * 0.3))

      updateOrbits(t)
      orbitParticles.rotation.y = t * 0.008
      network.rotation.y = t * 0.006
      network.rotation.x = t * 0.002

      camera.position.x += (mouseX.current * 1.2 - camera.position.x) * 0.015
      camera.position.y += (-mouseY.current * 0.8 - camera.position.y) * 0.015
      camera.lookAt(0, 0, 0)

      const opacity = Math.max(0, 1 - scrollPct * 0.8)
      canvas!.style.opacity = (opacity * 0.5).toString()

      if (useComposer && composer) {
        composer.render()
      } else {
        renderer.render(scene, camera)
      }
    }
    animate()

    // ── Resize ──
    function onResize() {
      renderer.setSize(W(), H())
      camera.aspect = W() / H()
      camera.updateProjectionMatrix()
      if (composer) composer.setSize(W(), H())
    }
    window.addEventListener('resize', onResize)

    return () => {
      destroyed = true
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      sphereGeo.dispose()
      sphereMat.dispose()
      orbitGeo.dispose()
      orbitMat.dispose()
      lineGeo.dispose()
      lineMat.dispose()
    }
  }, [])

  const filtered = activeCategory === 'ALL'
    ? events
    : events.filter(e => e.category === activeCategory.toLowerCase())

  const totalVolume = events.reduce((s, e) => s + e.volume, 0)
  const totalLiquidity = events.reduce((s, e) => s + e.liquidity, 0)

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[9998] opacity-[0.015]"
        style={{ backgroundImage: GRAIN_SVG, backgroundRepeat: 'repeat', backgroundSize: '512px', mixBlendMode: 'overlay' }}
      />

      <CustomCursor />

      {/* 3D Canvas — fixed background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 1.5s ease' }}
      />

      {/* ─── SECTION 1: HERO ─── */}
      <section className="relative min-h-screen flex items-center z-10">
        <div className="w-full px-8 md:px-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="pt-20 md:pt-0">
            {/* LIVE badge */}
            <div
              className="inline-flex items-center gap-2 mb-10 px-3 py-1.5 border border-[#0F0F0F] bg-[#050505]"
              style={{
                opacity: loadPhase >= 2 ? 1 : 0,
                transform: loadPhase >= 2 ? 'translateY(0)' : 'translateY(-20px)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, letterSpacing: '0.2em', color: '#777' }}>
                LIVE • {events.length > 0 ? `${events.length} MARKETS` : 'CONNECTING...'}
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: 'Syne',
                fontWeight: 800,
                fontSize: 'clamp(3.5rem, 9vw, 8.5rem)',
                letterSpacing: '-0.04em',
                lineHeight: 0.9,
                marginBottom: '2rem',
              }}
            >
              <WordReveal text="The edge" active={loadPhase >= 3} />
              <br />
              <WordReveal text="is in the" active={loadPhase >= 3} delay={200} className="text-[#777]" />
              <br />
              <WordReveal text="data." active={loadPhase >= 3} delay={400} className="text-[#777]" />
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: 'Syne',
                fontSize: 15,
                color: '#777',
                lineHeight: 1.7,
                maxWidth: 380,
                marginBottom: '2.5rem',
                opacity: loadPhase >= 4 ? 1 : 0,
                transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              5 AI agents analyze every market. They vote.
              <br />
              One exists to say no.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap gap-4"
              style={{
                opacity: loadPhase >= 5 ? 1 : 0,
                transform: loadPhase >= 5 ? 'translateY(0)' : 'translateY(30px)',
                transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <a
                href="#markets"
                className="inline-block bg-white text-black px-7 py-3.5"
                style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, letterSpacing: '0.15em' }}
                data-hover
              >
                EXPLORE MARKETS
              </a>
              <button
                onClick={() => onNavigate?.('council')}
                className="inline-block border border-[#1A1A1A] text-[#777] px-7 py-3.5"
                style={{
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 13,
                  letterSpacing: '0.15em',
                  transition: 'all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = '#333'
                  el.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.borderColor = '#1A1A1A'
                  el.style.color = '#777'
                }}
                data-hover
              >
                THE COUNCIL
              </button>
            </div>
          </div>

          {/* Right: space for 3D canvas */}
          <div className="hidden md:block h-[60vh]" />
        </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-scroll-hint flex flex-col items-center gap-2"
          style={{
            opacity: loadPhase >= 6 ? 0.3 : 0,
            transition: 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: '0.25em', color: '#444' }}>SCROLL</span>
          <ArrowRight style={{ transform: 'rotate(90deg)', color: '#333' }} size={12} />
        </div>
      </section>

      {/* ─── SECTION 2: TICKER + STATS ─── */}
      <section className="relative z-10 border-t border-[#0F0F0F]">
        {events.length > 0 && (
          <div className="overflow-hidden border-b border-[#0F0F0F] py-3">
            <div className="flex animate-scroll-x whitespace-nowrap" style={{ width: 'max-content' }}>
              {[...events, ...events].map((e, i) => {
                const pct = Math.round(e.yesPrice * 100)
                return (
                  <span key={i} className="inline-flex items-center gap-3 px-6">
                    <span style={{ fontFamily: 'Syne', fontWeight: 500, fontSize: 12, color: '#444' }}
                      className="truncate max-w-[180px] inline-block">
                      {e.title}
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: pct >= 50 ? '#00FF88' : '#FF3344' }}>
                      {pct}¢
                    </span>
                    <span className="text-[#0F0F0F]">│</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 bg-[#0F0F0F]" style={{ gap: 1 }}>
          {[
            { num: events.length, label: 'MARKETS TRACKED', prefix: '', suffix: '' },
            { num: Math.max(1, Math.round(totalVolume / 1e6)), label: 'VOLUME ANALYZED', prefix: '$', suffix: 'M' },
            { num: 5, label: 'AI AGENTS IN COUNCIL', prefix: '', suffix: '' },
            { num: Math.max(1, Math.round(totalLiquidity / 1e6)), label: 'LIQUIDITY MONITORED', prefix: '$', suffix: 'M' },
          ].map((s, i) => (
            <div key={i} className="bg-[#050505] py-8 px-6 text-center">
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: '#fff' }}>
                {s.num > 0
                  ? <AnimatedNumber value={s.num} prefix={s.prefix} suffix={s.suffix} />
                  : <span>—</span>
                }
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#333', letterSpacing: '0.25em', marginTop: 8 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SECTION 3: LIVE MARKETS ─── */}
      <section id="markets" className="relative z-10 px-8 md:px-20 py-24">
        <div ref={marketsReveal.ref} style={marketsReveal.style}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-6">
            <div>
              <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                Live Markets
              </h2>
              <p style={{ fontFamily: 'Syne', fontSize: 15, color: '#555', marginTop: 8, lineHeight: 1.7 }}>
                Real-time data. Every card links to the real market on Polymarket.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    fontFamily: 'IBM Plex Mono',
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    padding: '6px 14px',
                    border: `1px solid ${activeCategory === cat ? '#333' : '#0F0F0F'}`,
                    color: activeCategory === cat ? '#fff' : '#444',
                    background: activeCategory === cat ? '#0A0A0A' : 'transparent',
                    transition: 'all 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.slice(0, 12).map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Radio size={24} style={{ color: '#222', margin: '0 auto 12px' }} />
              <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#333', letterSpacing: '0.2em' }}>
                NO {activeCategory} MARKETS TRACKED
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── SECTION 4: HOW IT WORKS ─── */}
      <section className="relative z-10 px-8 md:px-20 py-28 border-t border-[#0F0F0F]">
        <div ref={howItWorksReveal.ref} style={howItWorksReveal.style}>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '3rem' }}>
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div
              className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px"
              style={{ background: 'linear-gradient(90deg, transparent, #0F0F0F 20%, #0F0F0F 80%, transparent)' }}
            />
            {HOW_IT_WORKS.map((s, i) => (
              <div
                key={s.num}
                className="bg-[#050505] border border-[#0F0F0F] p-8 relative"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div className="absolute top-8 right-8" style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 48, color: '#1A1A1A', lineHeight: 1 }}>
                  {s.num}
                </div>
                <s.icon size={20} style={{ color: '#555', marginBottom: 20 }} />
                <h3 style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.2em', color: '#fff', marginBottom: 12 }}>
                  {s.title}
                </h3>
                <p style={{ fontFamily: 'Syne', fontSize: 14, color: '#555', lineHeight: 1.7 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: THE COUNCIL ─── */}
      <section className="relative z-10 px-8 md:px-20 py-28 border-t border-[#0F0F0F]">
        <div ref={councilReveal.ref} style={councilReveal.style}>
          <div className="mb-12">
            <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 12 }}>
              The Council
            </h2>
            <p style={{ fontFamily: 'Syne', fontSize: 15, color: '#555', lineHeight: 1.7, maxWidth: 480 }}>
              Every signal passes through 5 independent agents. They don&apos;t agree with each other. That&apos;s the point.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {COUNCIL_AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="p-5 border flex flex-col gap-3"
                style={{
                  background: agent.doomer ? 'rgba(255,51,68,0.02)' : '#050505',
                  borderColor: agent.doomer ? 'rgba(255,51,68,0.15)' : '#0F0F0F',
                  boxShadow: agent.doomer ? '0 0 30px rgba(255,51,68,0.05)' : 'none',
                  transition: 'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), border-color 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'
                  e.currentTarget.style.borderColor = agent.doomer ? 'rgba(255,51,68,0.30)' : '#1A1A1A'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.borderColor = agent.doomer ? 'rgba(255,51,68,0.15)' : '#0F0F0F'
                }}
              >
                <agent.icon size={20} style={{ color: agent.color }} />
                <div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, letterSpacing: '0.2em', color: agent.doomer ? '#FF3344' : '#fff', marginBottom: 4 }}>
                    {agent.name}
                  </div>
                  {agent.doomer && (
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,51,68,0.5)', marginBottom: 6 }}>
                      HAS VETO POWER
                    </div>
                  )}
                  <p style={{ fontFamily: 'Syne', fontSize: 11, color: '#444', lineHeight: 1.6 }}>
                    {agent.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: 'Syne', fontStyle: 'italic', fontSize: 13, color: '#2A2A2A', textAlign: 'center', marginTop: 40, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            &ldquo;The Doomer exists to kill bad trades. If it can&apos;t find a reason to say no, the signal is strong.&rdquo;
          </p>
        </div>
      </section>

      {/* ─── SECTION 6: TRACK RECORD ─── */}
      <section className="relative z-10 px-8 md:px-20 py-24 border-t border-[#0F0F0F] min-h-[50vh] flex items-center">
        <div ref={trackRecordReveal.ref} style={trackRecordReveal.style} className="w-full">
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: '#fff', marginBottom: 8 }}>
            Public track record.
          </h2>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: '#1A1A1A', marginBottom: 40 }}>
            Coming soon.
          </p>

          <div className="grid grid-cols-3 gap-px max-w-lg" style={{ background: '#0F0F0F' }}>
            {[['—', 'TRADES'], ['—', 'WIN %'], ['—', 'P&L']].map(([val, lbl], i) => (
              <div key={i} className="bg-[#050505] py-8 px-6 text-center">
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 28, color: '#1A1A1A' }}>{val}</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#1A1A1A', letterSpacing: '0.25em', marginTop: 8 }}>{lbl}</div>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: 'Syne', fontSize: 14, color: '#333', marginTop: 24, lineHeight: 1.7, maxWidth: 400 }}>
            First predictions go live this week.
            <br />
            Every result published. Zero exceptions.
          </p>
        </div>
      </section>

      {/* ─── SECTION 7: CTA ─── */}
      <section
        className="relative z-10 px-8 md:px-20 py-20 border-t border-[#0F0F0F] text-center"
        style={{ minHeight: '30vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <a
          href="#markets"
          className="inline-block bg-white text-black px-10 py-4 mb-6"
          style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, letterSpacing: '0.2em', fontWeight: 500 }}
          data-hover
        >
          VIEW LIVE MARKETS →
        </a>
        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#1A1A1A', letterSpacing: '0.3em' }}>
          NOT FINANCIAL ADVICE
        </p>
      </section>

      {/* ─── SECTION 8: FOOTER ─── */}
      <footer className="relative z-10 px-8 md:px-20 py-12 border-t border-[#0F0F0F]">
        <div className="flex flex-col md:flex-row md:justify-between gap-8">
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#fff', marginBottom: 8 }}>
              BLACK EDGE
            </div>
            <p style={{ fontFamily: 'Syne', fontSize: 13, color: '#333', maxWidth: 240, lineHeight: 1.6 }}>
              Prediction market intelligence.
            </p>
            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#1A1A1A', letterSpacing: '0.15em', marginTop: 20 }}>
              © 2026 BLACK EDGE
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-3">
            {[
              ['Home', '#'],
              ['Markets', '#markets'],
              ['Terms', '/terms'],
              ['Privacy', '/privacy'],
              ['Risk Disclosure', '/risk-disclosure'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#333', letterSpacing: '0.15em', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#777' }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#333' }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
