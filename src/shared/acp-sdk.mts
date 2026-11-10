/**
 * Seul point d'entrée du SDK ACP dans Bobine (ADR-0038, fiche 181). Main, preload, renderer (types
 * seulement), agent factice et sondes importent d'ici : changer de version du SDK, ou revenir à la
 * précédente, ne touche que ce fichier, `package.json` et `pnpm-lock.yaml`. Une règle ESLint
 * refuse tout autre import de `@agentclientprotocol/sdk`.
 *
 * En `.mts` : l'agent factice et les sondes sont lancés par Node sans bundler, qui le charge ainsi
 * comme module ES sans avertissement.
 */
export * from '@agentclientprotocol/sdk/unstable'
