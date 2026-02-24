#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════════
// BLACK EDGE CLI v1.0
// Stream prediction market signals to your local terminal.
// Full guided setup: API key → credit check → Polymarket keys → stream.
// ═══════════════════════════════════════════════════════════════════════════════

const readline = require("readline");
const WebSocket = require("ws");

const API_BASE = process.env.BLACK_EDGE_API_URL || "https://api.blackedge.ai";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// ─── ANSI COLORS ─────────────────────────────────────────────────────────────
const G = "\x1b[38;2;0;255;136m";   // #00FF88 phosphor green
const D = "\x1b[2m";                 // dim
const R = "\x1b[0m";                 // reset
const RE = "\x1b[31m";              // red
const Y = "\x1b[33m";               // yellow
const B = "\x1b[1m";                // bold
const W = "\x1b[37m";               // white
const CY = "\x1b[36m";              // cyan

// ─── LOGO ────────────────────────────────────────────────────────────────────
function logo() {
  console.log(`
${G}${B}    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │   ██████╗ ██╗      █████╗  ██████╗██╗  ██╗           │
    │   ██╔══██╗██║     ██╔══██╗██╔════╝██║ ██╔╝           │
    │   ██████╔╝██║     ███████║██║     █████╔╝            │
    │   ██╔══██╗██║     ██╔══██║██║     ██╔═██╗            │
    │   ██████╔╝███████╗██║  ██║╚██████╗██║  ██╗           │
    │   ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝           │
    │                                                      │
    │   ███████╗██████╗  ██████╗ ███████╗                  │
    │   ██╔════╝██╔══██╗██╔════╝ ██╔════╝                  │
    │   █████╗  ██║  ██║██║  ███╗█████╗                    │
    │   ██╔══╝  ██║  ██║██║   ██║██╔══╝                    │
    │   ███████╗██████╔╝╚██████╔╝███████╗                  │
    │   ╚══════╝╚═════╝  ╚═════╝ ╚══════╝                  │
    │                                                      │
    └──────────────────────────────────────────────────────┘${R}

${D}    Asymmetric Intelligence Terminal — CLI v1.0${R}
${D}    Autonomous prediction market signal engine${R}
`);
}

// ─── SECTION HEADERS ─────────────────────────────────────────────────────────
function section(title) {
  console.log(`\n${G}  ┌${"─".repeat(title.length + 4)}┐${R}`);
  console.log(`${G}  │  ${title}  │${R}`);
  console.log(`${G}  └${"─".repeat(title.length + 4)}┘${R}\n`);
}

function step(num, text) {
  console.log(`  ${G}[${num}]${R} ${W}${text}${R}`);
}

function info(text) {
  console.log(`  ${D}${text}${R}`);
}

function success(text) {
  console.log(`  ${G}✓${R} ${text}`);
}

function error(text) {
  console.log(`  ${RE}✗${R} ${RE}${text}${R}`);
}

function warn(text) {
  console.log(`  ${Y}!${R} ${Y}${text}${R}`);
}

// ─── PROMPT ──────────────────────────────────────────────────────────────────
function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      // For passwords: don't echo input
      process.stdout.write(`  ${D}${question}${R} `);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      let input = "";

      const onData = (char) => {
        const c = char.toString();
        if (c === "\n" || c === "\r") {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input.trim());
        } else if (c === "\x7f" || c === "\b") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (c === "\x03") {
          // Ctrl+C
          process.exit(0);
        } else {
          input += c;
          process.stdout.write("•");
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(`  ${D}${question}${R} `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

// ─── API CALLS ───────────────────────────────────────────────────────────────
async function validateAndGetCredits(apiKey) {
  try {
    const res = await fetch(`${API_BASE}/api/v2/system/stats`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      valid: true,
      credits_remaining: data.credits_remaining ?? null,
      credits_total: data.credits_total ?? null,
      tier: data.tier ?? "runner",
    };
  } catch {
    return null;
  }
}

async function sendCredentials(apiKey, creds) {
  try {
    const res = await fetch(`${API_BASE}/api/engine/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(creds),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function activateEngine(apiKey, strategy) {
  try {
    const res = await fetch(`${API_BASE}/api/engine/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ strategy }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── FORMAT HELPERS ──────────────────────────────────────────────────────────
function formatRisk(risk) {
  if (risk === "low") return `${G}LOW${R}`;
  if (risk === "med") return `${Y}MED${R}`;
  return `${RE}HIGH${R}`;
}

function formatEdge(edge) {
  const sign = edge > 0 ? "+" : "";
  const color = edge > 0 ? G : RE;
  return `${color}${sign}${edge.toFixed(1)}%${R}`;
}

function formatTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${D}[${h}:${m}:${s}]${R}`;
}

// ─── CREDIT DISPLAY ──────────────────────────────────────────────────────────
function displayCredits(remaining, total) {
  if (remaining === null || total === null) return;

  const pct = Math.round((remaining / total) * 100);
  const barLen = 30;
  const filled = Math.round((remaining / total) * barLen);
  const bar = `${G}${"█".repeat(filled)}${D}${"░".repeat(barLen - filled)}${R}`;

  console.log(`\n  ${D}Credits:${R} ${bar} ${W}${remaining.toLocaleString()}${D} / ${total.toLocaleString()}${R} ${D}(${pct}%)${R}`);
}

function displayNoCredits() {
  console.log(`
${RE}${B}  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │   ⚠  NO API CREDITS REMAINING                       │
  │                                                      │
  │   Your account has 0 credits. Signal streaming       │
  │   requires active credits.                           │
  │                                                      │
  │   → Purchase credits at:                             │
  │     ${W}https://blackedge.ai/dashboard${RE}                  │
  │                                                      │
  │   → Or upgrade your plan for higher limits.          │
  │                                                      │
  └──────────────────────────────────────────────────────┘${R}
`);
}

// ─── STREAM SIGNALS ──────────────────────────────────────────────────────────
async function streamSignals(apiKey) {
  const wsUrl = `${WS_BASE}/api/v2/ws?token=${encodeURIComponent(apiKey)}`;

  info("Connecting to Black Edge signal stream...");

  const ws = new WebSocket(wsUrl);
  let signalCount = 0;

  ws.on("open", () => {
    console.log(`\n  ${G}✓ Connected${R} — streaming live signals\n`);
    console.log(`  ${D}${"MARKET".padEnd(42)} ${"EDGE".padEnd(10)} ${"CONF".padEnd(8)} ${"SIDE".padEnd(6)} RISK${R}`);
    console.log(`  ${D}${"─".repeat(76)}${R}`);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "signal_update" && msg.data) {
        signalCount++;
        const d = msg.data;
        const question = (d.question || d.market_id || "Unknown").substring(0, 40).padEnd(42);
        const edge = typeof d.edge === "number" ? d.edge : 0;
        const confidence = typeof d.confidence === "number" ? Math.round(d.confidence * 100) : 0;
        const side = d.signal === "SELL" || d.signal === "NO" ? "NO" : "YES";
        const risk = confidence > 70 ? "low" : confidence > 40 ? "med" : "high";

        const edgeStr = formatEdge(edge);
        const confStr = `${confidence}`.padEnd(8);
        const sideStr = side.padEnd(6);

        console.log(`  ${formatTimestamp()} ${question} ${edgeStr}    ${confStr} ${sideStr} ${formatRisk(risk)}`);
      }

      if (msg.type === "heartbeat") {
        // Silent
      }

      // Credit exhaustion check from server
      if (msg.type === "error" && msg.data?.code === "NO_CREDITS") {
        displayNoCredits();
        ws.close();
        process.exit(1);
      }
    } catch {
      // Ignore malformed
    }
  });

  ws.on("close", () => {
    console.log(`\n  ${Y}Disconnected.${R} ${D}Reconnecting in 5s...${R}`);
    setTimeout(() => streamSignals(apiKey), 5000);
  });

  ws.on("error", (err) => {
    error(`Connection error: ${err.message}`);
  });
}

// ─── MAIN FLOW ───────────────────────────────────────────────────────────────
async function main() {
  logo();

  // ── STEP 1: Black Edge API Key ──
  section("AUTHENTICATION");

  step(1, "Black Edge API Key");
  info("Get your key at https://blackedge.ai/dashboard");
  info("");

  let apiKey = process.env.BLACK_EDGE_API_KEY;

  if (apiKey) {
    info(`Using API key from environment: ${apiKey.substring(0, 12)}...`);
  } else {
    apiKey = await prompt("API Key (be_live_...):");
  }

  if (!apiKey) {
    error("API key is required.");
    info("Get your key at https://blackedge.ai/dashboard");
    process.exit(1);
  }

  // ── STEP 2: Validate key + check credits ──
  info("");
  info("Validating API key...");

  const account = await validateAndGetCredits(apiKey);

  if (!account) {
    error("Invalid API key or server unreachable.");
    info("");
    info("Check your key at https://blackedge.ai/dashboard");
    info("If the issue persists, the server may be down.");
    process.exit(1);
  }

  success(`Authenticated — Plan: ${B}${account.tier.toUpperCase()}${R}`);

  // ── STEP 3: Credit check ──
  if (account.credits_remaining !== null) {
    displayCredits(account.credits_remaining, account.credits_total);

    if (account.credits_remaining <= 0) {
      displayNoCredits();
      process.exit(1);
    }

    if (account.credits_remaining < 1000) {
      warn(`Low credits! Only ${account.credits_remaining} remaining.`);
      info("Top up at https://blackedge.ai/dashboard");
    }
  }

  // ── STEP 4: Polymarket Credentials ──
  section("POLYMARKET CREDENTIALS");

  info("The engine needs your Polymarket CLOB API keys to execute trades.");
  info("These are encrypted and stored securely on our servers.");
  info("You can skip this step if keys are already stored.\n");

  step(2, "Polymarket Proxy Key");
  info("Polymarket → Settings → API Keys → Create Key");
  const proxyKey = await prompt("Proxy Key (pk_live_...):");

  let secret = "";
  let passphrase = "";
  let polygonKey = "";

  if (proxyKey) {
    step(3, "API Secret");
    info("The secret shown when you created the API key");
    secret = await prompt("Secret:", true);

    step(4, "Passphrase");
    info("The passphrase you set during key creation");
    passphrase = await prompt("Passphrase:", true);

    step(5, "Polygon Private Key");
    info("MetaMask → Account Details → Export Private Key");
    warn("This key controls your wallet. Keep it safe.");
    polygonKey = await prompt("Private Key (0x...):", true);

    // Send to backend
    info("");
    info("Encrypting and storing credentials...");

    const stored = await sendCredentials(apiKey, {
      polymarket_api_key: proxyKey,
      polymarket_proxy_secret: secret,
      polymarket_passphrase: passphrase,
      polygon_private_key: polygonKey,
    });

    if (stored) {
      success("Credentials stored securely.");
    } else {
      warn("Could not store credentials (server may be offline).");
      info("You can set them later on the web dashboard.");
    }
  } else {
    info("Skipping — using previously stored credentials.");
  }

  // ── STEP 5: Strategy Selection ──
  section("STRATEGY");

  info("Choose your signal strategy:\n");
  console.log(`  ${G}[1]${R} ${W}${B}Oracle${R}  — News + sentiment cross-market analysis`);
  console.log(`  ${G}[2]${R} ${W}${B}Sniper${R}  — 5-min crypto latency arbitrage\n`);

  const stratChoice = await prompt("Strategy [1/2]:");
  const strategy = stratChoice === "2" ? "sniper" : "oracle";
  success(`Strategy: ${B}${strategy.toUpperCase()}${R}`);

  // ── STEP 6: Activate & Stream ──
  section("ACTIVATING ENGINE");

  info("Arming Black Edge engine...");
  const activated = await activateEngine(apiKey, strategy);

  if (activated) {
    success("Engine armed and running.");
  } else {
    warn("Could not activate engine remotely. Streaming signals anyway.");
  }

  console.log(`
  ${G}${B}┌──────────────────────────────────────────────────────┐
  │                                                      │
  │   ◉  BLACK EDGE ARMED — SCANNING DARK POOL          │
  │                                                      │
  │   Strategy: ${strategy === "oracle" ? "ORACLE (cross-market)   " : "SNIPER (latency arb)    "}                │
  │   Credits deducted per signal received.              │
  │                                                      │
  │   Press Ctrl+C to disconnect.                        │
  │                                                      │
  └──────────────────────────────────────────────────────┘${R}
`);

  // Stream
  await streamSignals(apiKey);
}

main().catch((err) => {
  error(`Fatal: ${err.message}`);
  process.exit(1);
});
