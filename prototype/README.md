# UrgencePro — prototype de démonstration

Prototype cliquable, **sans aucun service connecté** : toutes les données sont fictives et générées dans le navigateur
(6 mois d'historique pour deux entreprises : une serrurerie à Lyon et une plomberie-chauffage à Bordeaux).
Les numéros de téléphone utilisent les plages réservées à la fiction par l'ARCEP.

Il sert à valider les parcours et l'ergonomie avant de construire l'application réelle (Next.js + Supabase, cf. `docs/ARCHITECTURE.md`).

## Lancer

```bash
cd prototype
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/index.html autonome (+ dist/urgencepro-demo.html pour publication)
```

## Ce qu'on peut tester

| Interface | Parcours |
|---|---|
| Back-office | Tableau de bord, demandes (liste + kanban glisser-déposer), fiche demande (validation de la qualification IA, prix transparent, photos, suggestion de technicien), appels (simulation d'appel entrant / manqué), planning glisser-déposer, carte en direct, clients (export RGPD), devis (éditeur + aperçu PDF + signature), factures (export FEC), techniciens, catalogue (simulateur de prix), statistiques, avis, paramètres, API et webhooks (flux d'événements en direct, rejeu, clés API) |
| Appli technicien | Accepter / refuser une mission, En route → Sur place → Terminé, rapport avec photos et pièces du stock, signature, encaissement (QR code, espèces, chèque, CB), mode hors connexion avec synchronisation |
| Parcours client | Envoi de photos et localisation, suivi du technicien en direct, consultation et signature du devis, paiement, avis |

Les trois interfaces partagent le même état : une action dans l'une (ex. « En route » côté technicien) met à jour les autres,
envoie les SMS simulés et émet les événements visibles dans *API et webhooks*. Les modifications sont réinitialisées au rechargement.

## Simulé dans la démo

Twilio (appels, SMS), Stripe (paiements), Google Maps (carte stylisée en SVG, ETA calculé à vol d'oiseau), agents IA n8n
(proposition de qualification quelques secondes après une nouvelle demande), envoi des webhooks.
