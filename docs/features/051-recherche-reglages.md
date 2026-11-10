# 051 — Recherche dans les réglages

- **Statut** : fait
- **Dépend de** : 027

## Pourquoi

Retour de l'utilisateur (2026-10-14) : huit sections de réglages, sans moyen de trouver où se
trouve un réglage. Comme les réglages de macOS ou de Claude Desktop : un champ de recherche.

## Critères d'acceptation

- [x] Champ « Rechercher » en haut de la liste des sections ; ⌘F y mène quand les réglages sont
      ouverts.
- [x] Les résultats (sans casse ni accents, tous les mots) remplacent la section : libellé du
      réglage et sa section (son explication se voit à l'arrivée) ; aucun résultat : dit
      clairement.
- [x] Un clic (ou Entrée sur le premier) ouvre la section, amène le réglage à l'écran et le fait
      ressortir un instant ; Échap vide le champ sans fermer les réglages.
- [x] Les raccourcis clavier sont cherchables (leur libellé et leurs touches).
- [x] L'index ne peut pas oublier un réglage : un test rend chaque section et vérifie que chaque
      libellé affiché est dans l'index.
- [x] e2e et captures claires et sombres regardées.

## Plan

1. `renderer/src/settings-search.ts` : index des réglages (section, libellé, mots-clés),
   raccourcis tirés de `shared/shortcuts.ts`, recherche pliée (`shared/conversation-search.ts`).
2. `SettingsDialog.tsx` : champ, liste des résultats, ouverture et mise en avant du réglage.
3. Styles ; tests (index, recherche, synchronisation avec les sections rendues) ; e2e `settings`.

Aucune nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée à la demande de l'utilisateur.
- 2026-10-14 — **Fait.**
  - `renderer/src/settings-search.ts` : `SETTINGS_INDEX` (libellés tels qu'affichés, section,
    mots-clés ; raccourcis tirés de `shared/shortcuts.ts`), `searchSettings` (pli sans casse ni
    accents de `shared/conversation-search.ts`, `hasAllWords` ajouté ; libellés qui suffisent
    d'abord), `SETTINGS_SECTION_LABELS` (repris par la liste des sections).
  - `SettingsDialog.tsx` : champ en haut de la liste des sections, résultats à la place de la
    section, Entrée ouvre le premier, Échap vide d'abord le champ (`onEscapeKeyDown`), ⌘F y mène ;
    à l'ouverture, le réglage est amené à l'écran et ressort 1,6 s (`settings-flash`).
  - Tests : `settings-search.test.ts` (accents, mots-clés, touches, ordre) ;
    `SettingsDialog.test.tsx` : chaque libellé de ligne et chaque sous-titre affichés dans
    Général, Conversation, Terminal, Agents est dans l'index (un réglage ajouté sans entrée fait
    échouer le test), parcours résultat → section → mise en avant, aucun résultat, Entrée.
  - e2e `settings` : ⌘F, « veille », Entrée → Général, réglage mis en avant ; Échap vide le champ
    sans fermer ; suites qui passent par les réglages (`user-commands`, `mcp`, `auth`,
    `notifications`, `export`) vertes. Capture 85 regardée en clair et en sombre.
  - Limite : les serveurs MCP et les commandes ne sont cherchables que par leur section (leurs
    listes dépendent de la machine).
- 2026-10-23 (écart, fiche 126) : l'index comprend aussi les fonctions « Propre à … » des agents
  installés, lues de leur profil ; un résultat montre l'agent (« Agents et dossiers › IBM Bob »).
