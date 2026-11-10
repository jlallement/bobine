# 127 — Sous-agent en arrière-plan fini même si l'on continue, fil ramené en bas à l'envoi, barre du plan immobile

- **Statut** : fait (essai à la vraie souris de D26 et D27 pas fait : accès refusé ; scène 2.5 à
  rejouer avec OpenCode)
- **Dépend de** : 122 (sous-agent en arrière-plan), 053 (sous-agents), 117, 003 (fil), 050 (« Aller
  en bas »), 040 (plan annoté), 124 (boutons du plan)
- **Agents** : les deux pour D26 et D27 (fil et carte du plan, génériques). D25 touche OpenCode
  seul en pratique (lui seul lance des sous-agents en arrière-plan, profil
  `subagentStream.background`) ; la correction est générique (réducteur du fil, suiveur des
  sous-agents), rien de propre à OpenCode hors de son profil (ADR-0011).

## Pourquoi

Le rejeu des corrections avec de vrais agents (`docs/recettes/2026-10-23-rejeu-apres-corrections.md`,
« Nouveaux défauts ») a trouvé trois défauts :

- **D25 (majeur)** : un sous-agent qu'OpenCode lance en arrière-plan reste « en cours » pour
  toujours, sans réponse, si l'utilisateur envoie un autre message avant sa fin. Bobine relit bien
  sa session jusqu'à la fin et envoie la fin au fil, mais le fil ne cherche la carte que dans le
  dernier tour (`findTool`) : la fin, la durée et la réponse d'une carte d'un tour antérieur sont
  jetées, et le fil enregistré garde la carte « en cours ». L'utilisateur ne sait jamais si le
  sous-agent a fini.
- **D26** : envoyer un message quand le fil est remonté ne ramène pas en bas : la bulle envoyée et
  la réponse restent hors de vue. L'utilisateur croit que son message n'est pas parti et le renvoie
  (doublon chez l'agent).
- **D27** : sur la carte du plan, à la première remarque, le formulaire se replie et la barre
  « Envoyer mes remarques · Exécuter le plan » remonte sous le pointeur resté sur « Ajouter la
  remarque » : un double-clic exécuterait le plan (même risque que D10, dans l'autre axe).

## Critères d'acceptation

- [x] D25 : un sous-agent en arrière-plan finit dans sa carte (état, durée, réponse finale) même
      si d'autres messages sont partis depuis ; son travail relayé en direct va toujours sous sa
      carte ; un sous-agent du tour suivant n'est pas rangé sous la sienne.
- [x] D25 : la fin est dans le fil enregistré (relancer Bobine montre la carte finie).
- [x] D26 : envoyer un message (zone de saisie, « Envoyer maintenant », remarques du plan,
      « Exécuter le plan », remarques du diff) ramène le fil en bas, la bulle envoyée visible, et
      le fil suit la réponse. Remonter pour lire reste possible ; la flèche ↓ garde son rôle.
- [x] D27 : la barre de boutons du plan ne bouge ni horizontalement ni verticalement quand une
      remarque est ajoutée (première ou suivante), le pointeur restant sur la carte.
- [x] Testé contre l'agent factice (scénario `sous-agent-arriere-plan-lent` suivi d'un message ;
      suites e2e `subagents`, `composer`, `plan`).

## Plan

**D25** (un commit)
1. Test rouge du réducteur (`src/shared/subagent-background.test.ts`) : sous-agent en
   arrière-plan au tour 1, message au tour 2, puis `subagent-run` (fin, réponse) et
   `subagent-update` (travail relayé) : la carte du tour 1 les reçoit.
2. Test rouge du suiveur (`subagent-tracker.test.ts`) : la session connue du sous-agent en
   arrière-plan est rattachée à sa carte (relais après un autre prompt → sa carte, sa fin
   attendue) ; un sous-agent du tour suivant ne prend pas sa carte.
3. Scénario factice `sous-agent-arriere-plan-lent` (rapport 12 s après) ; e2e `subagents` :
   un message part avant la fin, la carte du tour précédent finit avec sa réponse, puis après
   rechargement du fil depuis le disque.
4. Correction : dans `transcript.ts`, une carte de sous-agent se cherche aussi dans les tours
   précédents pour `subagent-run` et le travail relayé (le dernier tour d'abord) ; dans
   `subagent-tracker.ts`, `detach` rattache la session connue à la carte. `manager.ts` non touché.

**D26** (un commit)
1. Test rouge du hook (`useThreadScroll.test.ts`) : remonté, `followSent()` puis un nouvel élément
   → le fil est en bas, même pointeur sur une carte `data-scroll-hold`.
2. `useThreadScroll` : `followSent()` (suivi repris, saut immédiat en bas) ; `App.tsx` l'appelle à
   chaque envoi de l'utilisateur. e2e `composer` : fil remonté, envoi, bulle visible.

**D27** (un commit)
1. Test rouge du composant (`PlanDocument.test.tsx`) : tout ce qui change à l'ajout d'une
   remarque (formulaire, liste) est après la barre ; la carte garde sa hauteur tant que le
   pointeur y reste.
2. `PlanDocument` : la barre suit directement le plan ; liste des remarques et formulaire en
   dessous ; hauteur de la carte gardée jusqu'à la sortie du pointeur. e2e `plan` : abscisses
   **et** ordonnées des boutons identiques avant / après la première remarque.
   *Écart* : la barre reste sous les remarques, seule la hauteur réservée a été gardée (voir le
   journal, D27).

## Journal

- 2026-10-23 : fiche ouverte (D25, D26, D27 du rejeu).
- 2026-10-23, D25 : tests rouges (réducteur : fin et travail relayé d'une carte d'un tour
  précédent jetés ; suiveur : la session du sous-agent d'un tour suivant prenait la carte du
  sous-agent en arrière-plan, la plus ancienne ouverte). Cause : `findTool` limite la recherche
  au dernier tour (identifiants réutilisés d'un tour à l'autre) ; le suiveur, lui, finissait bien
  le sous-agent. Correction : `findSubagent` (dernier tour, sinon la plus récente carte qui suit
  déjà un sous-agent) pour `subagent-run` et le travail relayé ; `detach` rattache la session
  connue à la carte. `manager.ts` non touché : le fil enregistré suit le réducteur. Scénario
  `sous-agent-arriere-plan-lent` (rapport 12 s après), e2e `subagents` : message envoyé avant la
  fin, carte finie avec sa réponse, puis après redémarrage ; vert en clair et en sombre.
- 2026-10-23, D26 : test rouge du hook (`followSent` absent). `useThreadScroll.followSent()` :
  suivi repris, saut immédiat en bas (pas de défilement doux qui laisserait la bulle hors de vue),
  pause d'une carte `data-scroll-hold` levée. `App.tsx` passe tous les envois de l'utilisateur
  par `send` / `sendNow` (zone de saisie, « Envoyer maintenant », remarques et exécution du plan,
  remarques du diff). Modifier un message (branche) n'y passe pas : le fil s'arrête déjà à lui.
  e2e `composer` : fil de 50 lignes remonté en haut, envoi, bulle dans la vue, plus de flèche ↓,
  réponse suivie ; vert en clair et en sombre.
- 2026-10-23, D27 : **décision UX** — hauteur réservée, pas formulaire sous la barre : la zone
  des remarques et du formulaire, au-dessus de la barre, garde sa hauteur tant que le pointeur
  est sur la carte et ne se resserre qu'à sa sortie, car c'est le seul moyen qui tient dans les
  deux régimes du fil (le formulaire sous la barre, essayé d'abord, la fait remonter de 85 px à
  son ouverture quand le fil est en bas). Gardée au repli du formulaire (« Ajouter », Échap,
  « Annuler ») et au retrait d'une remarque ; la nouvelle remarque prend le haut de la zone, le
  pointeur resté sur « Ajouter » tombe dans l'espace gardé. Pointeur suivi par `pointerenter` /
  `pointerleave` natifs : ceux de React voient une sortie quand le bouton sous le pointeur
  disparaît. Zone en `display: flow-root` : la marge du formulaire compte dans la hauteur gardée
  (sinon 11,5 px de moins suffisaient à relancer le suivi du bas du fil). Remarque ajoutée au
  clavier, pointeur hors de la carte : rien n'est gardé. Ordre changé dans la zone : les remarques,
  puis le formulaire (la remarque ajoutée prend sa place). Test de composant rouge puis vert ;
  e2e `plan` dans une fenêtre haute (place sous la carte, comme au rejeu) : sans la correction,
  « Exécuter le plan » sous le pointeur (y 689 → 624), avec, même ordonnée ; en bas du fil la
  barre ne bougeait déjà pas (l'e2e y passait même sans correction).
- 2026-10-23, clôture : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` : 109 / 110
  au premier passage (3 suites en parallèle), seul `filles` sombre en échec (propositions en
  rafale, D13 de la fiche 124 : la proposition est arrivée avant le survol, sous charge ; l'envoi,
  donc `followSent`, précède le survol dans cet essai), puis `filles` vert seul en clair et en
  sombre. Captures regardées en clair et en sombre : `g3d-arriere-plan-fini-apres-un-message`,
  `composer-1b-envoi-fil-remonte`, `97a-plan-premiere-remarque`, `98-plan-annote`.
  **Vérifié par e2e et tests seulement, pas à la vraie souris** (accès à Bobine / Electron refusé) :
  D26 (envoi au clavier depuis un fil remonté) et D27 (pointeur laissé sur « Ajouter la
  remarque », espace gardé jusqu'à sa sortie). Les e2e passent par CDP : ni une vraie molette, ni
  un double-clic réel. À rejouer avec OpenCode : scène 2.5 (sous-agent en arrière-plan, message
  envoyé avant sa fin, puis relance de Bobine).

