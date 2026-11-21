# 273 — 1.1 : montées de version (ADR-0057 accepté, mineures, SDK ACP 2.8, AXe 2, outillage)

- **Statut** : en cours
- **Dépend de** : 252 (rc-D, chaîne d'approvisionnement), 233 (lot 2 des dépendances), 218
  (Dependabot), 217 (avis de licence), 043 (AXe) ; ADR-0057, ADR-0009, ADR-0010 ; audit du
  2026-11-19 (LCM-4, 7, 8, 10, 11)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

La 1.0 est figée (ADR-0057, point 4 : SDK ACP gelé pendant la rc). La branche 1.1 reprend ce qui a
été retenu : les mineures en attente, le SDK ACP 2.8 (schéma 1.33), AXe 2 (LCM-4, hors
Dependabot) et les restes d'outillage de l'audit (LCM-7, 8, 10, 11). L'ADR-0057 est accepté.

## Critères d'acceptation

- [ ] ADR-0057 « accepté » (2026-11-21, accord de Jérôme), index des ADR à jour.
- [ ] Mineures montées, chacune passée par le délai `minimumReleaseAge` de pnpm, sans exception.
- [ ] `@agentclientprotocol/sdk` 2.8.0 exact ; changelog relu ; `pnpm opencode-probe --offline`
      (et en ligne si un modèle gratuit répond) ; `docs/acp.md` à jour si le contrat change.
- [ ] AXe 2.0.4 : version et empreinte de l'archive publiée, notes de version relues, appels
      adaptés, `pnpm fetch-axe`, `pnpm simulator-smoke`, avis de licence.
- [ ] Outillage : ce que la fiche 252 n'a pas fait (runners nommés, sonde MCP, paquets dépréciés).
- [ ] `./scripts/verify` à 0 après chaque lot ; `pnpm e2e --if-needed` (suite complète) à 0.

## Plan

Un commit par lot, `./scripts/verify` entre chaque :

1. **ADR-0057** : statut seulement, index `docs/adr/README.md`.
2. **Mineures** : vitest et `@vitest/coverage-v8` 5.1.1, i18next 27.2.x, react-i18next 18.0.x,
   lucide-react 1.77.x, typescript-eslint 8.73.x, ignore 7.0.16. Pas `typescript` (7 :
   incompatible avec typescript-eslint, pas d'API stable), pas `@types/node` (suit Node 24 de
   `.nvmrc`). Icônes renommées de lucide-react corrigées.
3. **SDK ACP** 2.7.0 → 2.8.0 exact ; adaptations dans le main process seulement.
4. **AXe** 1.8.0 → 2.0.4 : `scripts/fetch-axe` (`AXE_VERSION`, `AXE_SHA256`), archive et licences
   dans `vendor/archives/`, ADR-0009 si besoin, code d'appel et tests.
5. **Outillage** : LCM-7 (version de protocole de la sonde MCP), LCM-8 (paquets dépréciés de
   l'outillage), LCM-10/11 (`.nvmrc`, image Docker, runners).

Aucune nouvelle dépendance.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|

## Journal

- 2026-11-21 : fiche créée ; branche `chore/1.1-lcm` depuis `1.1` (`0458dcc`).
