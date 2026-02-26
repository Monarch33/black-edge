# ⚡ Black Edge CLI

> **Institutional-grade HFT terminal for prediction market arbitrage**

The command-line interface for Black Edge — stream real-time trading signals powered by a 5-agent AI Council directly to your terminal.

```
█████╗ ██╗      █████╗  █████╗ ██╗  ██╗    ███████╗██████╗  ██████╗ ███████╗
██╔══██╗██║     ██╔══██╗██╔══██╗██║ ██╔╝    ██╔════╝██╔══██╗██╔════╝ ██╔════╝
███████║██║     ███████║██║  ╚═╝█████═╝     █████╗  ██║  ██║██║  ██╗ █████╗
██╔══██║██║     ██╔══██║██║  ██╗██╔═██╗     ██╔══╝  ██║  ██║██║  ╚██╗██╔══╝
██║  ██║███████╗██║  ██║╚█████╔╝██║ ╚██╗    ███████╗██████╔╝╚██████╔╝███████╗
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝    ╚══════╝╚═════╝  ╚═════╝ ╚══════╝
```

---

## 🚀 Quick Start

### Installation

```bash
npm install -g black-edge-cli
```

### Usage

```bash
black-edge start
```

On first run, you'll be guided through:
1. **API Key** — Enter your Black Edge API key (`be_live_***`)
2. **Credit Check** — Verify your remaining API credits
3. **Polymarket Keys** — Configure local trading credentials (optional)
4. **Strategy Selection** — Choose Oracle or Sniper mode
5. **Live Streaming** — Receive real-time signals as they're generated

---

## 📡 How It Works

Black Edge CLI connects to the **Black Edge API** and streams trading signals in real-time:

- **Web Terminal**: Trade directly in your browser at [blackedge.io](https://blackedge.io)
- **CLI Terminal**: Run the engine locally with your own keys

**Both clients consume the same centralized API credit pool.**

Each signal costs **1 credit**. Purchase credits at [blackedge.io/pricing](https://blackedge.io/pricing).

---

## 🔑 Get Your API Key

1. Sign up at **[blackedge.io](https://blackedge.io)**
2. Connect your wallet or OAuth (Google/Apple)
3. Go to **Account & API** panel
4. Copy your API key (`be_live_***`)

**⚠️ Keep your API key secret!** It authenticates both Web Terminal and CLI access.

---

## 💳 Credit System

- **100 credits** — Free tier (demo)
- **10,000 credits** — Runner tier ($29/month)
- **100,000 credits** — Whale tier ($999/month)

When you run out of credits, the CLI will display:

```
┌────────────────────────────────────────┐
│   ⚠️  NO API CREDITS REMAINING        │
│                                        │
│   Purchase more at:                    │
│   https://blackedge.io/pricing         │
└────────────────────────────────────────┘
```

---

## 🎯 Features

✅ **Real-time Signal Streaming** — Receive signals as they're generated
✅ **Credit Balance Tracking** — See remaining credits after each signal
✅ **5-Agent AI Council** — Powered by Sage, Prophet, Doomer, Sentinel, Arbiter
✅ **Polymarket Integration** — Execute trades locally with your own keys
✅ **Strategy Modes** — Oracle (sentiment) or Sniper (arbitrage)
✅ **Beautiful CLI** — Sleek terminal UI with color-coded output

---

## 🛠️ Configuration

On first run, `black-edge start` creates `~/.blackedge/config.json`:

```json
{
  "apiKey": "be_live_***",
  "polymarket": {
    "proxyKey": "your-proxy-key",
    "secret": "your-secret",
    "passphrase": "your-passphrase",
    "polygonPrivateKey": "your-polygon-pk"
  },
  "strategy": "oracle"
}
```

**To reconfigure:** Delete `~/.blackedge/config.json` and run `black-edge start` again.

---

## 📊 Example Output

```
[11:42:03] ✅ Connected to Black Edge API
[11:42:03] 💳 Credits remaining: 8,450 / 10,000

[11:42:15] 📡 NEW SIGNAL
           Market: Bitcoin above $120K by End of 2025
           Edge: +12.4%
           Council Vote: 4/5 YES
           Kelly: 8.2%
           💳 Credits: 8,449

[11:42:47] 📡 NEW SIGNAL
           Market: Ethereum ETF Approval 2025
           Edge: +7.8%
           Council Vote: 5/5 YES
           Kelly: 6.1%
           💳 Credits: 8,448
```

---

## 🔒 Security

- **API keys are stored locally** in `~/.blackedge/config.json`
- **Never share your API key** — it grants full access to your account
- **Polymarket keys stay local** — they're never sent to Black Edge servers
- **All connections use TLS/SSL** encryption

---

## 📚 Documentation

- **Web Terminal**: [blackedge.io/terminal](https://blackedge.io/terminal)
- **API Docs**: [blackedge.io/api-docs](https://blackedge.io/api-docs)
- **Technical Paper**: [blackedge.io/technical-paper](https://blackedge.io/technical-paper)

---

## ⚖️ Legal

- **Not financial advice** — All signals are for informational purposes only
- **Prediction markets** — Subject to local regulations
- **Risk disclosure** — Read [blackedge.io/risk-disclosure](https://blackedge.io/risk-disclosure)

---

## 🆘 Support

- **Issues**: [github.com/Monarch33/black-edge/issues](https://github.com/Monarch33/black-edge/issues)
- **Email**: support@blackedge.io
- **Discord**: [discord.gg/blackedge](https://discord.gg/blackedge)

---

## 📜 License

MIT © Black Edge

---

**Built with ⚡ by the Black Edge team**
