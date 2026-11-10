import { L, Lpart, check, withApp } from '../lib.mjs'

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
    check(
      (await ui.ev(`document.querySelector('.acp-foot').innerText`)).includes(Lpart('acpTab.foot')),
      'pied : clés et jetons masqués, derniers messages en mémoire seulement'
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
    const prompt = await ui.ev(`${rowOf('session/prompt')}?.innerText ?? ''`)
    check(
      prompt.includes('→') && /#\d+/.test(prompt),
      `→ session/prompt, avec son identifiant (${prompt.replace(/\s+/g, ' ')})`
    )
    const permission = await ui.ev(`${rowOf('session/request_permission')}?.innerText ?? ''`)
    check(
      permission.includes('←') && /#\d+/.test(permission),
      `← session/request_permission (${permission.replace(/\s+/g, ' ')})`
    )
    const answered = await ui.ev(`${answer}.innerText`)
    check(
      answered.includes('→') && /\d\s?(ms|s)\b/.test(answered.replace(/\s+/g, ' ')),
      `réponse à la permission → vers l’agent, option choisie et durée (${answered.replace(/\s+/g, ' ')})`
    )
    check(
      (await ui.ev(`${whats}.includes('tool_call') && ${whats}.includes('tool_call_update')`)) &&
        (await ui.ev(`/\\d{2}:\\d{2}:\\d{2}\\.\\d{3}/.test(${rowOf('tool_call')}.innerText)`)),
      'tool_call et ses mises à jour, heure à la milliseconde'
    )
    const grouped = `${rows}.find((r) => r.dataset.grouped && r.dataset.what.startsWith('agent_message_chunk ×'))`
    check(
      (await ui.ev(`!!${grouped}`)) &&
        (await ui.ev(`${grouped}.innerText`)).includes(L('acpTab.grouped')),
      `morceaux de texte regroupés (${await ui.ev(`${grouped}?.dataset.what`)})`
    )
    // Un message d'un seul morceau reste seul (l'anglais de l'agent factice est plus court) : ce qui
    // compte, c'est que deux morceaux qui se suivent ne soient jamais sur deux lignes.
    check(
      await ui.ev(
        `${whats}.every((w, i, all) => w !== 'agent_message_chunk' || all[i + 1] !== 'agent_message_chunk')`
      ),
      'aucun morceau seul quand « Regrouper les morceaux » est activé'
    )

    // Un clic déplie le JSON brut, indenté et coloré.
    await ui.click(rowOf('tool_call'))
    await ui.waitFor(`!!${ui.$('acp-json')}`)
    const json = await ui.ev(`${ui.$('acp-json')}.innerText`)
    check(
      json.includes('"sessionUpdate": "tool_call"') &&
        json.includes('\n  "params": {') &&
        (await ui.ev(`!!${ui.$('acp-json')}.querySelector('.acp-json-key')`)),
      'clic : le JSON brut se déplie, indenté et coloré'
    )
    await ui.shot('acp-1-json')
    await ui.click(rowOf('tool_call'))
    await ui.waitFor(`!${ui.$('acp-json')}`)

    // Le groupe se déplie : un morceau par ligne.
    const count = Number((await ui.ev(`${grouped}.dataset.what`)).split('×')[1])
    await ui.click(grouped)
    await ui.waitFor(`!!${ui.$('acp-chunks')}`)
    check(
      (await ui.ev(`${ui.$('acp-chunks')}.querySelectorAll('.acp-row').length`)) === count,
      `groupe déplié : ses ${count} morceaux`
    )
    await ui.shot('acp-2-groupe')
    await ui.click(grouped)

    // Sans regroupement, chaque morceau a sa ligne.
    const before = await ui.ev(`${rows}.length`)
    await ui.click(ui.$('acp-group'))
    await ui.waitFor(`${rows}.length > ${before}`)
    check(
      (await ui.ev(`${whats}.includes('agent_message_chunk')`)) &&
        !(await ui.ev(`${rows}.some((r) => r.dataset.grouped)`)),
      '« Regrouper les morceaux » décoché : un morceau par ligne'
    )
    await ui.click(ui.$('acp-group'))

    // Filtre.
    await ui.click(ui.$('acp-filter'))
    await ui.ev(`${ui.$('acp-filter')}.focus()`)
    await ui.type('request_permission')
    await ui.waitFor(`${rows}.length === 1`)
    check(
      (await ui.ev(`${whats}[0]`)) === 'session/request_permission',
      'filtre : seule la ligne de la méthode cherchée reste'
    )
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
    check((await ui.ev(`${rows}.length`)) === frozen, 'en pause : la liste ne bouge plus')
    await ui.click(ui.$('acp-pause'))
    await ui.waitFor(`${rows}.length > ${frozen}`)
    check(true, 'reprise : les messages arrivés entre-temps apparaissent')
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    await ui.shot('acp-4-liste')
  })
}
