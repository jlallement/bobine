# ADR-0070 — Montée du SDK ACP pendant une version candidate

- **Statut** : accepté (décision de l'utilisateur du 2026-11-24)
- **Date** : 2026-11-24

## Contexte

L'ADR-0057, point 4, fige `@agentclientprotocol/sdk` pendant une rc, sauf défaut bloquant. La
fiche 278 (lot de maintenance de la rc.4) monte le SDK de 2.7.0 à 2.9.1 sans défaut bloquant :
schéma 1.32 → 1.34 en ajouts seulement, messages traités dans l'ordre d'arrivée. Les sondes
réelles de Bob et d'OpenCode existent et vérifient le contrat de l'app sans rien coûter ; elles
rendent le gel plus prudent que nécessaire. L'utilisateur garde le SDK 2.9.1 pendant la rc.

## Décision

Pendant une version candidate, une montée du SDK ACP est permise si, avec la nouvelle version :
`pnpm bob-probe` et `pnpm opencode-probe` (au moins `--offline`) ont leur contrat de l'app
complet vert, et les suites e2e touchées sont vertes sur GitHub (ADR-0069). La fiche du lot relit
les notes de version et confronte chaque changement au main. Remplace le point 4 de l'ADR-0057.

## Alternatives écartées

- **Garder le gel (ADR-0057, point 4)** — retarde des corrections du SDK alors que les sondes et
  les e2e suffisent à voir une casse du contrat.
- **Monter sans condition** — une rc doit rester stable : les sondes et les e2e restent exigées.

## Conséquences

- Une montée du SDK en rc coûte deux sondes réelles et les suites touchées (le lockfile les
  déclenche toutes) ; un contrat rouge ou une e2e rouge = pas de montée.
- Retour arrière : `git revert` du commit de montée, `pnpm install` (fiche 181).
- L'ADR-0057 est accepté pour le reste ; son point 4 ne s'applique plus.
