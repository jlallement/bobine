# 039 — Commandes de l'app : /compact, /clear, /context, /cost, /model…

- **Statut** : fait
- **Dépend de** : 017, 019

## Pourquoi

Claude Code a ses commandes intégrées (`/compact`, `/clear`, `/context`, `/cost`, `/model`,
`/init`, `/review`…). Par ACP, Bob 2.0.6 n'annonce que ses skills : il faut que l'app fournisse
les commandes courantes elle-même, mélangées dans le même menu `/`.

## Critères d'acceptation

- [x] Commandes de l'app dans le menu `/`, étiquetées « Bob Desktop » (celles de l'agent portent son
      nom) ; celles de l'agent gagnent en cas de nom identique.
- [x] `/clear` (nouvelle conversation, même agent et même dossier), `/context` et `/cost` (bilan dans
      le fil), `/model [nom]` et `/mode [nom]` (liste, ou réglage choisi par son nom), `/help`.
- [x] `/compact` : compaction native de l'agent (Bob `/compress`, OpenCode `/compact`, relevés).
      Écart : pas de compaction faite par l'app pour un agent qui n'en aurait pas.
- [x] `/init` (créer ou compléter `AGENTS.md`), `/review` (revue des modifications en cours) :
      consignes envoyées à l'agent.
- [x] Testé : unitaires ; agent factice (`/compact` → scénario de compaction) ; e2e ; Bob et OpenCode
      réels pour la compaction (sondes).

## Relevé (2026-10-12)

- **Bob 2.0.6** : `/compress` envoyé en texte par ACP marche (« Context compressed. », ≈ 1 s), bien
  qu'absent de ses commandes annoncées ; `/stats` n'existe pas (le message part au modèle). Sonde :
  ≈ 0,01 bobcoin.
- **OpenCode 1.18.31** : `/compact` en texte marche aussi sans être annoncé (résumé structuré ; contexte
  7 861 → 483 jetons d'après `usage_update`).

## Plan

- `shared/app-commands.ts` : commandes de l'app, fusion avec celles de l'agent (l'agent gagne à nom
  égal), lecture d'une saisie `/nom arguments`, résumé de consommation, choix d'une option par nom.
- Profil d'agent : `compactCommand` (Bob `/compress`, OpenCode `/compact`, agent factice `/compact`) ;
  une commande `compact` / `compress` annoncée par l'agent passe avant. Exposé dans l'instantané.
- Composer : menu `/` commun (étiquette « app » pour celles de l'app) ; une commande de l'app est
  traitée par l'app et n'est pas envoyée telle quelle.
- `/clear` (nouvelle conversation, même agent et dossier), `/compact` (commande de l'agent),
  `/context` et `/cost` (bilan dans le fil, rien n'est envoyé), `/model [nom]` et `/mode [nom]`
  (sans argument : la liste ; avec : le réglage choisi), `/help`, `/init` et `/review` (consignes
  envoyées à l'agent).
- Écart : pas de compaction faite par l'app pour un agent qui n'en a pas (aucun des agents proposés
  n'est dans ce cas) : `/compact` le dit simplement.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-12 — Implémenté comme prévu : `shared/app-commands.ts`, `compactCommand` des profils et de
  l'instantané, Composer (commande de l'app traitée par l'app, aussi pendant une réponse), étiquette
  d'origine dans le menu, `App.runAppCommand`, notices d'information multilignes en bloc. Tests :
  fusion, lecture de la saisie, bilan, choix d'option ; e2e `commandsSuite` (12 commandes dont 9 de
  l'app, `/context`, `/mode`, `/mode plan`, `/help`, `/compact`, `/clear` ; capture `30-commandes-app`).
- 2026-10-13 — Fiche 045 : commandes personnelles et du projet mêlées au même menu ; priorité agent
  > utilisateur / projet > app (`mergeCommands`, `appCommandOf` étendus).
