import { L, check, withApp } from '../lib.mjs'

/** Onglet « Échanges ACP » du panneau (fiche 135), journal au niveau Normal. */
export async function acpSuite(scheme) {
  console.log(`\n— Échanges ACP (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    const rows = `[...document.querySelectorAll('[data-testid=acp-row]')]`
    const whats = `${rows}.map((r) => r.dataset.what)`
    const rowOf = (what) => `${rows}.find((r) => r.dataset.what === ${JSON.stringify(what)})`

    await ui.click(ui.$('panel-toggle'))
    await ui.waitFor(`!!${ui.$('side-panel')}`)
    await ui.click(ui.$('panel-more'))
    await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
    await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=acp]')`)
    await ui.waitFor(`!!${ui.$('acp-tab')}`)
    // Démarrage de l'agent, avant l'ouverture de l'onglet : déjà gardé en mémoire.
    await ui.waitFor(`${whats}.includes('initialize') && ${whats}.includes('session/new')`)
    check(
      (await ui.ev(`document.querySelector('.side-panel-tab.active')?.dataset.tab`)) === 'acp',
      'outil « Échanges ACP » ouvert par le « + » du panneau, démarrage de l’agent déjà là'
    )

    // Tour `demo` : réflexion, texte, outils, permission.
    await ui.send('Bonjour')
    await ui.waitFor(`!!${ui.$('permission')}`)
    await ui.waitFor(`${whats}.includes('session/request_permission')`)
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    const response = L('acpTab.response', { id: '' })
    const answer = `${rows}.find((r) => r.dataset.direction === 'out' && r.dataset.what.startsWith(${JSON.stringify(response)}) && r.innerText.includes('allow'))`
    await ui.waitFor(`!!${answer}`)
    const grouped = `${rows}.find((r) => r.dataset.grouped && r.dataset.what.startsWith('agent_message_chunk ×'))`

    // Un clic déplie le JSON brut, indenté et coloré.
    await ui.click(rowOf('tool_call'))
    await ui.waitFor(`!!${ui.$('acp-json')}`)
    await ui.shot('acp-1-json')
    await ui.click(rowOf('tool_call'))
    await ui.waitFor(`!${ui.$('acp-json')}`)
    await ui.click(grouped)
    await ui.waitFor(`!!${ui.$('acp-chunks')}`)
    await ui.shot('acp-2-groupe')
    await ui.click(grouped)

    // Sans regroupement, chaque morceau a sa ligne.
    const before = await ui.ev(`${rows}.length`)
    await ui.click(ui.$('acp-group'))
    await ui.waitFor(`${rows}.length > ${before}`)
    await ui.click(ui.$('acp-group'))

    // Filtre.
    await ui.click(ui.$('acp-filter'))
    await ui.ev(`${ui.$('acp-filter')}.focus()`)
    await ui.type('request_permission')
    await ui.waitFor(`${rows}.length === 1`)
    await ui.shot('acp-3-filtre')
    // Texte sélectionné remplacé : un filtre plus large, qui cherche aussi dans le texte brut.
    await ui.ev(`${ui.$('acp-filter')}.select()`)
    await ui.type('session/')
    await ui.waitFor(`${whats}.includes('session/new') && ${whats}.includes('tool_call')`)

    // Pause : les messages du tour suivant attendent la reprise.
    await ui.click(ui.$('acp-pause'))
    const frozen = await ui.ev(`${rows}.length`)
    await ui.send('Encore')
    await ui.waitFor(`!!${ui.$('permission')}`)
    await ui.waitFor(`!!${ui.$('acp-waiting')}`)
    await ui.click(ui.$('acp-pause'))
    await ui.waitFor(`${rows}.length > ${frozen}`)
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    await ui.shot('acp-4-liste')
  })
}
