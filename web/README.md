# UrgencePro — application web (Next.js)

Première brique de l’application réelle (voir `../docs/ARCHITECTURE.md`). Elle contient pour l’instant le module
**Agent IA** : envoi d’une demande au workflow n8n *AgentMultiUrgence*, affichage du résultat et historique.

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- Authentification : Supabase Auth (projet Supabase de l’**application**)
- Agent : webhook n8n + projet Supabase **AgentMultiUrgence** (lu côté serveur uniquement)
- Hébergement : Vercel

## Sécurité : ce qui reste sur le serveur

Le navigateur n’appelle **jamais** n8n et ne voit aucun secret :

| Élément | Où il vit |
|---|---|
| `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` | `src/lib/env.ts` → `src/lib/agent/n8n.ts` (`server-only`) |
| `AGENT_SUPABASE_SERVICE_KEY` | `src/lib/agent/db.ts` (`server-only`) |
| `artisan_id` envoyé à n8n | lu dans le compte connecté (`app_metadata`), jamais fourni par le navigateur |

Les modules marqués `import "server-only"` font échouer la compilation s’ils sont importés côté client.

## Démarrage local

```bash
cd web
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000
```

Node.js 20.12 ou plus récent.

### Développer l’interface sans rien connecter

Dans `.env.local` :

```
AGENT_MOCK=1          # réponses simulées, aucun appel à n8n
AUTH_DEV_BYPASS=1     # accès sans connexion (npm run dev uniquement, ignoré en production)
```

Sans `AGENT_SUPABASE_URL`, l’historique affiche alors des demandes fictives.
Pour tester les erreurs en mode simulé, ajoutez un mot-clé dans le message : `#timeout`, `#secret`, `#404`, `#500`, `#json`.

## Pages et routes

| Chemin | Rôle |
|---|---|
| `/connexion` | Connexion email + mot de passe, lien « mot de passe oublié » |
| `/auth/confirm` | Validation des liens reçus par email (invitation, réinitialisation) |
| `/compte/mot-de-passe` | Choix d’un mot de passe |
| `/compte/non-active` | Compte connecté mais rattaché à aucune entreprise |
| `/agent/nouvelle` | Nouvelle demande + résultat de l’agent |
| `/agent/historique` | Historique (filtres type / statut, pagination) |
| `/agent/historique/[id]` | Fiche détaillée d’une demande |
| `/agent/diagnostic` | Test de la connexion (sans déclencher l’agent) |
| `POST /api/agent/demandes` | Appel au workflow (session, limite 10/min, validation, délai 60 s) |
| `GET /api/agent/sante` | Vérification de la configuration, sans effet |

### Codes renvoyés par `POST /api/agent/demandes`

| HTTP | `code` | Cas |
|---|---|---|
| 200 | — | Réponse de l’agent (`data.success` peut valoir `false` si l’agent a produit un JSON invalide) |
| 400 | `validation` | Champ invalide (`details` par champ) |
| 401 | `non_connecte` | Session absente ou expirée |
| 429 | `limite` | Plus de 10 demandes par minute (en-tête `Retry-After`) |
| 500 | `config` | Variable d’environnement manquante |
| 502 | `secret_refuse` | n8n a refusé `x-okto-key` (401/403) |
| 502 | `webhook_introuvable` | 404 : workflow désactivé ou URL incorrecte |
| 502 | `erreur_workflow` | n8n a répondu 5xx (une étape du workflow a échoué) |
| 502 | `reponse_illisible` / `reseau` | Réponse non JSON, serveur injoignable |
| 504 | `timeout` | Pas de réponse en 60 s |

## Tester la connexion au webhook

```bash
npm run test:agent                    # SANS effet : variables, webhook (faux secret refusé), lecture Supabase
npm run test:agent -- --complet       # + une vraie demande « communication »
npm run test:agent -- --complet devis # + une vraie demande du type choisi
npm run test:agent -- --tous          # + une vraie demande de chaque type (5 appels)
```

Un appel réel exécute tout le workflow : appels au modèle IA, email de démo, événement Google Agenda (planning),
ligne ajoutée dans `demandes`. La page **Diagnostic** de l’application fait la même vérification sans effet.

## Mise en place de l’authentification Supabase

1. Créez (ou choisissez) le projet Supabase de l’application et renseignez `NEXT_PUBLIC_SUPABASE_URL`
   et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys).
2. **Authentication → Sign In / Providers** : désactivez « Allow new users to sign up ». Les comptes sont créés
   par l’administrateur (Authentication → Users → Invite user).
3. **Authentication → URL Configuration** : *Site URL* = l’URL Vercel ; ajoutez `http://localhost:3000/**` et
   `https://<votre-domaine>/**` aux *Redirect URLs*.
4. **Authentication → Emails** : les modèles par défaut fonctionnent (la route `/auth/confirm` accepte le paramètre `code`).
   Pour des liens plus robustes (ouverts sur un autre appareil), utilisez
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (`type=recovery` pour la réinitialisation).
5. Rattachez chaque compte à son artisan — **obligatoire** : un compte sans `artisan_id` voit la page « Compte non activé »
   et l’API lui répond 403. Une inscription libre ne donne donc accès à rien. SQL Editor du projet de l’application :

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"artisan_id": "ART-DEMO-001"}'
   where email = 'artisan@example.com';
   ```

   `app_metadata` n’est pas modifiable par l’utilisateur lui-même. L’historique n’affiche que les demandes de cet artisan.
   L’utilisateur doit se reconnecter pour que le changement soit pris en compte.

## Déploiement sur Vercel

1. Importez le dépôt sur Vercel, **Root Directory = `web`** (framework détecté : Next.js).
2. Renseignez les variables de `.env.example` dans *Settings → Environment Variables*
   (`AGENT_MOCK=0`, ne définissez pas `AUTH_DEV_BYPASS`).
3. Région des fonctions : Paris (`cdg1`), proche de n8n et de Supabase (eu-west-3).
4. La route `/api/agent/demandes` déclare `maxDuration = 70` : vérifiez que votre offre Vercel autorise des
   fonctions d’au moins 70 secondes.

## Limites connues

- **Limite d’appels en mémoire** : comptée par instance de serveur. Sur Vercel (plusieurs instances), utiliser
  Upstash Redis ou une table Postgres.
- **PDF** : le workflow ne renvoie que le nom du fichier (le PDF est joint à l’email) ; l’application ne peut pas
  encore le proposer au téléchargement.
- **Délai dépassé** : si n8n met plus de 60 s, l’application affiche une erreur, mais le workflow peut aller au bout
  et enregistrer la demande. Vérifier l’historique avant de relancer.
