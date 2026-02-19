# Black Edge — Bot de Trading Autonome

Bot asynchrone spécialisé sur les marchés prédictifs (Polymarket).  
Mode Paper Trading uniquement (Phase 1).

## Installation

```bash
cd blackedge
poetry install
# ou: pip install -e .
```

## Configuration

Copier `.env.example` vers `.env` et renseigner :

```bash
BLACKEDGE_LLM_API_KEY=sk-ant-...   # Anthropic ou OpenAI
BLACKEDGE_LLM_PROVIDER=anthropic    # ou openai
BLACKEDGE_LLM_MODEL=claude-3-5-sonnet-20241022
BLACKEDGE_ALPHA_THRESHOLD_PCT=10
BLACKEDGE_PAPER_PORTFOLIO_USD=10000
```

## Utilisation

```bash
# Lancer le bot (TUI + Paper Trading)
blackedge start --key BE-VOTRE-CLE

# Afficher les marchés (sans LLM)
blackedge markets
```

## Architecture

- **api/** — Data Ingestor (Polymarket Gamma/CLOB)
- **intelligence/** — Agent LLM (Claude/OpenAI), calcul Alpha
- **risk/** — Kelly Criterion (position sizing)
- **engine/** — Paper Trader + SQLite
- **tui/** — Dashboard terminal (Textual)
- **core/** — Orchestrateur (boucle principale)

## Licence

Clé mock : doit commencer par `BE-`.
