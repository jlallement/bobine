# 197 — Profil : index reconstruit, disque plein, sauvegarde complète et restauration

- **Statut** : fait (en relecture)
- **Dépend de** : 196, 187 (lot G, risques R11, R14, R24), 043
- **Agents** : les deux : rien de propre à un agent.

## Pourquoi

Index et copie perdus, la liste était vide alors que les fils étaient sur le disque. Disque plein
en quittant : les derniers tours étaient perdus sans un mot. La sauvegarde ne copiait que les
conversations et les réglages, et rien ne la restaurait.

## Critères d'acceptation

- [x] Chaque fil garde une copie de l'enregistrement de sa conversation ; index et copie perdus,
      la liste est refaite à partir des fils (même ceux d'avant la 0.11, titre du premier message) ;
      un fil absent de l'index y revient ; avis « liste refaite » (information).
- [x] Disque plein : dit en clair (« le disque est plein »), sans code ; aucun temporaire laissé ;
      place libérée, les messages arrivent sur le disque. En quittant : alerte « Réessayer » (par
      défaut, aussi Échap et ⌘.) / « Quitter sans les enregistrer », qui revient tant que ça échoue.
      Arrêt du Mac ou signal : avis au lancement suivant.
- [x] Sauvegarde complète : conversations (corbeille comprise), réglages, autorisations, tâches,
      consommation (copie cohérente `VACUUM INTO`), marque ; sans les clés d'API ; un
      `bobine-sauvegarde.json` la décrit.
- [x] Restauration : jamais sans confirmation (dans la carte) ; faite au lancement suivant, tout ou
      rien ; l'état d'avant gardé dans `restaurations/avant-<date>/`, lui-même restaurable (essai).
- [x] E2e « disque plein » sur une vraie petite image disque (`hdiutil`), macOS.

## Ce qui a été fait

**Copie de l'enregistrement** (`conversations/store.ts`) : `attachRecords` donne au magasin
l'enregistrement courant ; chaque écriture d'un fil l'y copie (`record`), retiré à la lecture.
`loadIndex` : index, sinon sa copie, sinon reconstruction ; dans tous les cas, les fils qui ont
une copie et manquent à l'index y reviennent (`recovered`), et l'index est réécrit aussitôt. Une
copie peut être un peu en retard sur l'index (titre renommé après le dernier tour) : c'est
l'index qui fait foi tant qu'il se lit.

**Disque plein** (`history-writer.ts`, `unsaved-at-quit.ts`) : `saveFailedDiskFull` pour
ENOSPC/EDQUOT ; `unsavedIds`, `lastError`. En quittant, après l'écriture synchrone des fils,
`keepUnsaved` pose la question tant qu'il reste des conversations non enregistrées (nommées s'il y
en a trois au plus) ; sans personne pour répondre (`QuitFlow.interactive`), une petite note
`non-enregistre-au-dernier-arret.json` est relue au lancement suivant (au mieux : le disque peut
être encore plein).

**Sauvegarde et restauration** (`conversations/backup.ts`) : `backupProfile`, `checkBackup`
(sauvegarde d'avant la 0.11 reconnue à `conversations/index.json`, format plus récent refusé),
`requestRestore` (une demande, relance de l'app), `applyPendingRestore` au lancement : copie dans
un dossier à côté (un disque plein échoue là, rien n'a bougé), déplacement de l'état actuel dans
`restaurations/avant-…` avec sa description, mise en place ; au premier échec, tout est remis.
Une demande ne se rejoue jamais deux fois.

**Interface** : Réglages › Données, ligne « Restaurer une sauvegarde… » et confirmation dans la
carte (bouton d'accent : rien n'est perdu), refus en clair ; avis de succès ou d'erreur au
lancement avec « Afficher dans le Finder » et le détail replié.

## Plan

1. Copie de l'enregistrement et reconstruction (magasin), essais.
2. Disque plein : message, note des fils non enregistrés, alerte en quittant.
3. Sauvegarde complète, restauration au lancement, IPC `backup:*`.
4. Interface (maquette validée sous réserve), e2e (image disque, restauration réversible).

## Écarts au plan

- L'alerte en quittant (boîte native) n'est pas jouée en e2e : elle bloque le processus principal.
  Sa logique (Échap = Réessayer, retour tant que ça échoue, note sans interface) est couverte par
  `unsaved-at-quit.test.ts`.
- Le dernier clic « Restaurer et redémarrer » n'est pas joué en e2e (l'app relancée échapperait au
  lanceur d'essais) : l'e2e joue la confirmation, puis la restauration au lancement à partir de la
  même demande ; le canal est couvert par un essai unitaire.
- Les fils d'avant la 0.11 n'ont pas de copie de leur enregistrement tant qu'ils ne sont pas
  réécrits : reconstruits, ils perdent agent, dossier et épinglage (titre du premier message).
- L'image disque de l'e2e contient aussi le magasin de l'agent factice, qui échoue lui aussi : son
  erreur (avec son code) est la sienne, dans le fil ; seuls les avis de l'app sont vérifiés.

## Journal

- 2026-11-07 — Fait avec la fiche 196 (branche `claude/robustesse-g-profil`).
- 2026-11-07 — Essai réel, OpenCode 2.2.5, modèle gratuit `opencode/big-pickle`, profil jetable
  (`--user-data-dir` dans un dossier d'essai) et maison isolée (`HOME` et `XDG_*` à part : ni le
  vrai profil de Bobine, ni la configuration d'OpenCode de l'utilisateur) ; pilotage par le
  protocole DevTools, script `essai-reel.mjs` dans les notes de la nuit.
  - Trois tours ; au troisième (un long poème), `kill -9` de tous les processus de l'app en plein
    streaming (628 caractères affichés).
  - Relance : la conversation est là, les trois messages et 496 caractères de la réponse coupée
    (perte bornée à la dernière seconde d'écriture, comme prévu) ; OpenCode reprend la session.
  - Sauvegarde depuis Réglages › Données, puis un quatrième tour (« un légume » : « Carotte »).
  - Restauration (demande posée comme « Restaurer et redémarrer ») : avis de succès, la
    conversation revient à l'état de la sauvegarde (trois messages), le quatrième tour est dans
    `restaurations/avant-…`, la demande est effacée. Un tour après la restauration répond
    (« Pomme », premier fruit de la liste).
  - Constat : la restauration remet le profil de Bobine, pas l'historique propre de l'agent. Au
    rejeu de la session (`session/load`), OpenCode renvoie aussi le tour fait après la sauvegarde :
    sa réponse réapparaît dans le fil. Attendu (l'agent garde sa propre histoire), à dire dans
    l'aide.
  - Écart : `--profil-temporaire` n'a pas pu servir : son dossier est effacé dès que l'app
    s'arrête, `kill -9` compris, ce qui rend l'essai « relance après un plantage » impossible.
- 2026-11-07 — Relecture indépendante (bloquante), corrigée, chaque point avec son essai :
  - restauration (`restore.ts`, séparé de `backup.ts`) : la demande sert de journal, réécrite
    atomiquement à chaque étape (`staging`, `moving`, `placing`, `done`) ; relancée après un arrêt
    brutal, elle est finie si elle était au bout, sinon tout est remis comme avant et un avis le
    dit ; les copies `.restauration-*` restées sont balayées. Essai : arrêt simulé à chaque étape ;
  - sauvegarde piégée : tout lien symbolique (dossier choisi, entrées, sous-arbre) est refusé, le
    type de chaque entrée vérifié, `formatVersion` doit être un entier ; une sauvegarde de la 0.11
    sans description (coupée) est refusée ;
  - sauvegarde écrite dans `<nom>.partiel`, renommée à la fin ; seul un fichier absent est ignoré ;
    un échec (disque plein) ne laisse rien et le dit en clair ; jamais dans le dossier de données ;
  - pas de secrets : variables d'environnement des agents déclarés et identifiants du proxy retirés
    des réglages sauvegardés (à ressaisir après une restauration) ;
  - alerte en quittant : posée avant l'arrêt (fils écrits d'abord), boîte asynchrone fermée par un
    arrêt du Mac ou un signal survenu pendant (la réponse ne compte pas), délai de 5 minutes ;
    sinon, la perte est notée pour le lancement suivant ;
  - note de fin, demande de restauration, descriptions : écritures atomiques.
- 2026-11-07 — La confirmation de restauration et le guide (fr, en) disent que les clés d'API des
  agents déclarés ne sont pas dans une sauvegarde et sont à ressaisir.
- 2026-11-07 — Contre-relecture : `onboarding:check` refusé en lecture seule (il envoie un vrai
  message) ; un dossier `.partiel` n'est jamais restaurable, et la marque est copiée en premier ;
  la cible d'une sauvegarde est comparée par son chemin réel ; essais d'une restauration coupée au
  milieu de `moving` et de `placing`. Fusion de la mémoire (fiche 182) : ses canaux sont classés
  (lecture : `projects`, `list`, `export`, `reveal` ; le reste refusé en lecture seule) ; la
  sauvegarde garde les souvenirs (`memory/`) et leurs empreintes (`memory.approved.json`), jamais
  `memory.key`, chiffrée par le trousseau de ce Mac. Restaurée sur un autre Mac, les empreintes ne
  correspondent plus à la clé : les souvenirs sont à revalider (dit dans le guide).
