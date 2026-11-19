/**
 * Fichiers d'exclusion de Bob (fiche 155), tels que son profil les déclare (`ExclusionSource`).
 * Documenté par IBM (« Ignoring files ») : `.bobignore`, syntaxe de `.gitignore` ; un fichier exclu
 * n'est ni lu, ni écrit, ni supprimé par ses outils de fichiers. Non documenté et non vérifié en
 * réel : la prise en compte de `.gitignore` et de `.env` ; Bobine les compte quand même, par
 * prudence (voir « Fichiers d'exclusion » dans docs/acp.md). Inconnu : ce que Bob fait du texte du
 * message.
 */
import { t } from 'i18next'
import type { ExclusionSource } from '../agent/adapters'

export const BOB_EXCLUSIONS: ExclusionSource = {
  summary: () => t('capabilities.ignoreFiles.bob'),
  files: ['.gitignore', '.bobignore'],
  always: ['.env']
}
