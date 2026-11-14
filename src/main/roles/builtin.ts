/**
 * Les sept rôles fournis par Bobine (fiche 223, décision 3) : actifs d'office, désactivables ; un
 * rôle personnel ou du projet du même nom les remplace. Aucun ne nomme d'agent, de mode ni de
 * modèle : ils marchent avec tous (ADR-0011).
 *
 * Libellé, description et consigne suivent la langue de l'interface au moment de la lecture
 * (ADR-0046, exception à ADR-0014) : textes dans `builtin-en.ts` et `builtin-fr.ts`. La liste est
 * relue à chaque demande ; un rôle déjà figé (carte de proposition, fille en cours) garde la sienne.
 */
import { t } from 'i18next'
import type { Language } from '@shared/i18n'
import { frenchSpaces } from '@shared/i18n/typography'
import type { RoleDefinition, Role } from '@shared/roles'
import { currentLanguage } from '../i18n'
import { BUILTIN_EN, BUILTIN_NAMES, type BuiltinName, type BuiltinTexts } from './builtin-en'
import { BUILTIN_FR } from './builtin-fr'

/** Ce qui ne dépend pas de la langue. */
const LOOKS: Record<BuiltinName, Pick<RoleDefinition, 'icon' | 'color' | 'readOnly'>> = {
  'ux-ui-expert': { icon: 'palette', color: 'pink', readOnly: false },
  'flutter-expert': { icon: 'smartphone', color: 'blue', readOnly: false },
  'front-architect': { icon: 'layout-dashboard', color: 'violet', readOnly: false },
  'back-architect': { icon: 'server', color: 'green', readOnly: false },
  'security-expert': { icon: 'shield-check', color: 'orange', readOnly: true },
  'tech-lead': { icon: 'compass', color: 'graphite', readOnly: true },
  'code-reviewer': { icon: 'scan-search', color: 'blue', readOnly: true }
}

/** Libellés traduits (affichés) ; les clés suivent le nom du rôle. */
const LABELS: Record<BuiltinName, (lng: Language) => string> = {
  'ux-ui-expert': (lng) => t('roles.builtin.uxUiExpert', { lng }),
  'flutter-expert': (lng) => t('roles.builtin.flutterExpert', { lng }),
  'front-architect': (lng) => t('roles.builtin.frontArchitect', { lng }),
  'back-architect': (lng) => t('roles.builtin.backArchitect', { lng }),
  'security-expert': (lng) => t('roles.builtin.securityExpert', { lng }),
  'tech-lead': (lng) => t('roles.builtin.techLead', { lng }),
  'code-reviewer': (lng) => t('roles.builtin.codeReviewer', { lng })
}

const TEXTS: Record<Language, BuiltinTexts> = { fr: BUILTIN_FR, en: BUILTIN_EN }

/** Typographie de la langue : insécables du français (les textes s'écrivent avec des espaces). */
const TYPOGRAPHY: Record<Language, (text: string) => string> = {
  fr: frenchSpaces,
  en: (text) => text
}

/** Rôles fournis dans une langue : par défaut, celle de l'interface au moment de l'appel. */
export function builtinRoles(language: Language = currentLanguage()): Role[] {
  const texts = TEXTS[language]
  const typography = TYPOGRAPHY[language]
  return BUILTIN_NAMES.map((name) => ({
    name,
    label: LABELS[name](language),
    ...LOOKS[name],
    description: typography(texts[name].description),
    prompt: typography(texts[name].prompt.join('\n')),
    scope: 'builtin'
  }))
}
