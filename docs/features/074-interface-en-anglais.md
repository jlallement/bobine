# 074 — L'app en anglais : choix de la langue

- **Statut** : fait
- **Dépend de** : 027 (réglages), 073 (À propos, `.dmg`) — ADR-0014
- **Agents** : les deux — rien ne dépend de l'agent. La langue de l'interface n'a aucun effet sur
  lui : on peut avoir l'interface en anglais et lui parler en français. Ce qu'il envoie (réponses,
  questions, formulaires, erreurs ACP) s'affiche tel quel.

## Pourquoi

L'utilisateur (2026-10-16) veut pouvoir proposer Bobine dans d'autres langues que le français, en
commençant par l'anglais. Aujourd'hui, tous les textes sont écrits en français directement dans le
code, sans couche de traduction. Mieux vaut le faire tôt : chaque fiche ajoute en moyenne une
quinzaine de textes de plus à reprendre.

Décisions de l'utilisateur (2026-10-16), détaillées dans l'ADR-0014 :
- i18next, ressources en JSON ;
- **seuls les textes de l'interface** sont traduits, jamais ce qui vient des agents ou leur est
  envoyé ;
- langue choisie dans les réglages, comme dans Claude Desktop ; au départ, celle de macOS, sinon
  l'anglais ;
- une conversation déjà enregistrée s'affiche dans la langue choisie (lignes écrites par l'app
  enregistrées en codes).

## Mesures (2026-10-16)

Comptage automatique des textes du code, juste à 15 % près.

| Zone | Textes | Mots |
|---|---|---|
| Interface (`src/renderer/src`, 52 fichiers) | ~650 | ~3 300 |
| Main process (erreurs, avis, autorisations, menu, diagnostic…) | ~500 | ~3 300 |
| `src/shared/` (libellés d'outils, raccourcis, commandes, export) | ~200 | ~900 |
| **Total** | **~1 170 textes différents** | **~7 500** |

Points délicats repérés :
- `fr-FR` est écrit en dur dans `time.ts`, `usage.ts`, `ResumeDialog`, `McpSettings` et
  `SettingsDialog` ; la page déclare `<html lang="fr">`.
- Une quarantaine de pluriels sont faits à la main (`fichier${n > 1 ? 's' : ''}`), avec des accords
  (« modifié(s) »).
- Certaines phrases sont assemblées à partir de fragments (`app-tools.ts` : « vers le haut »,
  « dans la page ») ; l'ordre des mots change d'une langue à l'autre.
- Les avis (`notice`) et les libellés des outils de l'app (`appTool.label`) sont enregistrés en
  toutes lettres dans l'historique.
- Le menu macOS a environ 40 libellés en dur ; l'image du `.dmg` contient du texte en français.
- Les essais e2e trouvent les éléments par `data-testid` (550 sélecteurs), pas par leur texte.

Déjà prêt : les descriptions des outils MCP envoyées à l'agent sont en anglais ; l'app n'impose
aucune langue à l'agent ; Chromium est déjà livré en `fr` et `en` (`electronLanguages`).

## Questions à trancher (étape 4)

Chaque question a une proposition, mise en premier.

1. **Texte de la fenêtre du `.dmg`** (une seule image pour tous) : **bilingue** (proposé), anglais
   seul, ou français seul.
   → Fait comme proposé (bilingue, le français d'abord), confirmé par l'utilisateur le 2026-10-19.
2. **Chromium et macOS** (menus contextuels, boîtes de dialogue de fichiers) fixent leur langue au
   démarrage : **proposer « Relancer »** quand la langue choisie diffère de celle de macOS
   (proposé, si l'essai montre que ça suffit), ou laisser ces parties suivre macOS.
   → L'essai montre qu'une relance seule ne suffit pas (voir le journal) : elle suffit si l'app
   pose sa langue « par app » de macOS. Fait ainsi, dans l'app packagée, confirmé par
   l'utilisateur le 2026-10-19.

## Critères d'acceptation

- [x] Réglages › Général › « Langue » : Système (par défaut), Français, English. Le choix change
      toute l'interface sans relancer l'app : fil, barre latérale, réglages, panneaux, menu
      macOS, notifications, dialogues de l'app. Le réglage est trouvé par la recherche des
      réglages.
- [x] « Système » prend la première langue de macOS que l'app connaît, sinon l'anglais (macOS en
      allemand → anglais). `BOBINE_LANG` impose une langue.
- [x] Rien de ce qui vient de l'agent ou lui est envoyé ne change selon la langue : réponses,
      questions, formulaires, erreurs ACP, descriptions et résultats des outils MCP, contexte
      joint au message. Le journal reste en français.
- [x] Dates, heures, nombres, coûts et durées sont au format de la langue (plus de `fr-FR` en
      dur) ; `<html lang>` suit la langue.
- [x] Les pluriels sont justes dans les deux langues (« 1 file / 2 files », « 1 fichier modifié /
      2 fichiers modifiés »).
- [x] Les textes venus du main (erreurs, avis, demandes d'autorisation, libellés des outils de
      l'app, diagnostic, export) sont dans la langue choisie. Dans une conversation enregistrée
      après ce changement, avis et libellés d'outils suivent la langue du moment ; les
      conversations plus anciennes restent lisibles (avis en français).
- [x] Les textes en dur ne reviennent pas : une règle ESLint refuse le texte JSX et les valeurs
      littérales de `title`, `placeholder`, `aria-label` et `alt`. Un test vérifie que `en.json` a
      les mêmes clés et variables que `fr.json`, et les pluriels de sa langue.
- [x] Glossaire et guide de style (`docs/traduction.md`) validés par l'utilisateur ; traduction
      anglaise relue.
- [x] Nouveautés : `CHANGELOG.md` (français) et `CHANGELOG.en.md`. À propos montre celui de la
      langue ; les versions passées sont traduites ; AGENTS.md demande une ligne dans chacun.
- [x] Fenêtre du `.dmg` conforme à la réponse à la question 1.
- [x] Testé :
  - unitaires en français comme avant, plus le test de complétude des ressources et celui du
    choix de la langue ;
  - e2e : toute la suite en français après l'étape 2, captures identiques à celles d'avant ;
    puis `settings` (changer de langue), `base`, `browser`, `permissions` et `failures` en
    anglais, captures `en` regardées en clair et en sombre ;
  - agent factice, en anglais : scénarios `demo` (outil, permission, diff), `navigateur`
    (libellés des outils de l'app, autorisation d'un site), `plantage` (avis du main),
    `questions` ;
  - `pnpm e2e:packaged` ; Chromium et dialogues de fichiers vérifiés à la main (question 2).

## Plan

Quatre étapes : les trois proposées par l'utilisateur, plus le choix de la langue. Chacune se
vérifie seule, avec `./scripts/verify` entre chaque lot. L'anglais n'est proposé dans les réglages
qu'à l'étape 4, une fois traduit : l'interface n'est jamais à moitié en français. Environ 95
fichiers contiennent du texte. Estimation totale : 1,5 à 2,5 semaines, environ une semaine si un
agent fait l'extraction (relecture comprise).

**Nouvelles dépendances** : `i18next` et `react-i18next` (ADR-0014), versions exactes fixées à
l'installation, en `devDependencies` comme React (regroupées dans le build par electron-vite).

### Étape 1 — Mettre en place i18next (rien ne change à l'écran)

- `src/shared/i18n/` :
  - `locales/fr.json` et `locales/en.json` ;
  - `i18next.d.ts` : clés et variables typées à partir de `fr.json` (`CustomTypeOptions`) ;
  - `message.ts` : type `Message = { key, params }` ;
  - `locales.test.ts` : mêmes clés et variables, pluriels de chaque langue
    (`Intl.PluralRules(…).resolvedOptions().pluralCategories`) ;
  - `format.ts` : dates et nombres dans la langue courante.
- `main/i18n.ts` : instance du main, en français, ou dans la langue de `BOBINE_LANG`.
- `renderer/i18n.ts` : `react-i18next`, posé à la racine de la fenêtre principale et de la fenêtre
  rapide (`#quick`).
- `time.ts`, `usage.ts`, `ResumeDialog`, `McpSettings`, `SettingsDialog` : `fr-FR` remplacé par la
  langue courante.
- `e2e/lib.mjs` : `BOBINE_LANG: 'fr'` dans `NEUTRAL_ENV`.
- Un premier composant migré pour éprouver la chaîne (statuts de la barre latérale : clés typées,
  pluriel, test).

### Étape 2 — Sortir les libellés du code vers `fr.json`

- **Interface** : les ~650 textes de `src/renderer/src`, par lots de composants (fil et zone de
  saisie ; barre latérale et titre ; réglages ; panneaux ; dialogues). `settings-search.ts`
  cherche dans les libellés traduits.
- **Shared** :
  - `app-tools.ts` construit des `Message` ; les phrases assemblées par morceaux deviennent des
    phrases entières ;
  - `shortcuts.ts`, `app-commands.ts`, `tool-groups.ts`, `elicitation.ts`, `export.ts`,
    `diagnostics.ts`, `launch.ts`…
- **Main** :
  - erreurs de l'IPC (`ipc.ts`, `agent-host.ts`, `conversations/`…) ;
  - dialogues (`index.ts`, `quit-guard.ts`) et notifications (`main/notifications/`) ;
  - demandes d'autorisation (navigateur, simulateur, Android, `command-approval.ts`) ;
  - `menu.ts`, `diagnostics.ts`.
- **Enregistré en codes** :
  - `notice` du fil et de l'évènement `notice` : `message: Message` (l'ancien `text` reste lu) ;
  - `AppToolLabel` : `message` à la place de `label`.
- Pluriels faits à la main → pluriels d'i18next (`_one`, `_other`).
- Règle ESLint `no-restricted-syntax` à la fin de l'étape, une fois tout extrait.
- **Hors des ressources** : réponses et demandes de l'agent, descriptions et résultats des outils
  MCP, contexte joint au message (`@git-changes`, `@terminal`, contexte d'une branche),
  `main/log.ts`, agent factice.

### Étape 3 — Traduire en anglais, en tenant compte du contexte

- `docs/traduction.md`, à valider par l'utilisateur **avant** de traduire :
  - glossaire : termes de Bobine (fil → *thread*, Réglages → *Settings*, mode plan → *plan
    mode*…), termes de macOS (glossaires d'Apple), vocabulaire des développeurs (traductions de
    VS Code), ce qui reste en anglais (MCP, worktree…) ;
  - guide de style : ton, typographie anglaise (“ ”, pas d'espace avant « : »), longueur ;
  - comment ajouter une langue.
- `en.json` (~7 500 mots) traduit par l'agent, avec le glossaire et le contexte de chaque clé
  (composant, captures e2e de l'étape 2).
- `CHANGELOG.en.md`, versions passées comprises.
- Relecture : test de complétude, puis relecture humaine (l'utilisateur ou un anglophone).

### Étape 4 — Choisir la langue dans les réglages

- `shared/preferences.ts` : `language: 'system' | 'fr' | 'en'`.
- `main/i18n.ts` choisit la langue effective, dans cet ordre : `BOBINE_LANG`, préférence,
  `app.getPreferredSystemLanguages()`, anglais. Il la transmet au renderer avec les préférences
  (IPC existant).
- Au changement : `changeLanguage` dans les deux processus, menu reconstruit, `<html lang>` mis à
  jour.
- Réglages › Général › « Langue » ; À propos montre le `CHANGELOG` de la langue.
- `build/background.svg` (question 1), puis `scripts/make-dmg-background.mjs`.
- Question 2 : essai de relance, et de `--lang` ou `AppleLanguages`.
- `e2e/run.mjs` : option `--lang en`, captures préfixées `en-`.
- Clore : AGENTS.md (pas de texte en dur, les deux CHANGELOG, glossaire), `docs/architecture.md`,
  `CHANGELOG.md` et `CHANGELOG.en.md` (« Prochaine version »), index.

## Journal

- 2026-10-16 — Première version de la fiche et de l'ADR-0014 (dictionnaires maison), rédigée à
  partir de l'analyse du code (mesures ci-dessus).
- 2026-10-16 — Reprise après les décisions de l'utilisateur : i18next, ressources JSON, lignes
  écrites par l'app enregistrées en codes, langue de macOS sinon l'anglais, seule l'interface
  traduite. Plan en quatre étapes (les trois de l'utilisateur, plus le choix de la langue).
- 2026-10-16 — ADR-0014 et plan validés par l'utilisateur ; ADR passé à « accepté ». Prochaine
  étape : l'étape 1 (mettre en place i18next). Les questions 1 et 2 restent ouvertes jusqu'à
  l'étape 4.
- 2026-10-16 — **Étape 1 faite** : i18next en place, rien ne change à l'écran.
  - **Dépendances** : `i18next` 26.4.5 et `react-i18next` 17.0.16, versions exactes, en
    `devDependencies`. Elles n'amènent que deux petits paquets (`html-parse-stringify`,
    `use-sync-external-store`).
  - **Langue jusqu'aux fenêtres** : le main la passe à chaque fenêtre de l'app
    (`additionalArguments`), le preload la relit dans `process.argv` (`languageFromArgv`) et
    l'expose en `window.api.app.language` ; le renderer initialise i18next avec avant le premier
    rendu. Essai réel : `BOBINE_LANG=en` donne « Ready » et `<html lang="en">`, `fr` donne « Prêt ».
  - **Écart : types générés.** TypeScript lit les valeurs d'un JSON comme de simples `string` :
    les clés étaient vérifiées, pas les variables. `scripts/i18n-types.mts` écrit le type exact de
    `fr.json` dans `fr.generated.d.ts`, lancé par `pnpm typecheck` (un test vérifie qu'il est à
    jour). Une variable mal nommée ne compile plus ; une variable oubliée compile encore (limite
    d'i18next), le test de complétude ne la voit pas non plus.
  - **Écart : pluriels du français.** `Intl.PluralRules('fr')` a trois formes : `one`, `many` (1 000
    000) et `other`. Sans `_many`, i18next affiche le nom de la clé ; le test de complétude exige
    donc les trois formes en français, deux en anglais.
  - **Écart : `message.ts`** (type `Message`) remis à l'étape 2, où il sert.
  - **Premier composant migré** : statuts et pastilles d'attente de la barre latérale, compteurs
    d'un groupe d'outils (« 2 échecs », pluriel). `en.json` contient leur traduction, à revoir avec
    le glossaire (étape 3).
  - **`fr-FR` retiré** de `time.ts`, `usage.ts`, `ResumeDialog`, `McpSettings` ;
    `SettingsDialog` formatait une date sans langue (celle de Chromium), désormais celle de
    l'interface. Formats dans `shared/i18n/format.ts` (`currentLocale`, `numberFormat`).
  - **Essais** : `verify` (122 fichiers, 718 tests) ; e2e `base`, `usage`, `settings`, `resume`,
    `mcp`, `quick`, `long-thread` en clair et en sombre ; captures regardées (`37-groupe-deplie`,
    `h0-reprendre-session`) : identiques. Suite e2e complète : à lancer avant le push.
  - **Reste** : étapes 2 à 4 ; la règle ESLint arrive à la fin de l'étape 2.
- 2026-10-16 — **Étape 2 faite** : les textes de l'interface sont sortis du code, rien ne change à
  l'écran.
  - **Volume** : 1 460 entrées dans `fr.json` (≈ 7 000 mots), pluriels compris. Six lots,
    `./scripts/verify` entre chaque : fil et zone de saisie ; barre latérale, menus et dialogues ;
    réglages et leur recherche ; panneaux ; code partagé ; main.
  - **Méthode** : extraction semi-automatique (script hors du dépôt) qui lit chaque texte dans
    l'arbre TypeScript, le range sous sa clé et le remplace par `t()`. Les pluriels, les phrases
    coupées par du JSX (`<Trans>`) et les tables au niveau du module sont faits à la main. Contrôle
    à chaque lot : chaque texte français d'avant se retrouve dans le code ou mot pour mot dans
    `fr.json`.
  - **`en.json`** : pour l'instant une **copie du français** (sauf les clés de l'étape 1) ; il
    est traduit à l'étape 3. Le test de complétude reste ainsi vert.
  - **Enregistré en codes** (`shared/i18n/message.ts`, type `Message`, valeurs imbriquées
    possibles) : avis du fil (fin de tour, erreurs, arrêt de l'agent, avis de `AgentHost` et du
    gestionnaire, échecs d'écriture de l'historique) et libellés des outils de l'app. Les anciens
    `text` et `label` restent lus (`noticeText`, `appToolText`).
  - **Phrases entières** : les libellés d'outils assemblés par morceaux (`app-tools.ts`) ont une
    clé par variante, par exemple les 12 combinaisons de `browser_resize`. Le résumé d'un groupe
    d'outils passe par `Intl.ListFormat` (« a, b et c » en français, sortie identique).
  - **Tables partagées** (raccourcis, commandes « / » de l'app, onglets du panneau, mentions,
    raccourcis de la fenêtre rapide, police système) : accesseurs qui traduisent à la lecture. Les
    fichiers qui les lisent n'ont pas changé.
  - **Composants** : `useTranslation()` partout ; `i18next.t` dans les effets et callbacks où
    ajouter `t` aux dépendances relancerait le flux vidéo du simulateur ou les essais d'agents.
  - **Règle ESLint** (`no-restricted-syntax`, renderer) : texte JSX et valeurs littérales de
    `title`, `placeholder`, `aria-label`, `alt`, `label`, `hint`, `description`. Elle a trouvé 6
    textes oubliés. AGENTS.md le dit déjà (prévu à l'étape 4, avancé puisque la règle est active).
  - **Laissés tels quels, comme prévu (ADR-0014)** : résultats et erreurs d'outils pour l'agent,
    arbre d'accessibilité, contexte `@git-changes` et `@terminal`, contexte d'une branche, erreurs
    de `launch.json` (rendues à l'agent), journal, sonde de Bob, erreurs de programmation de
    `ipc.ts` (« Paramètre invalide… »), identifiants internes.
  - **À trancher par l'utilisateur** : textes envoyés à l'agent **au nom de l'utilisateur**, restés
    en français quelle que soit la langue de l'interface. Ce sont les consignes de `/init` et
    `/review`, les réponses relayées après une autorisation tardive (« J’ai autorisé … : tu peux
    reprendre ») et les remarques sur un plan (« Remarques sur le plan… »).
  - **Créé dans la langue du moment** (donnée, pas code) : titre par défaut « Nouvelle
    conversation », marque « · branche » d'une branche, titre d'outil de repli « Outil », détail de
    sortie d'un agent cité dans l'avis d'arrêt. Les libellés des profils d'agent sont lus au
    démarrage : à revoir à l'étape 4 (changement de langue sans relancer).
  - **Écart : `Message` typé** : clé vérifiée à la création (`ParseKeys`) ; traduit par
    `translate()`, qui contourne la signature typée d'i18next (clé connue seulement à
    l'exécution).
  - **Essais** : `verify` (722 tests). Tests adaptés là où ils lisaient l'ancien `text` d'un avis
    ou `label` d'un outil, et pour l'index des réglages, devenu une fonction. Suite e2e complète
    après les lots 1 à 4 (725 vérifications), puis après les six lots (726, 417 s), en clair et en
    sombre ; captures regardées (accueil, diagnostic, repartir d'un message, groupes d'outils) :
    identiques à celles d'avant.
  - **Instable, sans lien avec la fiche** : `agent-host.test.ts` « commandes « / » annoncées après
    l’ouverture de session » échouait parfois sous charge (course au redémarrage de l'agent
    factice). Corrigé le même jour, voir la fiche 041.
- 2026-10-16 — Étape 3 commencée : glossaire et guide de style rédigés (`docs/traduction.md`), à
  valider par l'utilisateur avant de traduire. Six points à trancher : « conversation » ou
  « chat », casse, nom du mode « Exécution », « Repartir de ce message », « Fenêtre rapide »,
  prénom d'exemple.
- 2026-10-16 — **Étape 3 faite** (traduction), sauf la relecture humaine.
  - **Glossaire validé** par l'utilisateur, avec ses six décisions (`docs/traduction.md`,
    « Points tranchés ») : conversation, casse, Act, Branch from this message, Quick Entry, Alex.
  - **`en.json` traduit** : 1 410 entrées, sept lots, en suivant le glossaire et le guide de style.
    Un outil (hors du dépôt) a vérifié à chaque lot que la clé existe en français, que les
    variables et les balises sont les mêmes, et qu'il n'y a pas d'espace avant la ponctuation.
    58 entrées s'écrivent pareil dans les deux langues (Agent, Plan, Terminal, Version…).
  - **`CHANGELOG.en.md`** : versions 0.2.0 et 0.1.1 traduites. À propos le lira à l'étape 4.
  - **Trouvé en route** : le pourcentage de la jauge (« 1 % ») était resté écrit en dur ; il
    passe par `usage.percent` (« 1% » en anglais).
  - **Essai en anglais** (`BOBINE_LANG=en`, captures `en-*` dans `e2e/captures`) : accueil,
    autorisation, conversation, Réglages › Général, Agents, Serveurs MCP, Diagnostic, À propos.
    Tout ce qui vient de l'app est en anglais. Ce qui vient de l'agent reste dans sa langue, comme
    prévu : nom et modes de l'agent factice, options d'autorisation, titres d'outils, texte.
  - **À vérifier** : le chemin anglais de macOS pour l'enregistrement de l'écran (« System
    Settings › Privacy & Security › Screen & System Audio Recording ») sur la version visée.
  - **Reste** : relecture par l'utilisateur ou un anglophone ; étape 4.
- 2026-10-16 — **Étape 4 faite** : la langue se choisit dans Réglages › Général › « Langue ».
  - **Réglage** : `language: 'system' | 'fr' | 'en'` dans les préférences (`settings.json`),
    « Système » par défaut. Liste : Système, puis chaque langue sous son propre nom
    (`LANGUAGE_NAMES` : Français, English), pour la retrouver dans une interface qu'on ne lit pas ;
    la recherche des réglages la trouve en français comme en anglais (« langue », « language »,
    « english », « français »).
  - **Langue effective** (`main/i18n.ts`, `resolveLanguage`) : `BOBINE_LANG`, puis le réglage,
    puis la première langue préférée de macOS que l'app connaît (`app.getPreferredSystemLanguages()`,
    lisible avant `ready`), sinon l'anglais. Lue avant toute fenêtre, dans `settings.json`
    (`savedLanguage`, sans mettre de côté un fichier abîmé : le gestionnaire s'en charge).
  - **Changement à chaud** : i18next du main change de langue, le menu macOS est reconstruit, et
    l'évènement `app:language` passe la langue à chaque fenêtre (principale, fenêtre rapide) ; le
    renderer change i18next et `<html lang>`. Rien n'est rechargé : brouillon, fil ouvert et
    Réglages restent. Les composants mémoïsés (`Item`, `MessageItem`, `ToolGroup`) appellent déjà
    `useTranslation()`, qui les refait. Libellés des profils (agent factice, clés d'API, étapes de
    connexion, marche à suivre) : accesseurs, lus dans la langue du moment.
  - **À propos** : `CHANGELOG.en.md` en anglais, `CHANGELOG.md` sinon ; un test vérifie que les
    deux ont les mêmes versions. « Prochaine version » / « Next version » ajoutées.
  - **Question 2, essai** (Electron de développement, Mac en français) : `--lang=en` ne change que
    Chromium (`app.getLocale()`), pas macOS ; `-AppleLanguages (en)` change les deux, et la liste
    de `getPreferredSystemLanguages()`. Une relance seule ne change donc rien : macOS choisit la
    langue de l'app dans ses langues préférées. Ce qui suffit, c'est la langue « par app » de macOS
    (`AppleLanguages` du domaine de l'app, celle de Réglages Système › Langue et région ›
    Applications), lue au lancement suivant ; `getPreferredSystemLanguages()` la suit aussitôt,
    posée ou retirée (essai sur le domaine d'Electron, remis en l'état).
  - **Question 2, fait** (`main/native-language.ts`) : une langue choisie est posée en langue
    « par app » de macOS, « Système » la retire (seulement si l'app l'avait posée : au lancement,
    une langue choisie dans Réglages Système reste et « Système » la suit). Seulement dans l'app
    packagée sans dossier de données imposé : en développement, le domaine est celui d'Electron,
    partagé par toutes les apps ; les essais ne le touchent jamais. Quand les fenêtres de macOS ne
    sont pas dans la langue affichée (`AppInfo.nativeLanguage`, d'après `app.getLocale()` au
    lancement), une note sous le réglage le dit, avec « Relancer » (`app:relaunch` : quitte, avec
    la confirmation habituelle si un agent travaille, puis relance).
  - **Question 1, fait** : fond du `.dmg` bilingue, le français d'abord puis l'anglais en plus
    discret (`build/background.svg`, images refaites par `scripts/make-dmg-background.mjs`).
  - **Essais e2e** : `pnpm e2e --lang en` (captures `en-…`) ; `L('clé')` et `Lpart('clé')`
    (`e2e/lib.mjs`) comparent les textes de l'app dans la langue des essais. Nouvelle suite
    `language` : français, puis English depuis les Réglages (Réglages restés ouverts, menu
    reconstruit, chaque fenêtre suit, accueil, `settings.json`), relance en anglais, retour au
    français. `base`, `browser`, `permissions`, `failures`, `settings` et `questions` passent en
    français et en anglais, en clair et en sombre ; captures anglaises regardées.
  - **Écarts** : le changement de langue est essayé par la suite `language`, pas `settings` ;
    `questions` remplace le scénario `questions` de l'agent factice prévu dans les critères.
    « Same as the current conversation » était coupé dans sa liste : « Same as current
    conversation ».
  - **Normal, pas un oubli** : le nom « Agent factice » dans la barre latérale et la zone de
    saisie est celui que l'agent factice annonce (`agentInfo.title`) : un texte de l'agent, qui
    reste en français. Le libellé du profil (« Mock agent ») apparaît dans Réglages › Agents.
  - **Reste** : relecture de l'anglais par l'utilisateur ou un anglophone ; `pnpm package` puis
    `pnpm e2e:packaged`, et à la main dans l'app packagée : choisir English, « Relancer », vérifier
    les dialogues Ouvrir/Enregistrer, les entrées que macOS ajoute au menu Édition et la fenêtre
    À propos ; confirmation des réponses aux questions 1 et 2 ; suite e2e complète avant le push.
- 2026-10-19 — **Clos.** `pnpm package` puis `pnpm e2e:packaged` passés sur `main` (fiches 081 et
  082 comprises). Relecture mécanique de `en.json` selon le guide de style (1 450 textes : pas de
  « please », d'exclamation, de reste de français, d'apostrophe ou de guillemet droit hors code,
  d'espace avant la ponctuation) : rien à corriger. Vérifié à la main par l'utilisateur dans l'app
  packagée : English, « Relaunch », menu contextuel, menu Edit (entrées de macOS), About,
  dialogues Ouvrir / Enregistrer, fenêtre du `.dmg`, retour à « Système » ; anglais relu et
  accepté ; réponses aux questions 1 et 2 confirmées. Publié avec la version 0.3.0.
