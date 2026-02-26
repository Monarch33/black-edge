# 🚀 DÉPLOIEMENT EXPRESS - BLACK EDGE

Guide ultra-rapide pour mettre ton app en ligne **maintenant**.

---

## ✅ CE QUI A ÉTÉ FIXÉ

1. ✅ **Stripe ne crash plus** - L'app fonctionne même sans clé Stripe (bouton désactivé)
2. ✅ **Badge "MOCK DATA" visible** - Tu vois clairement si tu es en mode mock ou live
3. ✅ **Messages d'erreur clairs** - Plus de confusion sur l'origine des problèmes

---

## 🎯 DÉPLOIEMENT EN 3 ÉTAPES

### ÉTAPE 1 : Commit + Push (1 minute)

```bash
cd /Users/camil/CascadeProjects/windsurf-project

# Commit des correctifs
git add .
git commit -m "Fix: Stripe graceful degradation + Mock data indicator"
git push origin main
```

### ÉTAPE 2 : Déployer Frontend sur Vercel (2 minutes)

```bash
cd frontend
npx vercel --prod
```

**Résultat** : Ton site est en ligne ! Il affichera "MOCK DATA" pour l'instant.

---

### ÉTAPE 3 : Obtenir les Clés Stripe (Optionnel - 2 minutes)

**Si tu veux activer les paiements** :

1. **Créer compte Stripe** : https://dashboard.stripe.com/register
2. **Obtenir les clés** : https://dashboard.stripe.com/test/apikeys
   - Publishable key : `pk_test_...`
   - Secret key : `sk_test_...` (clique "Reveal")

3. **Ajouter sur Vercel** :
   - Va sur https://vercel.com/dashboard → Ton projet → Settings → Environment Variables
   - Ajoute :
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
     - `STRIPE_SECRET_KEY` = `sk_test_...`
   - Redéploie : `npx vercel --prod`

---

## 🐍 ÉTAPE 4 : Déployer le Backend (Optionnel - 10 minutes)

**Si tu veux les VRAIES données Polymarket** :

### Option A : Railway (Recommandé - Gratuit)

1. **Créer compte** : https://railway.app/
2. **Nouveau projet** : "New Project" → "Deploy from GitHub repo"
3. **Connecter GitHub** : Sélectionne ton repo `black-edge`
4. **Configurer** :
   - Root Directory : `/backend`
   - Build Command : `pip install -r requirements.txt`
   - Start Command : `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Variables d'environnement** (Settings → Variables) :
   ```
   ALCHEMY_API_KEY=ton_alchemy_key
   POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/TON_KEY
   ```
6. **Copier l'URL du backend** : Ex: `https://backend-production-xxx.up.railway.app`

### Option B : Render (Gratuit mais plus lent)

1. **Créer compte** : https://render.com/
2. **New → Web Service**
3. **Connecter GitHub** : Sélectionne ton repo
4. **Configurer** :
   - Root Directory : `backend`
   - Build Command : `pip install -r requirements.txt`
   - Start Command : `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Ajouter variables d'environnement**

### Finaliser

Une fois le backend déployé :

```bash
# Ajouter l'URL du backend sur Vercel
vercel env add NEXT_PUBLIC_API_URL production
# Entre l'URL : https://ton-backend.railway.app

# Redéployer
npx vercel --prod
```

**Résultat** : Le badge changera de "MOCK DATA" 🟡 à "LIVE DATA" 🟢 automatiquement !

---

## 📊 VÉRIFICATION FINALE

Ton app devrait maintenant :
- ✅ Être accessible sur `https://black-edge-xxx.vercel.app`
- ✅ Afficher un badge **"MOCK DATA"** (jaune) ou **"LIVE DATA"** (vert)
- ✅ Permettre la connexion wallet (si `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` configuré)
- ✅ Afficher un message clair si Stripe n'est pas configuré

---

## 🆘 RÉSOLUTION RAPIDE

### "MOCK DATA" s'affiche en permanence
➡️ **Solution** : Déploie le backend (Étape 4) et ajoute `NEXT_PUBLIC_API_URL` sur Vercel

### "Stripe not configured"
➡️ **Solution** : Suis l'Étape 3 pour obtenir les clés Stripe

### Wallet ne se connecte pas
➡️ **Solution** : Ajoute `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` sur Vercel
   - Obtiens-le sur https://cloud.walletconnect.com

---

## 🎉 ÉTAT ACTUEL

Après avoir poussé ces correctifs, ton app :
- ✅ Ne crashe plus (Stripe géré gracieusement)
- ✅ Affiche clairement l'état des données (MOCK/LIVE)
- ✅ Est déployable sur Vercel immédiatement

**Prochaine étape** : Déploie maintenant avec `npx vercel --prod` !

---

**Made with 💎 by Black Edge**
