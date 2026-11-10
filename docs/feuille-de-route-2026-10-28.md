# Bobine — feuille de route des petits plus (28 octobre 2026)

**Ce qui l'a déclenchée** : après la 0.6.0, une revue des idées d'amélioration, grandes et
petites, dans tous les domaines. Jérôme a trié les propositions une par une, le 28/10. Chaque
point a été vérifié dans le code avant d'être proposé : ce qui existait déjà a été retiré.

**Ce qu'elle retient** : surtout des petits plus du quotidien, plus deux défauts à corriger en
premier. Les grands chantiers (arène, instantané git par tour, travail de nuit…) restent en
réserve (§ 3).

**Règles de conduite** (celles du 23/10 restent valables)

- **Corriger avant d'ajouter** : le lot A passe en premier.
- **Générique d'abord** : tout passe par ACP, Electron ou le système. Ce qui dépend d'un agent
  est déclaré dans son profil (ADR-0011), listé dans `specificItems` et dans `docs/agents.md`.
- **Bobine ne double pas l'agent.** Les commandes de l'agent (`rm`, `curl`…) sont lancées par
  l'agent lui-même, sous ses propres autorisations : Bobine ne les lance pas et n'ajoute pas de
  garde-fou par-dessus. Elle reste responsable de **ce qu'elle envoie elle-même** à l'agent
  (mentions, pièces jointes) et de **ses propres outils** (déjà soumis à accord, fiche 072).
- **Numéros** : provisoires, à partir de 154. Chaque lot est une fiche.

---

## 0. Plan d'exécution

| Ordre | Fiche | Lot | Taille |
|---|---|---|---|
| 1 | **154** | A — Défauts : clic droit, liens localhost, onglets du panneau dans l'ordre d'arrivée | P |
| 2 | **155** | B — Saisie : long texte collé, brouillon complet, copier un message envoyé, exclusions de l'agent respectées | P–M |
| 3 | **156** | C — Fil : durée du tour, images en grand, ouvrir dans l'éditeur, « Où en était-on ? » | M |
| 4 | **157** | D — Pendant le tour : commande bloquée, contexte presque plein, plafond de coût | M |
| 5 | **158** | E — Dossier et lancement : menu du dossier, `bobine .` | P–M |
| 6 | **159** | F — Apparence : densité compacte, mode présentation | P |
| 7 | **160** | G — Filles pilotées comme dans Claude Desktop : modèle choisi par la mère, compte rendu court, contrôle par la mère, fusion par l'utilisateur | M |

---

## 1. Les lots en détail

### A — Défauts (fiche 154, P)

**Clic droit**

- *Constat* : le clic droit ne fait rien dans Bobine. Aucun menu contextuel n'est branché
  (`context-menu` absent de `src/main`). Les fautes soulignées dans la zone de saisie ne se
  corrigent donc pas.
- *Ce qu'on fait* : un menu natif **réduit à l'essentiel** (demande de Jérôme), branché sur
  l'évènement `context-menu` de chaque fenêtre :
  - dans un champ : corrections d'orthographe proposées, Couper, Copier, Coller, Tout sélectionner ;
  - sur une sélection : Copier ;
  - sur un lien : Copier l'adresse ;
  - sur une image : Copier l'image.
  Rien d'autre : pas d'actions sur les messages dans ce menu, elles ont déjà leurs boutons.
- *Acceptation* : un mot mal écrit se corrige au clic droit ; Copier et Coller marchent partout.

**Liens localhost**

- *Constat* : un lien `http://localhost:3000` dans une réponse ne fait rien au clic. Seuls les
  liens `https://` sont ouverts (`src/main/renderer-windows.ts:44`).
- *Ce qu'on fait* : une adresse locale (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`)
  s'ouvre dans le navigateur intégré ; ⌥-clic l'ouvre dans le navigateur du Mac. Les autres
  liens `http://` s'ouvrent dans le navigateur du Mac.
- *Acceptation* : essai e2e avec un lien local dans une réponse de l'agent factice.

**Onglets du panneau dans l'ordre d'arrivée** (irritant de Jérôme, 28/10)

- *Constat* : les onglets visibles sont rangés dans l'ordre fixe de `PANEL_TABS` (Navigateur,
  Simulateur, Android, Terminal, Tâches, Échanges ACP, Modifications : `visiblePanelTabs`,
  `src/renderer/src/panel-tabs.ts`). Avec trois outils déjà ouverts, un Navigateur ouvert ensuite
  se place en premier et décale tous les autres, le contraire de ce que voulait la fiche 082.
- *Ce qu'on fait* : un onglet qui apparaît (outil utilisé par l'agent, « + », modifications)
  s'ajoute **à droite** ; ceux qui sont déjà là ne bougent plus. L'ordre d'arrivée est retenu par
  conversation. Au lancement, il se déduit du fil (ordre de première utilisation), puis des onglets
  ouverts à la main.
- *Acceptation* : test de `visiblePanelTabs` (Terminal, Tâches puis Navigateur → Navigateur à
  droite) et suite e2e du panneau.

### B — Saisie (fiche 155, P–M)

- **Long texte collé → pièce jointe.** Au-delà d'un seuil (de l'ordre de 40 lignes ou 4 000
  caractères, à régler), le texte collé devient une puce « Texte collé · N lignes » qu'on peut
  ouvrir ou remettre dans la saisie. Il part à l'agent comme un bloc de texte joint.
- **Brouillon complet.** Aujourd'hui le brouillon ne garde que le texte
  (`src/renderer/src/drafts.ts`). Il garde aussi les pièces jointes quand on change de
  conversation ; après un redémarrage, au moins les fichiers (par chemin), les images si la taille
  le permet.
- **Copier un message envoyé.** Les messages de l'utilisateur ont l'heure, « Réessayer » et
  « Modifier », mais pas de copie (`Transcript.tsx`). On ajoute le même bouton que sous les
  réponses.
- **Exclusions de l'agent respectées par les envois de Bobine.**
  - *Constat* : `.bobignore` est lu par Bob pour ses propres lectures. Mais les mentions `@`, les
    pièces jointes, le glisser-déposer et `@git-changes` sont mis par Bobine dans le texte du
    message : rien ne dit que Bob les filtre (non documenté, à vérifier quand Bob sera disponible).
    Exemple : un `.env` exclu, mais modifié, part quand même dans `@git-changes`.
  - *Ce qu'on fait* : le profil d'agent déclare ses fichiers d'exclusion (`.bobignore` pour Bob ;
    OpenCode s'il en a un). Les mentions `@` ne proposent pas ces fichiers, `@git-changes` les
    saute en le disant, une pièce jointe exclue demande confirmation.
  - *Agents* : Bob (déclaré dans son profil) ; générique pour les autres. Mise à jour de
    `docs/agents.md` et de « Compatibilité Bob » dans `docs/acp.md`.

### C — Fil (fiche 156, M)

- **Durée du tour.** L'heure s'affiche déjà sous chaque message (date complète en infobulle). On
  ajoute la durée du tour sous la réponse (« 2 min 14 s »).
- **Images en grand.** Un clic sur une image d'un message ou d'une capture d'outil l'ouvre en
  grand ; on peut la glisser vers le Finder.
- **Ouvrir dans l'éditeur.** Sur un fichier d'une carte ou d'un diff, « Ouvrir dans … » à la bonne
  ligne. L'éditeur se choisit dans les réglages, parmi ceux qui sont installés :
  - VS Code, Cursor, Zed : `<cmd> --goto fichier:ligne` ;
  - IntelliJ IDEA et les autres IDE de JetBrains (WebStorm, PyCharm…) : lanceur `idea --line N
    fichier`, sinon `open -na "IntelliJ IDEA.app" --args --line N fichier`.
  Bobine reste sans éditeur : on ne fait qu'ouvrir celui de l'utilisateur.
- **« Où en était-on ? »** En rouvrant une conversation inactive depuis plus d'un jour, une
  carte courte en bas du fil : dernière demande, fait, en cours (tâches du plan), fichiers
  modifiés non commités. Construite **par Bobine** à partir du fil, du plan et de git, sans
  appeler le modèle (0 coût). Repliable, une fois par reprise.

### D — Pendant le tour (fiche 157, M)

- **Commande bloquée signalée.** Une carte de commande sans nouvelle sortie depuis quelques minutes
  (réglable) est marquée « Aucune sortie depuis 4 min », avec « Interrompre » (annulation du tour
  par ACP). Générique : seulement quand l'agent envoie la sortie des commandes (fiche 018) ; à
  vérifier pour Bob.
- **Contexte presque plein.** La puce de consommation passe en orange vers 80 % de remplissage
  (`usage_update`), avec `/compact` en un clic. Rien quand l'agent n'envoie pas de remplissage.
- **Plafond de coût par conversation.** Un plafond par défaut dans les réglages, modifiable par
  conversation. Au-delà, Bobine interrompt le tour à la fin de l'outil en cours et demande
  « Continuer (plafond +X) » ou « Arrêter ». Dans l'unité de l'agent (bobcoins pour Bob, dollars
  sinon) ; sans coût connu, le plafond porte sur les jetons, et le réglage le dit.

### E — Dossier et lancement (fiche 158, P–M)

- **Menu du dossier.** Le dossier affiché sous la zone de saisie ouvre un petit menu : Afficher
  dans le Finder, Copier le chemin, Ouvrir un terminal ici (panneau terminal de Bobine).
  « Afficher dans le Finder » existe déjà pour les fichiers du fil, pas pour le dossier.
- **`bobine .` dans le terminal**, comme `code .` : une nouvelle conversation dans le dossier
  courant, avec un premier message en option (`bobine . "corrige les tests"`).
  - L'instance unique existe déjà (`second-instance`, `src/main/index.ts:304`) ; il reste à lire
    les arguments et à installer un petit script `bobine` depuis les réglages (comme
    « Installer la commande code » de VS Code).
  - Le premier message n'est jamais envoyé sans que l'utilisateur ait vu la conversation : il est
    posé dans la saisie.

### F — Apparence (fiche 159, P)

- **Densité compacte.** Réglage « Densité : normale / compacte » dans Apparence : moins d'espace
  entre messages, cartes et lignes de la barre latérale. Par les jetons de thème (ADR-0027).
- **Mode présentation.** Pour une démo ou un partage d'écran : texte du fil plus grand, chemins du
  dossier personnel raccourcis en `~`, coûts et quota masqués, bannières coupées. Interrupteur
  dans le menu Présentation et dans les réglages ; une pastille le rappelle tant qu'il est actif.

### G — Filles pilotées comme dans Claude Desktop (fiche 160, M)

Décision de Jérôme (28/10) : « le même comportement que Claude ». La mère est un tech lead :
elle découpe, choisit le modèle de chaque fille, contrôle le travail sans saturer son contexte,
renvoie des remarques, et c'est l'utilisateur qui fusionne.

- **Modèle et agent suggérés par la mère, jamais choisis seuls** (précision de Jérôme, 28/10) :
  avec Bob, on ne choisit jamais le modèle (rien de suggéré ni de présélectionné) ; avec
  OpenCode, la mère peut suggérer un modèle avec une raison, mais l'utilisateur doit le valider
  avant le lancement, y compris pour une fille lancée sans carte (fiche 118). Générique : une
  capacité déclarée dans le profil d'agent, pas un « si Bob ».
- **Compte rendu court et borné** à chaque fin de tour d'une fille : état, branche, fichiers
  touchés (+/−), début de son récapitulatif ; **jamais de diff** poussé dans le contexte de la mère.
- **Le compte rendu n'est pas une preuve** : la consigne donnée à la mère lui dit de vérifier par
  ses propres outils (git sur la branche de la fille, fichiers à risque, contrôles du projet) ou de
  déléguer la relecture à un sous-agent, avant de recommander une fusion.
- **Remarques renvoyées** par `message_child` (existe) : la fille garde son contexte et reprend.
- **Fusion par l'utilisateur** : la mère recommande (« prête à fusionner », ou ce qui manque), la
  recommandation s'affiche sur la carte de la fille ; « Fusionner » reste un geste de
  l'utilisateur, jamais un outil de l'agent.

---

## 2. Écartés le 28/10

- **Commandes dangereuses signalées** et **bac à sable de l'agent** : les commandes sont lancées
  par l'agent, sous ses propres autorisations ; Bobine ne les double pas.
- **Menu du clic droit enrichi** (Citer, Modifier, Repartir d'ici) : seulement l'essentiel (lot A).

## 3. En réserve (proposés, sans avis le 28/10)

Rien n'est perdu : à reprendre lors d'une prochaine revue.

- **Grands chantiers** : l'arène (même consigne à deux agents, fusion du gagnant) ; remonter le
  temps (instantané git par tour, ADR-0029 réservé, « blame » par conversation) ; travail de nuit ;
  Bobine dans la poche (téléphone) ; piloter le Mac (fiche 038) ; Windows.
- **Code et git** : contrôles du projet après chaque tour ; relecture d'une fille avant fusion ;
  préparation des worktrees ; avant / après visuel.
- **Appareils** : annoter le simulateur et l'émulateur ; enregistrer un parcours dans le
  navigateur ; rotation (fiche 083).
- **Interface** : conversation dans sa propre fenêtre ; accessibilité ; skills visibles ;
  ↑ pour l'historique des messages ; tout déplier / replier ; copier le tour en Markdown ;
  citer un passage ; annuler l'envoi ; saisie agrandie ; suggestions de départ ; agent et modèle
  retenus par dossier ; ne pas déranger ; ⌃1 à ⌃9.
- **Liens** : numéros d'issue et commits cliquables ; lire une réponse à voix haute.
- **Coût** : coût estimé avant l'envoi ; bilan de la semaine.
- **Qualité** : budgets de performance ; sondes en CI chaque semaine ; signaler une nouvelle
  version (il faudrait un ADR, après ADR-0023) ; rapport de plantage au lancement suivant.
- **Distribution** : finir Linux (fiche 145) ; Homebrew ; signature Apple réelle (fiche 111).
- **Partage** : secret collé détecté avant l'envoi ; conversation exportée en page HTML ; film du
  tour ; URL d'issue collée → contenu joint.
