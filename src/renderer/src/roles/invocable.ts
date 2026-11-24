/**
 * Rôles qu'on invoque (barre Équipe, mentions `@`) : activés, sauf un rôle interne de l'app
 * (`Role.internal`, le « Participant » du tour de table, fiche 285), qui reste dans Réglages ›
 * Rôles pour « Installer dans… ».
 */
export const invocableRole = (role: { enabled: boolean; internal?: boolean }): boolean =>
  role.enabled && !role.internal
