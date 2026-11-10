# ADR-0014 — Langues de l'interface : i18next, ressources JSON, textes enregistrés en codes

- **Statut** : accepté
- **Date** : 2026-10-16

## Contexte

L'interface est entièrement écrite en français, directement dans le code : environ 1 170 textes
(≈ 650 dans le renderer, 500 dans le main, 200 dans `src/shared/`). Les dates et les nombres sont
formatés en `fr-FR`, et le menu macOS ainsi que l'image du `.dmg` sont en français. On veut
proposer l'anglais (fiche 074), puis pouvoir ajouter d'autres langues.

Le main fabrique lui-même près de la moitié de ces textes : erreurs renvoyées par l'IPC, avis du
fil, libellés des outils de l'app, demandes d'autorisation, diagnostic, menu, dialogues,
notifications. Une partie est enregistrée en toutes lettres avec les conversations, par exemple
l'avis « L'agent ne répondait plus à « Stop » : il a été arrêté. » ou le libellé « Capture la
page » d'un outil du navigateur intégré.

Contraintes : TypeScript strict ; deux processus qui partagent `src/shared/` ; tests qui
supposent le français. La langue de l'interface ne doit avoir **aucun effet sur les agents** : on
peut avoir l'interface en anglais et parler à l'agent en français.

Décisions de l'utilisateur (2026-10-16) : i18next ; ressources en JSON ; une conversation déjà
enregistrée s'affiche dans la langue choisie ; langue choisie dans les réglages, comme dans Claude
Desktop, et au départ celle de macOS, sinon l'anglais ; seuls les textes de l'interface sont
traduits.

## Décision

1. **i18next** dans les deux processus : `i18next` dans le main, `react-i18next` dans le renderer.
2. **Ressources en JSON**, partagées : `src/shared/i18n/locales/fr.json` (référence) et `en.json`.
   - Une clé est nommée d'après la zone de l'interface (`sidebar.status.ready`), en anglais
     (convention du code).
   - Pluriels selon i18next : suffixes `_one`, `_other`, etc., tirés d'`Intl.PluralRules`.
   - Les clés et leurs variables sont typées à partir de `fr.json` (`CustomTypeOptions`).
   - Un test vérifie que chaque langue a les mêmes clés, les mêmes variables et les formes de
     pluriel de sa langue.
3. **Ce qui est enregistré part en code**, traduit au moment de l'affichage.
   - Les avis du fil et les libellés des outils de l'app sont enregistrés sous la forme
     `Message = { key, params }`. Une conversation s'affiche donc toujours dans la langue choisie,
     même après un changement.
   - Le main traduit lui-même, dans la langue courante, ce qui ne dure pas : erreurs renvoyées par
     l'IPC (Electron ne transmet que le texte du message), dialogues natifs, notifications, menu.
4. **Choix de la langue** : Réglages › Général › « Langue » — Système (par défaut), Français,
   English — enregistré dans `settings.json`.
   - « Système » prend la première langue de macOS que l'app connaît
     (`app.getPreferredSystemLanguages()`), sinon l'anglais.
   - `BOBINE_LANG` impose une langue (essais).
   - Le changement s'applique sans relancer l'app.
5. **Seule l'interface est traduite.** Restent hors des ressources :
   - tout ce qui vient de l'agent : réponses, questions, formulaires, erreurs ACP ;
   - tout ce que l'app lui envoie : descriptions et résultats des outils MCP, contexte joint au
     message (`@git-changes`, `@terminal`, contexte d'une branche) ;
   - le journal (`main/log.ts`), la documentation du dépôt, l'agent factice.

## Alternatives écartées

- **Dictionnaires typés maison** — aucune dépendance, et le compilateur vérifie tout. Mais il
  faudrait écrire nous-mêmes les pluriels de chaque langue, l'insertion des variables et le passage
  par les outils de traduction. i18next les fournit et les agents de code le connaissent bien.
- **FormatJS (react-intl), messages ICU** — standard lui aussi, mais la syntaxe ICU est plus lourde
  à écrire, et les variables ne sont pas typées sans outil d'extraction.
- **Lingui** — on écrit le texte français dans le code et des macros l'extraient. Il faut pour ça
  une extension de compilation dans electron-vite.
- **Ressources en TypeScript** — le compilateur vérifierait directement qu'une langue est
  complète, mais les plateformes de traduction (Crowdin, Lokalise, Weblate, Locize) lisent le JSON
  d'i18next, pas des fichiers TypeScript. Le test de complétude remplace cette vérification.
- **Le main traduit tout, y compris ce qui est enregistré** — plus simple, mais une conversation
  garderait la langue du jour où elle a été écrite (écarté par l'utilisateur).
- **Tout en codes, erreurs de l'IPC comprises** — il faudrait cacher un code dans le texte de
  l'erreur ou changer la forme de retour de tous les canaux, pour des messages qui ne durent pas.
- **Français au départ, ou repli sur le français** — écarté par l'utilisateur : on suit macOS,
  sinon l'anglais.

## Conséquences

- **Deux dépendances** : `i18next` et `react-i18next`. Elles sont regroupées dans le build par
  electron-vite, comme React (`devDependencies`).
- **Plus de texte en dur dans l'interface.**
  - Une règle ESLint (`no-restricted-syntax`, sans dépendance) refuse le texte JSX et les valeurs
    littérales de `title`, `placeholder`, `aria-label` et `alt`.
  - AGENTS.md le rappelle : chaque fiche ajoute ses textes en français **et** en anglais, en
    suivant le glossaire (`docs/traduction.md`).
- **Historique en deux formes.** Les conversations enregistrées avant ce changement gardent leurs
  avis en français (texte) ; les nouvelles enregistrent des codes. L'app sait lire les deux.
- **Essais en français.** i18next démarre en français tant que rien n'est choisi, et les e2e
  imposent `BOBINE_LANG=fr`. Les essais ne dépendent donc pas de la langue de la machine. Quelques
  suites tournent aussi en anglais.
- **Chromium et macOS.** Les menus contextuels de Chromium et les boîtes de dialogue de fichiers
  de macOS suivent les langues livrées (`electronLanguages: [fr, en]`) et celle de macOS, pas
  forcément le réglage de l'app : à vérifier (fiche 074).
- **Ajouter une langue.** Il faut un fichier JSON, une entrée dans `electronLanguages`, le
  glossaire et une relecture par quelqu'un dont c'est la langue. i18next gère déjà les pluriels de
  toutes les langues.
