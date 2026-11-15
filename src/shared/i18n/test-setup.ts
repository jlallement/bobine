/**
 * Tests du main, du preload et du code partagé (projet « node ») : textes de l'interface en
 * français, comme dans l'app par défaut (fiche 074).
 */
import i18next from 'i18next'
import { i18nOptions, typography } from './index'

void i18next.use(typography).init(i18nOptions('fr'))

// Sous Windows, les dépôts d'essai ne suivent pas la configuration système de git : l'installeur
// de Git for Windows (et MinGit) y met `core.autocrlf=true`, qui sortirait leurs fichiers en CRLF
// alors que les essais vérifient le cycle des worktrees, pas les fins de ligne (essayées à part,
// `git-platform.test.ts`). macOS et Linux : rien de changé (fiche 229, lot 7a).
if (process.platform === 'win32') process.env['GIT_CONFIG_NOSYSTEM'] = '1'
