import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

/**
 * Modifications d'une conversation rouverte après redémarrage (fiche 096) : au rejeu, OpenCode ne
 * joint plus le diff d'un fichier modifié depuis ; l'app le refait depuis le patch gardé par
 * l'outil (`rawOutput.metadata.files[].patch`), et l'onglet Modifications reste complet.
 */
export async function replayChangesSuite(scheme) {
  console.log(`\n— Modifications après redémarrage (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-rejeu-'))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-rejeu-donnees-'))
  writeFileSync(join(workspace, 'README.md'), '# Projet\n\nVersion 1\n')
  const env = { BOBINE_WORKSPACE: workspace }
  /** En-tête (« 3 +20 −1 ») et fichiers de la vue « Conversation ». */
  const changes = async (ui) => {
    await ui.waitFor(`!!${ui.$('changes-toggle')}`)
    const header = await ui.ev(`${ui.$('changes-toggle')}.innerText.replace(/\\s+/g, ' ').trim()`)
    // Le panneau peut être resté ouvert d'un lancement à l'autre : on ne l'ouvre que s'il le faut.
    if (!(await ui.ev(`!!${ui.$('changes-tab')}`))) await ui.click(ui.$('changes-toggle'))
    await ui.waitFor(`!!${ui.$('changes-tab')}`)
    const files = await ui.ev(
      `[...document.querySelectorAll('[data-testid=changes-file]')].map((f) => f.querySelector('.changes-toggle').innerText.replace(/\\s+/g, ' ').trim())`
    )
    return { header, files }
  }
  try {
    let live
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Applique le patch')
        await ui.ready()
        live = await changes(ui)
        await ui.shot('130-modifications-direct')
      },
      userData,
      'patch-opencode',
      env
    )
    await withApp(
      scheme,
      async (ui) => {
        const item = `document.querySelector('[data-testid=history-item] .history-open')`
        await ui.waitFor(`!!${item}`)
        await ui.click(item)
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length > 0`)
        await ui.ready()
        const replayed = await changes(ui)
        check(
          JSON.stringify(replayed) === JSON.stringify(live),
          `après redémarrage (rejeu) : mêmes fichiers et mêmes totaux qu’en direct (${replayed.header})`
        )
        // Le diff refait du README : la ligne retirée et la ligne ajoutée.
        const readme = `[...document.querySelectorAll('[data-testid=changes-file]')].find((f) => f.querySelector('.changes-toggle').title === 'README.md')`
        await ui.click(`${readme}.querySelector('.changes-toggle')`)
        await ui.waitFor(`!!${readme}.querySelector('[data-testid=changes-diff]')`)
        await ui.shot('131-modifications-rejeu')
      },
      userData,
      'patch-opencode',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
