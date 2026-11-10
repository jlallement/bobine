# 196 — Profil : versions du format, champs inconnus gardés, corbeille, avis

- **Statut** : fait (en relecture)
- **Dépend de** : 187 (lot G, risques R10, R12, R14, R23), 041, 043, 103
- **Agents** : les deux (et l'agent factice) : rien de propre à un agent. La case « supprimer aussi
  chez l'agent » suit l'annonce `session/delete` de chaque agent.

## Pourquoi

Promesse de la V1 : « ne jamais perdre une conversation ». Avant cette fiche, une Bobine plus
ancienne effaçait ce qu'elle ne connaissait pas, une suppression était définitive (et cochait
d'office la suppression chez l'agent), un disque plein laissait des fichiers temporaires qui
reprenaient la place libérée, et des réglages abîmés repartaient des valeurs par défaut sans le
dire.

## Critères d'acceptation

- [x] `profile.json` marque le format du profil ; un profil d'un format plus récent s'ouvre en
      lecture seule, avec un avis clair, et n'est jamais réécrit (ADR-0042).
- [x] Lecture seule : envoi impossible (saisie inerte, et le main refuse aussi), « Nouvelle
      conversation » désactivée, tâches planifiées non lancées et page qui le dit, Réglages en
      lecture seule (sauf Données, Diagnostic, À propos), corbeille et restauration refusées.
- [x] Champs inconnus gardés : réglages, autorisations, entrées de l'index, champs d'un fil
      (essais aller-retour, profils réels 0.7, 0.8, 0.9).
- [x] Écritures atomiques partout (tmp + fsync + rename) ; un temporaire en échec est retiré, ceux
      d'un arrêt brutal balayés au lancement.
- [x] Réglages ou autorisations illisibles ou du mauvais type : mis de côté (jamais supprimés), avis.
      Fichier illisible qu'on ne peut pas déplacer (droits) : jamais écrasé.
- [x] Corbeille : une conversation supprimée y reste 30 jours (Réglages › Données), se restaure,
      ou s'efface tout de suite ligne par ligne (confirmé). Purge au lancement, dite dans
      l'interface. Aucune écriture en vol ne fait revenir un fil supprimé.
- [x] Profils réels 0.7, 0.8, 0.9 faits avec les versions taguées, ouverts et réécrits sans perte.
- [x] E2e : suite `profil` (clair et sombre).

## Ce qui a été fait

**Format et lecture seule** (`src/main/profile-format.ts`, `profile-startup.ts`, `storage.ts`) :
au lancement, avant toute lecture, `openProfile` lit la marque. Format plus récent :
`setReadOnlyProfile` fait de toute écriture, tout renommage et toute purge sous le dossier de
données un « rien » (sauf `agents.pids`). Sinon la marque est posée, les temporaires balayés, la
corbeille purgée. Descente ordinaire : une ligne au journal, pas d'avis (rien n'est perdu).

**Champs inconnus** : `Settings.extra` et `Stored.extra` (approbations) gardent les clés de premier
niveau inconnues, réécrites avant les connues ; `KNOWN` est un `Record<keyof Settings, true>` (le
type oblige à le tenir à jour). Les entrées d'index qui ne sont pas des enregistrements valides
sont réécrites telles quelles en fin d'index. Un fil d'une `version` plus récente est lu, jamais
réécrit.

**Fichiers abîmés** : `readSettings` et `ApprovalStore.damaged` rendent le fichier mis de côté,
aussi pour du JSON du mauvais type. `readJson` met de côté un fichier illisible pour une autre
raison (EACCES) ; s'il ne peut pas être déplacé, il est protégé : `writeFileAtomic` refuse de
l'écraser (l'échec est signalé comme un autre).

**Corbeille** (`conversations/trash.ts`) : `conversations/.trash/<id>.json` (le fil de la mémoire
s'il est chargé, sinon le fichier tel quel) et `<id>.meta.json` (enregistrement, date, session
supprimée chez l'agent). `TrashLink` : le magasin marque la conversation « partie » (plus aucune
écriture, le `commit` d'une écriture en vol échoue), l'écrivain attend celles en vol, puis le fil
part. Restaurée alors que sa session a été supprimée chez l'agent : elle continue dans une session
neuve, et un avis du fil le dit.

**Avis** (`profile-status.ts`, `components/common/Profile.tsx`) : en tête de la fenêtre, avec le
composant commun `.notice` et sa gravité (information, succès, avertissement, erreur), sans chemin
ni code d'erreur : « Afficher dans le Finder » (l'interface désigne l'avis, jamais un chemin),
détail replié, fermé par ×. L'avis « historique illisible » quitte le fil de l'accueil pour ce
même endroit.

**Interface** (maquette validée sous réserve par l'expert UX, 13 corrections appliquées) :
boîte de suppression « Mettre à la corbeille », case « Supprimer aussi chez {agent} (définitif) »
seulement si l'agent sait le faire, jamais cochée d'office ; Réglages › Données : section
Corbeille (« effacée dans N jours », Restaurer, effacer définitivement par ligne, confirmation
dans la ligne, liste bornée qui défile).

## Plan

1. Écritures : temporaire retiré, balayage, fichiers protégés, lecture seule (`storage.ts`).
2. Marque du profil et ouverture au lancement (`profile-format.ts`, `profile-startup.ts`).
3. Champs inconnus : réglages, autorisations, index, fils.
4. Corbeille dans le magasin et le gestionnaire ; IPC `trash:*`, `profile:*`.
5. Interface (après maquette) : avis, lecture seule, corbeille, boîte de suppression.
6. Profils réels des versions taguées, essais unitaires et e2e.

## Écarts au plan

- Champs inconnus gardés au premier niveau seulement (réglages, autorisations) : un champ inconnu
  à l'intérieur d'un objet connu (un nouveau champ d'un agent déclaré, par exemple) est perdu à la
  réécriture par une version plus ancienne. Les entrées d'index et les fils, eux, sont gardés en
  entier.
- Descente de version : pas d'avis (le registre de la fiche 187 parlait d'un avertissement) ;
  rien n'étant perdu, une ligne au journal suffit — moins d'interface.
- La confirmation de l'effacement définitif garde le bouton « Garder » du composant commun
  `ConfirmRow` (la maquette disait « Annuler »).
- `.notice-success` ajoutée dans `profile.css`, isolée en fin de fichier : à retirer à
  l'intégration, le lot C l'ajoute au composant commun avec le contraste corrigé.
- Les profils réels ne contiennent ni `approvals.json` ni tâches planifiées : les versions taguées
  n'en écrivent pas avec ce scénario (la permission « toujours » du factice ne crée pas
  d'autorisation retenue). Les chemins du dossier de travail y sont ceux de la machine qui les a
  faits (laissés tels quels : rien d'inventé).
- Guide (fiche 186, après la fusion de la branche d'intégration) : Réglages › Données dit la
  sauvegarde complète, qu'elle contient aussi la corbeille, la restauration (sans l'historique
  interne de l'agent) et la corbeille.
- Premier lancement (fiche 188) : un profil en lecture seule ne voit jamais l'accueil et n'en écrit
  pas la marque (`readOnly` dans les faits du premier lancement) ; les profils réels 0.7 à 0.9 non
  plus (e2e, accueil permis).

## Journal

- 2026-11-07 — Fait (branche `claude/robustesse-g-profil`). Essais : `store`, `trash`,
  `history-writer`, `profile-integrity`, `profile-fixtures` (0.7, 0.8, 0.9), `manager`
  (corbeille aller-retour, session supprimée chez l'agent, lecture seule refusée), `DeleteDialog` ;
  e2e `profil` (profils réels, profil abîmé, corbeille, lecture seule avec une tâche échue,
  restauration). Voir aussi la fiche 197.
- 2026-11-07 — Fusion de la branche d'intégration (aide, astuces, GitLab, premier lancement) ; ADR
  renuméroté 0042. Relecture indépendante (bloquante), corrigée, chaque point avec son essai :
  - lecture seule : la suppression est refusée dans le main (le fil reste intact, rien chez l'agent),
    la corbeille refuse d'elle-même, et tous les canaux qui changeraient le profil (renommer,
    archiver, épingler, réglages, tâches…) sont refusés (`READ_ONLY_REFUSED`, `guardReadOnly`) au
    lieu d'être acceptés puis perdus ; le journal de consommation est coupé (la base n'est même pas
    ouverte : empreinte vérifiée en e2e) ;
  - `profile.json` illisible (JSON, type, `formatVersion` non entier) : lecture seule, jamais réécrit,
    avis propre ;
  - `readJson` ne met de côté que du contenu invalide ; une lecture impossible (droits, EIO,
    EMFILE) laisse le fichier en place, protégé ; mise de côté jamais par-dessus une copie, et au
    plus 10 copies par fichier (les plus anciennes retirées : écart assumé à « jamais supprimé »,
    pour ne pas remplir le disque) ;
  - écritures : dossier synchronisé après chaque renommage, `.bak` écrit atomiquement ;
  - corbeille : la fiche est écrite avant le fil, et une suppression laissée en route par un arrêt
    brutal est finie au lancement (pas de doublon) ; un fil d'une version plus récente part tel
    quel ; « Restaurer » qui ne peut rien faire le dit ; l'effacement définitif retire aussi les
    copies abîmées du fil et son entrée dans `index.json.bak` ;
  - script `bobine` : `--` avant le message (un message qui commence par « - »).
- 2026-11-07 — Décisions du tech lead sur les écarts :
  - copies abîmées : plus rien n'est supprimé ; au-delà de 10 copies d'un même fichier, il n'en est
    plus créé : le fichier reste en place, protégé, une ligne au journal, et l'avis « fichier du
    profil illisible, laissé tel quel » le dit ;
  - garde de lecture seule inversée (`read-only-guard.ts`) : tout canal est refusé sauf ceux de
    `READ_ONLY_SAFE` ; chaque canal de `IPC_CHANNELS` est classé (sûr, ou `PROFILE_CHANGING`) et un
    essai échoue pour un canal non classé ; commentaire dans `shared/ipc.ts` et `main/ipc.ts` ;
  - « Mon activité » en lecture seule dit pourquoi elle est vide.
- 2026-11-07 — Passe finale : les sorties ouvertes dans l'éditeur (fiche 192) quittent le profil
  pour `<temp>/bobine-tool-outputs-<empreinte du profil>/` (0700, fichiers 0600, vidé au démarrage
  et à la fermeture) ; toutes les gardes des envois s'enchaînent (le plafond de coût appelle la
  précédente) et la lecture seule enveloppe `prompt` lui-même : refusé dans tout ordre de
  démarrage (essai de l'assemblage réel) ; avant de quitter, `flushAll` attend les écritures en vol
  puis écrit le plus récent (essai avec un stockage contrôlé). `pr:options` est refusé en lecture
  seule ; la mémoire n'y écrit rien (ni clé créée, ni balayage, ni mise de côté).
- 2026-11-07 — Recette de l'intégration, défaut D5 : en lecture seule, Épingler, Renommer,
  Archiver, Supprimer et « Lancer en parallèle » sont désactivés (pas masqués) dans les menus d'une
  conversation, la raison en infobulle ; exporter reste permis. Un refus de la garde porte une
  marque (`READ_ONLY_ERROR`) : le renderer le dit dans sa langue (« Cette version ne peut pas
  modifier ce profil. »), jamais le texte d'Electron ; les erreurs venues du main passent toutes par
  `ipcErrorText`. Essais : `ipc-errors.test.ts`, e2e `profil` (menu en lecture seule).
