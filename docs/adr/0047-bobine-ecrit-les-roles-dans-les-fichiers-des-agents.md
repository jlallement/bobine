# ADR-0047 — Bobine écrit des rôles dans les fichiers des agents (modes de Bob, agents d'OpenCode)

- **Statut** : accepté
- **Date** : 2026-11-14

## Contexte

Un rôle de Bobine (ADR-0045) ne vit que dans Bobine. L'utilisateur veut le retrouver dans Bob Shell,
Bob IDE ou le terminal d'OpenCode, et, dans Bobine, que la lecture seule d'un rôle soit tenue par
l'agent lui-même plutôt que seulement demandée (OpenCode écrit sans demander). Les deux agents
savent définir des spécialistes, chacun dans son format :

- **Bob** : modes personnalisés, liste `customModes:` de `~/.bob/settings/custom_modes.yaml`
  (partagé avec Bob IDE) ou de `<dossier>/.bob/custom_modes.yaml` (documentation d'IBM,
  « Custom modes ») ; relevé sur Bob 2.1.0 (`pnpm bob-probe`, HOME jetable, 0 bobcoin) : ces modes
  sont listés par ACP après `agent`, `plan`, `ask` (`id` = `slug`), `session/set_mode` les accepte,
  et Bob garde le fichier tel quel ;
- **OpenCode** : un fichier Markdown par agent, `~/.config/opencode/agents/<id>.md` ou
  `<dossier>/.opencode/agents/<id>.md` (documentation publique, format V2 : `description`, `mode`,
  `permissions`) ; relevé sur OpenCode 2.2.5 (`pnpm opencode-probe --offline`) : un agent
  `mode: primary` écrit ainsi est listé par ACP dans le réglage de mode et s'y choisit.

ACP ne permet pas de créer un mode : il faut écrire ces fichiers, qui sont à l'utilisateur.

## Décision

1. **Export à sens unique, sur un geste explicite** : « Installer dans… » sur la page d'un rôle
   (rôles fournis compris, dans la langue de l'interface), une feuille qui dit où (pour vous / ce
   projet, chemin), quoi (identifiant, droits, sauvegarde) et montre le texte exact. Jamais de
   synchronisation : un rôle changé depuis est signalé, « Mettre à jour » le réécrit.
2. **Déclaré dans le profil** (ADR-0011) : `roleExport` porte l'adaptateur du format
   (`bob-custom-modes`, `opencode-agents`, dans `main/roles/export/`) ; repère `role-export` de
   Réglages › Agents et de la matrice de `docs/agents.md`. L'interface ne connaît que le format et
   ses textes.
3. **Bobine ne touche que ce qu'elle a écrit** : un registre dans ses données (profil, portée,
   fichier, identifiant, empreinte de l'entrée écrite et du rôle, lecture seule, « lancer dans ce
   mode ») dit ce qui est à elle. Une entrée du même identifiant absente du registre n'est jamais
   touchée (« rien n'a été changé ») ; une entrée de Bobine modifiée à la main depuis n'est
   remplacée ou retirée qu'après confirmation ; « Retirer » n'enlève que l'entrée (Bob) ou le
   fichier (OpenCode) de Bobine. Identifiant = nom du rôle ; noms réservés refusés (`agent`,
   `plan`, `ask` ; `build`, `plan`, `general`, `explore`, et les agents cachés d'OpenCode).
4. **Écriture sûre** : copie de sauvegarde datée (nombre borné) dans les données de Bobine avant
   toute écriture d'un fichier existant, écriture d'un coup (`writeFileAtomic`), fichier relu juste
   avant d'écrire (changé entre-temps : tout est refait), jamais à travers un lien symbolique (le
   fichier ; pour un projet, aucun dossier du chemin), fichier illisible jamais réécrit. Dans
   `custom_modes.yaml`, l'API `Document` de la dépendance `yaml` ne change que notre élément ; le
   reste et ses commentaires sont gardés, et le résultat est relu : le reste doit y être identique,
   sinon rien n'est écrit.
5. **Droits** : lecture seule = groupes `[read, mcp]` chez Bob ; `permissions` refusant `edit`,
   `shell` et `subagent` chez OpenCode (outils MCP, ceux de Bobine compris, laissés). Sinon :
   `[read, edit, execute, mcp]` ; rien chez OpenCode (ses réglages).
6. **« Dans Bobine, lancer ce rôle dans ce mode »** (coché par défaut) : à la fille d'un rôle sans
   `mode`, pour ce profil (portée projet : même dossier), si la session annonce ce mode, Bobine l'y
   met ; la lecture seule compte alors comme tenue par l'agent si l'installation l'était. La
   consigne part toujours en tête du premier message (ADR-0045).

## Alternatives écartées

- **Synchroniser dans les deux sens** — deux sources de vérité, et un mode modifié dans Bob IDE
  réécrirait un rôle de Bobine sans le dire.
- **Repérer nos entrées par un marqueur dans le fichier** (commentaire, champ) — un marqueur se
  copie ou se supprime à la main ; le registre et l'empreinte disent aussi si l'entrée a changé.
- **Réécrire tout `custom_modes.yaml` depuis un JSON** — perdrait les commentaires et la forme du
  fichier de Bob IDE ; d'où la dépendance `yaml` (ISC, sans dépendance) plutôt qu'un sous-ensemble
  maison (ADR-0045 lit un en-tête plat, pas une liste d'objets).
- **Suivre les liens symboliques comme ADR-0044** — un lien dans un dépôt ferait écrire ailleurs ;
  ici refusé partout, au prix des fichiers de configuration suivis par lien (dit à l'utilisateur).
- **Mettre d'office la fille dans le mode installé** — l'utilisateur choisit (case de la feuille).

## Conséquences

- Un rôle installé vaut dans Bob Shell, Bob IDE et le terminal d'OpenCode ; Bobine écrit des
  fichiers partagés avec d'autres outils, toujours après une copie et seulement sur un geste.
- Un registre perdu (illisible : mis de côté et repart vide) rend Bobine prudente : ses anciennes
  entrées sont vues comme « pas à elle » et ne sont plus touchées.
- Une installation pour le projet est à committer ; une fille en worktree ne la voit qu'une fois
  commitée (dit sur la feuille).
- Formats suivis par les sondes (`pnpm bob-probe`, `pnpm opencode-probe --offline`) ; que les
  permissions d'OpenCode tiennent ne se vérifie qu'avec un modèle (non sondé). Seul le format V2
  d'OpenCode est écrit (OpenCode 1.x non pris en charge pour l'installation).
