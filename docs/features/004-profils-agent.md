# 004 — Profils d'agent et dossier de travail dans l'UI

- **Statut** : fait
- **Dépend de** : 003

## Pourquoi

Aujourd'hui, l'agent et le dossier de travail se choisissent par variables d'environnement au
lancement. L'utilisateur doit pouvoir les changer depuis l'app, retrouver ses choix au redémarrage,
et l'app doit trouver `npx` / `bob` même lancée depuis le Finder.

## Critères d'acceptation

- [x] Sélecteur d'agent dans l'UI listant les profils (factice en dev, Claude Code, Codex, Bob) ;
      un profil dont la commande est introuvable est grisé avec la raison.
- [x] Choix du dossier de travail par dialogue natif, avec les 5 derniers dossiers utilisés.
- [x] Changer d'agent ou de dossier démarre une **nouvelle conversation** (confirmation si le fil
      n'est pas vide) ; bouton « Nouvelle conversation ».
- [x] Choix persistés dans `userData/settings.json` ; `BOB_AGENT_PROFILE` / `BOB_WORKSPACE`
      restent prioritaires au lancement.
- [x] Un dossier mémorisé qui n'existe plus → retour au dossier par défaut, avec un avis.
- [x] `PATH` du shell de connexion récupéré au démarrage (app lancée depuis le Finder).
- [x] Profil **Bob** : `bob acp` ; `BOBSHELL_API_KEY` transmise si présente dans l'environnement.
- [x] Testé : réglages, détection de disponibilité, PATH, changement de profil contre l'agent factice.

## Plan

**Main** :
- `src/main/settings.ts` — lecture/écriture validée de `settings.json` (fichier absent ou corrompu →
  valeurs par défaut), dossiers récents (dédoublonnés, 5 max).
- `src/main/shell-env.ts` — lance `$SHELL -ilc` avec des marqueurs pour extraire le `PATH` malgré le
  bruit des fichiers rc (oh-my-zsh, powerlevel10k…), délai max 3 s ; fusionne avec le `PATH` courant.
- `src/main/agent/profiles.ts` — ajout du profil `bob` ; `checkAvailability()` cherche la commande
  dans le `PATH`.
- `src/main/agent/agent-manager.ts` — `AgentManager` : détient l'`AgentHost` courant, `configure()`
  (change profil/dossier, persiste, émet `reset`, redémarre), délègue le reste.
- IPC : `settings:get`, `agent:configure`, `workspace:choose` (dialogue natif injecté).

**Partagé** : événement `reset` (vide le fil) ; types `ProfileSummary`, `AgentSettingsView`.

**Renderer** : barre d'outils sous la saisie (sélecteur d'agent, sélecteur de dossier avec récents
+ « Choisir un dossier… »), bouton « Nouvelle conversation » dans la barre de titre.

## Journal

- 2026-10-11 — Fiche créée.
- 2026-10-11 — Implémenté. 84 tests (réglages, PATH du shell, disponibilité des profils,
  `AgentManager` contre l'agent factice, IPC, preload, reset du fil).
  - Essai dans l'app buildée avec un `--user-data-dir` isolé (les réglages réels ne sont pas touchés) :
    Bob grisé avec la raison ; passage factice → Codex avec confirmation, fil vidé, Codex prêt ;
    retour sans confirmation sur fil vide ; changement de dossier ; réglages repris au relancement.
  - Lancement « comme depuis le Finder » (binaire Electron, `PATH=/usr/bin:/bin`) : Claude et Codex
    disponibles grâce au PATH du shell ; contrôle avec un `SHELL` invalide → indisponibles.
  - **Non testé automatiquement** : le dialogue natif « Choisir un dossier… » (inaccessible via CDP)
    et le clic sur « Nouvelle conversation » (même chemin que `configure({})`, testé). À vérifier à la main.
  - Profil Bob non essayé en vrai (pas de `bob` sur la machine).
  - Ajouts : l'UI relit les réglages à chaque `reset` (reste juste quel que soit l'appelant) ;
    `pnpm lint` échoue désormais sur les avertissements (`--max-warnings=0`).
- 2026-10-11 — **Claude Code et Codex retirés** des agents proposés (décision de l'utilisateur : la
  cible est Bob ; ces deux agents ont leur propre application, on s'en inspire seulement). Restent :
  Bob, OpenCode (essais à coût nul) et l'agent factice (développement). Une conversation d'un agent
  retiré s'affiche en lecture seule, sans être rouverte par un autre agent.
