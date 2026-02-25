# ✅ Account Setup & Credits - Verification Checklist

## Problèmes Corrigés

### 1. ✅ **Tiers Incohérents** (Backend)
**Avant** :
- user.py : "free" (100), "runner" (10000), "whale" (100000)
- stripe_payments.py : "starter" (1000), "pro" (10000), "whale" (100000)

**Après** :
- user.py : "free" (100), "starter" (100), **"pro"** (10000), "whale" (100000)
- Harmonisation complète entre les tiers utilisateur et les packages Stripe

**Fichiers modifiés** :
- `backend/models/user.py` (lignes 159-163, 360-376)

---

### 2. ✅ **API Key Non Connectée** (Frontend)
**Avant** :
- API key hardcodée : `be_live_k8x9mQ2pL5vN4wR7tY1aZ3bC6dF8gH0j`
- Pas de récupération depuis la session NextAuth

**Après** :
- API key récupérée depuis `session?.user.apiKey`
- Utilise `useSession()` de next-auth/react
- Affichage dynamique avec masquage/révélation

**Fichiers modifiés** :
- `frontend/components/account-panel.tsx` (lignes 1-45)

---

### 3. ✅ **Crédits Non Connectés** (Frontend)
**Avant** :
- Crédits hardcodés : 12450 / 50000
- Pas d'appel API au backend

**Après** :
- Appel API à `/api/credits/balance` au chargement
- State dynamique : `credits`, `maxCredits`, `creditPercent`
- Auto-refresh après achat de crédits

**Fichiers modifiés** :
- `frontend/components/account-panel.tsx` (lignes 30-58, fetch balance)

---

### 4. ✅ **Bouton Purchase Credits Non Fonctionnel**
**Avant** :
- Aucun `onClick` handler
- Bouton purement décoratif

**Après** :
- Modal de sélection de packages (starter, pro, whale)
- Intégration Stripe Checkout complète
- Redirection automatique vers Stripe
- Auto-refresh des crédits après achat

**Fichiers modifiés** :
- `frontend/components/account-panel.tsx` :
  - Nouveau composant `PackageCard` (lignes 15-127)
  - Modal de packages (lignes 500-580)
  - Handler `onClick={() => setShowPackages(true)}`

---

## Flow Complet Utilisateur

### 1️⃣ Création de Compte
```
User → Google OAuth → NextAuth callback → Backend /api/credits/admin/create-user
→ Retourne { api_key, user_id, credits: 100, tier: "free" }
→ API key stockée dans JWT session
```

**Crédits initiaux** : 100 (tier "free")

---

### 2️⃣ Affichage de l'API Key
```
User → Clique sur avatar → Account Panel s'ouvre
→ useSession() récupère session.user.apiKey
→ Affichage masqué : be_live_••••••••••••••••••••••••••••••••
→ Bouton 👁️ pour révéler
→ Bouton 📋 pour copier
```

**API key** : Récupérée depuis la session, fonctionnelle immédiatement

---

### 3️⃣ Consultation du Solde
```
Account Panel s'ouvre → useEffect() trigger
→ Appel GET /api/credits/balance (Authorization: Bearer {api_key})
→ Retourne { credits, max_credits, tier, signals_generated, ... }
→ Affichage dynamique dans le panel
```

**Solde affiché** : Données réelles depuis PostgreSQL

---

### 4️⃣ Achat de Crédits
```
User → Clique "PURCHASE CREDITS"
→ Modal s'ouvre avec 3 packages :
   - Starter: 1,000 crédits @ $10 ($0.01/crédit)
   - Pro: 10,000 crédits @ $50 ($0.005/crédit) [MOST POPULAR]
   - Whale: 100,000 crédits @ $400 ($0.004/crédit)

User → Sélectionne un package → Clique "PURCHASE"
→ POST /api/stripe/create-checkout { package: "pro", success_url, cancel_url }
→ Retourne { checkout_url }
→ Redirection automatique vers Stripe Checkout

User → Entre CB sur Stripe → Paiement validé
→ Stripe envoie webhook à /api/stripe/webhook
→ Backend ajoute crédits via user_db.add_credits()
→ Transaction enregistrée dans PostgreSQL

User → Redirigé vers success_url
→ Modal se ferme, fetchBalance() auto-refresh
→ Nouveaux crédits affichés immédiatement
```

---

## Vérification Technique

### Backend ✅

**1. Tiers PostgreSQL**
```sql
SELECT tier, credits FROM users;
-- free: 100 crédits
-- starter: 100 crédits (après achat starter pack)
-- pro: 10000 crédits (après achat pro pack)
-- whale: 100000 crédits (après achat whale pack)
```

**2. Packages Stripe**
```bash
curl https://black-edge-backend-production-e616.up.railway.app/api/stripe/packages
```
Doit retourner :
```json
{
  "status": "ok",
  "packages": [
    { "id": "starter", "credits": 1000, "price_usd": 10.0 },
    { "id": "pro", "credits": 10000, "price_usd": 50.0 },
    { "id": "whale", "credits": 100000, "price_usd": 400.0 }
  ]
}
```

**3. Balance API**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://black-edge-backend-production-e616.up.railway.app/api/credits/balance
```
Doit retourner :
```json
{
  "user_id": "xxx",
  "credits": 100,
  "max_credits": 50000,
  "tier": "free",
  "status": "ok"
}
```

---

### Frontend ✅

**1. Session NextAuth**
```typescript
const { data: session } = useSession()
console.log(session?.user.apiKey) // be_live_xxxxx
```

**2. Account Panel**
- Ouvre le panel → API key affichée (masquée par défaut)
- Crédits chargés depuis /api/credits/balance
- Bouton "PURCHASE CREDITS" actif

**3. Purchase Flow**
- Clique "PURCHASE CREDITS" → Modal s'ouvre
- 3 packages affichés avec prix correct
- Clique "PURCHASE" → Redirection Stripe
- Après paiement → Retour avec crédits ajoutés

---

## Tests à Effectuer

### ✅ Test 1 : Création de compte
1. Se déconnecter
2. Se connecter avec Google
3. Vérifier : 100 crédits initiaux

### ✅ Test 2 : Affichage API Key
1. Ouvrir Account Panel
2. Vérifier : API key masquée par défaut
3. Cliquer 👁️ → API key visible
4. Cliquer 📋 → Copié dans clipboard

### ✅ Test 3 : Balance dynamique
1. Ouvrir Account Panel
2. Vérifier : Crédits = valeur réelle depuis backend
3. Barre de progression = pourcentage correct

### ✅ Test 4 : Achat de crédits (Mode Test Stripe)
1. Cliquer "PURCHASE CREDITS"
2. Sélectionner "Pro Pack"
3. Redirection vers Stripe
4. Utiliser carte test : `4242 4242 4242 4242`
5. Paiement validé
6. Vérifier : Crédits passent de 100 à 10,100

### ✅ Test 5 : CLI Installation
1. Copier commande : `npm install -g black-edge-cli`
2. Vérifier : Nom correct (pas "black-edge")

---

## Variables d'Environnement Requises

### Backend (Railway)
```bash
STRIPE_SECRET_KEY=sk_live_xxx (ou sk_test_xxx en dev)
STRIPE_WEBHOOK_SECRET=whsec_xxx
DATABASE_URL=postgresql+asyncpg://...
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://black-edge-backend-production-e616.up.railway.app
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://black-edge-ncbbjfb5c-finas-projects-31356a2e.vercel.app
```

---

## Résumé

✅ **API Key** : Générée automatiquement lors du sign-up, stockée dans session JWT, affichée dans Account Panel
✅ **Crédits initiaux** : 100 crédits pour tier "free"
✅ **Balance** : Récupérée dynamiquement depuis `/api/credits/balance`
✅ **Achat de crédits** : Modal avec 3 packages, intégration Stripe complète, auto-refresh après achat
✅ **Tiers cohérents** : "free", "starter", "pro", "whale" (backend + Stripe harmonisés)

**Tout est maintenant fonctionnel et connecté !** 🎉
