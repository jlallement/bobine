# 205 — Plafond relu quand l'agent est prêt, connexion SSO traduite

- **Statut** : fait
- **Dépend de** : 091 (quota, ADR-0017), 022 (connexion), 200 (connexion expirée au tour),
  ADR-0011 (fonctions propres à un agent), ADR-0014 (textes de l'agent non traduits)
- **Agents** : Bob (seul à lire un quota, seul à nommer une méthode en anglais) ; les deux
  mécanismes sont génériques, déclarés dans le profil (`quotaSource`, `authMethodLabels`)

## Pourquoi

Recette réelle de la 0.11.1 avec IBM Bob 2.0.9, deux défauts :

1. **Plafond jamais affiché.** Bobine lancée alors que Bob était déconnecté : la lecture du quota
   (`bob chat`, `/status`) échoue (« interface jamais prête après 20000 ms ») et pose la pause de
   12 h (D11 de la fiche 091). L'utilisateur se connecte ensuite par SSO : la pause bloque toute
   lecture automatique, journal « lecture du lancement suspendue après un échec récent » ; Mon
   activité montre la consommation, jamais le plafond.
2. **« Log in with SSO » en anglais** dans les cartes « Connexion requise » / « Connexion
   expirée », l'accueil et le Diagnostic, interface en français. C'est le `name` de la méthode
   annoncée par Bob à `initialize` (`authMethods: [{ id: "sso", name: "Log in with SSO" }]`,
   traces `src/main/agent/__traces__/bob-2.0.9/`, `scripts/bob-probe.expected.json`). ADR-0014 :
   l'app ne traduit pas ce que dit l'agent ; mais ici c'est le libellé d'un bouton de l'app.

## Critères d'acceptation

- [x] Un échec de lecture ne supprime plus les lectures pour toute la session : quand l'agent se
      montre prêt (statut « prêt » d'une conversation, essai de l'accueil réussi, Diagnostic
      avec session d'essai ouverte), un quota encore inconnu est relu, malgré la pause.
- [x] Pas de martèlement : au plus une lecture par `RETRY_WHEN_READY_MS` (15 min) par agent sur ce
      chemin ; quota déjà lu dans ce lancement : rien. Lecture réussie : la pause est levée.
- [x] Un profil déclare les libellés traduits de ses méthodes connues (`authMethodLabels`,
      Bob : `sso` → `profiles.authMethod.sso`, « Se connecter par SSO » / « Sign in with SSO ») ;
      méthode inconnue : le nom donné par l'agent.
- [x] Tous les endroits qui montrent le nom : cartes (conversation, accueil — `BlockerPanel`),
      Diagnostic (`diagnostics.ts`) ; tous passent par `sessionBlocker`, seul point modifié.
- [x] Listé dans Réglages › Agents (« Propre à IBM Bob », repère `auth-method-labels`) et dans la
      matrice de `docs/agents.md` (ADR-0011).
- [x] Testé contre l'agent factice : e2e `quota` (pause posée avant le lancement, plafond affiché
      quand l'agent est prêt) et `auth` (bouton « Se connecter par SSO »).

## Plan

- `src/main/agent/quota.ts` : `QuotaReader.agentReady(profileId)` (contourne la pause, garde son
  propre délai `RETRY_WHEN_READY_MS`), `quotaOnReady` (écoute des statuts de conversation),
  `quotaAfterCheck` (Diagnostic) ; `quota-setup.ts` l'expose ; `index.ts` branche les trois
  sources (conversations, accueil par `onReady`, Diagnostic).
- `profiles.ts` : `authMethodLabels` (Bob : `sso` ; agent factice : `mock-sso`) ;
  `session-blocker.ts` : le libellé du profil remplace le nom de l'agent.
- Agent factice : sa méthode SSO s'appelle « Log in with SSO », en anglais quelle que soit sa
  langue, comme Bob 2.0.9 (`docs/mock-agent.md`).
- Aucune nouvelle dépendance.

## Journal

- 2026-11-08 — Fait.
  - Contrat réel : pas de nouvelle sonde ni de vrai Bob lancé ; les traces 2.0.9 déjà relevées
    donnent l'annonce exacte de la méthode. L'échec de lecture du quota est celui du journal de la
    recette (déconnecté → interface jamais prête), que `fakeBob({ connected: false })` rejoue.
  - Échec avant correctif vérifié : tests unitaires `quota.test.ts` (« lancé déconnecté, connecté
    ensuite par SSO… ») et `agent-host.test.ts` (« méthode libellée par le profil… ») ; e2e
    `quota` et `auth` en clair et en sombre, échouant avec le correctif retiré (plafond jamais
    affiché ; bouton « Log in with SSO »), verts avec.
  - Écart : la clé est `profiles.authMethod.sso` (à côté de `profiles.step.*`, libellés déjà
    déclarés par les profils), pas `auth.method.sso`. Anglais « Sign in with SSO » (glossaire de
    `docs/traduction.md` : « se connecter » → *sign in*), pas le « Log in » de Bob.
  - Relecture « prêt » : à chaque passage d'une conversation à « prêt » (fin de tour comprise),
    le coût est un test en mémoire tant que le quota est connu ; inconnu, au plus une lecture par
    15 min. Une lecture ratée sur ce chemin repose la pause de 12 h pour les lancements suivants,
    sans bloquer ce chemin.
