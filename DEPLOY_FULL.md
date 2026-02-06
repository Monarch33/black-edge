# 🚀 DÉPLOIEMENT COMPLET - BLACK EDGE

Guide étape par étape pour déployer **Black Edge en production** avec :
- ✅ Backend Railway (données live Polymarket)
- ✅ Frontend Vercel
- ✅ Stripe payments fonctionnels
- ✅ Tout configuré et opérationnel

---

## 📋 CE QUI A ÉTÉ PRÉPARÉ

✅ **Fichiers Railway créés** :
- `backend/Procfile` - Configuration de démarrage
- `backend/railway.json` - Configuration Railway
- `backend/main.py` - CORS mis à jour pour Vercel

✅ **Code corrigé** :
- Stripe graceful fallback (pas de crash)
- Badge MOCK/LIVE data visible
- Meilleure gestion des erreurs

---

## 🎯 DÉPLOIEMENT - ÉTAPE PAR ÉTAPE

### ÉTAPE 1 : Commit et Push (30 secondes)

```bash
cd /Users/camil/CascadeProjects/windsurf-project

# Commit des nouveaux fichiers
git add .
git commit -m "Add Railway config + CORS for Vercel deployment"
git push origin main
```

**✅ Résultat** : Code prêt pour Railway et Vercel

---

### ÉTAPE 2 : Déployer Backend sur Railway (5 minutes)

#### 2.1 Créer compte Railway
1. Va sur https://railway.app/
2. Clique **"Start a New Project"** → **"Login with GitHub"**
3. Autorise Railway à accéder à GitHub

#### 2.2 Créer projet
1. Clique **"New Project"**
2. Sélectionne **"Deploy from GitHub repo"**
3. Cherche et sélectionne **"black-edge"** (ton repo)

#### 2.3 Configurer le déploiement
Railway va détecter le Python automatiquement. Configure :

1. **Root Directory** : Clique sur "Settings" → "Root Directory" → Entre : `/backend`
2. **Build Command** : (Automatique, laisse vide)
3. **Start Command** : Railway utilisera le Procfile automatiquement

#### 2.4 Ajouter les Variables d'Environnement

Clique sur **"Variables"** et ajoute ces variables **UNE PAR UNE** :

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `PORT` | Railway le génère auto | **NE PAS AJOUTER** |
| `ENVIRONMENT` | `production` | Obligatoire |
| `POLYGON_RPC_URL` | Copie depuis ton `backend/.env` | Ton Alchemy URL |
| `STRIPE_SECRET_KEY` | Copie depuis ton `backend/.env` | Ta clé sk_live_... |
| `LLM_API_KEY` | Copie depuis ton `backend/.env` (optionnel) | OpenAI key si utilisée |

**⚠️ IMPORTANT** :
- Utilise les valeurs EXACTES de ton fichier `backend/.env`
- Ne partage JAMAIS ces clés publiquement
- Railway les chiffre automatiquement

#### 2.5 Déployer
1. Railway va commencer à déployer automatiquement
2. Attends 2-3 minutes (tu verras les logs défiler)
3. Une fois terminé, clique sur **"Settings"** → **"Networking"**
4. Clique **"Generate Domain"**
5. **📋 COPIE L'URL** (ex: `https://backend-production-xxxx.up.railway.app`)

**✅ Résultat** : Backend déployé ! Note l'URL quelque part.

---

### ÉTAPE 3 : Configurer Vercel avec TOUTES les variables (3 minutes)

#### 3.1 Aller sur Vercel Dashboard
```bash
# Ouvre dans ton navigateur
https://vercel.com/dashboard
```

#### 3.2 Configurer les Variables d'Environnement

1. Clique sur ton projet **"black-edge"**
2. Va dans **"Settings"** → **"Environment Variables"**
3. Ajoute **TOUTES** ces variables :

| Variable Name | Value | Où l'obtenir |
|---------------|-------|--------------|
| `NEXT_PUBLIC_API_URL` | **L'URL Railway** (étape 2.5) | Ex: `https://backend-production-xxxx.up.railway.app` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Copie depuis `frontend/.env.local` | Ta clé `pk_live_...` ou `pk_test_...` |
| `STRIPE_SECRET_KEY` | Copie depuis `frontend/.env.local` | Ta clé `sk_live_...` ou `sk_test_...` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Copie depuis `frontend/.env.local` | Ton WalletConnect ID |
| `NEXT_PUBLIC_STRIPE_PRICE_ID_RUNNER` | (Optionnel) | Si tu as un Price ID Stripe |

**Pour chaque variable** :
- Clique **"Add New"**
- Name : Copie le nom exact
- Value : Colle la valeur
- Environments : ✅ **Production**, ✅ **Preview**, ✅ **Development**
- Clique **"Save"**

#### 3.3 Note sur les clés Stripe

Si tu n'as pas encore tes clés Stripe dans `frontend/.env.local` :

1. Va sur https://dashboard.stripe.com/test/apikeys (ou /live si en prod)
2. Copie :
   - **Publishable key** : `pk_test_...` ou `pk_live_...`
   - **Secret key** : `sk_test_...` ou `sk_live_...`

**⚠️ Utilise TEST en développement, LIVE seulement en production réelle !**

---

### ÉTAPE 4 : Déployer Frontend sur Vercel (2 minutes)

```bash
cd /Users/camil/CascadeProjects/windsurf-project/frontend

# Déployer en production
npx vercel --prod
```

Vercel va :
1. Builder ton app Next.js
2. Déployer sur le CDN global
3. Te donner une URL finale

**✅ Résultat** : Site en ligne ! Note l'URL.

---

### ÉTAPE 5 : Vérifier TOUT fonctionne (2 minutes)

#### 5.1 Ouvrir le site
Va sur l'URL Vercel (ex: `https://black-edge-xxx.vercel.app`)

#### 5.2 Checklist de vérification

- [ ] **Logo s'affiche** (en haut à gauche)
- [ ] **Badge "LIVE DATA" 🟢** est visible (pas "MOCK DATA")
- [ ] **Wallet se connecte** (MetaMask/Rainbow)
- [ ] **Marchés Polymarket** s'affichent avec vraies données
- [ ] **Prix changent** si tu refreshes (données en temps réel)
- [ ] **Stripe checkout** s'ouvre quand tu cliques sur "Runner" plan
- [ ] **Pas d'erreur** dans la console navigateur (F12)

#### 5.3 Vérifier le Backend
Va sur `https://ton-backend-railway.app/docs` (remplace par ton URL)

Tu devrais voir :
- ✅ Swagger UI (documentation API)
- ✅ Endpoint `/api/opportunities`
- ✅ Clique "Try it out" → "Execute" → Devrait retourner des données

---

## 🎉 FÉLICITATIONS !

Si tout fonctionne, tu as maintenant :
- 🟢 **Backend live** sur Railway avec données Polymarket en temps réel
- 🟢 **Frontend live** sur Vercel avec UI premium
- 🟢 **Stripe configuré** pour les paiements
- 🟢 **Production ready** pour de vrais utilisateurs

---

## 🐛 DÉPANNAGE

### Badge reste "MOCK DATA" 🟡
**Cause** : Frontend ne peut pas joindre le backend

**Solutions** :
1. Vérifie que `NEXT_PUBLIC_API_URL` est correcte sur Vercel (doit être l'URL Railway)
2. Vérifie que le backend Railway est bien déployé (vert dans Railway dashboard)
3. Teste l'URL backend directement : `https://ton-backend.railway.app/api/opportunities`
4. Redéploie le frontend : `npx vercel --prod`

### Erreur CORS
**Cause** : Backend refuse les requêtes de Vercel

**Solution** : J'ai déjà fixé ça ! Mais si problème persiste :
- Vérifie que le code poussé sur GitHub contient la mise à jour CORS
- Redéploie sur Railway (devrait se faire auto)

### Stripe ne marche pas
**Cause** : Variables manquantes

**Solutions** :
1. Vérifie que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` est sur Vercel
2. Vérifie que `STRIPE_SECRET_KEY` est sur Vercel
3. Vérifie que les clés commencent par `pk_` et `sk_`
4. Redéploie : `npx vercel --prod`

### Backend Railway crash
**Cause** : Variable manquante ou erreur de code

**Solutions** :
1. Va dans Railway → Ton projet → "Deployments" → Clique sur le dernier
2. Lis les logs pour voir l'erreur
3. Souvent : variable `POLYGON_RPC_URL` manquante
4. Ajoute-la et redéploie

---

## 📊 ARCHITECTURE FINALE

```
┌─────────────────────────────────────────────────────────┐
│                     UTILISATEUR                          │
│                  (Navigateur Web)                        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              VERCEL (Frontend Next.js)                   │
│  • UI Premium avec glassmorphism                         │
│  • Terminal view avec données live                       │
│  • Connexion wallet (RainbowKit)                         │
│  • Badge LIVE DATA 🟢                                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│            RAILWAY (Backend FastAPI)                     │
│  • Polymarket Gamma API polling                          │
│  • Quant analytics (Kelly, edge detection)               │
│  • WebSocket pour streaming                              │
│  • /api/opportunities endpoint                           │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│     SERVICES EXTERNES                                    │
│  • Polymarket Gamma API (marchés)                        │
│  • Alchemy RPC (Polygon blockchain)                      │
│  • Stripe API (paiements)                                │
│  • The Graph (portfolio positions)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 PROCHAINES ÉTAPES

Une fois en ligne, tu peux :
1. **Personnaliser le domaine** : Vercel → Settings → Domains
2. **Ajouter analytics** : Vercel Analytics (gratuit)
3. **Monitorer les erreurs** : Railway logs
4. **Scaler** : Railway augmente automatiquement la capacité

---

## 📞 BESOIN D'AIDE ?

Si tu es bloqué à une étape :
1. Note le numéro de l'étape
2. Copie l'erreur exacte que tu vois
3. Dis-moi où tu es bloqué

Je te guiderai ! 🎯

---

**Made with 💎 by Black Edge Team**
**Powered by Railway, Vercel, Polymarket, and Pure Alpha**

⚡ **THE EDGE IS REAL. THE TRADES ARE LIVE. LET'S MAKE ALPHA.** ⚡
