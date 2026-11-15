import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LANG, NEUTRAL_AGENT_ENV, check, root, withApp } from '../lib.mjs'
import { platformFeatures } from '../../src/main/platform.ts'
import { withSystemTexts } from '../../src/shared/i18n/system-texts.ts'

/**
 * Textes de Linux et de Windows (fiches 145 et 229, lot 8 ; D4 de la fiche 145) : la même app,
 * lancée avec les capacités de Linux puis de Windows (`BOBINE_PLATFORM`), ne parle plus du Mac,
 * du Finder, du Dock ni du trousseau macOS dans Réglages (Général, Agents, Notifications, Données) ;
 * sous Linux sans trousseau de session (`basic_text`, simulé avec le faux trousseau des essais), une
 * clé d'API est enregistrée en clair, et la page de l'agent le dit avec de quoi la chiffrer. Sous
 * Linux (Docker), Linux seulement. Les textes du Mac sont vérifiés par les autres suites.
 */
const messages = JSON.parse(
  readFileSync(join(root, 'src', 'shared', 'i18n', 'locales', `${LANG}.json`), 'utf8')
)
const MAC = /\bMac\b|\bFinder\b|\bDock\b|trousseau macOS|macOS Keychain|⌘/

/** Texte d'une clé pour cette plateforme (sans variables), comme l'app l'affiche. */
function text(platform, key) {
  const texts = withSystemTexts(messages, platformFeatures(platform))
  const value = key.split('.').reduce((node, part) => node?.[part], texts)
  if (typeof value !== 'string') throw new Error(`texte inconnu : ${key}`)
  return value
}
/** Le début du texte, avant sa première variable ou son premier signe typographique. */
const head = (value) =>
  value
    .split(/\{\{|[«“]/)[0]
    .trim()
    .slice(0, 40)

export async function textesPlateformeSuite(scheme) {
  console.log(`\n— Textes de Linux et de Windows (${scheme})`)
  for (const platform of process.platform === 'darwin' ? ['linux', 'win32'] : ['linux']) {
    const linux = platform === 'linux'
    const tag = linux ? 'linux' : 'windows'
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const page = `document.querySelector('[data-testid=settings]')?.innerText ?? ''`
        const noMac = async (where) => {
          const shown = await ui.ev(page)
          const word = MAC.exec(shown)?.[0]
          check(!word, `${tag} : ${where} sans texte du Mac${word ? ` (« ${word} »)` : ''}`)
        }
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-general'))
        await ui.waitFor(
          `${page}.includes(${JSON.stringify(text(platform, 'settings.general.keepAwake.hint'))})`
        )
        check(
          (await ui.ev(page)).includes(text(platform, 'settings.general.mac')),
          `${tag} : Réglages › Général, section « ${text(platform, 'settings.general.mac')} »`
        )
        await noMac('Réglages › Général')
        await ui.shot(`textes-${tag}-general`)

        await ui.click(ui.$('settings-notifications'))
        await ui.waitFor(
          `${page}.includes(${JSON.stringify(text(platform, 'settings.notifications.dockBounce.label'))})`
        )
        check(true, `${tag} : ${text(platform, 'settings.notifications.dockBounce.label')}`)
        await noMac('Réglages › Notifications')
        await ui.shot(`textes-${tag}-notifications`)

        await ui.click(ui.$('settings-data'))
        await ui.waitFor(
          `${page}.includes(${JSON.stringify(text(platform, 'settings.data.fresh.agentsLabel'))})`
        )
        check(true, `${tag} : ${text(platform, 'settings.data.fresh.agentsLabel')}`)
        await noMac('Réglages › Données')

        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        const hint = text(platform, 'settings.agents.page.keysHint')
        await ui.waitFor(`${page}.includes(${JSON.stringify(head(hint))})`)
        check(true, `${tag} : clés d’API « ${hint} »`)
        const row = ui.$('api-key-MOCK_AGENT_API_KEY')
        await ui.click(`${row}.querySelector('[data-testid=api-key-edit]')`)
        await ui.waitFor(`!!${ui.$('api-key-value')}`)
        await ui.ev(`${ui.$('api-key-value')}.focus()`)
        await ui.type('cle-de-test-123')
        await ui.enter()
        const state = `(${row}?.querySelector('[data-testid=api-key-state]')?.innerText ?? '')`
        const expected = linux
          ? text(platform, 'settings.apiKeys.plaintextState')
          : text(platform, 'settings.apiKeys.state.stored')
        await ui.waitFor(`${state} === ${JSON.stringify(expected)}`)
        const notice = await ui.ev(
          `${row}.querySelector('[data-testid=api-key-plaintext]')?.innerText ?? ''`
        )
        check(
          linux ? notice.includes('MOCK_AGENT_API_KEY') : !notice,
          linux
            ? `linux sans trousseau : « ${expected} », et dit avec de quoi la chiffrer`
            : `windows : clé « ${expected} », chiffrée (pas d’avis en clair)`
        )
        await ui.ev(`${ui.$('settings-api-keys')}.scrollIntoView({ block: 'center' })`)
        await noMac('Réglages › Agents')
        await ui.shot(`textes-${tag}-cles`)
        await ui.key('Escape')
      },
      undefined,
      'demo',
      {
        ...NEUTRAL_AGENT_ENV,
        BOBINE_PLATFORM: platform,
        // Linux sans trousseau de session (D4), avec le faux trousseau des essais seulement.
        ...(linux ? { BOBINE_KEYCHAIN_BACKEND: 'basic_text' } : {})
      }
    )
  }
}
