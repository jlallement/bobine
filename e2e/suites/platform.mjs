import { NEUTRAL_AGENT_ENV, check, withApp } from '../lib.mjs'

/**
 * Capacités de la plateforme (fiche 145) : la même app, lancée avec les capacités du Mac puis avec
 * celles de Linux (`BOBINE_PLATFORM`), montre ou masque ce qui n'existe que sur macOS : onglet du
 * simulateur dans le « + » du panneau, capture d'écran de la zone de saisie, groupe iOS du
 * Diagnostic. Jouable sur le Mac comme sous Linux.
 */
export async function platformSuite() {
  console.log('\n— Capacités de la plateforme')
  for (const platform of ['darwin', 'linux']) {
    const mac = platform === 'darwin'
    await withApp(
      'light',
      async (ui) => {
        await ui.ready()
        check(
          (await ui.ev(`!!${ui.$('capture')}`)) === mac,
          `${platform} : capture d’écran ${mac ? 'proposée' : 'masquée'} dans la zone de saisie`
        )

        await ui.click(ui.$('panel-toggle'))
        await ui.waitFor(`!!${ui.$('side-panel')}`)
        await ui.click(ui.$('panel-more'))
        await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
        const tabs = await ui.ev(
          `[...${ui.$('panel-more-menu')}.querySelectorAll('[data-tab]')].map((i) => i.dataset.tab).join(' ')`
        )
        check(
          tabs.split(' ').includes('simulator') === mac && tabs.split(' ').includes('browser'),
          `${platform} : simulateur iOS ${mac ? 'proposé' : 'absent'} dans le « + » du panneau (${tabs})`
        )
        await ui.key('Escape')

        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-diagnostics'))
        await ui.waitFor(
          `!!${ui.$('diagnostics')} && !document.querySelector('[data-testid=diag-check][data-level=pending]')`,
          30_000
        )
        const groups = await ui.ev(
          `[...document.querySelectorAll('[data-testid^=diag-group-]')].map((g) => g.dataset.testid.slice(11)).join(' ')`
        )
        check(
          groups.split(' ').includes('ios') === mac && groups.split(' ').includes('android'),
          `${platform} : groupe iOS du Diagnostic ${mac ? 'présent' : 'absent'} (${groups})`
        )
      },
      undefined,
      'demo',
      { ...NEUTRAL_AGENT_ENV, BOBINE_PLATFORM: platform }
    )
  }
}
