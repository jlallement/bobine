/**
 * Tests du main, du preload et du code partagé (projet « node ») : textes de l'interface en
 * français, comme dans l'app par défaut (fiche 074).
 */
import i18next from 'i18next'
import { i18nOptions, typography } from './index'

void i18next.use(typography).init(i18nOptions('fr'))
