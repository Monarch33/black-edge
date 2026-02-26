# 🚀 Déploiement Black Edge Backend

## ✨ Cette approche Docker garde TOUTES les fonctionnalités

Plus de compromis, plus de fonctionnalités enlevées. Tout marche.

## 📋 Prérequis

- Compte GitHub avec le repo
- Compte Render.com

## 🐳 Étape 1 : Tester localement (optionnel)

```bash
cd backend
./docker-test.sh
```

Cela va :
- Builder l'image Docker
- Lancer le serveur sur http://localhost:8000
- Tester que tout marche avec TOUTES les dépendances

## 📤 Étape 2 : Pousser sur GitHub

```bash
cd /Users/camil/CascadeProjects/windsurf-project
git add backend/Dockerfile backend/.dockerignore backend/render.yaml backend/docker-test.sh
git commit -m "🐳 Add Docker deployment with full features"
git push origin main
```

## 🌐 Étape 3 : Configurer Render

### 3.1 Créer un nouveau Web Service

1. Aller sur https://dashboard.render.com
2. Cliquer "New +" → "Web Service"
3. Connecter votre repo GitHub
4. Sélectionner le repo `windsurf-project`

### 3.2 Configuration du service

**Important :** Render va détecter le `render.yaml` automatiquement !

- **Name:** `black-edge-backend`
- **Region:** Oregon (US West) ou autre
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** Docker ⬅️ IMPORTANT
- **Docker Build Context Directory:** `./`
- **Dockerfile Path:** `./Dockerfile`

### 3.3 Environment Variables

Ajouter ces variables :

```
ENVIRONMENT=production
POLYGON_RPC_URL=<your_alchemy_polygon_rpc_url>
STRIPE_SECRET_KEY=<your_stripe_secret_key>
```

**Note:** Utilisez vos vraies clés (vous les avez déjà dans votre .env local)

### 3.4 Plan

- **Instance Type:** Free
- **Auto-Deploy:** Yes

### 3.5 Déployer

Cliquer "Create Web Service"

## ✅ Vérification

Une fois déployé, votre backend sera disponible à :
- URL : `https://black-edge-backend.onrender.com`
- Health : `https://black-edge-backend.onrender.com/health`
- API Docs : `https://black-edge-backend.onrender.com/docs`

Vérifier que :
- ✅ Health endpoint répond
- ✅ `/api/opportunities` retourne des données Polymarket LIVE
- ✅ Logs montrent "✅ Arbitrage router enabled" (pas "disabled")
- ✅ Logs montrent "✅ Advanced features available"

## 🎯 Étape 4 : Configurer le Frontend

Copier l'URL du backend et l'ajouter dans Vercel :

1. Aller sur https://vercel.com/dashboard
2. Sélectionner votre projet frontend
3. Settings → Environment Variables
4. Ajouter :
   ```
   NEXT_PUBLIC_API_URL=https://black-edge-backend.onrender.com
   ```
5. Redéployer le frontend

## 🔥 Avantages de cette approche

- ✅ **Toutes les fonctionnalités** : numpy, pandas, scipy, cvxpy
- ✅ **Détection d'arbitrage** : 100% fonctionnelle
- ✅ **Kelly Criterion** : Tous les calculs quantitatifs
- ✅ **Risk Calculator** : Complètement opérationnel
- ✅ **Pas de compromis** : Exactement comme en local
- ✅ **Builds reproductibles** : Docker garantit la cohérence
- ✅ **Pas de cache issues** : Chaque build est propre

## 🐛 Troubleshooting

### Build qui échoue

```bash
# Tester localement d'abord
cd backend
docker build -t test .
```

### Runtime qui échoue

Vérifier les logs Render :
- Est-ce que toutes les env vars sont définies ?
- Est-ce que le port 8000 est bien exposé ?

### Fonctionnalités "disabled"

Si vous voyez "Advanced features disabled" dans les logs, c'est que numpy n'a pas été installé.
Vérifier que Render utilise bien le Dockerfile et pas le buildpack Python.

## 📝 Notes

- Le premier build Docker prend ~5-10 minutes (compile numpy/pandas/scipy)
- Les builds suivants sont plus rapides grâce au cache Docker
- Le plan Free de Render a 750h/mois - largement suffisant
