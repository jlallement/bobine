# 005 — Images et fichiers dans le message

- **Statut** : fait
- **Dépend de** : 003

## Pourquoi

Dans Claude Code et Claude Desktop, on colle une capture, on glisse un fichier ou on mentionne un
fichier du projet avec `@`. L'agent reçoit le contenu sans qu'on ait à le décrire.

## Critères d'acceptation

- [x] Coller une image (Cmd+V) ou la glisser dans la zone de saisie : vignette, retrait possible.
- [x] Glisser un fichier texte : envoyé comme ressource (`resource` / `resource_link`).
- [x] `@` ouvre une recherche des fichiers du dossier (respect du `.gitignore`), insère une mention.
- [x] N'envoyer que ce que l'agent accepte (`promptCapabilities` : `image`, `embeddedContext`) ; sinon message clair.
- [x] Images et mentions visibles dans le fil, y compris après rechargement de la conversation.
- [x] Testé : agent factice (qui décrit ce qu'il reçoit) ; e2e ; Codex et Bob réels.
- [ ] Claude Code et OpenCode réels ; glisser-déposer réel depuis le Finder (non automatisable en e2e).

## Notes

Bob annonce `image` et `embeddedContext` (2.0.6). La lecture des fichiers se fait dans le main ; le renderer ne touche pas au disque.

## Plan

- `src/shared/attachments.ts` — types (`PromptAttachment` du renderer, `AttachmentView` du fil),
  validation côté main (`parseAttachments` : 10 au plus, images PNG / JPEG / GIF / WebP ≤ 5 Mo, chemins
  absolus), mentions `@` (`mentionAt`, `insertMention`).
- `src/main/agent/prompt-content.ts` — blocs ACP : `image` ; fichier texte ≤ 256 Kio → `resource`
  (si `embeddedContext`) ; sinon `resource_link`. Refus clair si l'agent n'accepte pas les images.
- `src/main/workspace-files.ts` — fichiers du dossier pour `@` : `git ls-files` (respecte le
  `.gitignore`), sinon parcours borné (saute `node_modules`, `.git`, fichiers cachés…), cache 15 s.
- IPC : `agent:prompt` prend les pièces jointes ; `workspace:searchFiles`, `workspace:pickFiles` (le
  renderer désigne une conversation, le main en déduit le dossier). Preload : chemin d'un fichier
  glissé (`webUtils.getPathForFile`) — le renderer ne lit jamais le disque.
- Renderer : `useAttachments` (images lues en mémoire, fichiers par chemin), `FileMenu`, vignettes et
  pastilles dans la zone de saisie et dans le fil ; trombone, coller, glisser-déposer, `@`.
- Instantané : `promptCapabilities` de l'agent. Fil : pièces jointes rattachées au message, y compris au
  rejeu (`user_message_chunk` image / ressource / lien).

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Implémenté. 194 tests ; `pnpm e2e` (image collée, `@app` → fichier proposé puis joint,
  l'agent factice reçoit l'image et le contenu du fichier, affichage dans le fil), clair et sombre.
  Agent factice : `--sans-images` (agent texte seul), rejeu de tous les blocs de l'utilisateur.
  - **Essai réel Codex** et **Bob** : carré rouge collé + `@secret.md` (« Le mot secret est : kiwi »)
    → « L'image est rouge et le mot secret est « kiwi » » (Codex) ; « La couleur de l'image est rouge
    et le mot secret est kiwi » (Bob, 0,021 bobcoin).
  - Défaut corrigé : une image minuscule s'affichait comme un trait dans le fil (taille minimale).
- 2026-10-13 — Glisser-déposer sur **toute la conversation** (fil et zone de saisie, et la
  conversation d'à côté), plus seulement la zone de saisie : `useFileDrop` sur la zone principale,
  les fichiers vont à la zone de saisie (`FilesInbox`) ; indication « Déposez pour joindre au
  message » pendant le survol. e2e `attachments` : vrai glisser-déposer de Chromium au milieu du
  fil, puis sur la zone de saisie.
- 2026-10-23 (écart, fiche 126) : la recherche des mentions `@` classe d'abord les préfixes (nom,
  segment du chemin, mot du nom) ; les lettres dans l'ordre ne servent qu'en repli.
