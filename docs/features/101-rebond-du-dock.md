# 101 — Le Dock rebondit quand une conversation a besoin de vous

- **Statut** : fait (essai réel dans le Dock à faire sur l'app installée, voir le journal)
- **Dépend de** : 068 (son quand un agent attend), le suivi de l'attention (`src/main/notifications/`)
- **Agents** : les deux. C'est l'état des conversations qui compte, pas l'agent.

## Pourquoi

Les notifications de macOS sont refusées pour une app sans certificat de développeur, ce qui est le
cas de l'app installée. Avec plusieurs conversations en parallèle, on rate qu'une réponse est finie
ou qu'un agent attend : c'est le premier irritant du bilan « 8 h par jour » du 2026-10-21.

Le badge du Dock et le son de la fiche 068 existent déjà, mais le badge ne se remarque pas, et le
son ne joue que quand un agent attend. Faire rebondir l'icône du Dock marche sans certificat
(`app.dock.bounce`). L'app ne le fait pas aujourd'hui.

## Choix d'interface

Tranchés par la session principale :

- **Quand** : aux mêmes moments qu'une notification. Une conversation finit sa réponse, ou attend
  l'utilisateur (accord, question, connexion, « Enregistrer sous », boîte de page, accord d'une
  fille), alors que la fenêtre de Bobine n'a pas le focus.
- **Comment** :
  - un seul rebond, `informational`, pour une réponse finie ;
  - un rebond qui continue jusqu'au retour dans l'app, `critical`, quand un agent attend
    l'utilisateur, puisque rien n'avance sans lui ;
  - le retour dans l'app arrête le rebond.
- **Réglage** : dans la section des notifications des Réglages, « Faire rebondir l'icône du Dock »,
  activé par défaut. « Couper les notifications » (la cloche) coupe aussi le rebond.
- **Rien de nouveau** pour le badge et le son : ils restent comme aujourd'hui.

## Critères d'acceptation

- [x] Réponse finie, fenêtre sans le focus : un rebond `informational`.
- [x] Agent qui attend l'utilisateur, fenêtre sans le focus : un rebond `critical`, arrêté au retour
      dans l'app.
- [x] Fenêtre au premier plan : pas de rebond.
- [x] Le réglage et la cloche coupent le rebond.
- [x] Plusieurs évènements rapprochés ne font pas une rafale : un seul rebond en cours à la fois,
      comme pour le son de la fiche 068.
- [x] Testé : unités du suivi de l'attention (rebond demandé ou non selon focus, réglage, cloche,
      type d'évènement). e2e : rebond noté dans le journal en essai, comme le son.

## Plan

1. `shared/preferences.ts` : `dockBounce` (booléen, oui par défaut), lu par `parsePreferences` ;
   une ligne à côté de `attentionSound` dans `main/settings.ts` et `main/settings-store.ts`.
2. `main/notifications/dock-bounce.ts`, sur le modèle de `chime.ts` : `createDockBounce({ dock,
   enabled })` rend `bounce(kind)` et `stop()`. Un seul rebond en cours : un `critical` (action
   attendue) dure jusqu'à `stop()` ; un `informational` (réponse finie) ne rebondit qu'une seconde
   chez macOS, il compte comme fini après 2 s (l'écart du son), pour qu'une autre réponse finie
   plus tard rebondisse encore. Un `critical` remplace un `informational` en cours, jamais
   l'inverse. Sans Dock (hors macOS), rien. `journalDock(write)` : en essai
   (`BOBINE_BOUNCE_LOG`), chaque rebond et son arrêt sont notés au lieu d'être faits.
3. `main/notifications/attention.ts` : `AttentionTracker.alert` appelle `bounce` après le
   réglage des notifications (la cloche coupe le rebond, pas le son) : `critical` pour une
   demande, `informational` pour une réponse finie ou en erreur (les mêmes moments qu'une
   notification) ; `refresh()`, fenêtre au premier plan, appelle `stopBounce`. L'accord d'une
   fille passe par là : c'est une demande de sa conversation.
4. `main/index.ts` : branchement (`app.dock`, ou le journal en essai) ; `did-become-active` arrête
   aussi le rebond (retour par la fenêtre rapide, que macOS arrête de lui-même).
5. Réglages › Général, juste après « Notifications » : interrupteur « Faire rebondir l'icône du
   Dock » (`settings-dock-bounce`), grisé quand les notifications sont coupées ; index de
   recherche ; i18n fr et en.
6. Tests : unitaires `dock-bounce.test.ts` et `attention.test.ts` ; e2e `notifications` (journal :
   `critical` à la demande, arrêt au retour, `informational` à la fin, rien cloche coupée,
   `critical` même quand macOS refuse les notifications) et `settings` (capture du réglage).

Pas de nouvelle dépendance (`app.dock.bounce` d'Electron).

## Journal

- 2026-10-21 — Fiche créée (lot A des irritants). Pas de certificat Apple Developer pour l'instant
  (décision de l'utilisateur). Rien n'est codé.
- 2026-10-21 — Codé selon le plan (branche `claude/fiche-101-rebond-dock-448649`, non poussée).
  - `dock-bounce.ts` : `createDockBounce` (un rebond en cours ; `critical` jusqu'à `stop()`,
    `informational` fini après 2 s, `CHIME_GAP_MS` du son ; un `critical` remplace un
    `informational` qui rebondit encore ; refus de macOS, `-1`, et absence de Dock : rien) et
    `journalDock` (essais). `AttentionTracker` : `bounce` après le réglage des notifications,
    `stopBounce` dans `refresh()` fenêtre au premier plan. Réglage `dockBounce` (oui par défaut).
  - Réglages › Général : « Faire rebondir l'icône du Dock » juste après « Notifications », grisé
    (valeur gardée) quand elles sont coupées, puisque la cloche coupe aussi le rebond ; recherche
    (« rebond », « dock », « icône »…) ; glossaire : « faire rebondir l'icône du Dock » → « bounce
    the Dock icon ».
  - Tests : unitaires `dock-bounce.test.ts` (rafale, remplacement, 2 s, réglage, refus, sans Dock,
    journal) et `attention.test.ts` (types d'évènement, focus, cloche et réglage, rafale, arrêt au
    retour) ; `./scripts/verify` vert. e2e `notifications` et `settings`, clair et sombre, en
    français et `--lang en` : verts. Journal `BOBINE_BOUNCE_LOG` : `critical` à la demande, `stop`
    au retour, `informational` à la fin, rien cloche coupée, `critical` quand macOS refuse les
    notifications. Captures `81-reglages-rebond` et `81-reglages-rebond-grise` regardées.
  - Écarts au plan : le branchement du son et du rebond sur macOS est sorti d'`index.ts` dans
    `notifications/system-alerts.ts` (`index.ts` dépassait son plafond de 850 lignes ; il en a
    maintenant 5 de moins que sur `main`). Une réponse en **erreur** rebondit aussi
    (`informational`), puisqu'elle a sa notification. `did-become-active` arrête aussi le rebond
    (retour par la fenêtre rapide, que macOS arrête de lui-même). La suite `notifications` compare
    désormais les textes de l'app avec `L()` (elle échouait en anglais).
  - L'accord d'une fille n'a pas de code à part : c'est une demande d'autorisation de sa
    conversation, qui passe par le même chemin (`critical`).
  - À regarder à l'essai réel (app installée, session principale) : (1) une conversation qui
    demande un accord, Bobine en arrière-plan → l'icône rebondit sans s'arrêter ; revenir dans
    Bobine (clic sur l'icône, ⌘⇥) l'arrête. (2) Une réponse finie, Bobine en arrière-plan → un seul
    rebond, court. (3) Deux conversations qui finissent à quelques secondes d'écart → pas de
    rafale ; une autre réponse finie une minute plus tard rebondit de nouveau. (4) Une réponse
    finie pendant qu'une demande fait déjà rebondir l'icône → rien de plus. (5) Cloche coupée, ou
    réglage désactivé → pas de rebond ; le son reste. (6) Fenêtre rapide ouverte puis refermée
    pendant un rebond → le rebond s'arrête, et une demande suivante rebondit de nouveau.
  - CHANGELOG proposé (« Prochaine version ») : « Quand une réponse est finie ou qu'un agent
    attend, fenêtre en arrière-plan, l'icône de Bobine rebondit dans le Dock, même quand macOS
    bloque les notifications (Réglages › Général › Faire rebondir l'icône du Dock). »
    — en (« Next version ») : “When a reply is done or an agent is waiting while the window is in
    the background, Bobine’s icon bounces in the Dock, even when macOS blocks notifications
    (Settings › General › Bounce the Dock icon).”
- 2026-10-21 — **Essai réel partiel** (session principale, app de développement de l'assemblage du
  lot A, vrai Dock, sans `BOBINE_BOUNCE_LOG`). Fenêtre vraiment sans le focus (`open -a Finder`) :
  la demande d'accord appelle `app.dock.bounce('critical')`, que macOS accepte (identifiant 0, puis
  1 et 2 pour les demandes suivantes : 0 est un identifiant valable, seul -1 veut dire refusé). Non
  vu à l'œil (pas de contrôle de l'écran) : le rebond lui-même, ni son arrêt au retour dans l'app,
  que macOS ne laisse pas déclencher depuis l'arrière-plan (`app.focus` et `open -a` ignorés,
  activation coopérative). Les six points ci-dessus restent à regarder par l'utilisateur sur l'app
  installée.
