# 191 — Astuces de Bobine

- **Statut** : fait
- **Dépend de** : 186 (aide intégrée : « En savoir plus »), 180 (aparté), 177 (« Faire relire »),
  157 (contexte presque plein)
- **Agents** : les deux. Aucune astuce ne dépend d'un agent : elles parlent de Bobine (ADR-0011).

## Pourquoi

Bobine a beaucoup de fonctions qui ne se devinent pas : l'aparté n'a pas de bouton (`/btw`, ⇧⌘A),
« Faire relire » n'est qu'une icône, la compaction ne se voit qu'à 85 % de contexte. Une astuce
dite **au moment où elle sert**, une fois, aide sans encombrer. Maquette validée par l'utilisateur :
`ux-0-9-1/maquettes/05-astuces` (notes de session, 2026-11-06).

## Règles (maquette 05)

- Une astuce n'apparaît que **dans son contexte**, **une à la fois**, **au plus une par jour**
  (toutes confondues), jamais pendant une demande de l'agent (autorisation, question) ni pendant
  les **deux premières minutes** d'une conversation.
- × : fermée pour aujourd'hui (le quota du jour est pris). « Ne plus montrer » : masquée pour
  toujours. Fonction utilisée (aparté ouvert, relecture lancée) : son astuce ne revient jamais,
  même sans clic sur l'astuce.
- « En savoir plus » ouvre l'aide (fiche 186) à la section de la fonction.
- Réglages › Général, carte « Vous », sous « Langue » : **Astuces de Bobine**, activé par défaut ;
  « N astuces masquées · Tout réafficher ».
- Textes dans `fr.json` / `en.json` ; rien de propre à un agent.

## Critères d'acceptation

- [x] Aparté : on tape (texte non vide depuis 2 s) pendant que l'agent travaille → languette sur
      le bord haut de la saisie ; « Essayer » pose le texte tapé en aparté ; elle s'efface quand
      le texte est envoyé ou effacé.
- [x] Contexte au-delà de 85 % : languette, une fois par conversation, avec le pourcentage.
- [x] Gros changement (plus de 20 fichiers ou 500 lignes dans la conversation) pas encore relu :
      au survol ou au focus de « Fusionner », languette au pied de la vue Git, « Faire relire… ».
- [x] Même message (presque identique) envoyé trois jours différents dans le même dossier →
      « Planifier… » ouvre la page des tâches planifiées sur une nouvelle tâche préremplie (consigne,
      dossier) ; une tâche créée fait taire l'astuce.
- [x] Une astuce fermée ne revient pas après relance ; « Ne plus montrer » et fonction utilisée :
      jamais plus ; réglage qui les coupe toutes ; « Tout réafficher ».
- [x] Discrètes : teinte d'accent très légère, fondu de 160 ms (rien sous « réduire les
      animations »), ne poussent pas le fil.
- [x] Testé : unitaires (règles, moments, déclencheurs, réglages) et suite e2e `astuces` (fr et
      en, clair et sombre) contre l'agent factice.

## Plan

- `shared/tips.ts` : identifiants, état (`hidden`, `lastShownDay`), règles pures
  (`mayShowTip`, `applyTipAction`), seuils.
- Main : préférence `tipsEnabled` (oui par défaut), état `tipsState` dans `settings.json`
  (`SettingsStore.tips / recordTip / resetTips`) ; IPC `tips:state`, `tips:record`, `tips:reset`,
  validés (astuce et action de la liste ; le **jour est celui du main**). `BOBINE_TIPS_QUIET_MS`
  raccourcit les deux minutes de calme pour les essais e2e seulement.
- Renderer : `useTips` (une seule astuce, refus selon les règles et le moment), `TipsContext`
  fourni par `App` (`useAppTips`) ; `ComposerTip` (aparté, contexte) au-dessus de la saisie ;
  astuce « Faire relire » dans `WorktreeBar` ; `TipTab` (la languette) ; `TipsRow` dans
  Réglages › Général. `ConversationSummary.createdAt` est publié pour la règle des deux minutes.
- Message répété : la saisie signale chaque message tapé (`tips:noteMessage`, jamais les messages
  générés par l'app : plan, commandes) ; le main garde une **empreinte** (SHA-256 tronqué du
  dossier et du texte normalisé, jamais le texte), les jours d'envoi (trois au plus), 200
  empreintes au plus, rien quand les astuces sont coupées ou celle-ci masquée ; l'interface ne
  reçoit jamais les empreintes. `TaskForm` accepte un `prefill`.
- Pas de nouvelle dépendance.

## Journal

- 2026-11-07 — Fiche ouverte et faite dans la même session que la fenêtre d'aide (fiche 186).
  Fait : aparté, contexte, gros changement, réglage, relance, puis (même nuit, « tout implémenter »)
  le message répété → « Planifier… ». **Écart** : le message répété passe outre les deux minutes
  de calme (on recommence souvent la même demande dans une conversation neuve) ; maquette des
  écarts envoyée à l'expert UX (`nuit-0-10/aide/maquette-ecarts-186-191`). **Écart** : × ferme « pour aujourd'hui » comme dans la
  maquette, pas « pour toujours » ; avec la règle d'une astuce par jour, une astuce fermée ne
  revient pas après relance le même jour, et peut revenir un autre jour (« Ne plus montrer » pour
  toujours). Le texte du contexte garde la question de la maquette (« Repartir d'un résumé ? ») ;
  « En savoir plus » mène à `/compact` dans le guide, et la saisie montre déjà « Compacter ».
  Captures : `nuit-0-10/aide/astuce-*` (notes de session). Essai réel avec OpenCode : voir le
  journal de la fiche 186.
- 2026-11-07 — **Verdict de l'expert UX** (`nuit-0-10/aide/VERDICT-expert-ux.md`) : écarts acceptés.
  Corrigé : le message répété paraît **à la fin du tour** (l'agent a fini ; jamais pendant le tour
  ni pendant une demande), compte dans la limite d'une par jour, et « Planifier… » ouvre une tâche
  **non enregistrée** ; « Annuler » ramène à la conversation. Retenu par le tech lead : **aucune
  astuce le jour du premier lancement** (pas de marque « accueil fini » de la fiche 188 sur main :
  le main retient le premier jour où il sert les astuces, `tipsState.firstDay`). Le retour à la
  ligne des actions est mesuré (`flex: 1 1 auto`), plus un seuil. Au passage, onglet Session :
  « Rien en arrière-plan pour cette conversation » remplace « Rien ne tourne pour cette
  conversation », qui contredisait l'agent en train de répondre. Essais : règles de fréquence par
  le crochet lui-même (`useTips.test.ts` : une par jour, une à la fois, demande, réglage, premier
  jour, « Ne plus montrer », fonction utilisée, deux minutes, fin de tour), suite e2e `astuces`
  (message répété : fin de tour, préremplie, rien d'enregistré, Annuler).
- 2026-11-07 — **Relecture du tech lead**, corrigé (chacun avec son essai) : l'état des astuces
  s'enregistre **sans** le circuit « réglages changés » (`setTips` : écriture seule, plus de
  re-rendu de toutes les fenêtres à chaque message) ; le jour du premier lancement est relu à chaque
  offre (`firstDayToday`, l'app restée ouverte après minuit) ; le message répété est marqué « en
  attente » dès l'envoi et paraît quand le tour est fini ET le troisième jour confirmé, dans
  n'importe quel ordre ; empreinte = **HMAC-SHA-256 avec une clé tirée au hasard pour
  l'installation** (`tipsState.salt`, jamais envoyée à l'interface). La clé est dans le même
  `settings.json` (pas dans le trousseau) : qui lit ce fichier peut encore tester un texte deviné ;
  le HMAC empêche seulement les tables précalculées et la comparaison d'une installation à l'autre ; empreintes **effacées** quand les astuces sont coupées
  ou quand « Planifier… » est masquée ou utilisée ; relecture du disque piégée (trop d'empreintes,
  jours en double, `__proto__`) couverte.
- 2026-11-07 — **Seconde relecture** : message répété envoyé pendant que l'agent travaille (file
  d'attente) : le tour en cours compte (`busySeen` pris à l'envoi), « Planifier… » à sa fin ;
  « Tout réafficher » et « Ne plus montrer » prévenus par `tips:changed` (pas pour « montrée ») :
  les astuces et le compte des Réglages suivent sans relancer l'app ; commentaire et fiche justes
  sur la clé du HMAC (dans `settings.json`, pas le trousseau). Essais pour chacun.
