# 🚀 MISE EN LIGNE - BLACK EDGE v1.0

Guide complet pour déployer Black Edge sur GitHub et Vercel.

---

## 📋 PRÉ-REQUIS

Avant de commencer, assure-toi d'avoir :
- ✅ Un compte GitHub (gratuit sur [github.com](https://github.com))
- ✅ Un compte Vercel (gratuit sur [vercel.com](https://vercel.com))
- ✅ Les variables d'environnement configurées dans `.env.local`

---

## 🔧 ÉTAPE 1 : INITIALISER LE DÉPÔT GIT

Dans le terminal de Windsurf, tape ces commandes :

```bash
# Initialiser le dépôt Git
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "Initial Release v1.0 - Black Edge"
```

**✅ Résultat attendu :** Tu devrais voir un message confirmant le commit avec le nombre de fichiers ajoutés.

---

## 🐙 ÉTAPE 2 : CRÉER LE DÉPÔT GITHUB

### Option A : Avec GitHub CLI (Recommandé si installé)

```bash
# Créer le dépôt et pousser en une commande
gh repo create black-edge --public --source=. --remote=origin --push
```

### Option B : Manuellement (Si pas de GitHub CLI)

1. **Créer le dépôt sur GitHub :**
   - Va sur [github.com/new](https://github.com/new)
   - Nom du dépôt : `black-edge`
   - Visibilité : **Public** (ou Private si tu préfères)
   - **NE COCHE PAS** "Initialize with README"
   - Clique sur **"Create repository"**

2. **Lier ton projet local au dépôt GitHub :**
   ```bash
   # Remplace TON_USERNAME par ton nom d'utilisateur GitHub
   git remote add origin https://github.com/TON_USERNAME/black-edge.git

   # Pousser le code
   git branch -M main
   git push -u origin main
   ```

**✅ Résultat attendu :** Ton code est maintenant sur GitHub ! Va voir sur `https://github.com/TON_USERNAME/black-edge`

---

## ⚡ ÉTAPE 3 : DÉPLOYER SUR VERCEL

### A. Préparer le frontend

```bash
# Aller dans le dossier frontend
cd frontend

# Installer Vercel CLI (si pas déjà installé)
npm install -g vercel

# Lancer le déploiement
npx vercel
```

### B. Répondre aux questions de Vercel

Vercel va te poser plusieurs questions :

```
? Set up and deploy "~/windsurf-project/frontend"?
→ Répondre : Y (Yes)

? Which scope do you want to deploy to?
→ Répondre : Ton nom d'utilisateur (appuie sur Entrée)

? Link to existing project?
→ Répondre : N (No, créer un nouveau projet)

? What's your project's name?
→ Répondre : black-edge (ou appuie sur Entrée pour accepter)

? In which directory is your code located?
→ Répondre : ./ (juste appuyer sur Entrée)

? Want to modify these settings?
→ Répondre : N (No)
```

**✅ Résultat attendu :** Vercel va builder et déployer ton app. Tu recevras une URL du type `https://black-edge-xxx.vercel.app`

---

## 🔐 ÉTAPE 4 : CONFIGURER LES VARIABLES D'ENVIRONNEMENT

**⚠️ CRITIQUE - NE PAS OUBLIER CETTE ÉTAPE !**

### Variables à copier depuis `.env.local` vers Vercel :

1. **Aller sur le dashboard Vercel :**
   - Ouvre [vercel.com](https://vercel.com)
   - Clique sur ton projet **"black-edge"**
   - Va dans **Settings** → **Environment Variables**

2. **Ajouter chaque variable une par une :**

#### 📡 Variables Frontend (Nécessaires)

| Variable | Exemple de valeur | Description |
|----------|-------------------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `abc123...` | ID de ton projet WalletConnect |
| `NEXT_PUBLIC_API_URL` | `https://ton-api.com` | URL de ton backend (voir ci-dessous) |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Clé secrète Stripe (pour les paiements) |

#### 🔗 Comment obtenir ces valeurs :

**WalletConnect Project ID :**
- Va sur [cloud.walletconnect.com](https://cloud.walletconnect.com)
- Créer un projet (gratuit)
- Copier le "Project ID"

**Backend API URL :**
- Si tu déploies le backend sur Railway/Render : `https://ton-backend.railway.app`
- Si local seulement : Laisser `http://localhost:8000` (mais ça ne marchera pas en production)

**Stripe Secret Key :**
- Va sur [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
- Copier la clé "Secret key"
- ⚠️ **Utilise la clé TEST** (`sk_test_...`) pour les tests
- ⚠️ **Utilise la clé LIVE** (`sk_live_...`) seulement en production

3. **Pour chaque variable :**
   - Clique **"Add New"**
   - Nom : Copie le nom exact (ex: `NEXT_PUBLIC_API_URL`)
   - Valeur : Colle la valeur depuis ton `.env.local`
   - Environment : Sélectionne **"Production"**, **"Preview"**, et **"Development"**
   - Clique **"Save"**

4. **Redéployer après avoir ajouté les variables :**
   ```bash
   # Dans le terminal, dans le dossier frontend :
   npx vercel --prod
   ```

**✅ Résultat attendu :** Ton app est maintenant 100% fonctionnelle avec toutes les connexions (Wallet, Stripe, API).

---

## 🐍 ÉTAPE 5 : DÉPLOYER LE BACKEND (OPTIONNEL)

Si tu veux que ton backend Python soit accessible publiquement (pour les signaux Polymarket en live) :

### Option A : Railway (Recommandé)

1. **Créer un compte sur [railway.app](https://railway.app)**
2. **Créer un nouveau projet**
3. **Déployer depuis GitHub :**
   - Connecte ton repo GitHub
   - Sélectionne le dossier `/backend`
   - Railway détectera automatiquement Python
4. **Ajouter les variables d'environnement :**
   - Copie toutes les variables du backend depuis `.env.local`
5. **Copier l'URL du backend :**
   - Ex: `https://backend-production-xxx.up.railway.app`
   - Mettre cette URL dans `NEXT_PUBLIC_API_URL` sur Vercel

### Option B : Render (Gratuit mais plus lent)

1. **Créer un compte sur [render.com](https://render.com)**
2. **New → Web Service**
3. **Connecter GitHub** et sélectionner ton repo
4. **Configuration :**
   - Root Directory : `backend`
   - Build Command : `pip install -r requirements.txt`
   - Start Command : `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Ajouter les variables d'environnement**

**✅ Résultat attendu :** Ton backend est live et accessible publiquement.

---

## 📊 CHECKLIST FINALE

Avant de déclarer le projet "EN LIGNE", vérifie :

### Frontend (Vercel)
- [ ] App accessible sur `https://black-edge-xxx.vercel.app`
- [ ] Logo s'affiche correctement
- [ ] Wallet se connecte (MetaMask/Rainbow)
- [ ] Stripe checkout fonctionne (mode test)
- [ ] Aucune erreur dans la console du navigateur

### Backend (Si déployé)
- [ ] API accessible sur `https://ton-backend.com/docs` (SwaggerUI)
- [ ] Endpoint `/api/opportunities` retourne des données
- [ ] Pas d'erreur 500 dans les logs

### Variables d'environnement
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` configuré
- [ ] `NEXT_PUBLIC_API_URL` pointe vers le bon backend
- [ ] `STRIPE_SECRET_KEY` configuré
- [ ] Toutes les variables ajoutées sur Vercel

### Git & GitHub
- [ ] Code poussé sur GitHub
- [ ] `.env.local` PAS dans le repo (vérifie avec `git log --all --full-history -- .env.local`)
- [ ] README.md à jour (optionnel mais pro)

---

## 🎯 COMMANDES RAPIDES (Récapitulatif)

```bash
# 1. Git Setup
git init
git add .
git commit -m "Initial Release v1.0 - Black Edge"

# 2. GitHub (Option CLI)
gh repo create black-edge --public --source=. --remote=origin --push

# 3. Vercel Deploy
cd frontend
npx vercel --prod

# 4. Vérifier le déploiement
curl https://black-edge-xxx.vercel.app/
```

---

## 🆘 DÉPANNAGE

### Erreur : "API not responding"
➡️ **Solution :** Vérifie que `NEXT_PUBLIC_API_URL` est correcte dans Vercel.

### Erreur : "Wallet not connecting"
➡️ **Solution :** Vérifie que `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` est configuré.

### Erreur : "Stripe checkout fails"
➡️ **Solution :** Vérifie que `STRIPE_SECRET_KEY` est la bonne clé (test ou live).

### Build Error sur Vercel
➡️ **Solution :** Vérifie les logs de build. Souvent causé par des dépendances manquantes dans `package.json`.

---

## 📞 SUPPORT

- **Documentation Vercel :** [vercel.com/docs](https://vercel.com/docs)
- **Documentation Railway :** [docs.railway.app](https://docs.railway.app)
- **WalletConnect :** [docs.walletconnect.com](https://docs.walletconnect.com)

---

## 🎉 FÉLICITATIONS !

Si tu as suivi toutes les étapes, **BLACK EDGE** est maintenant **EN LIGNE** ! 🚀

Partage le lien : `https://black-edge-xxx.vercel.app`

---

**Made with 💎 by Black Edge**
**Powered by Polymarket, Polygon, and Pure Alpha**
