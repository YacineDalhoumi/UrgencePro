# Évolution B2B — inventaire et plan (à valider)

Branche : `feature/cycle-demande-b2b` (partie de l’état actuel de production).
Principe : on part de l’existant ; rien n’est supprimé ni renommé sans accord.

---

## 1. Inventaire de l’existant

### Application (`web/`, Next.js 16, Tailwind, déployée sur Vercel)

| Élément | Fichier(s) | Rôle aujourd’hui |
|---|---|---|
| Connexion, mot de passe oublié, choix du mot de passe | `app/connexion`, `app/auth/confirm`, `app/compte/*` | Supabase Auth (projet AgentMultiUrgence) |
| Contrôle d’accès | `lib/auth.ts`, `proxy.ts` | session vérifiée ; entreprise lue dans `app_metadata.artisan_id` ; sinon « Compte non activé » |
| Nouvelle demande | `app/agent/nouvelle`, `components/agent/NouvelleDemandeForm.tsx` | formulaire + exemples, choix du type d’agent |
| Affichage des résultats | `components/agent/Resultat.tsx` | un rendu par type (prise en charge, devis, rapport/facture, communication, planning) + bloc « Ce qui a été fait » + JSON brut |
| Historique + fiche | `app/agent/historique`, `[id]` | lecture de `demandes` (clé service, filtrée par entreprise) |
| Diagnostic | `app/agent/diagnostic`, `api/agent/sante` | test de configuration sans effet |
| Appel au webhook n8n | `api/agent/demandes/route.ts`, `lib/agent/n8n.ts` | serveur uniquement, `x-okto-key`, délai 60 s, limite 10/min, erreurs traduites |
| Mode simulé, configuration | `lib/agent/mock.ts`, `lib/env.ts`, `app/configuration` | tests sans n8n ; page « Configuration incomplète » |
| Composants UI | `components/ui.tsx` | Button, Badge, Card, Alert, Field, Input, Select, Textarea |
| Menu | `app/agent/nav.tsx` | Nouvelle demande · Historique · Diagnostic |

Variables d’environnement : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `N8N_WEBHOOK_URL`,
`N8N_WEBHOOK_SECRET`, `N8N_TIMEOUT_MS`, `AGENT_SUPABASE_URL`, `AGENT_SUPABASE_SERVICE_KEY`, `AGENT_ARTISAN_ID`,
`AGENT_RATE_LIMIT_PER_MINUTE`, `AGENT_MOCK`, `AUTH_DEV_BYPASS`.

### Base Supabase « AgentMultiUrgence »

| Table | Colonnes | Lignes | RLS |
|---|---|---|---|
| `artisans` | id, entreprise, gerant, telephone, email, siret, adresse, zone_intervention[], horaires, grille_tarifaire_ht, majorations, tva, validite_devis_jours, **lien_avis_google**, google_calendar_id, created_at | 1 (`ART-DEMO-001`) | activée, **aucune règle** |
| `techniciens` | id, artisan_id, nom, competences[], zone[], disponible, created_at | 3 | idem |
| `clients` | id, artisan_id, nom, telephone, email, adresse, type_logement, created_at | 0 | idem |
| `demandes` | id, reference, artisan_id, client_id, client_nom/telephone/email, message, type_demande, routage, resultat, actions, **statut** (`traite`/`erreur` = état technique du traitement IA), donnees_fictives, created_at | 2 | idem |
| `auth.users` | votre compte (gérant de `ART-DEMO-001`) | 1 | — |

Aujourd’hui, seule la clé de service lit les données (aucune règle RLS). Le Realtime n’est activé sur aucune table.

### Workflow n8n « AgentMultiUrgence » (publié)

Webhook → lecture artisan / client / techniciens → routeur IA → 5 agents → PDF (devis, facture) → email Gmail
(mode démo : tout part vers votre adresse de test) → Google Agenda (planning) → **insertion d’une ligne dans
`demandes` à chaque appel** → réponse JSON.

Point important : n8n **ne crée pas de fiche dans `clients`**. La table restera vide tant que l’application ne le fait pas.

---

## 2. Ce que deviennent les fonctionnalités demandées

Légende : ♻️ réutilisé tel quel · ✏️ existant modifié · 🆕 nouveau

### Étape 2 — Base multi-entreprises

| | Élément | Détail |
|---|---|---|
| ♻️ | Supabase Auth, connexion, mot de passe, proxy | inchangés |
| ✏️ | `lib/auth.ts` | l’entreprise et le rôle viennent de la nouvelle table `membres` (et plus de `app_metadata`) ; votre compte est migré en « gérant » de `ART-DEMO-001` |
| ✏️ | `artisans`, `techniciens`, `clients`, `demandes` | ajout des règles RLS (une entreprise ne voit que ses lignes ; un technicien ne voit que ses interventions et les demandes liées) |
| ✏️ | Lecture des données dans l’app | passe par la session de l’utilisateur (RLS appliquée par la base) au lieu de la clé de service. La clé de service et le secret n8n restent côté serveur, pour les seuls cas sans utilisateur connecté (page publique de signature). |
| 🆕 | Table `membres` | user_id, artisan_id, role (`gerant` \| `technicien`), technicien_id |
| 🆕 | Tests RLS | script SQL exécuté dans une transaction annulée à la fin (aucune donnée laissée) : deux entreprises, gérant et technicien, vérification qu’aucune donnée ne fuit |

### Étape 3 — Cycle de vie d’une demande

| | Élément | Détail |
|---|---|---|
| ✏️ | `demandes` | **ajout** des colonnes `etape` (nouvelle → devis_envoye → devis_signe → planifiee → terminee, + refusee, annulee), `canal` (`email`, `sms` plus tard), `client_adresse`, `a_planifier_manuellement`. La colonne `statut` existante garde son sens technique : elle n’est ni renommée ni modifiée. |
| 🆕 | `demande_historique` | chaque changement d’étape horodaté (avant, après, auteur : gérant, technicien, client ou système) |
| ✏️ | Création de demande (`NouvelleDemandeForm`, route serveur) | formulaire simplifié : plus de choix du type, email client obligatoire. L’app crée la demande et la fiche client (🆕 réutilisation d’un client existant par téléphone ou email), puis appelle **la route serveur existante** avec `type_demande: "devis"`, `demande_id`, `numero_devis` et `lien_signature`. |
| 🆕 | `devis` | numéro continu par entreprise, lignes, totaux HT/TVA/TTC, validité, statut, empreinte du lien (le jeton lui-même n’est jamais stocké), preuve de signature. Le devis est verrouillé après signature par un déclencheur en base. |
| 🆕 | `/devis/[token]` (public) | logo et nom de l’entreprise, détail, totaux, case d’acceptation, nom, signature au doigt, « Signer » ou « Refuser ». Preuve enregistrée : image, nom, date, IP, navigateur, SHA-256 du contenu exact du devis. |
| 🆕 | Planification automatique | après la signature (en arrière-plan, la page du client ne patiente pas) : appel `planning` avec les créneaux occupés de chaque technicien. L’app **vérifie** le créneau proposé (technicien existant, pas de chevauchement) avant de créer l’intervention, passe la demande en « Planifiée », puis appelle `communication` pour la confirmation. Sans créneau valable : alerte « À planifier manuellement ». |
| 🆕 | `interventions` | technicien, demande, début, fin, adresse, statut, rapport (constat, travaux, matériel) |
| 🆕 | Page Agenda | vue semaine (vue jour sur téléphone), une couleur par technicien, filtre, temps réel (Supabase Realtime sur `interventions`). Le gérant déplace ou réattribue ; le technicien ne voit que son agenda. |
| ✏️ | `techniciens` | **ajout** de `couleur` et `telephone` |
| 🆕 | « Intervention terminée » | formulaire court → appel `rapport_facture` avec le numéro de facture attribué par l’app et le lien d’avis Google → facture enregistrée → demande « Terminée » |
| 🆕 | `factures` + `compteurs` | numérotation continue par entreprise et par année, attribuée en base (aucun trou, aucun doublon) |
| ♻️ | `Resultat.tsx` | ses rendus Devis, Rapport/facture et Planning sont réutilisés dans la fiche demande, sans le JSON ni le routage IA |

**Modifications nécessaires dans le workflow n8n** (je les fais et les teste comme pour le planning) :
1. « Normaliser entree » : accepter `demande_id`, `numero_devis`, `numero_facture`, `lien_signature`, `canal`.
2. Email du devis : ajouter le bouton « Consulter et signer le devis » (`lien_signature`) ; le PDF et l’email utilisent le numéro de devis fourni par l’app.
3. Facture : le PDF utilise `numero_facture` fourni par l’app ; l’email ajoute le remerciement et le lien `lien_avis_google` de l’entreprise.
4. Planning : prendre en compte les créneaux occupés transmis par l’app (en plus de Google Agenda) et répondre avec l’identifiant d’un technicien existant.
5. « Enregistrer demande » : quand `demande_id` est fourni, ne plus créer de nouvelle ligne dans `demandes` (sinon une demande produirait 4 lignes) mais tracer l’appel dans une table 🆕 `agent_traitements`. Sans `demande_id`, le comportement actuel reste identique.
6. Le mode démo reste actif : tous les emails partent vers votre adresse de test.

### Étape 4 — Tableau de bord

Il n’existe pas dans `web/` (seulement dans le prototype). 🆕 Page « Tableau de bord » :
- filtre de période et comparaison avec la période précédente ;
- 6 cartes, 2 graphiques, liste « À traiter » ;
- tous les calculs sont faits par des fonctions SQL (`tableau_de_bord(debut, fin)`), soumises à la RLS. Le style des cartes et graphiques reprend celui du prototype.

### Étape 5 — Simplicité (menu à 5 entrées)

| Menu | Contenu | Origine |
|---|---|---|
| Tableau de bord | KPI + « À traiter » | 🆕 |
| Demandes | liste (ex-Historique) + bouton « Nouvelle demande » + fiche avec devis, intervention et facture | ✏️ fusion de Nouvelle demande et Historique |
| Agenda | interventions | 🆕 |
| Techniciens | liste, couleur, invitation d’un technicien (compte avec rôle « technicien ») | 🆕 |
| Paramètres | infos de l’entreprise, lien avis Google, mot de passe, Diagnostic | ✏️ Diagnostic déplacé ici |

Technicien connecté : menu réduit à **Agenda** (et Paramètres pour son mot de passe).

### Étape 6 — Tests

- Tests unitaires (Vitest) : jeton et empreinte SHA-256, transitions d’étapes, vérification des créneaux, numérotation.
- Tests RLS en SQL (transaction annulée).
- Test du parcours complet (Playwright) : demande → devis → signature → planification → intervention terminée → facture. n8n est simulé, la base est réelle, dans une entreprise de test `ART-TEST-E2E` supprimée à la fin.
- Puis un passage réel avec n8n en mode démo.

---

## 3. Migrations Supabase (uniquement des ajouts)

1. `membres` + fonctions `app.entreprise_courante()`, `app.role_courant()`, `app.technicien_courant()` ; migration de votre compte.
2. Règles RLS sur `artisans`, `techniciens`, `clients`, `demandes` (lecture et écriture limitées à l’entreprise ; restrictions technicien).
3. Colonnes ajoutées : `demandes(etape, canal, client_adresse, a_planifier_manuellement)`, `techniciens(couleur, telephone)` ; tables `demande_historique`, `devis`, `interventions`, `factures`, `compteurs`, `agent_traitements` avec RLS ; déclencheur de verrouillage du devis signé ; fonction `prochain_numero()`.
4. Fonctions du tableau de bord + activation du Realtime sur `interventions`.

Aucune suppression ni aucun renommage de colonne ou de table.

---

## 4. Ordre de réalisation (un commit ou plus par étape)

1. Migrations 1 et 2 + `lib/auth.ts` + tests RLS
2. Menu à 5 entrées, page Demandes (fusion), Paramètres
3. Migration 3 + création demande → devis (app + n8n)
4. Page publique de signature
5. Planification automatique + interventions (app + n8n)
6. Agenda (Realtime, déplacement, réattribution) + Techniciens
7. Intervention terminée → facture (app + n8n)
8. Migration 4 + Tableau de bord
9. Tests du parcours complet, passage réel en mode démo, documentation

---

## 5. Points à valider

1. **Adresses des pages** : nouvelles adresses simples (`/tableau-de-bord`, `/demandes`, `/agenda`, `/techniciens`, `/parametres`), les anciennes `/agent/...` redirigeant automatiquement (rien ne casse) — ou garder le préfixe `/agent/` ?
2. **Retrait de l’affichage technique** : le bloc « Voir le JSON », la ligne « routage IA » et les références techniques disparaissent de l’interface (les données restent en base). D’accord ?
3. **Modifications du workflow n8n** listées en section 2 : d’accord pour que je les fasse ?
4. **Source du rôle** : la table `membres` remplace `app_metadata.artisan_id` (votre compte est migré automatiquement).
5. **Données de test** : le test de parcours crée puis supprime une entreprise `ART-TEST-E2E` dans le projet réel. D’accord ?
