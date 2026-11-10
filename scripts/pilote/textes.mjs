/**
 * Textes de l'interface dans la langue de Bobine, comme `L('clé')` des essais e2e
 * (`e2e/lib.mjs`) : le pilote vise un bouton par son libellé traduit, jamais par un texte en dur.
 * La langue est lue dans la page (`<html lang>`), pas supposée.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const locales = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'shared', 'i18n')
const cache = new Map()

/** Langue prise en charge la plus proche : `fr-FR` → `fr`, inconnue → `en`. */
export const baseLanguage = (lang) => {
  const base = String(lang ?? 'fr')
    .toLowerCase()
    .split('-')[0]
  return ['fr', 'en'].includes(base) ? base : 'en'
}

function messages(lang) {
  const base = baseLanguage(lang)
  if (!cache.has(base)) {
    cache.set(base, JSON.parse(readFileSync(join(locales, 'locales', `${base}.json`), 'utf8')))
  }
  return cache.get(base)
}

/**
 * Typographie du français comme l'app l'affiche (`src/shared/i18n/typography.ts`, fiche 126) :
 * élisions et espaces insécables. Mêmes expressions (vérifié par `textes.test.ts`).
 */
export const frenchTypography = (text) =>
  text
    .replace(/(?<![\p{L}\p{N}_’'])(de|que) (?=[AEIOUYÀÂÆÉÈÊËÎÏÔŒÛÜ])/gu, (_, word) =>
      word === 'de' ? 'd’' : 'qu’'
    )
    .replace(/ ([:;?!%»])/g, ' $1')
    .replace(/« /g, '« ')

/** Texte d'une clé dans la langue donnée (variables `{{nom}}`, pluriel d'après `count`). */
export function L(key, lang, params = {}) {
  const base = baseLanguage(lang)
  const lookup = (k) => k.split('.').reduce((node, part) => node?.[part], messages(base))
  const plural =
    typeof params.count === 'number'
      ? lookup(`${key}_${new Intl.PluralRules(base).select(params.count)}`)
      : undefined
  const value = plural ?? lookup(key)
  if (typeof value !== 'string') throw new Error(`texte inconnu : ${key}`)
  const text = value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => String(params[name] ?? ''))
  return base === 'fr' ? frenchTypography(text) : text
}

/**
 * Onglets du panneau de droite : nom tapé par l'utilisateur du pilote (français ou anglais, sans
 * accents) → identifiant de l'onglet (`data-tab`, clé `panel.tab.<id>`).
 */
export const PANEL_TABS = {
  session: 'session',
  terminal: 'terminal',
  navigateur: 'browser',
  browser: 'browser',
  ios: 'simulator',
  simulateur: 'simulator',
  simulator: 'simulator',
  android: 'android',
  taches: 'tasks',
  tasks: 'tasks',
  modifications: 'changes',
  changes: 'changes',
  acp: 'acp'
}

/** Nom d'onglet normalisé (minuscules, sans accents). */
export const panelTab = (name) =>
  PANEL_TABS[String(name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()]
