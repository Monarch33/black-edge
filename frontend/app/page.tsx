"use client"

import { useEffect, useState, useRef } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useDisconnect } from "wagmi"
import { useRouter } from "next/navigation"
import { AccessModal } from "@/components/access-modal"

const MARKETS = [
  { name: "Federal Reserve Rate Cut — Q3 2025", cat: "economy", prob: 67, delta: 3.2, vol: "$4.2M", kelly: "+8.1%", badge: "live" },
  { name: "Bitcoin above $120K by End of 2025", cat: "crypto", prob: 41, delta: -1.8, vol: "$8.7M", kelly: "+5.3%", badge: "hot" },
  { name: "US Recession in 2025", cat: "economy", prob: 28, delta: 0.5, vol: "$2.1M", kelly: "+3.7%", badge: "live" },
  { name: "GPT-5 Release Before Q2 2025", cat: "crypto", prob: 55, delta: 7.4, vol: "$1.6M", kelly: "+11.2%", badge: "new" },
  { name: "Ethereum ETF Approval 2025", cat: "crypto", prob: 73, delta: 2.1, vol: "$5.3M", kelly: "+14.3%", badge: "hot" },
  { name: "Trump Signs Crypto Executive Order", cat: "politics", prob: 84, delta: 1.2, vol: "$3.8M", kelly: "+6.9%", badge: "live" },
  { name: "Democratic Primary Challenger 2028", cat: "politics", prob: 32, delta: -0.7, vol: "$1.1M", kelly: "+2.1%", badge: "live" },
  { name: "NFL Super Bowl LX Winner", cat: "sports", prob: 18, delta: 0.4, vol: "$0.9M", kelly: "+1.8%", badge: "live" },
  { name: "NBA Championship — East Wins", cat: "sports", prob: 52, delta: -2.3, vol: "$2.4M", kelly: "+4.2%", badge: "hot" },
]

const LOGS = [
  ["BOOT", "Initializing BLACK EDGE Terminal v3.0..."],
  ["NET", "Connecting to Polymarket CLOB API..."],
  ["AI", "Loading Council agents [5/5]..."],
  ["SEC", "Verifying cryptographic keys..."],
  ["DATA", "Fetching live market orderbook..."],
  ["AI", "Calibrating Sentiment Scanner..."],
  ["AI", "Doomer Agent armed and ready..."],
  ["SYS", "WebGL renderer initialized..."],
  ["OK", "The Edge is ready."],
]

const WC = [
  { w: "BULLISH", s: 18, o: 0.85 }, { w: "HEDGE", s: 11, o: 0.4 }, { w: "ALPHA", s: 16, o: 0.75 },
  { w: "VOLATILITY", s: 10, o: 0.35 }, { w: "OVERBET", s: 13, o: 0.5 }, { w: "FOMO", s: 14, o: 0.55 },
  { w: "EDGE", s: 20, o: 0.9 }, { w: "NOISE", s: 10, o: 0.3 }, { w: "SIGNAL", s: 15, o: 0.65 },
  { w: "LIQUIDITY", s: 11, o: 0.4 }, { w: "GAMMA", s: 12, o: 0.45 }, { w: "PANIC", s: 13, o: 0.5 },
  { w: "ASYMMETRY", s: 12, o: 0.55 }, { w: "BETA", s: 10, o: 0.3 },
]

export default function Home() {
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const [accessModalTier, setAccessModalTier] = useState<"pro" | "whale">("pro")
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const walletMenuRef = useRef<HTMLDivElement>(null)

  // Fermer le menu wallet en cliquant ailleurs
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    let activeFilter = "all"
    const marketsData = [...MARKETS]

    // Cursor
    const ring = document.getElementById("cursor-ring")
    const dot = document.getElementById("cursor-dot")
    const lbl = document.getElementById("cursor-label")
    let mx = 0, my = 0, rx = 0, ry = 0

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      if (dot) {
        dot.style.left = mx + "px"
        dot.style.top = my + "px"
      }
    }
    document.addEventListener("mousemove", onMouseMove)

    function animCursor() {
      rx += (mx - rx) * 0.12
      ry += (my - ry) * 0.12
      if (ring) {
        ring.style.left = rx + "px"
        ring.style.top = ry + "px"
      }
      if (lbl) {
        lbl.style.left = rx + "px"
        lbl.style.top = ry + "px"
      }
      requestAnimationFrame(animCursor)
    }
    animCursor()

    const hoverEls = document.querySelectorAll("a, button, .mcard, .agent, .pcard, .hiw-card, .tr-stat, .ksig")
    hoverEls.forEach((el) => {
      el.addEventListener("mouseenter", () => ring?.classList.add("big"))
      el.addEventListener("mouseleave", () => ring?.classList.remove("big"))
    })

    const orbWrap = document.getElementById("orb-wrap")
    orbWrap?.addEventListener("mouseenter", () => {
      if (lbl) {
        lbl.textContent = "SCAN DATA"
        lbl.style.opacity = "1"
      }
    })
    orbWrap?.addEventListener("mouseleave", () => {
      if (lbl) lbl.style.opacity = "0"
    })

    // Preloader
    const preCount = document.getElementById("pre-count")
    const preFill = document.getElementById("pre-fill")
    const preLog = document.getElementById("pre-log")
    let pct = 0
    const PI = setInterval(() => {
      pct++
      if (preCount) preCount.textContent = String(pct).padStart(2, "0")
      if (preFill) preFill.style.width = pct + "%"
      const li = Math.floor(pct / 11)
      if (LOGS[li] && preLog) {
        const [t, m] = LOGS[li]
        preLog.innerHTML = `[ <span>${t}</span> ] ${m}`
      }
      if (pct >= 100) {
        clearInterval(PI)
        setTimeout(() => {
          document.getElementById("preloader")?.classList.add("out")
          document.getElementById("app")?.classList.add("show")
          initPage()
        }, 300)
      }
    }, 20)

    function pad(n: number) {
      return String(n).padStart(2, "0")
    }
    function clock() {
      const n = new Date()
      const t = `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} UTC`
      const el = document.getElementById("t-time")
      if (el) el.textContent = t
    }
    setInterval(clock, 1000)

    function buildMarkets() {
      const grid = document.getElementById("markets-grid")
      if (!grid) return
      const filtered = activeFilter === "all" ? marketsData : marketsData.filter((m) => m.cat === activeFilter)
      grid.innerHTML = ""
      filtered.forEach((m, i) => {
        const updown = m.delta >= 0
        const idx = marketsData.indexOf(m)
        const card = document.createElement("div")
        card.className = "mcard"
        card.innerHTML = `
          <div class="mcard-top">
            <span class="mcard-category cat-${m.cat}">${m.cat.toUpperCase()}</span>
            <div class="status-pulse"><div class="spulse"></div>LIVE</div>
          </div>
          <div class="mcard-name">${m.name}</div>
          <div class="mcard-prob-row">
            <div class="mcard-prob ${updown ? "yes" : "no"}" data-idx="${idx}">${Math.round(m.prob)}%</div>
            <div class="mcard-prob-label">YES</div>
          </div>
          <div class="mcard-bar"><div class="mcard-bar-fill" style="width:${m.prob}%"></div></div>
          <div class="mcard-meta">
            <span class="mcard-delta ${updown ? "pos" : "neg"}">${updown ? "+" : ""}${m.delta.toFixed(1)}%</span>
            <span class="mcard-vol">VOL ${m.vol}</span>
            <span style="color:var(--em);font-size:9px">KELLY ${m.kelly}</span>
          </div>`
        grid.appendChild(card)
      })
    }

    document.getElementById("filters")?.addEventListener("click", (e) => {
      const tab = (e.target as HTMLElement).closest(".ftab")
      if (!tab) return
      document.querySelectorAll(".ftab").forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      activeFilter = (tab as HTMLElement).dataset.cat || "all"
      buildMarkets()
    })

    const T_MARKETS = marketsData.slice(0, 6)
    function buildTerminal() {
      const tbody = document.getElementById("t-body")
      if (!tbody) return
      tbody.innerHTML = ""
      T_MARKETS.forEach((m) => {
        const ud = m.delta >= 0
        const tr = document.createElement("tr")
        tr.innerHTML = `
          <td class="tname">${m.name}</td>
          <td class="tprob ${ud ? "up" : "dn"}" data-name="${m.name}">${Math.round(m.prob)}%</td>
          <td class="tdelta ${ud ? "pos" : "neg"}">${ud ? "+" : ""}${m.delta.toFixed(1)}%</td>
          <td class="tvol">${m.vol}</td>
          <td style="color:var(--em);font-size:11px">${m.kelly}</td>
          <td><span class="tbadge tbadge-${m.badge}">${m.badge.toUpperCase()}</span></td>
        `
        tbody.appendChild(tr)
      })
    }

    function buildTicker() {
      const inner = document.getElementById("ticker-inner")
      if (!inner) return
      const src = marketsData
        .map(
          (m) => `
        <div class="ticker-item">
          <span class="name">${m.name.substring(0, 30)}${m.name.length > 30 ? "…" : ""}</span>
          <span class="prob ${m.delta >= 0 ? "up" : "dn"}">${Math.round(m.prob)}%</span>
          <span class="${m.delta >= 0 ? "up" : "dn"}">${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(1)}%</span>
          <span class="ticker-sep">|</span>
        </div>`
        )
        .join("")
      inner.innerHTML = src + src
    }

    buildMarkets()
    buildTerminal()
    buildTicker()

    setInterval(() => {
      marketsData.forEach((m) => {
        m.prob = Math.max(4, Math.min(96, m.prob + (Math.random() - 0.48) * 0.9))
        m.delta = +(m.delta + (Math.random() - 0.5) * 0.25).toFixed(1)
      })
      document.querySelectorAll(".mcard-prob").forEach((el) => {
        const idx = +(el as HTMLElement).dataset.idx!
        if (isNaN(idx)) return
        const m = marketsData[idx]
        if (!m) return
        const nv = Math.round(m.prob) + "%"
        if (el.textContent !== nv) {
          el.textContent = nv
          el.className = "mcard-prob " + (m.delta >= 0 ? "yes" : "no")
          el.classList.add("flash")
          setTimeout(() => el.classList.remove("flash"), 250)
        }
      })
      document.querySelectorAll(".tprob").forEach((el) => {
        const name = (el as HTMLElement).dataset.name
        const m = marketsData.find((x) => x.name === name)
        if (!m) return
        const nv = Math.round(m.prob) + "%"
        if (el.textContent !== nv) {
          el.textContent = nv
          el.className = "tprob " + (m.delta >= 0 ? "up" : "dn")
          el.classList.add("flash")
          setTimeout(() => el.classList.remove("flash"), 250)
        }
      })
    }, 2200)

    let countdown = 30
    setInterval(() => {
      countdown--
      if (countdown <= 0) countdown = 30
      const el = document.getElementById("refresh-timer")
      if (el) el.textContent = `0:${String(countdown).padStart(2, "0")}`
    }, 1000)

    const wc = document.getElementById("wcloud")
    if (wc) {
      WC.forEach((w, i) => {
        const s = document.createElement("span")
        s.className = "wc"
        s.textContent = w.w
        s.style.fontSize = w.s + "px"
        s.style.color = `rgba(255,255,255,${w.o})`
        s.style.animationDelay = i * 0.65 + "s"
        s.style.fontFamily = "var(--t-mono)"
        s.style.letterSpacing = ".05em"
        wc.appendChild(s)
      })
    }

    function initPage() {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in")
              if (e.target.id === "agent-bars" || e.target.classList.contains("agent-a")) {
                document.querySelectorAll(".abar-fill").forEach((b) => {
                  const w = (b as HTMLElement).dataset.w
                  if (w) (b as HTMLElement).style.transform = `scaleX(${w})`
                })
              }
              obs.unobserve(e.target)
            }
          })
        },
        { threshold: 0.12 }
      )
      document.querySelectorAll(".reveal, .reveal-left").forEach((el) => obs.observe(el))

      const philLines = document.querySelectorAll(".phil-line")
      const philObs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            philLines.forEach((l, i) => setTimeout(() => l.classList.add("lit"), i * 180))
            setTimeout(() => document.getElementById("phil-cta")?.classList.add("show"), philLines.length * 180 + 400)
            philObs.disconnect()
          }
        },
        { threshold: 0.2 }
      )
      const philSec = document.getElementById("philosophy")
      if (philSec) philObs.observe(philSec)

      window.addEventListener(
        "scroll",
        () => {
          const sy = window.scrollY
          const orb = document.getElementById("orb-wrap")
          if (orb) orb.style.transform = `translateY(${sy * 0.15}px)`
        },
        { passive: true }
      )
    }

    setInterval(() => {
      const targets = [...document.querySelectorAll<HTMLElement>(".agent-name, .nav-logo, .hiw-title")]
      const t = targets[Math.floor(Math.random() * targets.length)]
      if (!t) return
      const orig = t.innerHTML
      let c = 0
      const gi = setInterval(() => {
        t.style.transform = `translate(${(Math.random() - 0.5) * 4}px,${(Math.random() - 0.5) * 2}px)`
        if (++c > 3) {
          clearInterval(gi)
          t.style.transform = ""
          t.innerHTML = orig
        }
      }, 40)
    }, 4500)

    return () => {
      document.removeEventListener("mousemove", onMouseMove)
    }
  }, [])

  return (
    <>
      <div id="cursor-ring" />
      <div id="cursor-dot" />
      <div id="cursor-label" />

      <div id="grain" />
      <div id="grid-bg" />
      <div className="ambient amb-em" />
      <div className="ambient amb-vi" />
      <div className="ambient amb-em2" />

      <div id="preloader">
        <div id="pre-count">0</div>
        <div id="pre-track">
          <div id="pre-fill" />
        </div>
        <div id="pre-log">
          [ <span>INIT</span> ] Booting BLACK EDGE v3.0...
        </div>
      </div>

      <div id="app">
        <nav>
          <div className="nav-logo">
            BLACK<em>EDGE</em>
          </div>
          <div className="nav-links">
            <a href="#markets" className="nav-a">MARKETS</a>
            <a href="#council" className="nav-a">COUNCIL</a>
            <a href="#trackrecord" className="nav-a">TRACK RECORD</a>
            <a href="#pricing" className="nav-a">PRICING</a>
          </div>
          <div className="nav-right">
            <div className="live-badge">
              <div className="live-dot" />
              LIVE
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setAccessModalOpen(true)}
              style={{ padding: "8px 16px", fontSize: 10 }}
            >
              GET ACCESS
            </button>
            <ConnectButton.Custom>
              {({ openConnectModal, account }) =>
                account ? (
                  <div ref={walletMenuRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="btn-connect"
                      onClick={() => setWalletMenuOpen((v) => !v)}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--em)", display: "inline-block", flexShrink: 0 }} />
                      {account.displayName}
                      <span style={{ fontSize: 8, opacity: 0.5 }}>▾</span>
                    </button>
                    {walletMenuOpen && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 8px)", right: 0,
                        background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)",
                        minWidth: 200, zIndex: 200,
                      }}>
                        <button
                          type="button"
                          onClick={() => { setWalletMenuOpen(false); router.push("/dashboard") }}
                          style={{
                            display: "block", width: "100%", padding: "12px 16px",
                            textAlign: "left", fontFamily: "var(--t-mono)", fontSize: 10,
                            letterSpacing: "0.2em", color: "var(--em)",
                            background: "none", border: "none", cursor: "pointer",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          ▶ OPEN TERMINAL
                        </button>
                        <button
                          type="button"
                          onClick={() => { setWalletMenuOpen(false); setAccessModalTier("pro"); setAccessModalOpen(true) }}
                          style={{
                            display: "block", width: "100%", padding: "12px 16px",
                            textAlign: "left", fontFamily: "var(--t-mono)", fontSize: 10,
                            letterSpacing: "0.2em", color: "rgba(255,255,255,0.6)",
                            background: "none", border: "none", cursor: "pointer",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          ⚡ SUBSCRIBE
                        </button>
                        <button
                          type="button"
                          onClick={() => { setWalletMenuOpen(false); disconnect() }}
                          style={{
                            display: "block", width: "100%", padding: "12px 16px",
                            textAlign: "left", fontFamily: "var(--t-mono)", fontSize: 10,
                            letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)",
                            background: "none", border: "none", cursor: "pointer",
                          }}
                        >
                          DISCONNECT
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button type="button" className="btn-connect" onClick={openConnectModal}>
                    CONNECT WALLET
                  </button>
                )
              }
            </ConnectButton.Custom>
          </div>
        </nav>

        <section id="hero">
          <div className="hero-layout">
            <div className="hero-left">
              <div className="hero-eyebrow reveal">PREDICTION MARKET INTELLIGENCE</div>
              <h1 className="hero-title reveal" style={{ transitionDelay: ".1s" }}>
                The <span className="accent">edge</span>
                <br />
                is in the
                <br />
                <span className="line-serif">data.</span>
              </h1>
              <p className="hero-sub reveal" style={{ transitionDelay: ".2s" }}>
                5 AI agents analyze every Polymarket position independently. They debate. They vote. One exists only to say no.
              </p>
              <div className="hero-ctas reveal" style={{ transitionDelay: ".3s" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setAccessModalOpen(true)}
                >
                  <span>GET ACCESS</span>
                  <span>→</span>
                </button>
                <a href="#markets" className="btn-ghost">
                  EXPLORE MARKETS <span style={{ color: "var(--em)" }}>↓</span>
                </a>
                <a href="#council" className="btn-ghost">
                  THE COUNCIL <span style={{ color: "var(--em)" }}>↓</span>
                </a>
              </div>
              <div className="hero-stats reveal" style={{ transitionDelay: ".4s" }}>
                <div className="hstat">
                  <div className="hstat-val green" id="stat-markets">247</div>
                  <div className="hstat-label">MARKETS TRACKED</div>
                </div>
                <div className="hstat">
                  <div className="hstat-val" id="stat-vol">$12.4M</div>
                  <div className="hstat-label">VOLUME ANALYZED</div>
                </div>
                <div className="hstat">
                  <div className="hstat-val green">5</div>
                  <div className="hstat-label">AI AGENTS</div>
                </div>
                <div className="hstat">
                  <div className="hstat-val" id="stat-liq">$8.1M</div>
                  <div className="hstat-label">LIQUIDITY MONITORED</div>
                </div>
              </div>
            </div>
            <div className="hero-right">
              <div className="orb-wrap reveal" id="orb-wrap" style={{ transitionDelay: ".2s" }}>
                <div className="orb-glow" />
                <div className="orb-core" />
                <div className="orb-mask" />
                <div className="orb-ring1" />
                <div className="orb-ring2" />
                <div className="orb-dot" />
                <div className="orb-dot orb-dot2" />
              </div>
            </div>
          </div>
          <div className="scroll-hint">
            <div className="scroll-line" />
            <span>SCROLL</span>
          </div>
        </section>

        <div id="ticker-bar">
          <div className="ticker-inner" id="ticker-inner" />
        </div>

        <section id="markets">
          <div className="section-inner">
            <div className="section-tag reveal">LIVE MARKETS</div>
            <div className="markets-header">
              <h2 className="section-title reveal" style={{ transitionDelay: ".1s" }}>
                Real-Time
                <br />
                <em>Signals</em>
              </h2>
              <div className="filter-tabs reveal" style={{ transitionDelay: ".15s" }} id="filters">
                <button type="button" className="ftab active" data-cat="all">
                  ALL
                </button>
                <button type="button" className="ftab" data-cat="politics">
                  POLITICS
                </button>
                <button type="button" className="ftab" data-cat="crypto">
                  CRYPTO
                </button>
                <button type="button" className="ftab" data-cat="sports">
                  SPORTS
                </button>
                <button type="button" className="ftab" data-cat="economy">
                  ECONOMY
                </button>
              </div>
            </div>
            <div className="markets-grid" id="markets-grid" />
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <section id="howitworks">
          <div className="section-inner">
            <div className="section-tag reveal">METHODOLOGY</div>
            <h2 className="section-title reveal" style={{ transitionDelay: ".1s" }}>
              How the
              <br />
              <em>Edge</em> is Built
            </h2>
            <div className="hiw-grid">
              <div className="hiw-card reveal" style={{ transitionDelay: ".1s" }}>
                <div className="hiw-num">01</div>
                <div className="hiw-icon">⬡</div>
                <div className="hiw-title">COLLECT</div>
                <div className="hiw-desc">
                  Polymarket CLOB API, news feeds, social sentiment signals, on-chain data. 30-second refresh cycle. No data gaps, no delays.
                </div>
                <div className="hiw-tag">30s REFRESH</div>
              </div>
              <div className="hiw-card reveal" style={{ transitionDelay: ".2s" }}>
                <div className="hiw-num">02</div>
                <div className="hiw-icon">⟁</div>
                <div className="hiw-title">ANALYZE</div>
                <div className="hiw-desc">
                  5 AI agents debate every market independently. The Doomer agent applies veto power. The Judge synthesizes. No consensus required.
                </div>
                <div className="hiw-tag">5 INDEPENDENT AGENTS</div>
              </div>
              <div className="hiw-card reveal" style={{ transitionDelay: ".3s" }}>
                <div className="hiw-num">03</div>
                <div className="hiw-icon">◈</div>
                <div className="hiw-title">SIGNAL</div>
                <div className="hiw-desc">
                  Edge %, Kelly-criterion sizing, composite score 0–100. Every prediction logged publicly. Every result published. Zero exceptions.
                </div>
                <div className="hiw-tag">KELLY CRITERION</div>
              </div>
            </div>
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <section id="council">
          <div className="section-inner">
            <div className="section-tag reveal">THE COUNCIL</div>
            <div className="council-intro">
              <div>
                <h2 className="section-title reveal" style={{ transitionDelay: ".1s" }}>
                  Five Agents.
                  <br />
                  One <em>Truth</em>.
                </h2>
                <p className="council-lead reveal" style={{ transitionDelay: ".2s", marginTop: 24 }}>
                  Every signal passes through <strong>five independent agents</strong>. They don&apos;t share data until the vote.{" "}
                  <em>Disagreement is the feature, not the bug.</em>
                </p>
              </div>
              <div className="council-meta reveal" style={{ transitionDelay: ".3s" }}>
                <div className="cmeta-row">
                  <div className="cmeta-num">5</div>
                  <span>AI agents in council</span>
                </div>
                <div className="cmeta-row">
                  <div className="cmeta-num">1</div>
                  <span>veto agent (The Doomer)</span>
                </div>
                <div className="cmeta-row">
                  <div className="cmeta-num">0</div>
                  <span>consensus required</span>
                </div>
                <div className="cmeta-row">
                  <div className="cmeta-num">30s</div>
                  <span>signal refresh cycle</span>
                </div>
              </div>
            </div>
            <div className="agents-bento">
              <div className="agent agent-a reveal">
                <div className="agent-id">AGENT_01</div>
                <div className="agent-name">Fundamentals</div>
                <div className="agent-desc">
                  Orderbook depth, volume flow, liquidity analysis. Pure on-chain data. No emotion.
                </div>
                <div className="agent-icon">◈</div>
                <div className="agent-bars" id="agent-bars">
                  <div className="abar-row">
                    <span>VOL DELTA</span>
                    <div className="abar-track">
                      <div className="abar-fill" data-w=".84" />
                    </div>
                    <span className="abar-val">84%</span>
                  </div>
                  <div className="abar-row">
                    <span>OI RATIO</span>
                    <div className="abar-track">
                      <div className="abar-fill" data-w=".61" />
                    </div>
                    <span className="abar-val">61%</span>
                  </div>
                  <div className="abar-row">
                    <span>LIQUIDITY</span>
                    <div className="abar-track">
                      <div className="abar-fill" data-w=".92" />
                    </div>
                    <span className="abar-val">92%</span>
                  </div>
                  <div className="abar-row">
                    <span>SPREAD</span>
                    <div className="abar-track">
                      <div className="abar-fill" data-w=".47" />
                    </div>
                    <span className="abar-val">47%</span>
                  </div>
                  <div className="abar-row">
                    <span>MOMENTUM</span>
                    <div className="abar-track">
                      <div className="abar-fill" data-w=".78" />
                    </div>
                    <span className="abar-val">78%</span>
                  </div>
                  <div className="abar-row">
                    <span>COMPOSITE</span>
                    <div className="abar-track">
                      <div className="abar-fill" data-w=".73" />
                    </div>
                    <span className="abar-val">73%</span>
                  </div>
                </div>
              </div>
              <div className="agent agent-b reveal" style={{ transitionDelay: ".08s" }}>
                <div className="agent-id">AGENT_02</div>
                <div className="agent-name">Sentiment</div>
                <div className="agent-desc">Decoding the crowd&apos;s unconscious. News feeds, X/Twitter, public opinion signals.</div>
                <div className="agent-icon">⌬</div>
                <div className="wcloud" id="wcloud" />
              </div>
              <div className="agent agent-c reveal" style={{ transitionDelay: ".14s" }}>
                <div className="agent-id">AGENT_03</div>
                <div className="agent-name">Sniper</div>
                <div className="agent-desc">Price microstructure. Identifies high-value entry windows.</div>
                <div className="agent-icon">◎</div>
                <div className="agent-radar">
                  <svg className="radar-svg" width="110" height="110" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="50" fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="1" />
                    <circle cx="55" cy="55" r="35" fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="1" />
                    <circle cx="55" cy="55" r="18" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="1" />
                    <line x1="55" y1="5" x2="55" y2="105" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
                    <line x1="5" y1="55" x2="105" y2="55" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
                    <path d="M55 55 L55 5" stroke="#10b981" strokeWidth="1.5" opacity=".9" />
                    <path d="M55 55 L88 22" stroke="rgba(16,185,129,0.2)" strokeWidth="1" />
                    <circle cx="80" cy="30" r="3.5" fill="var(--em)" opacity=".8" />
                    <circle cx="38" cy="70" r="2.5" fill="var(--vi)" opacity=".7" />
                    <circle cx="68" cy="76" r="2" fill="var(--em)" opacity=".4" />
                    <circle cx="30" cy="38" r="1.5" fill="white" opacity=".2" />
                    <path d="M55 55 L55 5 A50 50 0 0 1 105 55 Z" fill="rgba(16,185,129,0.05)" />
                  </svg>
                </div>
              </div>
              <div className="agent agent-d reveal" style={{ transitionDelay: ".2s" }}>
                <div className="agent-id">AGENT_04</div>
                <div className="agent-name">Narrative</div>
                <div className="agent-desc">
                  Viral potential, upcoming catalysts, trend analysis. Maps the story the market is telling.
                </div>
                <div className="agent-icon">⟁</div>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 1, flexShrink: 0, background: "rgba(139,92,246,0.5)", alignSelf: "stretch" }} />
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                      Regulatory pivot narrative detected — market lag 12% upside opportunity
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 1, flexShrink: 0, background: "rgba(16,185,129,0.4)", alignSelf: "stretch" }} />
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                      Media cycle 48h behind smart money positioning — catalyst confirmed
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 1, flexShrink: 0, background: "rgba(245,158,11,0.3)", alignSelf: "stretch" }} />
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                      Viral narrative momentum index: <span style={{ color: "var(--amber)" }}>7.4/10</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="agent agent-e reveal" style={{ transitionDelay: ".26s" }}>
                <div className="doomer-ring" />
                <div className="agent-id red">AGENT_05 — VETO</div>
                <div className="agent-name doomer-name">The Doomer</div>
                <div className="agent-desc">
                  Finds reasons NOT to trade. Has absolute veto power. If it can&apos;t find a reason to say no — the signal is strong.
                </div>
                <div className="agent-icon" style={{ color: "var(--red)", opacity: 0.5 }}>
                  ⚠
                </div>
                <div className="risk-box">CURRENT STATUS: ELEVATED CAUTION</div>
                <div style={{ marginTop: 10, fontSize: 8, letterSpacing: ".12em", color: "rgba(255,255,255,.2)", lineHeight: 1.7 }}>
                  &quot;The Doomer exists to kill bad trades.&quot;
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <section id="terminal-section">
          <div className="section-inner">
            <div className="section-tag reveal">REAL-TIME PULSE</div>
            <h2 className="section-title reveal" style={{ transitionDelay: ".1s" }}>
              Market
              <br />
              <em>Terminal</em>
            </h2>
            <div style={{ marginTop: 48 }}>
              <div className="terminal-frame reveal" style={{ transitionDelay: ".15s" }}>
                <div className="terminal-titlebar">
                  <div className="tbar-dot tbar-r" />
                  <div className="tbar-dot tbar-y" />
                  <div className="tbar-dot tbar-g" />
                  <div className="tbar-title">BLACK EDGE / POLYMARKET CLOB — LIVE FEED</div>
                  <div className="tbar-right">
                    <div className="live-dot" /> <span id="t-time">--:--:-- UTC</span>
                  </div>
                </div>
                <table className="terminal-table">
                  <thead>
                    <tr>
                      <th>MARKET</th>
                      <th>PROBABILITY</th>
                      <th>24H CHANGE</th>
                      <th>VOLUME</th>
                      <th>KELLY EDGE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody id="t-body" />
                </table>
              </div>
              <div className="kelly-wrap reveal" style={{ transitionDelay: ".25s" }}>
                <div className="ksig">
                  <div className="ksig-label">BEST KELLY SIGNAL</div>
                  <div className="ksig-val">+14.3%</div>
                  <div className="ksig-desc">ETH ETF APPROVAL — optimal bet size: 4.2% of bankroll</div>
                </div>
                <div className="ksig">
                  <div className="ksig-label">COMPOSITE SCORE</div>
                  <div className="ksig-val" style={{ color: "var(--vi)" }}>
                    87/100
                  </div>
                  <div className="ksig-desc">Council consensus — 4/5 agents positive, Doomer abstained</div>
                </div>
                <div className="ksig">
                  <div className="ksig-label">SIGNAL REFRESH</div>
                  <div className="ksig-val" style={{ color: "rgba(255,255,255,.5)" }} id="refresh-timer">
                    0:28
                  </div>
                  <div className="ksig-desc">Next data pull from Polymarket CLOB API</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <section id="philosophy">
          <div className="phil-inner">
            <div className="phil-pre">// MANIFESTO</div>
            <span className="phil-line">Most traders follow the chart.</span>
            <span className="phil-line">
              We follow <em>the code</em>.
            </span>
            <div className="phil-div" />
            <span className="phil-line">The Council doesn&apos;t predict.</span>
            <span className="phil-line">
              It <em>calculates</em>.
            </span>
            <div className="phil-div" />
            <span className="phil-line small">Information is a weapon.</span>
            <span className="phil-line small">
              <em>Design</em> is its tranchant.
            </span>
            <div className="phil-div" />
            <span className="phil-line" style={{ fontSize: "clamp(48px,7vw,100px)" }}>
              Don&apos;t bet.
            </span>
            <span className="phil-line" style={{ fontSize: "clamp(48px,7vw,100px)" }}>
              <em>Execute.</em>
            </span>
            <div className="phil-cta" id="phil-cta">
              <a href="#markets" className="btn-primary">
                <span>VIEW LIVE MARKETS</span>
                <span>→</span>
              </a>
              <span style={{ fontSize: 9, letterSpacing: ".2em", color: "rgba(255,255,255,.2)" }}>NOT FINANCIAL ADVICE</span>
            </div>
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <section id="trackrecord">
          <div className="section-inner">
            <div className="section-tag reveal">PUBLIC TRACK RECORD</div>
            <h2 className="section-title reveal" style={{ transitionDelay: ".1s" }}>
              Zero
              <br />
              <em>exceptions</em>.
            </h2>
            <p className="reveal" style={{ transitionDelay: ".15s", fontSize: 11, color: "rgba(255,255,255,.35)", lineHeight: 1.8, maxWidth: 500, marginTop: 16 }}>
              Every prediction published. Every result logged on-chain. No cherry-picking. No survivorship bias. The edge is real or it isn&apos;t.
            </p>
            <div className="tr-grid">
              <div className="tr-stat reveal" style={{ transitionDelay: ".1s" }}>
                <div className="tr-val coming">
                  LIVE
                  <br />
                  SOON
                </div>
                <div className="tr-desc">TOTAL TRADES</div>
              </div>
              <div className="tr-stat reveal" style={{ transitionDelay: ".15s" }}>
                <div className="tr-val coming">—</div>
                <div className="tr-desc">WIN RATE</div>
              </div>
              <div className="tr-stat reveal" style={{ transitionDelay: ".2s" }}>
                <div className="tr-val coming">—</div>
                <div className="tr-desc">TOTAL P&L</div>
              </div>
              <div className="tr-stat reveal" style={{ transitionDelay: ".25s" }}>
                <div className="tr-val coming">—</div>
                <div className="tr-desc">SHARPE RATIO</div>
              </div>
            </div>
            <div className="tr-note reveal" style={{ transitionDelay: ".3s" }}>
              First predictions go live this week. Every result published. Zero exceptions.
              <br />
              <a href="#markets">→ VIEW LIVE MARKETS</a>
            </div>
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <section id="pricing">
          <div className="section-inner">
            <div className="section-tag reveal">PRICING</div>
            <h2 className="section-title reveal" style={{ transitionDelay: ".1s" }}>
              Choose your
              <br />
              <em>Edge</em>
            </h2>
            <div className="pricing-grid">
              <div className="pcard reveal" style={{ transitionDelay: ".1s" }}>
                <div className="pcard-tier">FREE</div>
                <div className="pcard-price">
                  <sup>$</sup>0
                </div>
                <div className="pcard-per">FOREVER</div>
                <div className="pcard-features">
                  <div className="pfeature">Top 5 market signals</div>
                  <div className="pfeature">Basic probability view</div>
                  <div className="pfeature">Public track record access</div>
                  <div className="pfeature no">Council vote breakdown</div>
                  <div className="pfeature no">Kelly criterion sizing</div>
                  <div className="pfeature no">API access</div>
                </div>
                <button type="button" className="btn-tier" onClick={() => setAccessModalOpen(true)}>
                  GET STARTED
                </button>
              </div>
              <div className="pcard featured reveal" style={{ transitionDelay: ".15s" }}>
                <div className="pcard-badge">MOST POPULAR</div>
                <div className="pcard-tier">PRO</div>
                <div className="pcard-price">
                  <sup>$</sup>49
                </div>
                <div className="pcard-per">/ MONTH</div>
                <div className="pcard-features">
                  <div className="pfeature">All live market signals</div>
                  <div className="pfeature">Full Council vote breakdown</div>
                  <div className="pfeature">Kelly criterion position sizing</div>
                  <div className="pfeature">Real-time terminal + bot</div>
                  <div className="pfeature">Polymarket API integration</div>
                  <div className="pfeature no">Full API access</div>
                </div>
                <button type="button" className="btn-tier em-btn" onClick={() => { setAccessModalTier("pro"); setAccessModalOpen(true); }}>
                  GET ACCESS — $49
                </button>
              </div>
              <div className="pcard reveal" style={{ transitionDelay: ".2s" }}>
                <div className="pcard-tier">THE EDGE</div>
                <div className="pcard-price">
                  <sup>$</sup>199
                </div>
                <div className="pcard-per">/ MONTH</div>
                <div className="pcard-features">
                  <div className="pfeature">Everything in Pro</div>
                  <div className="pfeature">Full REST + WebSocket API</div>
                  <div className="pfeature">Webhook alerts</div>
                  <div className="pfeature">Priority signal delivery</div>
                  <div className="pfeature">Portfolio integration</div>
                  <div className="pfeature">Dedicated support</div>
                </div>
                <button type="button" className="btn-tier" onClick={() => { setAccessModalTier("whale"); setAccessModalOpen(true); }}>
                  GET ACCESS — $199
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="hr" style={{ position: "relative", zIndex: 10 }} />

        <footer>
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="nav-logo">
                BLACK<em>EDGE</em>
              </div>
              <p className="footer-tagline">
                Prediction market intelligence powered by five independent AI agents. The edge is in the data.
              </p>
              <p className="footer-legal">
                Not financial advice. All predictions are published publicly.
                <br />
                Powered by Polymarket · Built on Polygon.
              </p>
            </div>
            <div>
              <div className="footer-col-title">NAVIGATION</div>
              <div className="footer-links">
                <a href="#" className="footer-link">
                  Home
                </a>
                <a href="#markets" className="footer-link">
                  Markets
                </a>
                <a href="#council" className="footer-link">
                  The Council
                </a>
                <a href="#trackrecord" className="footer-link">
                  Track Record
                </a>
                <a href="#pricing" className="footer-link">
                  Pricing
                </a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">RESOURCES</div>
              <div className="footer-links">
                <a href="#" className="footer-link">
                  Documentation
                </a>
                <a href="#" className="footer-link">
                  API Reference
                </a>
                <a href="#" className="footer-link">
                  System Status
                </a>
                <a href="#" className="footer-link">
                  Changelog
                </a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">LEGAL</div>
              <div className="footer-links">
                <a href="/terms" className="footer-link">
                  Terms of Service
                </a>
                <a href="/privacy" className="footer-link">
                  Privacy Policy
                </a>
                <a href="/risk-disclosure" className="footer-link">
                  Risk Disclosure
                </a>
                <a href="#" className="footer-link">
                  Cookie Policy
                </a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 BLACK EDGE — ALL RIGHTS RESERVED</span>
            <span style={{ color: "var(--em)" }}>V3.0</span>
            <span>NOT FINANCIAL ADVICE</span>
          </div>
        </footer>

        <AccessModal isOpen={accessModalOpen} onClose={() => setAccessModalOpen(false)} defaultTier={accessModalTier} />
      </div>
    </>
  )
}
