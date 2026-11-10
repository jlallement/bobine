# 170 — Une seule règle pour l'action principale, Envoyer neutre, jetons de rayon

- **Statut** : fait (reste l'essai à la vraie souris : survol d'Arrêter)
- **Dépend de** : 134 (jetons de thème, contrastes), 136 (Apparence), 159 (jetons de densité),
  168 (Fjord) ; respecte 098 (mode Plan visible) et 113 (allègement)
- **Agents** : les deux. Rien ne dépend de l'agent : styles et jetons du renderer.

## Pourquoi

L'audit UX du 2026-11-05 (§ 1.1, 1.2, 3.1) relève trois incohérences visibles tous les jours :

- l'action principale prend tour à tour l'accent (Envoyer, fusion des filles), le texte plein
  (Autoriser : bouton noir en clair, blanc en sombre) ou une couleur inversée (Arrêter) ; en sombre,
  le carré blanc d'arrêt est l'élément le plus lumineux de l'écran pendant tout un tour, et il
  vire à l'orange au survol (il hérite du survol d'Envoyer) ;
- Envoyer désactivé est l'accent à 40 % : il se lit comme un bouton actif (brun en sombre, rose
  délavé en clair) ;
- au moins six rayons différents à l'écran (2 à 20 px, 24 valeurs dans le CSS), des cartes
  imbriquées dont le coin intérieur « flotte ».

## Critères d'acceptation

- [x] Règle écrite dans `docs/architecture.md` (section « Style de l'interface ») : **accent plein**
      = action principale, **contour** = action secondaire, **texte seul** = refus / annulation,
      **rouge plein** = confirmation destructive ; au plus une action principale par groupe.
- [x] `.btn.primary` prend l'accent (`--accent` / `--on-accent`, survol `--accent-hover`) dans les
      six palettes et les six accents ; la fusion des filles n'a plus de classe à part (`merge-go`).
- [x] Les boutons d'annulation encore en contour passent en texte seul (inventaire ci-dessous).
- [x] Arrêter pendant un tour : carré `--surface-3`, icône `--text`, survol `--border` (neutre),
      jamais l'accent.
- [x] Envoyer sans rien à envoyer : `--surface-3`, flèche `--muted` ; l'accent au premier
      caractère (zone de saisie et saisie rapide).
- [x] Jetons `--radius-xs/sm/md/lg/pill` dans `src/shared/themes.ts` (`RADIUS_TOKENS`), posés sur
      `:root` par `pnpm themes-css` ; plus aucun `border-radius` en dur dans les CSS du renderer
      (hors fichier généré) ; `--radius` et `--radius-lg` d'avant retirés.
- [x] Garde-fou : un test refuse tout `border-radius` (et ses formes longues) dont la valeur n'est
      pas un jeton, `0`, `inherit` ou un `calc()` tiré d'un jeton.
- [x] Contrastes : `--text` sur `--surface-3` et sur `--border` (≥ 4,5:1), `--muted` sur
      `--surface-3` (≥ 3:1) ajoutés au test des palettes ; vert.
- [x] `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` vert, clair et sombre ; captures
      avant/après regardées (permission, tour en cours en sombre, accueil, plan, Fjord).
- [x] Testé contre l'agent factice (scénarios `permission`, `lent`, `plan` des suites e2e
      `permissions`, `composer`, `plan`, `base`).

## Plan

### Inventaire des boutons d'action (avant)

Le composant de base est `.btn` (contour `--border-strong`, fond `--surface`) avec trois variantes :
`primary` (fond `--text` : noir en clair, blanc en sombre), `ghost` (texte seul), `danger` (rouge
plein). Le code suit déjà presque partout la structure « principale / secondaire / refus » ; c'est la
**couleur** de la principale qui n'est pas la bonne, et quelques annulations sont en contour.

| Lieu | Principale (accent plein) | Secondaire (contour) | Refus / annulation (texte seul) |
|---|---|---|---|
| Carte de permission (`ToolCall.tsx`) | Autoriser (`allow_once`) | Toujours autoriser | Refuser (`reject_*`) |
| Approbation du plan (`PlanApproval.tsx`) | — liste de choix au clavier (`.choice`), pas des boutons : inchangée (fiche 098) | | |
| Document du plan (`PlanDocument.tsx`) | Exécuter / Valider | Envoyer les remarques | Annuler, Diff |
| Questions, élicitation (`QuestionCard`, `ElicitationCard`) | Envoyer / Valider | | Passer / Refuser |
| Blocages de l'agent (`BlockerPanel.tsx`) | Réessayer, Faire confiance, Choisir le dossier, Se connecter | Ouvrir le terminal, étapes | Autre méthode |
| Plafond de coût (`CostCapCard`) | Continuer | | Arrêter là |
| Propositions de filles (`ChildProposals`) | Lancer | Ici | Options, Écarter |
| Fusion des filles (`SubtasksMerge`) | Fusionner (`merge-go` → `primary`) | Réessayer, Autres filles | Abandonner la fusion, Annuler (**contour → texte**) |
| Cycle de worktree, commit, modifications (`WorktreeBar`, `CommitForm`, `ChangesList`, `ChangesBars`, `DiffView`) | Fusionner, Committer, Envoyer les remarques | Réessayer, Ouvrir | Annuler ; Supprimer = rouge plein |
| Annotation de page, d'image (`PageAnnotator`, `ImageAnnotator`) | Ajouter, Joindre | | Annuler, Fermer (**contour → texte**) |
| Dialogues (Branche, Reprise, Installation, Passation, Fille, Supprimer) | Créer, Reprendre, Installer, Passer la main ; Supprimer = rouge plein | | Annuler, Plus tard, Jamais |
| Réglages (clés d'API, fournisseurs, commandes, MCP, agent perso) | Enregistrer / Ajouter | Modifier, Retirer la clé, Ajouter… | Annuler (**contour → texte** dans `ApiKeys`, `ProvidersSettings`, `CommandsSettings`) |
| Réinitialiser, remise à zéro, confirmations (`FreshStart`, `UsageReset`, `ConfirmRow`) | rouge plein (destructif) | | Garder / Annuler |
| Écran d'erreur (`ErrorBoundary`) | Recharger | Voir le journal | |
| Zone de saisie | Envoyer (`.send-button`, accent) | | Arrêter = **état**, neutre |
| Barre latérale | « Nouvelle conversation » : pastille d'accent (inchangée) | | |

Hors règle (ce ne sont pas des actions) : boutons d'icône, puces de la saisie, onglets, bascules
(`.btn.active`), suggestions de l'accueil, pastilles.

### Inventaire des rayons (avant) et jetons retenus

189 `border-radius` dans 7 fichiers CSS, 24 valeurs : 2 px (5), 3 (4), 4 (4), 5 (9), 6 (23),
7 (6), 8 (38), 9 (5), 10 (16 + 15 `--radius`), 11 (1), 12 (16), 13 (1), 14 (7), 16 (1), 18 (1),
20 (4 `--radius-lg`), 99/999 px (12), 50 % (17).

| Jeton | Valeur | Remplace | Pour |
|---|---|---|---|
| `--radius-xs` | 4 px | 2–5 px | code en ligne, `kbd`, surlignage, barres fines, carrés de légende |
| `--radius-sm` | 8 px | 6–9 px | boutons, puces, champs, lignes, Envoyer / Arrêter |
| `--radius-md` | 12 px | 10–12 px | blocs du fil (code, diff, sortie, avis), menus, cartes des réglages |
| `--radius-lg` | 20 px | 13–20 px | grandes surfaces : zone de saisie, cartes de permission / plan / blocage, dialogues, palette, saisie rapide, bulle de l'utilisateur |
| `--radius-pill` | 999 px | 99/999 px, 50 % | pastilles, interrupteurs, points, avatars ronds |

Écarts à la proposition de l'audit (6 / 10 / 16 / 999) et pourquoi :
- **8 px pour `sm`** : c'est la valeur la plus fréquente (38, tous les `.btn`) ; 6 aurait changé
  tous les boutons, 8 n'en change aucun.
- **12 px pour `md`** et **20 px pour `lg`** : la zone de saisie est à 20 px et ne doit pas bouger
  (une autre fiche y travaille) ; la carte de permission, posée juste au-dessus et de même largeur,
  prend le même rayon que la saisie au lieu de 14 px. 12 garde un pas régulier (4, 8, 12, 20).
- **un cinquième jeton `xs`** : 22 rayons de 2 à 5 px sur de tout petits éléments (code en ligne,
  carrés de la grille d'activité, barres de 4 px) ; les passer à 8 px les aurait déformés.
- **50 % → `pill`** : tous les 50 % sont sur des éléments carrés ; 999 px y donne le même cercle.

**Rayons imbriqués** : un enfant collé au bord de son parent (bandeau de pied, confirmation
prolongeant une ligne) prend `calc(rayon du parent − épaisseur de bordure)` ; un bloc posé dans une
carte avec une marge au moins égale au rayon prend un cran de moins (`lg` → `md` → `sm`) : carte de
permission `lg`, diff `md`, boutons `sm`.

Le chassis des appareils (`SimulatorTab`, `AndroidTab`) calcule ses rayons depuis la géométrie de
l'appareil, en style en ligne : hors règle, ce n'est pas l'interface de Bobine.

### Jeton de couleur `--action-primary` ?

Non retenu : l'action principale **est** l'accent, qui existe déjà dans les six palettes et les six
accents, avec son survol et son texte (`--accent`, `--accent-hover`, `--on-accent`), et dont le
contraste du texte posé dessus est déjà testé. Un alias n'aurait rien ajouté qu'un nom de plus à
tenir à jour ; la règle vit dans la classe `.btn.primary`.

### Fichiers touchés

- `src/shared/themes.ts` (`RADIUS_TOKENS`, `radiusVariables`), `scripts/themes-css.mts`,
  `src/renderer/src/themes.generated.css` (généré), `src/shared/themes.test.ts` (rayons croissants,
  `--text` sur `--surface-3`) ;
- garde-fou : `scripts/radius-guard.test.ts` (lit les CSS du renderer) ;
- `src/renderer/src/*.css` : remplacement des rayons ; `styles.css` : `.btn.primary`,
  `.send-button` (désactivé, arrêt), retrait de `.merge-go` ;
- composants : `SubtasksMerge.tsx`, `ImageAnnotator.tsx`, `ApiKeys.tsx`, `ProvidersSettings.tsx`,
  `CommandsSettings.tsx` (classes seulement) ;
- doc : `docs/architecture.md`, cette fiche, index, `CHANGELOG.md` / `CHANGELOG.en.md`.

Aucune dépendance nouvelle.

### Étapes

1. Jetons de rayon + génération + test des jetons.
2. Remplacement des rayons dans les CSS, garde-fou.
3. `.btn.primary` à l'accent, arrêt et Envoyer désactivé neutres, annulations en texte seul.
4. Doc, vérification, e2e clair et sombre, captures avant/après.

### À aligner à la fusion

La branche de la fiche 166 (onglet Session, `src/renderer/src/session-tab.css`) n'est pas encore
dans `main` : ses `border-radius` devront passer aux jetons, sinon le garde-fou échouera à la
fusion. Idem pour toute branche ouverte qui ajoute un rayon en dur (171, 172).

## Journal

- 2026-11-05 : fiche créée, inventaires faits, plan écrit.
- 2026-11-05 : fait. Trois commits : jetons de rayon et garde-fou (`scripts/radius-guard.test.ts`
  — déplacé de `src/shared/`, typé sans Node), règle des actions, doc. Écarts au plan :
  - `.btn.primary:disabled` suit aussi Envoyer désactivé (neutre au lieu de l'accent à 40 %), pour
    que la règle tienne partout ;
  - « Voir le conflit » (fusion) passe de texte seul à contour : c'est une action secondaire ;
  - menu des commandes `/` en `md` (comme `.menu`), puce de l'agent du panneau, pastilles du profil
    temporaire et du mode présentation en `pill` (leur rayon valait la moitié de leur hauteur).
  - Contrastes mesurés (orange) : icône d'arrêt sur `--surface-3` de 8,8:1 (Sombre) à 13:1 (Nuit
    noire) ; flèche désactivée 4,05:1 (Sombre) à 5,65:1 ; texte sur l'accent ≥ 4,81:1 (déjà testé
    pour les six accents).
  - Vérification : `./scripts/verify` vert (un test de timing de `manager.test.ts` a échoué une fois
    sous la charge, vert seul) ; `pnpm build && pnpm e2e --changed` = toute la suite (139 essais,
    clair et sombre) : 138 verts, `diagnostic dark` a échoué une fois (« rapport copié », presse-
    papiers sous charge), vert relancé seul. Captures regardées : permission (clair), tour en cours
    (sombre), accueil (clair), plan en Fjord nuit.
  - Non vérifié : survol réel d'Arrêter et des boutons (pas d'essai à la souris), Sépia / Nuit
    noire à l'œil (contrastes testés seulement).
- 2026-11-05 : `main` fusionnée dans la branche (fiches 166, 167, 171, 173 arrivées). Conflits :
  `CHANGELOG.md` / `CHANGELOG.en.md` et l'index (les deux entrées gardées) ; `.child-report` de
  `styles.css` (jeton `--radius-md` de la 170 + filet de 2 px de la 171). Rayons convertis :
  `session-tab.css` (fiche 166), cinq valeurs — `.session-link` et `.session-finished-toggle` 6 px →
  `sm`, `.session-bar` 999 px → `pill`, `.session-dot` 2 px et `.session-measure` 4 px → `xs` ; rien
  en dur arrivé par 167, 171 ou 173. Boutons arrivés, déjà dans la règle sans changement : « Ouvrir »
  d'une fille (contour, secondaire), « Arrêter » d'une entrée de l'onglet Session (bouton d'icône
  neutre : un état, jamais l'accent), « Mesurer » (lien d'action en accent, comme un lien), dépli
  des comptes rendus et « terminés » (bascules, hors règle).
  Après fusion : `./scripts/verify` vert ; `pnpm e2e --changed` (145 essais, clair et sombre) :
  139 verts, 6 rouges dans `debordements` et `sommaire` (fiche 173), reproductibles seuls — et
  **identiques sur `main` (`02d7a30`) construite à part** : ils ne viennent pas de cette branche
  (`time.msg-time` dépasse le fil étroit à 120 px, `outline-bars` jamais affiché). Captures
  regardées : `session-2-en-cours` (sombre), `inbox-1-etats-sur-place` (clair), `composer-8-barre-500`.
