# 266 — Vocabulaire unique et coût honnête (lot 5 de la 260)

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260 (fiche cadre, règle 1 et décision 1), 261 à 265
- **Agents** : les deux — tout est générique : mots de l'interface, règle du coût sans nom d'agent
  (les bobcoins de Bob, son propre décompte, n'y sont pas soumis)

## Pourquoi

Recette du 19 novembre (`docs/recettes/2026-11-19-exploration-opencode-sol.md`) : le vocabulaire
du travail délégué est éclaté (fille, sous-tâche, compte rendu, tâches proposées, mère, « a fini
son tour », « Finie, à lire », « terminée »…) ; un coût nul s'affiche « ≈ 0,00 $US » ou « gratuit »
même pour un modèle payant connecté par abonnement, et le plafond de coût ne se déclenche jamais
(D12) ; le menu des modèles ne dit pas lesquels demandent une connexion (D31) ; l'avis « Réglage
non appliqué » est technique, mi-anglais, avec l'identifiant brut (D32). Les lots 261 à 265 avaient
laissé à celui-ci les textes repris d'avant.

## Critères d'acceptation

- [x] Ce qu'on confie est un **travail** (« task »), fait par un rôle ou « un autre <agent> », qui
  rend une **réponse** ; « conversation fille », « fille », « sous-tâche(s) », « compte rendu »,
  « tâches proposées », « conversation mère » quittent l'interface (fr et en) et le guide.
- [x] Fin d'un travail : « a répondu » (« a répondu · N fichiers » pour un travail qui écrit),
  « en erreur », « arrêté » accordé avec le nom ; plus de « a fini son tour », « a rendu son compte
  rendu », « Finie, à lire », « terminée(s) ».
- [x] Les sous-agents de l'agent gardent « sous-agent ».
- [x] Ce qui va à l'agent n'est pas touché (ADR-0014) : aucun texte envoyé à l'agent n'était faux.
- [x] Coût : « gratuit » pour un coût nul d'un modèle qui se dit gratuit ; « coût non communiqué »
  sinon ; jamais un modèle payant présenté comme gratuit ; un coût par carte.
- [x] Plafond : dit qu'il ne peut pas se déclencher (Réglages, détail de la consommation).
- [x] D31 : le menu des modèles signale les modèles du même fournisseur qu'un modèle refusé.
- [x] D32 : avis clair, en français, sans identifiant brut, qui dit le modèle pris à la place.
- [x] Durées : jamais « 0 s », « < 1 s » partout.
- [x] Essais : mots interdits (textes et guide), coûts (gratuit, abonnement, non communiqué,
  payant, bobcoins), avis D32, menu D31, durées ; e2e complète.

## Plan

1. Inventaire : `fr.json` / `en.json` (188 valeurs fr, 119 en), textes hors i18n (aucun : notifications,
   export, menus et pilote passent tous par les fichiers de langue ; l'agent factice parle comme un
   agent, pas l'app), guide `docs/guide/{fr,en}`.
2. Valeurs changées, **clés gardées** (renommer `children.*` aurait touché ~60 fichiers et les e2e
   pour aucun gain visible) ; `fr.generated.d.ts` régénéré.
3. Essai qui interdit les mots retirés (`src/shared/i18n/retired-words.ts`, `vocabulary.test.ts`,
   `renderer/src/help/guide-vocabulary.test.ts`).
4. Coût : `isFreeModel` déplacé dans `shared/usage.ts` ; `freeModels`, `costNotReported`,
   `costText`, `digestsFree` ; `UsageDigest.free` (retenu dans l'index, relu par
   `parseUsageDigest`) ; cartes d'un travail, carte de groupe, carte « Travaux » (ancienne), puce et
   détail de la consommation, plafond (`UsageGuards`), Réglages, chiffre « Coût » de Mon activité.
5. D32 : `initial-controls.ts` (valeur plus proposée : rien n'est envoyé, avis
   `modelNotOffered` / `controlNotOffered` ; échec de l'agent : `controlFailedKept` dit ce qui est
   gardé) ; nom retenu par `knownOptionName` (modèles vus, fiche 108).
6. D31 : `ModelMenu.tsx`, étiquette « connexion sans doute à faire » (pointillé) sur les modèles du
   même fournisseur (`modelProvider`, le préfixe du nom affiché) qu'un modèle refusé.
7. Durées : `turnDuration` rend « < 1 s » sous la seconde (pied des réponses, Code reviewer,
   Session › En cours, attente) ; fusion et rédaction du message de commit aussi.
8. Docs : glossaire, `agents.md` (règle du coût), `acp.md` (Bob), guide, CHANGELOG, fiche 260.

## Tableau avant → après (appliqué)

| Avant (fr) | Après (fr) | Avant (en) | Après (en) |
|---|---|---|---|
| conversation fille | travail | child conversation | task |
| Conversation fille de « X » | Travail lancé par « X » | Child conversation of “X” | Task started by “X” |
| fille de « X » (À traiter) | lancé par « X » | child of “X” | started by “X” |
| conversation mère / la mère | la conversation qui l'a lancé ; l'agent (avis, suggestion, recommandation) | parent conversation | the conversation that started it; the agent |
| Sous-tâches (carte, Réglages) | Travaux ; Travaux délégués (rubrique, famille d'outils) | Subtasks | Tasks; Delegated tasks |
| Modifications › Filles | Modifications › Travaux | Children | Tasks |
| N tâches proposées | N travaux proposés | N proposed tasks | (inchangé) |
| compte rendu | réponse | report | response |
| Compte rendu à lire | Réponse d'un travail à lire | Unread report | Unread task response |
| « X » a fini son tour | « X » a répondu | “X” finished its turn | “X” replied |
| Rôle a rendu son compte rendu — X | Rôle a répondu — X | Role sent its report — X | Role replied — X |
| Finie, à lire / Finie | A répondu, à lire / A répondu | Finished, unread / Finished | Replied, unread / Replied |
| N terminée(s) ; N fini(s) (carte de groupe) | N a répondu / ont répondu | N finished | N replied |
| a fini (repère, rôle) | a répondu | finished | replied |
| Arrêtée ; a été arrêté (état d'un rôle) | Arrêté ; arrêté | Stopped | (inchangé) |
| Erreur ; en échec ; s'est arrêtée sur une erreur | En erreur ; en erreur ; est en erreur | Error / failed | Failed |
| La branche est finie ; N branches finies | Le travail a répondu ; N travaux ont répondu | The branch is finished | The task replied |
| Fusionner la recommandée ; N fusionnée(s) | Fusionner le recommandé ; N fusionné(s) | (inchangé) | (inchangé) |
| Partie du commit … | Parti du commit … | (inchangé) | (inchangé) |
| N conversations filles ont fini (notification) | N travaux ont répondu | N child conversations have finished | N tasks replied |
| Conversations filles en cours (Réglages) | Travaux en cours | Running child conversations | Running tasks |
| Proposer des conversations filles | Proposer des travaux | Propose child conversations | Propose tasks |
| Votre demande partira dans une conversation fille | … dans sa propre conversation | … to a child conversation | … to its own conversation |
| Lance / Écrit à une conversation fille (outils) | Lance un travail / Écrit à un travail | Starts / Writes to a child conversation | Starts a task / Writes to a task |
| Relecture … finie sans remarques structurées | … a répondu sans remarques structurées | ended without… | replied without… |
| ≈ 0,00 $US pour un modèle payant | coût non communiqué | ≈ $0.00 | cost not reported |
| Réglage « Model » non appliqué (openai/gpt-6.2-sol) : Valeur non proposée… | Le modèle GPT-6.2 Sol n'est plus proposé par OpenCode : cette conversation utilise Tidepool Alpha Free. | Setting “Model” not applied… | OpenCode no longer offers the model GPT-6.2 Sol: this conversation uses … |
| 0 s | < 1 s | 0 s | < 1 s |

Mots-clés de la recherche des réglages (`settingsSearch.*`, jamais affichés) : les anciens mots y
restent en synonymes, avec les nouveaux.

## Décisions

1. **Règle du coût** (documentée dans `docs/agents.md`, « Coût nul ») : montant si non nul ;
   coût en monnaie nul → « gratuit » si chaque modèle connu de la conversation se dit gratuit
   (heuristique « free » de la fiche 265), sinon « coût non communiqué » ; pas de coût → jetons ;
   unité propre de l'agent (bobcoins) → tel quel, même nul. **« Inclus dans l'abonnement » n'est
   jamais affiché** : aucun agent ne dit par ACP qu'il passe par un abonnement, et OpenCode a été vu
   annoncer un coût non nul avec un abonnement (recette du 17) ; on ne peut pas le savoir. Écart à la
   décision 1 de la 260, faute de signal.
2. **Plafond** : comportement inchangé (on ne bascule pas en jetons sans le dire) ; il le dit.
3. **Clés gardées**, valeurs changées : `children.*`, `childrenMerge.*`… restent des noms internes.
4. Fin d'un travail dans la carte de groupe : « 2 ont répondu » (au lieu de « 2 finis ») : un seul
   verbe pour la fin d'un travail.
5. `approvalRules.page.group.subtask` garde « Sous-tâches » : c'est le groupe d'approbation
   `subtask` d'IBM Bob, son concept et son nom (exclusion documentée de l'essai).
6. D31 : l'app ne découpe toujours pas l'identifiant (fiche 210) ; elle lit le fournisseur dans le
   **nom affiché** (`modelProvider`, déjà utilisé par le menu) et dit « sans doute », en pointillé :
   rien n'est sondé, le modèle reste choisissable.
7. D32 : une valeur que l'agent ne propose plus n'est plus envoyée (avant : refusée par l'app, avec
   un message technique) ; le nom vient des options, sinon des modèles retenus, sinon la valeur.
8. Guide : noms de pages et ancres gardés (`conversations-filles.md`, `#taches-proposees`,
   `#avis-de-la-mere`) pour ne casser aucun lien ; l'essai ne lit pas les liens.

## Limites connues

- La gratuité reste une heuristique (« free » dans le nom ou l'identifiant) : un modèle gratuit
  sans ce mot donne « coût non communiqué » (jamais l'inverse).
- Résumés enregistrés avant ce lot (sans `free`) : un travail gratuit déjà fini peut dire « coût non
  communiqué » jusqu'à ce que son résumé soit recalculé (nouveau tour).
- Mon activité : le chiffre « Coût » suit la règle (gratuit si chaque modèle de l'unité se dit
  gratuit, sinon « coût non communiqué », sans coût par échange) ; les tableaux par modèle, par
  projet et le graphique gardent le montant brut (« 0,00 $US ») : une ligne par modèle s'y lit
  déjà.
- Le message d'un délai dépassé très court (< 0,5 s, essais seulement) dit encore « en 0 s »
  (`process.timeout`) ; les délais réels sont de plusieurs secondes.
- « task » (travail) et « tasks » (liste de tâches de l'agent, onglet Tâches) partagent le mot
  anglais, déjà fixé par la fiche 261 ; noté au glossaire.
- Le CHANGELOG garde, pour les versions publiées, les mots de l'époque.

## Journal

- 2026-11-20 : inventaire, valeurs fr/en, guide, essai des mots retirés ; règle du coût et plafond ;
  D31, D32 ; durées ; docs. `./scripts/verify` vert.
- 2026-11-20 : e2e complète (222 passages, clair et sombre) : tout vert sauf `filles-fusion`
  (« Ouvrir sa conversation » sans effet, 3 fois sur 4 ; 4 sur 4 vert sur le code d'avant). Cause
  trouvée par bissection (fichiers de langue seuls) et relevé des événements : au retour dans la
  conversation, la carte relit le plan de fusion et la ligne dépliée descend de 15 à 30 px ; l'appui
  tombait sur la ligne de transmission juste au-dessus. Essai corrigé comme un humain : ligne
  désignée par son travail (`data-child-id`), dépliée seulement si elle ne l'est pas, appui une fois
  la ligne immobile ; 10 sur 10 vert. Le saut de la ligne à la relecture du plan existe depuis la
  264 (non corrigé ici, signalé). Mon activité (chiffre « Coût ») ajouté à la règle du coût ;
  suites `activity`, `usage-board`, `usage`, `filles-fusion` relancées après : vertes.
- Captures regardées (clair, sombre) : `filles-161-vue-filles` (barre latérale avec travaux,
  Modifications › Travaux, cartes), `264-groupe-finis` (carte de groupe), `263-carte-repondu`
  (carte d'un rôle), `157-reglages` (plafond et sa note), `265-relecture-remarques`. Pas de capture
  e2e de « coût non communiqué » ni de « connexion sans doute à faire » : l'agent factice ne joue ni
  coût nul payant ni modèles à fournisseur ; couverts par les essais unitaires.

### Décisions du tech lead, revues UX et QA (2026-11-20), appliquées

- **Saut de la ligne dépliée** : la cause mesurée (relevé image par image dans `filles-fusion`)
  n'est pas la relecture du plan de fusion (le magasin `merge-plan-store` garde déjà l'ancien plan,
  hauteurs constantes au relevé) mais le **suivi du bas du fil** : une ligne dépliée en bas du fil
  agrandit le fil, qui défilait aussitôt vers le bas, et la ligne remontait sous le pointeur
  (jusqu'à sortir de l'écran). Corrigé dans l'app par le mécanisme de la fiche 124 : chaque carte
  de travail et chaque ligne d'une carte de groupe porte `data-scroll-hold` ; pointeur dessus, le
  fil ne court pas vers le bas, il reprend en bas quand le pointeur en sort. (Un premier essai, qui
  lâchait le suivi du bas au clic d'un `[aria-expanded]`, cassait `filles` : abandonné.) Essai
  `WorkGroup.test.tsx` ; l'e2e `filles-fusion` clique juste après le retour, sans attente de
  stabilité (ligne désignée par son travail), 8 fois sur 8 verte. Limite : pointeur posé sur une
  carte de travail pendant qu'une réponse arrive, le fil attend qu'il en sorte (comme pour les
  propositions).
- **Coût** : « coût inconnu » remplace « coût non communiqué » ; partout (`/cost`, tâches
  planifiées, aparté, sous-agents, Mon activité : chiffre, tableau par modèle, conversations,
  infobulle du graphique ; moyenne et lignes du détail de la consommation) ; total partiel d'une
  carte de groupe « ≈ … + coût inconnu », bulle « Sans le coût de N travaux ». Puce avant le premier
  envoi : d'après le modèle choisi.
- `isFreeModel` : « free » en fin de nom ou d'identifiant seulement (`free-tier-pro`, `not-free`,
  `non-free` refusés) ; `freeModels` faux dès qu'un tour n'a pas de modèle ; seuls les tours gardés
  (`MAX_TURNS`) sont vus (l'historique tronqué ne l'est pas). Au tableau de bord, l'identifiant sans
  le profil (`boardModelFree`).
- **Anciens résumés** (sans `free`) : complétés une fois au lancement depuis leur fil
  (`free-digests.ts`, `settleFreeDigests`, sans garder les fils) ; les réponses d'un travail
  reprennent la gratuité de sa conversation (`withFree`). `free` est maintenant toujours posé
  (`true` ou `false`) quand un coût existe.
- **D31** : marquage fait dans le main (`markRefused`, `authLikely`) : jamais sur le modèle choisi,
  un modèle gratuit, ni un modèle qui a répondu avec ce profil.
- **D32** : avis avec guillemets, « Changez le modèle par défaut dans Réglages › Agents. » ; un seul
  avis par conversation, la valeur n'est plus renvoyée (`withoutWarned`) ; échec d'un modèle :
  `modelFailedKept`, l'erreur brute au journal ; autre réglage : `controlFailedKept` ; réglage
  appliqué après le délai : avis `controlLate`. `process.timeout` dit « < 1 s ».
- **Carte de groupe** : après le réveil de l'agent, « Réponses transmises » (le réveil porte les
  réponses des travaux lancés par l'agent, même posé avant la dernière).
- **Vocabulaire** : « conversation d'origine » / « source conversation » ; « Recommandé » / « Pas
  encore recommandé » ; « Fusionner le travail recommandé » ; « N travaux à fusionner ont
  répondu » ; « N travaux fusionnés dans main en … » ; « Travaux en même temps, au plus » ; « en
  cours, sera arrêté » ; « Finis : N » ; en anglais, la liste de l'agent devient « To-dos » (onglet,
  épinglée, export, outils), « Tasks » est réservé aux travaux ; « 3 proposed tasks ».
- **Essai des mots retirés** : expressions Unicode, équivalent anglais de « terminée »
  (« finished »), guide lu par paragraphe, exclusions seulement nommées.
- **Agent factice** : scénarios `cout-nul-payant` et `connexion-a-faire-fournisseur` (modèles nommés
  par fournisseur) ; suite e2e `cout-connexion`, captures `266-cout-non-communique` et
  `266-connexion-a-faire` (clair, sombre).
- Non fait faute du texte : le point 23 de la revue UX (« les trois détails en anglais ») et les
  « textes proposés » (14, 15, 20) n'étaient pas joints : textes écrits par moi, à relire.

