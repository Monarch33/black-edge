# 🚀 Black Edge - Guide Utilisateur

Bienvenue sur **Black Edge**, votre terminal HFT institutionnel pour les marchés de prédiction.

---

## 📋 **Table des Matières**

1. [Démarrage Rapide](#démarrage-rapide)
2. [Inscription & API Key](#inscription--api-key)
3. [Utilisation Web Terminal](#utilisation-web-terminal)
4. [CLI Installation](#cli-installation)
5. [Achat de Crédits](#achat-de-crédits)
6. [Signaux de Trading](#signaux-de-trading)
7. [FAQ](#faq)
8. [Support](#support)

---

## ⚡ **Démarrage Rapide**

### 1. Créer un Compte (2 minutes)

1. Va sur **https://black-edge-ncbbjfb5c-finas-projects-31356a2e.vercel.app**
2. Clique sur **"LOG IN"** en haut à droite
3. Connecte-toi avec :
   - **Google** (recommandé)
   - **Wallet Crypto** (MetaMask, WalletConnect)
4. Tu reçois automatiquement une **API key** et **100 crédits gratuits** !

### 2. Voir les Signaux (Immédiat)

Une fois connecté :
- Les signaux apparaissent en temps réel sur la page d'accueil
- Chaque signal coûte **1 crédit**
- Tu as **100 crédits gratuits** pour commencer

### 3. Installer le CLI (Optionnel - 2 minutes)

Pour les power users qui veulent un terminal local :

```bash
npm install -g black-edge-cli
black-edge start
```

Entre ton API key quand demandé, et c'est parti ! 🚀

---

## 🔑 **Inscription & API Key**

### Créer un Compte

**Via Google OAuth** (Recommandé) :
1. Clique sur "LOG IN"
2. Sélectionne "Continue with Google"
3. Autorise Black Edge
4. ✅ Compte créé !

**Via Wallet Crypto** :
1. Clique sur "LOG IN"
2. Sélectionne "Connect Wallet"
3. Connecte ton wallet (MetaMask, WalletConnect, Coinbase)
4. ✅ Compte créé !

### Récupérer ton API Key

1. Clique sur ton **avatar** en haut à droite
2. Le panneau **Account** s'ouvre
3. Ton API key est affichée (format `be_live_xxxxx`)
4. Clique sur **"COPY"** pour la copier
5. Clique sur **👁️** pour l'afficher en clair

⚠️ **Ne partage JAMAIS ton API key !** Elle donne accès à tes crédits.

---

## 🖥️ **Utilisation Web Terminal**

### Interface Principale

**Header** :
- **LOG IN** : Se connecter
- **OPEN TERMINAL** : Ouvrir le terminal en plein écran (réservé Premium)
- **Avatar** : Accéder à ton compte

**Tableau de Signaux** :
Chaque signal affiche :
- **Market** : Le marché Polymarket
- **Edge** : L'avantage détecté (%)
- **Council Vote** : Vote du conseil IA (ex: 4/5 YES)
- **Kelly** : Taille de position recommandée (%)
- **Side** : YES ou NO

### Filtres

- **All** : Tous les signaux
- **Oracle** : Signaux basés sur le sentiment
- **Sniper** : Opportunités d'arbitrage

### Actions

**Cliquer sur un signal** :
- Ouvre la page Polymarket du marché
- Tu peux trader manuellement sur Polymarket

---

## 💻 **CLI Installation**

### Installation

```bash
npm install -g black-edge-cli
```

### Premier Lancement

```bash
black-edge start
```

**Setup guidé** :
1. **API Key** : Entre ton API key (récupérée sur le web)
2. **Balance** : Affiche tes crédits restants
3. **Polymarket Keys** (Optionnel) : Configure tes clés Polymarket
4. **Strategy** : Choisis Oracle ou Sniper

### Configuration

Le CLI sauvegarde ta config dans `~/.blackedge/config.json`

**Reset la configuration** :
```bash
black-edge reset
```

### Utilisation

Une fois lancé, le CLI affiche :
- 📡 Signaux en temps réel
- 💳 Balance de crédits après chaque signal
- 🔥 Edge et recommandations

**Arrêter le CLI** : `Ctrl+C`

---

## 💳 **Achat de Crédits**

### Packages Disponibles

| Package | Crédits | Prix | Prix/Crédit |
|---------|---------|------|-------------|
| **Starter** | 1,000 | $10 | $0.01 |
| **Pro** | 10,000 | $50 | $0.005 |
| **Whale** | 100,000 | $400 | $0.004 |

### Acheter des Crédits

**Via Web** :
1. Clique sur ton **avatar**
2. Clique sur **"PURCHASE CREDITS"**
3. Choisis un package
4. Paiement sécurisé via **Stripe**
5. ✅ Crédits ajoutés automatiquement !

**Via API** :
```bash
curl -X POST https://black-edge-backend-production-e616.up.railway.app/api/stripe/create-checkout \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"package": "pro"}'
```

### Balance de Crédits

**Vérifier ta balance** :
```bash
curl https://black-edge-backend-production-e616.up.railway.app/api/credits/balance \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 📊 **Signaux de Trading**

### Que Signifie Chaque Métrique ?

**Edge (%)** :
- Avantage mathématique détecté
- Plus l'edge est élevé, meilleure est l'opportunité
- Exemple : 12.4% edge = le marché sous-évalue de 12.4%

**Council Vote** :
- Vote des 5 agents IA du conseil
- Format : `4/5 YES` = 4 agents sur 5 votent YES
- Unanimité (5/5) = signal très fort

**Kelly (%)** :
- Taille de position recommandée selon Kelly Criterion
- Exemple : 8.2% = mise 8.2% de ton capital
- ⚠️ Ne jamais dépasser la recommandation Kelly !

**Side** :
- **YES** : Acheter YES (événement va arriver)
- **NO** : Acheter NO (événement n'arrivera pas)

### Comment Trader un Signal ?

1. **Reçois le signal** (Web ou CLI)
2. **Analyse** : Regarde Edge, Council, Kelly
3. **Décide** : Es-tu d'accord avec l'analyse ?
4. **Trade** : Va sur Polymarket et exécute
5. **Track** : Suis la performance

⚠️ **Disclaimer** : Black Edge fournit des signaux, pas des conseils financiers. Trade à tes risques.

---

## ❓ **FAQ**

### **Q : C'est quoi Black Edge ?**
Black Edge est un système HFT (High-Frequency Trading) qui analyse 447+ marchés Polymarket en temps réel et détecte des opportunités d'arbitrage et de sentiment.

### **Q : Comment ça fonctionne ?**
5 agents IA spécialisés analysent chaque marché :
- **Quant Agent** : Analyse mathématique
- **Sentiment Agent** : Analyse des news
- **Whale Agent** : Suit les gros traders
- **Risk Agent** : Évalue le risque
- **Oracle Agent** : Synthèse finale

### **Q : Combien coûte un signal ?**
1 crédit = 1 signal. Tu as 100 crédits gratuits au départ.

### **Q : Les signaux sont-ils rentables ?**
Les performances passées ne garantissent pas les résultats futurs. Utilise Black Edge comme un outil d'aide à la décision, pas comme un robot de trading automatique.

### **Q : Puis-je trader automatiquement ?**
Pas encore. Le trading automatique arrive bientôt. Pour l'instant, les signaux sont manuels.

### **Q : Black Edge trade-t-il pour moi ?**
Non. Black Edge **analyse** et **recommande**. Tu dois exécuter les trades manuellement sur Polymarket.

### **Q : Combien de marchés sont analysés ?**
447+ marchés Polymarket actifs, représentant ~$91M de volume quotidien.

### **Q : À quelle fréquence les signaux sont-ils mis à jour ?**
En temps réel. Chaque nouveau signal est diffusé instantanément via WebSocket.

### **Q : Puis-je utiliser Black Edge sur mobile ?**
Oui ! Le web terminal fonctionne sur mobile. Le CLI nécessite un ordinateur.

### **Q : Mes crédits expirent-ils ?**
Non. Tes crédits sont valables à vie.

---

## 🆘 **Support**

### Problèmes Techniques

**CLI ne démarre pas** :
```bash
# Vérifier Node.js (requis >=16)
node --version

# Réinstaller
npm uninstall -g black-edge-cli
npm install -g black-edge-cli
```

**API Key invalide** :
1. Reconnecte-toi sur le web
2. Récupère une nouvelle API key
3. Reset le CLI : `black-edge reset`

**Pas de signaux** :
- Vérifie ta balance de crédits
- Vérifie ta connexion internet
- Attends 30-60 secondes (signaux viennent en temps réel)

### Contact

- 📧 **Email** : support@blackedge.io
- 💬 **Discord** : [discord.gg/blackedge](https://discord.gg/blackedge)
- 🐦 **Twitter** : [@BlackEdgeHFT](https://twitter.com/BlackEdgeHFT)
- 📚 **Docs** : [docs.blackedge.io](https://docs.blackedge.io)

---

## 🎯 **Best Practices**

1. **Diversifie** : Ne mise pas tout sur un seul signal
2. **Respecte Kelly** : Ne dépasse jamais la taille recommandée
3. **Fais tes recherches** : Vérifie toujours les signaux avant de trader
4. **Gère ton risque** : Utilise des stop-loss
5. **Track ta performance** : Note tes trades pour apprendre

---

## 🚀 **Prochaines Fonctionnalités**

- ✅ **Trading automatique** : Exécution auto des signaux
- ✅ **Backtesting** : Teste les stratégies historiquement
- ✅ **Portfolio tracking** : Suis tes positions en temps réel
- ✅ **Alertes Discord/Telegram** : Reçois les signaux par message
- ✅ **Mobile app** : Application iOS/Android native

---

**Prêt à commencer ?** 🎉

👉 **https://black-edge-ncbbjfb5c-finas-projects-31356a2e.vercel.app**

*Built with ⚡ by the Black Edge team*
