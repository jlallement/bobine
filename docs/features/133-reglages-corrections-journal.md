# 133 — Réglages : corrections, et le journal en tête du Diagnostic

- **Statut** : fait (reste l'essai à la vraie souris, par la session de coordination)
- **Dépend de** : 027 (réglages), 043 (relire le PATH), 051 (recherche dans les réglages), 061
  (Diagnostic), 080 (journal réglable), 116 (fenêtre « À propos »)
- **Agents** : les deux. Rien ne dépend de l'agent (ADR-0011).
- **Reprend** : lots 135 (« corrections sans changer la structure ») et 156 (« le journal en tête
  du Diagnostic ») de l'étude du 23 octobre (`docs/feuille-de-route-2026-10-23.md`, itération 3).
  La refonte complète des réglages (groupes, cartes, pages d'agent) est la fiche 136 : ce lot-ci ne
  change pas la structure des onglets.

## Pourquoi

Après usage réel, les réglages disent deux fois la même chose (« Relire le PATH » dans Agents et
dans Diagnostic, la version dans À propos, dans la fenêtre « À propos » et dans Diagnostic), leurs
aides sont longues, deux textes de notifications se contredisent (le compteur du Dock « reste
actif » alors que son interrupteur est grisé), une liste est coupée, et les journaux, qu'on a
besoin d'ouvrir justement quand quelque chose ne va pas, sont difficiles à trouver : deux boutons au
milieu du Diagnostic, sans dire ce que contient chaque fichier.

## Maquette validée

Planche « Maquettes de Bobine », section « Journal et échanges ACP », capture `journal-diagnostic`
(maquette privée, non publiée), validée par Jérôme le 23/10. On n'en reprend
pas la colonne de gauche à trois groupes : elle appartient à la fiche 136.

## Critères d'acceptation

- [x] « Relire le PATH » n'est plus dans Réglages › Agents et dossiers ; l'action reste dans
      Diagnostic (`reload-shell-env`).
- [x] Réglages › À propos ne montre plus ni la version, ni Electron, ni le système (ils restent dans
      la fenêtre « À propos » et dans Diagnostic).
- [x] Notifications : l'aide ne parle plus du badge du Dock (il a son réglage), et la note
      « bloquées » dit vrai (le rebond et le compteur marchent encore quand macOS bloque) — en une
      phrase chacun ; rebond et compteur disent qu'ils sont coupés avec les notifications.
- [x] Aides : une phrase de 90 caractères au plus, du point de vue de l'utilisateur, sans variable
      d'environnement, sans « environ 300 Mo » ; clés i18n inchangées. Un test borne la longueur de
      toutes les aides de `settings.*` (français et anglais).
- [x] « Comme la conversation en cours » tient dans la liste de la nouvelle conversation, en
      français comme en anglais : devenu « Comme maintenant » / « Same as now ».
- [x] Diagnostic : juste après le résumé (Relancer, Copier, Signaler), une carte « Journal » : une
      ligne par fichier (`main.log`, `agents.log` : police à chasse fixe, taille, une phrase sur son
      contenu, « Ouvrir », icône « Afficher dans le Finder »), puis le niveau du journal.
- [x] Le chemin du dossier des journaux n'est plus répété dans la section « Bobine ».
- [x] « Afficher dans le Finder » : canal IPC `log:reveal` (émetteur vérifié comme tous les canaux,
      paramètre validé), sans effet si le fichier n'existe pas.
- [x] La recherche dans les réglages trouve « journal » et « log » ; le test « rien d'affiché ne
      manque à l'index » reste vert.
- [x] e2e : suites `settings`, `diagnostic`, `notifications`, `about`, en clair et en sombre, et
      `settings` en anglais (voir le journal).
- [ ] Essai à la vraie souris (fait à la fin des vagues, par la session de coordination) : voir
      « À vérifier à la souris » ci-dessous.

## Plan

Fichiers touchés :

- `src/renderer/src/components/settings/AgentsSettings.tsx` : retrait de `ReloadShellPath` et de la
  prop `onReloadShellEnv` (le Diagnostic la garde) ; `SettingsDialog.tsx` ne la passe plus aux Agents.
- `AboutSettings.tsx` : retrait de l'en-tête et du bloc version / Electron / système ; reste la
  description et les nouveautés. Styles `.settings-about*` retirés s'ils ne servent plus.
- `LogSettings.tsx` : devient la carte « Journal » (deux lignes de fichier, puis niveau) ;
  `DiagnosticsSettings.tsx` la place juste après le résumé (avant la phrase de confidentialité).
- `src/shared/ipc.ts`, `src/preload/api.ts`, `src/main/ipc.ts`, `src/main/index.ts` : `log:reveal`
  (`shell.showItemInFolder`).
- `src/main/diagnostics.ts` (+ test, `index.ts`) : plus de ligne « Journal » avec le chemin dans le
  groupe « Bobine ».
- `fr.json`, `en.json` (+ `fr.generated.d.ts` par `pnpm i18n-types` ou le script de la fiche 074) :
  seules les valeurs des aides changent (clés conservées) ; clés nouvelles de la carte Journal ;
  clés mortes retirées (`settings.agents.shellPath.*`, `settings.about.{electron,system,version}`).
- `settings-search.ts` : « journal » et « log » mènent à la carte ; « version » mène au Diagnostic.
- `styles.css` : uniquement les règles de la carte Journal (fiche 134 : couleurs).
- e2e : `settings.mjs` (plus de « Relire le PATH » dans Agents, plus d'en-tête dans À propos),
  `diagnostic.mjs` (carte Journal, icône du Finder).
- Aucune nouvelle dépendance.

## À vérifier à la souris

- Diagnostic : « Ouvrir » ouvre bien `main.log` dans Console ; l'icône du dossier le montre dans le
  Finder (dossier `~/Library/Logs/Bobine`, fichier sélectionné) ; `agents.log` est grisé tant que le
  niveau est Normal et que rien n'a été écrit, puis s'ouvre en Détaillé.
- Changer le niveau (Normal, Détaillé, Trace) : l'aide sous le sélecteur change tout de suite ;
  lancé avec `BOBINE_LOG`, le sélecteur est grisé et le dit.
- Réglages › Agents : la liste « Comme maintenant » n'est pas coupée ; rien ne parle plus du PATH
  (ni bouton ni phrase) ; avec un agent absent, la phrase « Non installé… » finit par le lien
  « relire le PATH dans Diagnostic », qui ouvre le Diagnostic.
- Réglages › Général : lire les aides des notifications, du rebond et du compteur, coupés puis
  rallumés ; avec une app non signée, la note « macOS bloque les notifications… ».
- Recherche dans les réglages : « journal », « log » et « finder » mènent à la carte Journal, qui se
  met en avant ; « version » mène au Diagnostic.

## Journal

- 2026-10-24 — Fait. Écarts au plan :
  - Les textes (aides, notes de notifications) sont écrits au plus près du comportement du code :
    le rebond et le compteur du Dock ne dépendent pas de l'autorisation de macOS, seulement de
    l'interrupteur « Notifications » (d'où « Coupé avec les notifications » et la note « bloquées »
    qui dit que les deux marchent encore).
  - À propos : tout le bloc d'en-tête (icône, nom, version) a disparu avec Electron et le système,
    il ne reste que la description et les nouveautés.
  - « Relire le PATH » : un lien « relire le PATH dans Diagnostic » est ajouté à la phrase « Non
    installé : … » de Réglages › Agents. Les autres textes qui renvoyaient à Réglages › Agents ›
    Relire le PATH (aucun agent trouvé, git introuvable, `docs/README.md`, `docs/installation.md`)
    renvoient à Diagnostic. Clés mortes retirées (`settings.agents.shellPath.*`,
    `settings.about.{electron,system,version}`, `diagnostics.check.log`,
    `diagnostics.log.{files,filesHint}`, `settingsSearch.shellPath`).
  - Les aides longues des autres sections (Réseau, Fournisseurs, Terminal, Raccourcis…) sont
    raccourcies aussi, pour que le test de longueur porte sur toutes les aides de `settings.*` ;
    les variables d'environnement (`HTTPS_PROXY`…) n'y sont plus (restent dans les mots-clés de
    recherche).
  - La phrase de confidentialité du Diagnostic passe sous les groupes, pour que la carte Journal
    suive directement le résumé. Le niveau « Normal » dit seulement « Seul main.log est écrit »
    (le contenu de `main.log` est dit sur sa ligne, sans le répéter).
  - Le canal `log:reveal` suit `log:open` : l'émetteur est vérifié par le filtre commun de tous les
    canaux (`trusted`), le paramètre est validé (`main` ou `agents`), rien ne se passe si le fichier
    n'existe pas (`withLogFile`, `main/log.ts`).
  - `styles.css` : seules les règles de la carte Journal sont touchées (`.log-card`, `.log-file-*`,
    à la place de `.log-files`). Les règles `.settings-about*` ne servent plus ; leur retrait est
    laissé à la fiche 134 / 136 pour ne pas toucher au fichier.
- e2e jouées (build final) : `pnpm e2e settings diagnostic notifications about` (8 tâches, clair et
  sombre) et `pnpm e2e --lang en settings`, vertes ; captures regardées (`k0-journal-*`,
  `81-reglages-rebond-grise-*`, `84-agents-*`, `85-a-propos-*`, `en-84-agents-*`). Suite complète
  non jouée (consigne du lot). `./scripts/verify` vert.
  - Attention : la suite `about` s'est bloquée trois fois quand d'autres sessions jouaient leurs e2e
    en même temps (ports partagés) ; seule, elle passe (≈ 6 s). Pas lié au lot.
