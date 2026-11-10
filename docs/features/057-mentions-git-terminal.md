# 057 — Mentions `@git-changes` et `@terminal`

- **Statut** : fait
- **Dépend de** : 005, 021, 034
- **Agents** : les deux (contenu joint en texte, que tout agent ACP accepte)

## Pourquoi

Pour demander « relis mes modifications » ou « explique cette erreur », il faut aujourd'hui copier
le diff ou la sortie du terminal à la main. Bob IDE propose `@git-changes` et `@terminal` : la
mention joint ce contenu au message.

## Critères d'acceptation

- [x] Le menu `@` propose en tête « Modifications git » (`@git-changes`) et « Terminal »
      (`@terminal`), filtrés comme les fichiers ; les choisir insère la mention et ajoute une
      pièce jointe.
- [x] À l'envoi, l'app joint au message, en texte : l'état git et le diff du dossier depuis le
      dernier commit (fichiers non suivis listés), ou les dernières lignes du terminal de la
      conversation. Contenu lu au moment de l'envoi, borné en taille.
- [x] Sans dépôt git, ou sans terminal ouvert : le message part quand même, l'agent lit pourquoi le
      contenu manque.
- [x] Le fil montre les pièces jointes comme les fichiers (« git-changes », « terminal »).
- [x] Testé : unitaire (lecture du diff, du terminal), agent factice (`echo` décrit le contenu
      reçu), e2e avec captures.

## Plan

1. `shared/attachments.ts` : pièce jointe `{ kind: 'context', source: 'git-changes' | 'terminal' }`.
2. `main/changes/git.ts` : `contextText(workspace)` (état, diff `HEAD`, non suivis ; 100 Ko au
   plus). `main/terminal` : dernières lignes de l'onglet le plus récent de la conversation.
3. `prompt-content.ts` : au moment où le message part vers l'agent, une pièce `context` devient un
   bloc texte (« Contenu de @… ») ; vue `context` dans le fil.
5. `FileMenu` / `Composer` / `useAttachments` : entrées spéciales, puce de pièce jointe.
6. Tests, e2e (`@git-changes` dans un dépôt jetable, `@terminal` après une commande), captures.

## Journal

- 2026-10-14 — Fait. Entrées `@git-changes` et `@terminal` en tête du menu `@` (filtrées par nom
  ou libellé), puces de pièces jointes, contenu lu par le main au moment où le message part vers
  l'agent (`AgentHost.prompt` → `buildPrompt`), en texte. Écart au plan : pas de résolution dans
  l'IPC ; la pièce reste `context` jusqu'à l'envoi réel, donc un message mis en file pendant une
  réponse joint un contenu à jour et redevient modifiable tel quel, et « repartir d'un message »
  relit le contenu. Terminal : l'onglet le plus récent, 200 lignes, sans les icônes des thèmes
  d'invite (zone d'usage privé d'Unicode, trouvées pendant l'essai). Le message apparaît dans le
  fil une fois le contenu lu (le diff d'un gros dépôt peut prendre un instant). Tests : unitaires
  (mentions, lecture du diff dans un dépôt jetable, terminal, bloc texte), e2e `mentions` (dépôt
  modifié, commande lancée dans le terminal, agent factice `echo`), captures `j0`, `j1`. Pas
  d'essai réel : du texte, que tout agent ACP accepte.
