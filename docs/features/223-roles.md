# 223 — Rôles : des agents spécialisés à invoquer, et des filles lancées sans insister

- **Statut** : à faire (fiche et maquettes en relecture par l'utilisateur)
- **Dépend de** : 045 (commandes personnelles, fichiers Markdown du projet), 097 et 160
  (conversations filles, agent et modèle d'une fille, ADR-0019, ADR-0036), 112 (carte de
  propositions), 118 (filles proposées par l'agent, contexte de session), 177 (relecteur en lecture
  seule dans le même dossier), 013 (modes et options de session)
- **Agents** : tous. Un rôle est une conversation fille ordinaire, lancée avec une consigne, un
  mode et des serveurs MCP choisis : rien de propre à un agent hors des profils (ADR-0011). Seul
  l'export vers le mode natif d'un agent (phase 2) passe par un adaptateur du profil, déclaré dans
  `specificItems` et dans la matrice de `docs/agents.md`.

## Pourquoi

L'utilisateur veut des **agents spécialisés** qu'il crée une fois et invoque quand il veut : expert
UX/UI, expert Flutter, architecte front, architecte back, expert sécurité, tech lead, code
reviewer. Il veut aussi que l'agent principal **délègue de lui-même** à ces spécialistes : à
l'usage, les modèles ne lancent presque jamais de conversation fille sans qu'on insiste et qu'on
nomme `start_child`.

Bob (modes personnels) et OpenCode (agents) savent déjà définir des agents spécialisés, mais chacun
dans son format, et Bobine ne sait ni les créer, ni les invoquer d'un geste, ni les montrer au
travail. Un rôle de Bobine est écrit une fois et marche avec tous les agents.

## Décisions proposées

1. **Un rôle = un fichier Markdown** à en-tête, comme les commandes personnelles (fiche 045) et les
   sous-agents de Claude Code :
   ```markdown
   ---
   name: expert-secu
   label: Expert sécu
   icon: shield-check          # icône Lucide
   color: red                  # une des couleurs d'accent du thème
   description: Audite la sécurité d'un changement (injection, secrets, permissions). Ne modifie rien.
   agent: opencode             # facultatif : sinon l'agent de la conversation
   mode: expert-secu           # facultatif : mode natif utilisé si l'agent l'a
   model: …                    # facultatif, profils qui permettent le choix du modèle
   read-only: true             # Bobine refuse ses écritures ; même dossier, sans worktree (fiche 177)
   mcp: [simulator]            # facultatif : serveurs MCP propres au rôle
   ---
   Tu es un expert en sécurité applicative. Pour chaque risque : preuve (fichier:ligne),
   scénario d'attaque, gravité, correctif minimal…
   ```
   Portée : **projet** (`.bobine/roles/` du dossier, partagé par git) ou **personnel** (dossier de
   données de Bobine, tous les projets). Le projet l'emporte à nom égal. Sept rôles d'exemple
   fournis, désactivables : ceux cités par l'utilisateur.
2. **Un rôle s'exécute toujours dans une conversation fille.** Elle a son propre contexte (la mère
   ne gonfle pas, utile avec Bob qui sature vite), elle est visible, ouvrable, arrêtable, et rend
   un compte rendu. Lecture seule : même dossier, comme le relecteur de la fiche 177 ; sinon son
   worktree, comme toute fille.
3. **Consigne** : si l'agent a le mode nommé par `mode` (liste des modes ACP de sa session), la
   fille est ouverte dans ce mode (prompt système et restrictions natives) ; sinon la consigne du
   rôle part en tête de son premier message (ACP ne permet pas de poser un prompt système).
4. **Deux façons d'invoquer, une seule définition** :
   - l'utilisateur : `@rôle …` dans la saisie lance la fille avec ce rôle et ce texte ;
   - l'agent : `start_child` reçoit un argument `role`, et la liste des rôles (nom + description)
     est donnée dans sa description et dans le contexte de session. L'agent propose, l'utilisateur
     décide sur la carte de proposition (fiche 112), comme aujourd'hui.
5. **Les rôles se voient au travail** : icône et couleur du rôle sur la carte de la fille, dans la
   carte « Sous-tâches » de la mère (avec ce que chacun fait en ce moment) et dans la barre
   latérale. Pas de nouvel écran tant que ces cartes suffisent.
6. **Création** : parcours choisi par l'utilisateur sur maquettes (assistant en étapes, « décrire
   en une phrase », création sur place depuis `@` ou depuis une fille réussie…). La gestion vit
   dans Réglages › Rôles ; le point d'entrée principal doit être visible hors des Réglages.
7. **Écarté** : les « skills » (pas une notion d'ACP, sens différent selon l'agent) ; la liste
   d'outils autorisés outil par outil (Bobine ne bloque que ce qui demande une autorisation : la
   restriction réelle passe par le mode natif) ; un agent qui crée seul ses rôles (il peut en
   proposer un, l'utilisateur valide) ; la synchronisation dans les deux sens avec les fichiers des
   agents.

## Lancer des filles sans insister

### Diagnostic (lu dans le code, 2026-11-14)

1. **Le contexte arrive une fois** : `capabilitiesContext` (`shared/children.ts`, fiche 118) est
   joint au premier message de chaque session. Il pèse peu face au prompt système de l'agent, et
   disparaît du contexte à la compaction.
2. **Les consignes sont surtout des interdits** : le réglage par défaut « Quand ça s'y prête » et
   la description de `start_child` (`main/mcp/children-tools.ts`) énumèrent ce qu'il ne faut pas
   faire, et renvoient explicitement vers « your own sub-agents ».
3. **Une fille paraît chère** : worktree, carte d'accord, attente du compte rendu. Sans raison
   concrète, l'agent fait le travail lui-même.
4. **Aucun spécialiste nommé** : « fais relire par l'expert sécu » est un déclencheur naturel ;
   « ouvre une conversation fille » ne l'est pas. C'est la description des sous-agents qui fait
   déléguer Claude Code.
5. Les petits modèles appellent rarement un outil MCP qu'ils ne connaissent pas.

### Corrections proposées

- **Les rôles eux-mêmes** : la liste des rôles, avec leur description « quand l'utiliser », dans la
  description de `start_child` et dans le contexte de session.
- **Description réécrite en positif** : quand déléguer d'abord (plusieurs tâches indépendantes,
  relecture par un spécialiste, travail long), les exclusions ensuite, sans renvoi vers les
  sous-agents de l'agent pour un travail séparé.
- **Rappel court réinjecté** (quelques lignes) après une compaction, à la reprise d'une session
  (`session/load`) et quand le message de l'utilisateur nomme un rôle.
- **Filles de relecture sans worktree** (lecture seule, fiche 177) : moins chères, donc proposées
  plus volontiers.
- **Mesure avant et après** : un banc de dix consignes types (plusieurs tâches, « fais relire »,
  question simple qui ne doit pas déléguer…), joué à la main avec OpenCode et un modèle gratuit
  (0 coût), Bob seulement sur décision de l'utilisateur ; on compte les `start_child` justes et
  les délégations à tort. Le banc n'entre pas dans les essais automatiques (aucun vrai modèle).

## Critères d'acceptation

- [ ] Un rôle se crée par le parcours retenu sur maquettes, se modifie et se supprime dans Réglages
      › Rôles ; portée personnelle ou projet (`.bobine/roles/*.md`), relu à chaud.
- [ ] Un fichier de rôle invalide est signalé (nom du fichier, raison) sans bloquer les autres.
- [ ] `@` dans la saisie liste les rôles ; `@rôle texte` propose la fille avec ce rôle.
- [ ] `start_child` accepte `role` ; un rôle inconnu est refusé avec la liste des rôles connus.
- [ ] Le mode natif est utilisé quand l'agent l'a, la consigne en premier message sinon.
- [ ] Un rôle en lecture seule travaille dans le même dossier ; ses demandes d'écriture sont
      refusées et dites.
- [ ] Les serveurs MCP du rôle sont ceux passés à la session de la fille.
- [ ] Icône et couleur du rôle sur la carte de la fille, dans « Sous-tâches » et dans la barre
      latérale ; textes en français et en anglais.
- [ ] Contexte de session et description de `start_child` réécrits ; rappel après compaction et
      reprise ; banc de délégation joué avant et après, résultats dans le journal.
- [ ] Testé contre l'agent factice : scénarios « délègue à un rôle », « rôle inconnu », « rôle en
      lecture seule qui tente d'écrire », « mode natif présent / absent ».
- [ ] E2e : création d'un rôle, `@rôle`, carte de la fille, clair et sombre, fr et en.
- [ ] Phase 2 seulement : « Installer dans Bob / OpenCode », d'après leur documentation publique
      (modes personnels de Bob relus par ACP ? format des agents d'OpenCode), export à sens
      unique, copie de sauvegarde avant d'écrire, déclaré dans les profils (ADR-0011).

## Plan

Phases livrables séparément, chacune verte (`verify`, e2e touchées) :

1. **Délégation** (sans interface) : description de `start_child` et contexte réécrits, rappel
   après compaction et reprise ; banc joué avant et après. Petit, mesurable, utile tout de suite.
2. **Rôles, cœur** : `shared/roles.ts` (lecture et validation de l'en-tête), `main/roles/`
   (chargement personnel et projet, surveillance des fichiers), argument `role` de `start_child`,
   liste dans le contexte, lancement de la fille (mode, consigne, lecture seule, MCP), canaux IPC.
3. **Rôles, interface** (après validation des maquettes) : parcours de création, Réglages › Rôles,
   menu `@`, icône et couleur sur les cartes et dans la barre latérale.
4. **Export vers les agents** (après vérification de leur documentation publique).

Contraintes : `conversations/manager.ts`, `agent-host.ts`, `main/index.ts`, `shared/ipc.ts` et
`shared/transcript.ts` sont à leur plafond ESLint (audit du 13/11, CODE-2) : le code des rôles vit
dans ses propres modules, et un fichier au plafond est découpé avant d'y ajouter. Aucune nouvelle
dépendance (icônes Lucide déjà présentes). Un ADR pour le format des rôles et leur portée.

## Journal

- 2026-11-14 : fiche écrite ; diagnostic de la délégation lu dans le code ; maquettes demandées
  (plusieurs parcours de création, rôles au travail, Réglages › Rôles), en attente de validation.
