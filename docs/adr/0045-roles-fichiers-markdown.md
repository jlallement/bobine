# ADR-0045 — Rôles : un fichier Markdown par rôle, trois portées, exécutés en conversation fille

- **Statut** : accepté
- **Date** : 2026-11-14

## Contexte

L'utilisateur veut des spécialistes écrits une fois (expert sécu, tech lead, code reviewer…) et
invoqués d'un geste, par lui (`@rôle`) ou par l'agent (`start_child`), avec tous les agents (fiche
223). Bob (modes personnels) et OpenCode (agents) ont chacun leur format ; ACP ne permet ni de
poser un prompt système, ni de créer un mode. Il faut un format à Bobine, lisible et partageable
par git, et une règle quand deux rôles portent le même nom. Le format a été validé par
l'utilisateur le 2026-11-14 (décisions 3, 5, 7 et 8 de la fiche).

## Décision

1. **Un rôle = un fichier Markdown** : un en-tête entre `---` puis la consigne. Champs :
   `name` (minuscules, chiffres, tirets ; sinon le nom du fichier), `label`, `icon` (nom d'icône
   Lucide), `color` (une des couleurs d'accent de l'app : `orange`, `blue`, `violet`, `pink`,
   `green`, `graphite`), `description` (quand l'utiliser, lue par l'agent de la mère),
   facultatifs `agent` (profil), `mode` (mode natif, valeur ou nom), `model`, `read-only`
   (booléen), `mcp` (familles d'outils de Bobine données à la fille ; sans `mcp`, toutes).
   L'en-tête est un petit sous-ensemble de YAML (`clé: valeur`, listes `[a, b]` ou en tirets,
   commentaires `#`), lu sans dépendance. **Un champ inconnu écarte le fichier** (une faute de
   frappe sur `read-only` ne doit pas donner silencieusement le droit d'écrire) ; un fichier
   écarté est signalé avec sa raison, sans bloquer les autres.
2. **Trois portées** : fournis par Bobine (les sept rôles demandés, actifs d'office,
   désactivables), personnels (`<données de Bobine>/roles/*.md`, tous les projets), du projet
   (`.bobine/roles/*.md` du dossier de la conversation **mère**, partagés par git). À nom égal, le
   projet l'emporte sur le personnel, qui l'emporte sur le fourni. La désactivation est retenue
   par nom dans les réglages (`rolesOff`). Un rôle fourni ne s'écrit ni ne se supprime :
   l'enregistrer en personnel le remplace.
3. **Un rôle s'exécute toujours dans une conversation fille.** Mode natif si la session de
   l'agent l'expose (`mode`), sinon la consigne en tête du premier message ; le rôle est retenu
   dans l'enregistrement de la fille à son lancement (nom, libellé, icône, couleur, lecture seule,
   familles d'outils).
4. **Lecture seule** : même dossier que la mère, sans worktree ; Bobine refuse d'office les
   demandes d'écriture (`edit`, `delete`, `move`, `switch_mode`), le dit à l'agent dans sa
   consigne et compare l'empreinte git du dossier avant et après chaque tour (écart signalé à la
   fille et à la mère). Pour un agent qui écrit sans demander (profil `writesWithoutAsking`,
   OpenCode), la lecture seule n'est **que demandée** sauf mode natif choisi par le rôle, et c'est
   dit dans le fil de la fille : Bobine ne prétend pas une garantie qu'elle n'a pas.

## Alternatives écartées

- **Rôles dans `settings.json`** (comme les commandes personnelles de la fiche 045) — pas
  partageables par git, et une consigne longue y est illisible.
- **Format d'un agent** (modes de Bob, agents d'OpenCode) — propre à un agent (ADR-0011) ;
  l'export vers eux est une étape à part, à sens unique (phase 4).
- **YAML complet par une dépendance** — pour dix champs plats, une dépendance de plus n'apporte
  que de la surface ; le sous-ensemble lu est écrit à l'identique par `serializeRole`.
- **Champs inconnus ignorés** (compatibilité avec une Bobine plus récente) — écarté pour la
  sûreté ci-dessus ; un champ ajouté demain écartera le fichier dans une version plus ancienne, ce
  qui se voit (problème signalé) au lieu de se taire.
- **Lecture seule par le mode plan de l'agent, d'office** — le mode plan de Bob écrit un plan et
  finit par une question ; seul le rôle sait quel mode lui convient (`mode`).
- **`fs.watch` pour relire à chaud** — un surveillant par projet ouvert à fermer, évènements peu
  fiables selon l'éditeur ; à la place, empreinte du dossier (noms, tailles, dates) comparée à
  chaque lecture.

## Conséquences

- Tout agent profite des rôles sans code propre à lui ; seule la capacité « écrit sans demander »
  est déclarée dans un profil (OpenCode).
- Un rôle de projet non commité est lu dans le dossier de la mère, jamais dans le worktree d'une
  fille (qui part du dernier commit).
- La lecture seule d'un agent qui écrit sans demander n'est garantie que par son mode natif ;
  sinon, l'écriture est seulement détectée après coup, rien n'est défait.
- Un tour où une autre conversation du même dossier lance un outil qui écrit n'est pas jugé
  (pas d'accusation à tort) ; une modification faite à la main pendant le tour serait signalée.
- À surveiller : nouveaux champs (versions de Bobine qui se croisent dans un dépôt), et l'export
  vers Bob et OpenCode (phase 4).
