# 🌐 Agora — Réseau Social Libre

Réseau social minimaliste déployable en 2 minutes sur Vercel.

## Fonctionnalités
- Inscription avec pseudo + avatar emoji
- Publication de messages (max 500 caractères)
- Likes et commentaires
- Actualisation automatique toutes les 5 secondes
- Base de données en mémoire (persiste tant que le serveur tourne)

## Déploiement sur Vercel (2 minutes)

### Option 1 — Via GitHub (recommandé)
1. Crée un repo GitHub et pousse ce code
2. Va sur [vercel.com](https://vercel.com) → "New Project"
3. Importe ton repo → Deploy !

### Option 2 — Via Vercel CLI
```bash
npm i -g vercel
cd social-app
vercel
```
Réponds aux questions, ton app sera en ligne en ~1 minute.

## Développement local
```bash
npm install
npm run dev
# → http://localhost:3000
```

## ⚠️ Note sur la persistance
Les données sont en mémoire RAM. Elles sont perdues si :
- Le serveur Vercel redémarre (cold start après inactivité)
- Plusieurs instances tournent en parallèle

Pour une persistance réelle, ajoute **Vercel KV** (Redis gratuit) :
1. Dashboard Vercel → Storage → Create KV Database
2. Remplace le store.js par des appels à `@vercel/kv`
