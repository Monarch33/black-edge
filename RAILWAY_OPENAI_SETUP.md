# Configuration OpenAI + Stripe sur Railway

## 1. OpenAI API Key (Railway)

Tu as déjà ajouté une clé OpenAI sur Railway. Elle est maintenant **bien intégrée** :

### Où elle est utilisée

| Composant | Variable | Usage |
|-----------|----------|-------|
| **GrokAnalyzer** (backend) | `OPENAI_API_KEY` | Fallback quand `GROK_API_KEY` est vide. Analyse marchés + commentaires via `/api/grok/analyze` et `/api/grok/commentary` |
| **BlackEdge** (CLI/orchestrator) | `OPENAI_API_KEY` ou `BLACKEDGE_LLM_API_KEY` | Analyse IA des marchés pour l’agent autonome |

### Variables à configurer sur Railway

```
OPENAI_API_KEY=sk-...
```

Optionnel :
```
OPENAI_MODEL=gpt-4o-mini   # par défaut, économique
```

### Estimation des crédits

- **gpt-4o-mini** : ~$0.15 / 1M tokens input, ~$0.60 / 1M output
- Council analyse ~30 marchés toutes les 5 min → ~150–300 tokens/marché → ~5–10K tokens/cycle
- Grok endpoints : appelés à la demande (analyse, commentary)
- **Ordre de grandeur** : 5–20 $/mois selon le trafic

---

## 2. Stripe (Vercel)

### Variables Vercel

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... ou pk_live_...
STRIPE_SECRET_KEY=sk_test_... ou sk_live_...
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_...   # Plan Pro $49/mois
NEXT_PUBLIC_STRIPE_PRICE_ID_WHALE=price_... # Plan The Edge $199/mois (optionnel)
```

Crée les produits/prix dans le [Stripe Dashboard](https://dashboard.stripe.com/products) :
- **Pro** : $49/mois, subscription
- **The Edge** : $199/mois, subscription

---

## 3. Flow utilisateur

1. **GET ACCESS** (hero ou nav) → ouvre la modal Stripe
2. **Connect wallet** si pas encore connecté
3. **Choisir Pro ($49) ou The Edge ($199)** → paiement Stripe
4. **Après paiement** → redirection vers `/success` puis `/dashboard`
5. **Dashboard** → coller Proxy Key + Secret Polymarket → SAVE → ACTIVATE AGENT

---

## 4. Polymarket API Keys

Le client récupère ses clés sur [Polymarket](https://polymarket.com) :
- **Proxy Key** et **Secret** (CLOB API)
- À coller dans le dashboard après souscription
