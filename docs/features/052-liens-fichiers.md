# 052 — Liens vers des fichiers dans la conversation

- **Statut** : fait
- **Dépend de** : 021, 029

## Pourquoi

Retour de l'utilisateur (2026-10-14) : les réponses de l'agent contiennent des liens vers des
fichiers (`plan.md`, `src/app.ts:12`…) et un clic ne fait rien : l'app ne laisse passer que les
liens `https://`. Décision de l'utilisateur : les `.md` s'affichent en **aperçu, en lecture seule,
dans le panneau** ; les autres fichiers s'ouvrent dans l'app par défaut du Mac. Petite exception
assumée à « Bob Desktop n'est pas un IDE » : pas d'édition, pas d'explorateur, seulement l'aperçu
des documents que la conversation cite.

## Critères d'acceptation

- [x] Liens relatifs (au dossier de la conversation), absolus, `file://`, avec `:12` ou `#L12`
      reconnus ; liens web inchangés.
- [x] `.md` du dossier : aperçu rendu dans un onglet « Aperçu » du panneau (titre, chemin, relire,
      ouvrir dans l'app par défaut, montrer dans le Finder, fermer) ; ses propres liens relatifs
      marchent depuis son dossier ; relu quand l'agent a travaillé.
- [x] Autre fichier du dossier : ouvert dans l'app par défaut. Dossier : montré dans le Finder.
- [x] Sécurité : un lien venu de l'agent n'exécute jamais rien. Fichier exécutable (bit `x`, `.app`,
      `.command`, scripts…) ou hors du dossier de la conversation : montré dans le Finder, et le fil
      dit pourquoi. Fichier absent : dit clairement.
- [x] ⌥-clic sur un lien de fichier : le montrer dans le Finder.
- [x] Essais sans ouvrir de vraies apps (journal des ouvertures en essai) ; e2e avec captures
      claires et sombres regardées.

## Plan

1. `shared/file-links.ts` : lecture d'un lien (`parseFileLink`), types de l'issue.
2. `main/files/file-links.ts` : décision (dans le dossier ou non, existe, dossier, Markdown,
   exécutable), lecture du Markdown (taille bornée) ; IPC `files:openLink`, `files:readMarkdown` ;
   ouvertures par `shell` remplaçables en essai (`BOB_OPEN_LOG`).
3. Renderer : contexte des liens (`FileLinks`), `Markdown` (liens `file:` gardés), onglet
   `document` du panneau (`DocumentTab`), état dans `App`, avis dans le fil.
4. Agent factice : scénario `liens-fichiers` ; e2e `links`.
5. Docs : périmètre de `docs/features/README.md`, `architecture.md`.

Aucune nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée ; choix de l'utilisateur : aperçu `.md` dans le panneau, le reste dans
  l'app par défaut.
- 2026-10-14 — **Fait.**
  - Cause : les liens du fil s'ouvraient comme des liens web (`target="_blank"`), et seule
    `https://` passe `setWindowOpenHandler` ; un lien relatif était ignoré en silence.
  - `shared/file-links.ts` : `parseFileLink` (relatif, absolu, `file://`, `%20`, `:12`, `#L12` ;
    `README.md:3` n'est pas un schéma ; `tel:`, `javascript:`, web : pas des fichiers).
  - `main/files/file-links.ts` : chemins réels (un lien symbolique du dossier vers l'extérieur est
    traité comme hors du dossier) ; dossier → Finder ; hors du dossier → Finder ; `.md` → aperçu
    (1 Mo au plus) ; bit `x` ou type qui s'exécute (`.app`, `.command`, scripts, `.pkg`,
    `.webloc`…) → Finder ; sinon `shell.openPath`. Base des liens d'un document : son dossier,
    ignorée si elle sort du dossier de la conversation.
  - `BOB_OPEN_LOG` (essais) : ouvertures et Finder notés dans un fichier, aussi pour l'onglet
    « Modifications ».
  - Interface : `MarkdownLink` (pointillé, infobulle avec la ligne, ⌥-clic), `urlTransform` qui
    garde `file:` ; contexte fourni par la conversation affichée, celle d'à côté et l'aperçu (liens
    relatifs à son dossier) ; valeurs du contexte stables (elles ne changent pas pendant le
    streaming, les éléments mémoïsés de la fiche 047 le restent).
    Onglet « Aperçu » présent seulement avec un document ; relu après chaque outil terminé ;
    oublié au redémarrage. Avis dans le fil : exécutable ou hors du dossier montré dans le Finder,
    fichier introuvable.
  - Tests : `file-links.test.ts` (partagé et main, vrais fichiers, lien symbolique, bit `x`),
    `Markdown.test.tsx`, `ipc.test.ts` ; e2e `links` (scénario `liens-fichiers`) : aperçu, lien
    dans l'aperçu, code, dossier, exécutable (jamais ouvert, avis), ⌥-clic, fermeture. Capture 41
    regardée en clair et en sombre.
  - Limites : la ligne citée n'est pas transmise à l'app par défaut (macOS ne le permet pas) ; les
    chemins écrits en `code` sans lien ne sont pas cliquables.
  - **Trouvé en route** par la passe complète (commit à part) : `browser` échouait à chaque fois,
    fiche 052 retirée comprise — fenêtre d'essai derrière l'app de l'utilisateur, la page du
    navigateur intégré ne prenait pas le focus et la saisie de l'agent se perdait. Correctif dans
    `cdp-tab.ts` (émulation du focus, journal de la fiche 007). Et `mcp` / `user-commands`
    instables : le harnais cliquait pendant l'animation d'ouverture des réglages ; `ui.click`
    attend désormais que la cible soit immobile.
  - Passe e2e complète verte ensuite (338 s).
