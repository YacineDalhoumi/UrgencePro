# UrgencePro — application web (Next.js)

Application des entreprises de dépannage : demandes, devis signés en ligne, agenda des techniciens, factures et
tableau de bord. Les documents (devis, factures, emails) sont produits par le workflow n8n *AgentMultiUrgence*.

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- Supabase : authentification, base de données avec règles RLS (une entreprise ne voit jamais les données d’une autre)
- n8n : agents IA, PDF, emails (appelé uniquement par le serveur)
- Hébergement : Vercel

## Le parcours d’une demande

```
Nouvelle ─▶ Devis envoyé ─▶ Devis signé ─▶ Planifiée ─▶ Terminée
                 │                                      (+ Refusée, Annulée)
                 └─ lien de signature envoyé au client
```

1. **Le gérant crée la demande** (`/demandes/nouvelle`) : fiche client (réutilisée si l’email ou le téléphone est connu),
   numéro de demande et de devis réservés en base, appel n8n `devis` avec `numero_devis` et `lien_signature`.
   n8n envoie le PDF et un bouton « Consulter et signer le devis ».
2. **Le client signe** sur `/devis/[jeton]` (sans compte, adapté au téléphone) : case d’acceptation, nom, signature
   au doigt. La base enregistre l’image, le nom, la date, l’adresse IP, le navigateur et l’empreinte SHA-256 du contenu
   exact du devis, puis le verrouille (plus aucune modification possible). Le client peut aussi refuser.
3. **Planification automatique** (en arrière-plan) : appel n8n `planning` avec les créneaux déjà occupés de chaque
   technicien. L’application essaie le créneau proposé puis les alternatives ; la base refuse tout chevauchement.
   Puis appel `communication` : confirmation au client. Sans créneau libre : alerte « À planifier manuellement ».
4. **Intervention terminée** (fiche demande ou agenda, par le technicien ou le gérant) : constat, travaux, matériel →
   numéro de facture continu réservé en base → appel n8n `rapport_facture` → facture, remerciement et lien d’avis Google.

Chaque changement d’étape est horodaté dans `demande_historique` (auteur : gérant, technicien, client ou automatique).
Le mode démo de n8n reste actif : tous les emails partent vers l’adresse de test.

## Rôles

| Rôle | Menu | Accès |
|---|---|---|
| Gérant | Tableau de bord · Demandes · Agenda · Techniciens · Paramètres | toutes les données de son entreprise |
| Technicien | Agenda · Paramètres | ses interventions et les demandes liées ; peut clôturer ses interventions |

Le rôle et l’entreprise viennent de la table `membres` (lue avec la session : l’utilisateur ne peut pas les modifier).
Un compte sans ligne dans `membres` voit « Compte non activé ».

## Sécurité : ce qui reste sur le serveur

| Élément | Où il vit |
|---|---|
| `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` | `src/lib/env.ts` → `src/lib/agent/n8n.ts` (`server-only`) |
| `APP_CLE_SERVEUR` | serveur uniquement ; seule son empreinte est en base (`app.secrets`) |
| Jeton de signature | 32 octets aléatoires, présent seulement dans le lien envoyé ; la base ne garde que son empreinte |
| Données métier | lues et écrites avec la session de l’utilisateur ; les écritures passent par des fonctions SQL contrôlées |

L’application n’utilise **aucune clé de service** Supabase. Les règles RLS et les fonctions sont dans
`../supabase/migrations/`, les tests de sécurité dans `../supabase/tests/rls_et_parcours.sql`.

## Démarrage local

```bash
cd web
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000
```

Node.js 20.12 ou plus récent. `AGENT_MOCK=1` remplace n8n par des réponses simulées (aucun email) ; mots-clés de test
dans la demande : `#timeout`, `#secret`, `#404`, `#500`, `#json`, `#aucun-creneau`.

## Pages et routes

| Chemin | Rôle |
|---|---|
| `/tableau-de-bord` | 6 indicateurs comparés à la période précédente, 2 graphiques, liste « À traiter » (calculs en SQL) |
| `/demandes`, `/demandes/nouvelle`, `/demandes/[id]` | liste filtrable, création, fiche (devis, preuve de signature, intervention, facture, historique) |
| `/agenda` | semaine (jour sur téléphone), une couleur par technicien, filtre, temps réel, déplacement/réattribution |
| `/techniciens` | ajout, couleur, disponibilité, création du compte de connexion (mot de passe provisoire) |
| `/parametres` | entreprise (logo, lien d’avis Google, validité des devis), mot de passe, diagnostic |
| `/devis/[jeton]` | page publique de signature |
| `/agent/*` | anciennes adresses, redirigées vers les nouvelles |
| `POST /api/agent/demandes` | nouvelle demande → devis (gérant, limite 10/min, délai 60 s) |
| `POST /api/demandes/[id]/devis` | nouvelle tentative de devis (même numéro, nouveau lien) |
| `POST /api/devis/planifier` | planification après signature (répond tout de suite, continue en arrière-plan) |
| `POST /api/interventions/[id]/terminer` | intervention terminée → facture ; corps vide = nouvelle tentative |
| `GET /api/agent/sante` | vérification de la configuration, sans effet |

## Tests

```bash
npm test                 # tests unitaires (jeton, empreinte, heures de Paris, créneaux)
npm run typecheck && npm run lint
```

- **Sécurité RLS + parcours en base** : coller `../supabase/tests/rls_et_parcours.sql` dans l’éditeur SQL Supabase.
  Résultat attendu : « TESTS OK (46 vérifications) » ; rien n’est conservé.
- **Parcours complet dans un navigateur** (n8n simulé, base réelle) :
  1. éditeur SQL : `../supabase/tests/e2e_preparer.sql` (crée l’entreprise `ART-TEST-E2E`) ;
  2. `AGENT_MOCK=1 AGENT_MOCK_DELAY_MS=300 npm run build && AGENT_MOCK=1 npm start > /tmp/serveur.log` ;
  3. `npm run test:e2e -- --journal /tmp/serveur.log` ;
  4. éditeur SQL : `../supabase/tests/e2e_nettoyer.sql`.
- **Webhook n8n réel** : `npm run test:agent` (sans effet) ou `npm run test:agent -- --complet devis`.

## Mise en place Supabase

1. Appliquer les migrations de `../supabase/migrations/` (dans l’ordre).
2. Clé serveur : générer une valeur aléatoire, la mettre dans `APP_CLE_SERVEUR`, et enregistrer son empreinte :
   ```sql
   insert into app.secrets (nom, valeur_hash) values ('cle_serveur', encode(sha256(convert_to('<la valeur>', 'UTF8')), 'hex'))
   on conflict (nom) do update set valeur_hash = excluded.valeur_hash, updated_at = now();
   ```
3. **Authentication → Sign In / Providers** : désactiver « Allow new users to sign up ».
4. **Authentication → URL Configuration** : *Site URL* = l’URL Vercel ; ajouter `http://localhost:3000/**` et
   `https://<votre-domaine>/**` aux *Redirect URLs*.
5. Rattacher le gérant d’une nouvelle entreprise :
   ```sql
   insert into public.membres (user_id, artisan_id, role)
   select id, 'ART-XXX', 'gerant' from auth.users where email = 'gerant@exemple.fr';
   ```
   Les comptes des techniciens se créent ensuite depuis la page Techniciens.

## Déploiement sur Vercel

1. Root Directory = `web`, région `cdg1` (Paris).
2. Variables de `.env.example` dans *Settings → Environment Variables*. `APP_CLE_SERVEUR` est facultative : à défaut,
   le secret du webhook n8n sert de clé serveur (son empreinte est enregistrée en base, ligne `cle_serveur_n8n`).
   `AGENT_MOCK=0`, pas d’`AUTH_DEV_BYPASS`.
3. Les routes d’agent déclarent `maxDuration` 70 à 120 s : l’offre Vercel doit l’autoriser.

## Limites connues

- **SMS** : le champ `canal` existe (`email`/`sms`) mais seul l’email est envoyé aujourd’hui.
- **Limite d’appels en mémoire** : comptée par instance de serveur (prévoir Redis ou Postgres sur Vercel).
- **PDF** : joint à l’email par n8n, pas encore téléchargeable depuis l’application.
- **Délai dépassé** : si n8n met plus de 60 s, l’application affiche une erreur alors que l’email a pu partir ;
  la fiche permet de relancer (même numéro de devis ou de facture).
