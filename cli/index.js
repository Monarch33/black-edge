#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════════
// BLACK EDGE CLI v1.0
// Stream prediction market signals to your local terminal.
// Authenticates via Black Edge API Key, deducting credits per call.
// ═══════════════════════════════════════════════════════════════════════════════

const readline = require("readline");
const WebSocket = require("ws");

const API_BASE = process.env.BLACK_EDGE_API_URL || "https://api.blackedge.ai";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const GREEN = "\x1b[38;2;0;255;136m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";

function banner() {
  console.log(`
${GREEN}${BOLD}  ██████╗ ██╗      █████╗  ██████╗██╗  ██╗    ███████╗██████╗  ██████╗ ███████╗
  ██╔══██╗██║     ██╔══██╗██╔════╝██║ ██╔╝    ██╔════╝██╔══██╗██╔════╝ ██╔════╝
  ██████╔╝██║     ███████║██║     █████╔╝     █████╗  ██║  ██║██║  ███╗█████╗
  ██╔══██╗██║     ██╔══██║██║     ██╔═██╗     ██╔══╝  ██║  ██║██║   ██║██╔══╝
  ██████╔╝███████╗██║  ██║╚██████╗██║  ██╗    ███████╗██████╔╝╚██████╔╝███████╗
  ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝    ╚══════╝╚═════╝  ╚═════╝ ╚══════╝${RESET}

${DIM}  Asymmetric Intelligence Terminal — CLI v1.0${RESET}
${DIM}  Stream live prediction market signals to your terminal.${RESET}
`);
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function validateApiKey(apiKey) {
  try {
    const res = await fetch(`${API_BASE}/api/v2/system/stats`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatRisk(risk) {
  if (risk === "low") return `${GREEN}LOW${RESET}`;
  if (risk === "med") return `${YELLOW}MED${RESET}`;
  return `${RED}HIGH${RESET}`;
}

function formatEdge(edge) {
  const sign = edge > 0 ? "+" : "";
  const color = edge > 0 ? GREEN : RED;
  return `${color}${sign}${edge.toFixed(1)}%${RESET}`;
}

function formatTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${DIM}[${h}:${m}:${s}]${RESET}`;
}

async function streamSignals(apiKey) {
  const wsUrl = `${WS_BASE}/api/v2/ws?token=${encodeURIComponent(apiKey)}`;

  console.log(`\n${DIM}  Connecting to Black Edge signal stream...${RESET}`);

  const ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    console.log(`${GREEN}  Connected.${RESET} Streaming live signals...\n`);
    console.log(
      `${DIM}  ${"MARKET".padEnd(45)} ${"EDGE".padEnd(10)} ${"SIGNAL".padEnd(8)} ${"SIDE".padEnd(6)} ${"RISK".padEnd(6)}${RESET}`
    );
    console.log(`${DIM}  ${"─".repeat(80)}${RESET}`);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "signal_update" && msg.data) {
        const d = msg.data;
        const question = (d.question || d.market_id || "Unknown").substring(0, 42).padEnd(45);
        const edge = formatEdge(d.edge || 0).padEnd(20); // padEnd accounts for ANSI codes
        const confidence = d.confidence
          ? `${Math.round(d.confidence * 100)}`.padEnd(8)
          : "—".padEnd(8);
        const side = (d.signal === "SELL" || d.signal === "NO" ? "NO" : "YES").padEnd(6);
        const risk =
          (d.confidence || 0) > 0.7 ? "low" : (d.confidence || 0) > 0.4 ? "med" : "high";

        console.log(`  ${formatTimestamp()} ${question} ${edge} ${confidence} ${side} ${formatRisk(risk)}`);
      }

      if (msg.type === "heartbeat") {
        // Silent keepalive
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    console.log(`\n${YELLOW}  Disconnected. Reconnecting in 5s...${RESET}`);
    setTimeout(() => streamSignals(apiKey), 5000);
  });

  ws.on("error", (err) => {
    console.error(`${RED}  Connection error: ${err.message}${RESET}`);
  });
}

async function main() {
  banner();

  // Step 1: API Key
  let apiKey = process.env.BLACK_EDGE_API_KEY;

  if (!apiKey) {
    apiKey = await prompt(`${DIM}  Enter your Black Edge API Key: ${RESET}`);
  }

  if (!apiKey) {
    console.log(`${RED}  Error: API key is required.${RESET}`);
    console.log(`${DIM}  Get your key at https://blackedge.ai/dashboard${RESET}\n`);
    process.exit(1);
  }

  console.log(`${DIM}  Validating API key...${RESET}`);
  const valid = await validateApiKey(apiKey);

  if (!valid) {
    console.log(`${RED}  Invalid API key or insufficient credits.${RESET}`);
    console.log(`${DIM}  Top up at https://blackedge.ai/dashboard${RESET}\n`);
    process.exit(1);
  }

  console.log(`${GREEN}  API key validated.${RESET} Credits will be deducted per signal.\n`);

  // Step 2: Stream
  await streamSignals(apiKey);
}

main().catch((err) => {
  console.error(`${RED}  Fatal error: ${err.message}${RESET}`);
  process.exit(1);
});
