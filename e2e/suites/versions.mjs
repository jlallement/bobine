import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Versions de l'agent (fiche 198), avec l'agent factice (versions essayées 0.1.0, plancher 0.0.5) :
 * version plus récente → avis gris une seule fois (pas dans une autre conversation, pas après un
 * redémarrage), lien « Diagnostic » ; plus ancienne → avertissement ; sous le plancher ou protocole
 * ACP incompatible → démarrage refusé, expliqué.
 */
export async function versionsSuite(scheme) {
  console.log(`\n— Versions de l’agent (${scheme})`)
  const agent = L('profiles.mock.label')
  const notices = (ui) =>
    ui.ev(`[...document.querySelectorAll('.notice')].map((n) => n.innerText).join('\\n')`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-versions-'))
  const newer = L('agentHost.version.newer', { named: `${agent} 0.2.0`, newest: '0.1.0' })
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Bonjour')
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 1`)
        await ui.ready()
        const shown = await notices(ui)
        check(
          shown.includes(newer) && shown.split(newer).length === 2,
          'version plus récente : avis gris, une fois'
        )
        check(
          (await ui.ev(`${ui.$('notice-link')}.innerText`)) ===
            L('transcript.notice.diagnosticsLink') &&
            (await ui.ev(`!!document.querySelector('.notice-info [data-testid=notice-link]')`)),
          'lien « Diagnostic » à la suite de l’avis'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('versions-1-plus-recente')

        await ui.click(ui.$('notice-link'))
        await ui.waitFor(`!!${ui.$('diagnostics')}`)
        check(true, 'le lien ouvre Réglages › Diagnostic')
        await ui.press('Escape')
        await ui.waitFor(`!${ui.$('diagnostics')}`)

        // Autre conversation, même agent et même version : rien.
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.ready()
        await ui.send('Encore')
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 1`)
        await ui.ready()
        check(!(await notices(ui)).includes(newer), 'autre conversation : pas d’avis à nouveau')
      },
      userData,
      'version-plus-recente'
    )
    // Même profil, après un redémarrage : toujours rien.
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Après redémarrage')
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 1`)
        await ui.ready()
        check(!(await notices(ui)).includes(newer), 'après un redémarrage : pas d’avis à nouveau')
      },
      userData,
      'version-plus-recente'
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }

  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.send('Bonjour')
      await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 1`)
      await ui.ready()
      const older = L('agentHost.version.older', {
        named: `${agent} 0.0.8`,
        agent,
        oldest: '0.1.0'
      })
      check(
        (await ui.ev(`document.querySelector('.notice-warning')?.innerText ?? ''`)) === older,
        'version plus ancienne : avertissement, l’agent répond quand même'
      )
      await ui.hover({ x: 5, y: 400 })
      await ui.shot('versions-2-plus-ancienne')
    },
    undefined,
    'version-plus-ancienne'
  )

  const refused = async (scenario, detail, name) => {
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('restart')}`)
        const text = await ui.ev(`document.querySelector('.notice-error')?.innerText ?? ''`)
        check(
          text === L('transcript.notice.failedDetail', { detail }) &&
            // Un seul avis (fiche 194 : le même arrêt réannoncé n'en ajoute pas).
            (await ui.ev(`document.querySelectorAll('.notice-error').length`)) === 1 &&
            (await ui.ev(`document.querySelector('.composer-status.error').innerText`)).includes(
              L('composer.failedToStart')
            ),
          `${scenario} : démarrage refusé, expliqué ; « Relancer » sous la saisie`
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot(name)
      },
      undefined,
      scenario,
      {},
      [],
      { startError: true }
    )
  }
  await refused(
    'version-trop-ancienne',
    L('agentHost.version.belowFloor', { named: `${agent} 0.0.1`, agent, floor: '0.0.5' }),
    'versions-3-sous-le-plancher'
  )
  await refused(
    'protocole-incompatible',
    L('agentHost.protocol.tooNew', {
      named: `${agent} 0.1.0`,
      agent,
      announced: '2',
      supported: '1'
    }),
    'versions-4-protocole'
  )
}
