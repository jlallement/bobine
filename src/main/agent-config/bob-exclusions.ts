/**
 * Fichiers d'exclusion de Bob (fiche 155), tels que son profil les déclare (`ExclusionSource`).
 * Bob 2.0.6 (ordre non vérifié en réel, voir docs/acp.md) : pour un fichier du dossier de travail, `.gitignore` (réglage
 * `respectGitIgnore`, vrai par défaut ; Bobine ne lit pas ce réglage) puis `.bobignore` de chaque
 * dossier, de la racine à celui du fichier, avec la bibliothèque `ignore` ; `.env` toujours. Il
 * refuse alors de lire ou d'écrire le fichier. Rien n'est connu de ce qu'il fait du texte du message.
 */
import { t } from 'i18next'
import type { ExclusionSource } from '../agent/adapters'

export const BOB_EXCLUSIONS: ExclusionSource = {
  summary: () => t('capabilities.ignoreFiles.bob'),
  files: ['.gitignore', '.bobignore'],
  always: ['.env']
}
