# Faire connaître Bobine sur GitHub — état des lieux et plan

Statut : **plan validé, partie « dépôt » en cours** (fiche 225). Rien n'est changé sur GitHub ;
chaque action publique (réglages du dépôt, publications, listes) attend l'accord de l'utilisateur.

## 1. Ce qui se fait d'habitude

Relevé sur des applications et outils de développement libres bien présentés (Jan, OpenCode, Zed,
Ollama, Aider, Continue) et sur la liste officielle des clients ACP :

| Élément | Pratique courante |
|---|---|
| Haut du README | logo ou bannière centrée, phrase d'accroche d'une ligne, badges (version, licence, CI, plateforme), liens rapides (Télécharger · Guide · Nouveautés), **une image ou une animation** qui montre l'outil au travail |
| Corps du README | « Pourquoi », 3 à 6 points forts **illustrés chacun** (capture ou GIF court), installation en une étape, démarrage rapide, agents ou modèles pris en charge, FAQ courte, feuille de route, contribuer, licence |
| Langues | README anglais en tête, sélecteur de langue en haut (Jan : 3 langues, OpenCode : ~20) |
| Dépôt | description courte et concrète, **sujets** (topics), champ « Website » vers un site ou la doc, **image de partage** 1280×640 (sinon GitHub génère une carte générique) |
| Versions | notes avec captures des nouveautés, `.dmg` en pièce jointe, Release « Latest » quand elle existe |
| Communauté | Discussions (questions, idées, « montrez ce que vous en faites »), modèles d'issue, `good first issue` |
| Vidéo | courte démo (30 à 90 s) ; sur GitHub, une vidéo ne se lit dans le README que si elle est **déposée par l'éditeur web** de GitHub (lien `user-attachments`) ; un `.mp4` versionné dans le dépôt ne s'affiche pas en lecteur. Un GIF versionné, lui, s'affiche partout |
| Annuaires | liste officielle des clients ACP (agentclientprotocol.com › Clients, page `docs/get-started/clients.mdx` du dépôt `agentclientprotocol/agent-client-protocol`, section « Desktop and Web », ~50 entrées, une ligne : nom — description — plateformes) ; listes « awesome » (agents de code, Electron, macOS) |
| Lancement | « Show HN », Reddit (r/LocalLLaMA, r/macapps, r/opensource, r/ChatGPTCoding), communauté du protocole (Zulip ACP), éventuellement communautés IBM Bob |
| Site | page d'accueil (GitHub Pages) : utile quand le README devient trop long ou pour le référencement ; beaucoup de projets jeunes s'en passent |

## 2. Audit du README actuel (et du dépôt)

Ce qui va bien : phrase d'accroche claire, image en tête, installation non signée très bien
expliquée (Open Anyway, `xattr`), agents testés avec versions, limites connues honnêtes,
non-affiliation, versions anglaise et française, guide de l'utilisateur, modèles d'issue,
description et sujets du dépôt déjà posés.

Manques, du plus visible au moins visible :

1. **L'image de tête dessert l'app.** `docs/images/bobine.png` montre `/scenario lent`,
   « Je réfléchis longuement… » répété, « Response interrupted », un diff en français dans une
   interface anglaise, « Agent factice ». C'est une capture d'essai, pas une vitrine.
2. **Une seule image pour tout le README.** Les points forts (rôles et conversations filles,
   panneau de droite, navigateur, simulateur iOS, émulateur Android, thèmes) sont listés en une
   phrase dense, sans rien montrer. Le lecteur ne voit ni le parallélisme, ni les outils visuels.
3. **Rien qui bouge** : pas de GIF ni de vidéo.
4. **Version périmée** : le bandeau dit « 1.0.0-beta.1 », l'app est en 1.0.0-beta.3. À rendre
   intemporel (« Public beta ») ou relié à la page des Releases.
5. **Pas de badges** (version, licence, CI, macOS Apple Silicon) ni de bouton « Download ».
   Attention : toutes les versions sont des préversions, donc `releases/latest` et le badge
   « latest release » standard sont vides ; utiliser `include_prereleases`.
6. **Pas de « pourquoi Bobine »** face aux dizaines de clients ACP de bureau : ce qui la distingue
   (IBM Bob d'abord avec SSO, licence et bobcoins ; outils visuels pilotés par l'agent ;
   rôles en parallèle dans des worktrees ; aucun modèle embarqué) n'est pas mis en avant.
7. **Rôles absents du README** (beta.2 et beta.3 les ont apportés).
8. **Pas de FAQ** (« Est-ce que Bobine envoie mes données ? », « Pourquoi pas notarisée ? »,
   « Intel / Windows ? », « Faut-il IBM Bob ? »).
9. **Pas de feuille de route publique** en anglais (les feuilles de route sont en français, dans
   `docs/`).
10. **Dépôt** : pas d'image de partage (carte générique de GitHub), champ « Website » qui pointe
    sur le dépôt lui-même, Discussions fermées, aucun `good first issue`, notes de version sans
    image.
11. **Absente de la liste officielle des clients ACP.**

## 3. Plan classé (impact / effort)

### A. Dans le dépôt (ce que j'écris, sur la branche `docs/promotion-github`)

| # | Quoi | Impact | Effort |
|---|---|---|---|
| A1 | Script de captures de vitrine (§ 4) et scénarios d'agent factice « vitrine » au contenu réaliste | fort (conditionne tout le reste) | moyen |
| A2 | Nouvelle image de tête : une conversation crédible avec carte d'autorisation et diff, panneau de droite ouvert, en clair ; variante sombre servie par `<picture>` (`prefers-color-scheme`) | fort | faible une fois A1 fait |
| A3 | README anglais restructuré : accroche, badges, boutons « Download for macOS » · « User guide » · « What's new », image de tête, « Why Bobine », 5 à 6 points forts illustrés, agents pris en charge, installation (contenu actuel conservé, raccourci en tête), FAQ, feuille de route courte, contribuer, licence, non-affiliation | fort | moyen |
| A4 | `README.fr.md` aligné (mêmes images en version française) | moyen | faible |
| A5 | Image de partage 1280×640 (`docs/images/social-preview.png`, générée par le script : nom, accroche, capture) | moyen | faible |
| A6 | GIF court (≤ 5 Mo, 10 à 20 s) : `@role` → deux conversations filles en parallèle → cartes qui se remplissent ; et un MP4 de 45 à 60 s pour l'éditeur web | fort | moyen (outil d'encodage, voir § 4) |
| A7 | Modèle de notes de version avec une capture par nouveauté (dans `.github/workflows/release.yml` ou à la main au moment du tag) | moyen | faible |
| A8 | Modèles d'issue : ajouter « Question » renvoyant vers Discussions si elles sont ouvertes | faible | faible |
| A9 | Fiche de fonctionnalité (`docs/features/225-vitrine-github.md`) et index, selon AGENTS.md | — | faible |

### B. Ce qui demande l'accord de l'utilisateur (actions publiques, je ne fais rien sans « oui »)

| # | Quoi | Impact | Effort |
|---|---|---|---|
| B1 | Pousser la branche et fusionner (README, images, script) | fort | faible |
| B2 | Déposer l'image de partage (Settings › General › Social preview : pas d'API, à la main) | moyen | très faible |
| B3 | Champ « Website » : guide de l'utilisateur ou future page d'accueil, au lieu du dépôt | faible | très faible |
| B4 | Sujets en plus : `ibm`, `bob-shell`, `ios-simulator`, `android-emulator`, `mcp`, `git-worktree`, `apple-silicon` (11 aujourd'hui, 20 maximum) | faible | très faible |
| B5 | Déposer la vidéo MP4 dans le README par l'éditeur web de GitHub (seul moyen d'avoir un lecteur intégré) | moyen | faible |
| B6 | Ouvrir Discussions (catégories : Q&A, Ideas, Show and tell, Announcements) | moyen | faible, mais à animer |
| B7 | Pull request à `agentclientprotocol/agent-client-protocol` : une ligne dans « Desktop and Web » | fort pour ce public | faible |
| B8 | Ajouter des captures aux notes des Releases existantes (beta.2, beta.3) | faible | faible |
| B9 | Étiquettes `good first issue` / `help wanted` sur 3 à 5 issues réelles | faible | faible |
| B10 | Publications : « Show HN », Reddit, Zulip ACP, éventuellement communautés IBM Bob. **Plutôt après** A1–A6 et une beta stable ; **à la 1.0** (décision du 2026-11-14) | fort mais ponctuel | moyen (rédiger, puis répondre) |
| B11 | Page d'accueil (GitHub Pages) | faible à ce stade | moyen ; **à la 1.0** (décision du 2026-11-14) |

Ordre proposé : A1 → A2 → A3/A4 → A5 → A6, revue, puis B1, B2, B3, B4, B7 ; B5 et B6 ensuite ;
B10 à la 1.0.0.

## 4. Montrer l'outil au travail (médias)

### Écrans à montrer (les plus forts d'abord)

1. **Image de tête** : une conversation sur le projet de démo « La Bobinette » (`demos/`), carte
   d'autorisation avec diff, liste de tâches, panneau de droite (onglet Modifications ou Session).
2. **Rôles et conversations filles** : `@security-expert @code-reviewer` dans la saisie (« Will go
   to… »), puis la carte « Sous-tâches » avec deux filles en parallèle, chacune dans son worktree,
   et la section « Team » de la barre latérale.
3. **Panneau de droite** : Modifications (diff du tour, git), navigateur intégré avec console et
   réseau.
4. **Simulateur iOS / émulateur Android** pilotés par l'agent (l'iPhone dans son châssis, la
   planche contact).
5. **Questions à choix et plan annoté** (l'agent demande avant d'agir).
6. **Thèmes** : une bande clair / sombre / Fjord (une image composée de trois captures).
7. Plus tard : l'espace Discussion s'il est fusionné.

### Les captures d'essai existantes ne suffisent pas

`e2e/captures/` (≈ 1 200 images, 2560 px, clair et sombre, `en-` pour l'anglais) prouve que tout
se capture sans modèle, mais ces images montrent des invites `/scenario …`, « Agent factice »,
« Factice rapide », des dossiers temporaires (`bob-e2e-filles-FXuvwP`), des avertissements
d'essai et du français dans l'interface anglaise. Les captures du guide
(`e2e/guide-captures.mjs`, `docs/guide/images/`) sont plus propres (`my-project`) mais gardent
« Mock agent » et des chemins en français (`/projet/config.json`, `db.interne`).

### Production reproductible, sans modèle ni donnée personnelle

- **Script** `e2e/vitrine-captures.mjs`, sur le modèle de `e2e/guide-captures.mjs` (même
  `withApp`, même profil temporaire, app buildée, agent factice) :
  `pnpm build && pnpm vitrine [--lang fr] [--sans-video]`, sortie dans
  `docs/images/readme/<langue>/`. Raccourci `pnpm vitrine` ; à relancer à chaque version
  (ligne ajoutée à la procédure de publication d'AGENTS.md, fiche 218).
- **Scénarios d'agent factice « vitrine »** (`src/mock-agent/scenarios-vitrine.mts`) au texte
  réaliste en anglais et en français, sur le projet `demos/projet` : lancés par `--scenario`
  au démarrage pour que l'invite affichée soit une vraie phrase (« Add a CSV export to the
  cart page ») et non `/scenario …`. Nom d'agent par `--nom` (voir question 4), dossier copié
  par `demos/preparer` dans un dossier temporaire nommé `la-bobinette`.
- **Mode présentation** (fiche 159) activé : `~` au lieu du dossier personnel, coûts masqués,
  texte agrandi ; fenêtre fixée à 1280×800 (rendu 2560×1600 en Retina, réduit à 1600 px de large
  et optimisé pour garder chaque PNG sous ~400 Ko).
- **Contrôle** : le script échoue si une capture contient un texte interdit (`/scenario`,
  `factice`, `Mock`, `bob-e2e-`, `/Users/`), lu dans le DOM avant la capture.
- **Vidéo** : enregistrer la fenêtre pendant que le script rejoue le parcours, à vitesse humaine
  (`--delay` de l'agent factice, frappe simulée lettre par lettre). Deux voies :
  1. images par le protocole de débogage de Chromium (`Page.startScreencast`, déjà accessible
     aux essais) puis encodage ;
  2. `screencapture -v` de macOS sur la zone de la fenêtre (aucun outil à installer, mais demande
     l'autorisation d'enregistrement de l'écran au terminal).
  L'encodage en MP4 et en GIF demande `ffmpeg` (absent de cette machine ; `brew install ffmpeg`,
  outil de développement non livré, à noter dans la fiche) ; `gifski` donne de meilleurs GIF.
  Cibles : MP4 H.264 1280 px, 45 à 60 s, < 10 Mo (limite des dépôts par l'éditeur web) ; GIF
  960 px, 12 images/s, 10 à 20 s, ≤ 5 Mo.
- **Poids du dépôt** : les images versionnées vont dans `docs/images/readme/` (≈ 12 images par
  langue, quelques Mo au total) ; le MP4 n'est pas versionné (déposé sur GitHub), sa source est
  regénérable.

## 5. Langues

Proposition : `README.md` en anglais pour le public international (c'est déjà le cas), images en
anglais ; `README.fr.md` complet avec les images en français ; un lien en tête de chacun vers
l'autre. Le reste de la documentation reste en français (AGENTS.md). Les notes de version
restent bilingues (anglais puis français, déjà en place).

## 6. Décisions (2026-11-14)

1. Dans les captures, l'agent s'appelle « Demo agent » (« Agent de démo » en français) ; jamais un
   faux IBM Bob ou OpenCode.
2. `README.md` en anglais reste la page principale ; `README.fr.md` complet, images en français.
3. Page d'accueil et publications (Show HN, Reddit…) : **à la 1.0**, pas avant.
4. Discussions et pull request à la liste des clients ACP : textes prêts ci-dessous ; le
   coordinateur demande l'accord de l'utilisateur avant de les faire.
5. `ffmpeg` et `gifski` installés par Homebrew (outils de développement, non livrés).
6. Thème : clair et sombre actuels ; le thème « Aurore » en préparation se capturera en relançant
   `pnpm vitrine`.

## 7. Textes prêts (à publier seulement avec l'accord de l'utilisateur)

### Discussions : message d'accueil (catégorie « Announcements », épinglé)

Titre : **Welcome to Bobine's discussions**

> Hi, and thanks for stopping by!
>
> Bobine is a macOS desktop app for ACP coding agents: IBM Bob, OpenCode, or any agent that speaks
> the [Agent Client Protocol](https://agentclientprotocol.com). It is in public beta, so your
> feedback shapes what comes next.
>
> Where to post:
>
> - **Q&A**: installing, setting up an agent, « how do I… ». Please say your macOS version, your
>   agent and its version (Settings › Diagnostics › « Copy report » gives all of it).
> - **Ideas**: what you would like Bobine to do. One idea per thread, with the problem it solves.
> - **Show and tell**: roles you wrote, workflows, screenshots.
> - **Bugs** go to [Issues](https://github.com/jlallement/bobine/issues/new/choose) (Settings ›
>   Diagnostics › « Report an issue » fills the template for you), and security problems to the
>   [private advisory form](https://github.com/jlallement/bobine/security/advisories/new).
>
> Questions in French are welcome too: *les questions en français sont les bienvenues.*

Catégories proposées : Announcements (annonces, réservé au mainteneur), Q&A (format question et
réponse), Ideas, Show and tell. Une fois ouvertes : ajouter un lien « Questions » vers les
Discussions dans `.github/ISSUE_TEMPLATE/config.yml` (contact_links), non fait tant qu'elles sont
fermées (le lien mènerait à une page vide).

### Liste des clients ACP : la ligne

Fichier `docs/get-started/clients.mdx` du dépôt `agentclientprotocol/agent-client-protocol`,
section « Desktop and Web », à sa place dans l'ordre alphabétique (après « Bellows », avant
« Braide ») :

```md
- [Bobine](https://github.com/jlallement/bobine) — open-source (Apache-2.0) desktop app made first for IBM Bob, also OpenCode and any ACP agent: permission cards with diffs, roles called with `@` that work in parallel child conversations (git worktrees), and a built-in browser, iOS Simulator and Android emulator the agent drives (macOS)
```

### Liste des clients ACP : la pull request

Titre : `docs(clients): add Bobine`

> Adds [Bobine](https://github.com/jlallement/bobine) to « Desktop and Web ».
>
> Bobine is an open-source (Apache-2.0) macOS desktop client for ACP agents. It was built first
> for IBM Bob (`bob acp`) and also runs OpenCode (`opencode acp`) and any agent declared by
> command. It uses the TypeScript SDK on the client side: permission requests with diffs, plans,
> session config options and modes, elicitation forms (questions with choices), `session/load`
> and `session/resume`, and it serves an MCP server that gives the agent a built-in browser, the
> iOS Simulator and the Android emulator.
>
> Public beta, macOS 13+ on Apple Silicon. Independent project, not affiliated with IBM.

Avant d'ouvrir la pull request : relire le `CONTRIBUTING.md` du dépôt du protocole (format,
`npm run spellcheck`, prettier), et vérifier que chaque fonction citée est bien dans la version
publiée.

