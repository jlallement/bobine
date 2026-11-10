# 171 — Comptes rendus de filles repliés

- **Statut** : fait
- **Dépend de** : 097, 117, 160, 161
- **Agents** : les deux — rendu du fil, rien de propre à un agent

## Pourquoi

Audit UX du 2026-11-05, § 1.4 : dans le fil d'une mère, chaque fille apparaît deux fois (sa ligne de
la carte « Sous-tâches », puis un bloc « a fini son tour » qui répète branche, fichiers, coût et
échanges). Ce bloc, à filet gauche épais, pèse plus lourd que la réponse de l'agent ; et un
**bandeau vide** apparaît entre l'extrait et la ligne de métadonnées : le fondu de l'extrait
efface le haut d'un bloc (code, citation) coupé par la hauteur bornée, et ne laisse voir que son fond.

## Critères d'acceptation

- [x] Compte rendu **replié par défaut** sur deux lignes : titre (« … a fini son tour », qui ouvre
      la fille) avec le coût à droite, puis la première phrase du compte rendu.
- [x] Dépliable à la souris et au clavier (un vrai bouton, `aria-expanded`, `aria-controls`) ; déplié :
      l'extrait en Markdown, puis branche, fichiers modifiés, nombre d'échanges.
- [x] Le coût reste visible replié (fiche 117), en `--muted`, au poids d'une métadonnée ; masqué en
      mode présentation comme ailleurs (fiche 159).
- [x] « Partira à l'agent… » reste visible replié : c'est un état, pas une métadonnée technique.
- [x] Filet gauche de 2 px (au lieu de 3).
- [x] Fondu de l'extrait **seulement quand il est coupé** ; un extrait court n'a ni masque ni bandeau
      (test unitaire).
- [x] Libellé court pour « aucun fichier modifié » : « rien modifié » / « no changes » (glossaire :
      *modification* → *change*), sur la carte et le compte rendu.
- [x] Testé contre l'agent factice : suites `filles`, `filles-tech-lead`, `inbox`, `subagents`, en
      clair et sombre.

## Plan

- `src/shared/children.ts` : `recapLead(excerpt)` — première phrase en texte brut (Markdown retiré,
  bornée), testée.
- `src/renderer/src/components/thread/Subtasks.tsx` : `ChildReportItem` replié/déplié ; coût seul sur
  la ligne de titre (`child-report-usage`), échanges au dépli (`child-report-turns`) ;
  `ReportExcerpt` mesure le débordement (`scrollHeight > clientHeight`, `ResizeObserver`) et ne
  pose le fondu (`data-clipped`) que s'il coupe.
- `styles.css` : filet 2 px, ligne repliée (une ligne, points de suspension), bouton de dépli,
  masque conditionné à `[data-clipped]`. Rayons existants seulement (fiche 170 les remplace).
- `fr.json` / `en.json` : `children.report.noFiles`, `children.report.expand` / `collapse`.
- Tests : `Subtasks.test.tsx`, `Transcript.test.tsx`, `children.test.ts` ; e2e `filles`,
  `filles-tech-lead` (déplier avant de lire branche et extrait).
- Pas de nouvelle dépendance.

## Journal

- 2026-11-05 — fiche créée (audit UX § 1.4). Écart à l'audit § 1.3 : le coût n'est pas retiré
  (fiche 117), il garde le poids d'une métadonnée.
- 2026-11-05 — fait. `recapLead` (`shared/children.ts`) ; `ChildReportItem` replié par défaut
  (titre qui ouvre la fille, coût `--muted` à droite, première phrase dans un bouton de dépli
  `aria-expanded`/`aria-controls`) ; déplié, le bouton dit « Masquer le détail » (l'extrait commence
  par la phrase : pas de répétition), puis extrait, branche, fichiers, échanges. « Partira à
  l'agent… » reste visible replié (une troisième ligne, le temps que le compte rendu parte).
  Filet 2 px (il faisait 3, pas 4 comme le disait l'audit). Fondu : le masque était posé à tout
  extrait ; il ne l'est plus que si l'extrait déborde (`data-clipped`) — test unitaire en simulant
  les hauteurs (jsdom ne mesure pas). « rien modifié » / « no changes », carte et compte rendu ; le
  texte envoyé à l'agent (`children-tools.ts`, non traduit) ne change pas.
  Écarts : l'audit proposait une infobulle pour les métadonnées, on les met au dépli (accessible au
  clavier) ; le coût reste sur la ligne de titre (fiche 117). L'extrait déplié reste borné à
  7,2 em (fiche 160) : un extrait long garde son fondu, légitime puisqu'il est coupé.
  Essais : unités (`Subtasks`, `Transcript`, `children`), `./scripts/verify`, e2e `filles`,
  `filles-tech-lead`, `inbox`, `subagents` en clair et sombre (8/8) ; captures regardées
  (`inbox-1-etats-sur-place`, `filles-2-sous-taches`, `filles-tech-lead-5-bavarde`).
