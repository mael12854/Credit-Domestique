# Crédit Domestique

Banque fictive familiale — React + Vite, données partagées en direct entre
tous les appareils de la famille via Supabase.

> Établissement fictif · aucune valeur légale

**En ligne :** https://credit-domestique.vercel.app

## Démarrer

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — vérification des types puis build de production
- `npm test` — tests unitaires (Vitest) du moteur bancaire
- `npm run lint` — Oxlint

## Architecture

- `src/lib/bank.ts` — moteur métier pur : comptabilité en double écriture,
  calcul des intérêts (33,33 % arrondi au centime supérieur), dépôts/retraits
  d'espèces, virements, prêts, ajustements et annulations administrateur.
- `src/lib/types.ts` — modèle de données (`Account`, `Entry`, `Loan`).
- `src/lib/seed.ts` — comptes de démonstration (voir plus bas) ; sert de
  fixture aux tests, le vrai amorçage vit dans la migration Supabase.
- `src/lib/supabaseClient.ts` / `src/lib/supabaseSync.ts` — client Supabase et
  synchronisation : chargement initial, diff optimiste vers les tables, et
  rafraîchissement en direct via Supabase Realtime quand un autre appareil
  modifie les données.
- `src/store/BankProvider.tsx` — état applicatif. Les données partagées
  (comptes, écritures, prêts, taux) vivent dans Supabase ; la session (qui est
  connecté, sous quelle identité) reste locale à l'appareil (`localStorage`).
- `src/store/NavProvider.tsx` — navigation en pile (un écran à la fois, retour disponible).

## Supabase

Projet : `Credit-Domestique` (org `Crédit Domestique`). Aucune authentification
par utilisateur — la clé publique (`sb_publishable_...`, embarquée dans le
bundle par conception) suffit à lire/écrire, comme choisi pour cette appli
familiale sans valeur réelle. Les écritures (`entries`) n'ont pas de policy
`update`/`delete` : la comptabilité en double écriture reste immuable au
niveau de la base, pas seulement par convention côté client.
- `src/screens/` — Connexion, Compte, Historique, Virement, Dépôt/Retrait
  d'espèces, Emprunt, Entreprises, Admin.

## Comptes de démonstration

| Titulaire | Rôle | Numéro | CVC | Exp. |
| --- | --- | --- | --- | --- |
| MAËL FONDATEUR | admin | 4972 0031 8846 5120 | 417 | 08/30 |
| RENAUD · PARENT | parent | 4972 0031 8846 5138 | 204 | 11/29 |
| ADELINE · PARENT | parent | 4972 0031 8846 5146 | 851 | 11/29 |
| MARIN · FOYER | enfant | 4972 0031 8846 5153 | 639 | 06/31 |
| JOËL · FOYER | enfant | 4972 0031 8846 5161 | 728 | 06/31 |

Numéros et CVC fictifs, sans rapport avec un vrai réseau de carte.
