import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

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
        check(
          live.header === '3 +20 −1' && live.files.length === 3,
          'en direct : 3 fichiers, +20 −1 (notes.md et src/calc.js créés, README.md modifié)'
        )
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
        const diff = await ui.ev(`${readme}.querySelector('[data-testid=changes-diff]').innerText`)
        check(
          diff.includes('Version 1') && diff.includes('Version 2'),
          'diff refait depuis le patch : avant et après'
        )
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
  await createdFilesPhase(scheme, changes)
  await bobCreationPhase(scheme)
}

/**
 * Fichiers créés par le `write` d'OpenCode 2.2.5 (fiche 202) : sa fin ne porte aucun diff (le diff
 * n'est que dans la demande d'autorisation, quand il y en a une). Ils comptent pourtant dans
 * Modifications › Conversation et dans l'en-tête, en direct comme après redémarrage.
 */
async function createdFilesPhase(scheme, changes) {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-ecriture-'))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-ecriture-donnees-'))
  writeFileSync(join(workspace, 'README.md'), '# Projet\n\nVersion 1\n')
  const env = { BOBINE_WORKSPACE: workspace }
  const expected = ['nouveau.txt', 'README.md', 'autorise.txt']
  /** Chemins des fichiers de la vue « Conversation », dans l'ordre affiché. */
  const names = (ui) =>
    ui.ev(
      `[...document.querySelectorAll('[data-testid=changes-file] .changes-toggle')].map((t) => t.title)`
    )
  try {
    let live
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Écris les fichiers')
        // `autorise.txt` : OpenCode demande l'autorisation (permission `edit: ask`).
        const allow = `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`
        await ui.waitFor(`!!${allow}`)
        await ui.click(allow)
        await ui.ready()
        live = await changes(ui)
        const files = await names(ui)
        check(
          live.header === '3 +3 −1' &&
            files.length === 3 &&
            expected.every((f) => files.includes(f)),
          `en direct : nouveau.txt et autorise.txt créés comptent avec README.md (${live.header} ; ${files.join(', ')})`
        )
        await ui.shot('132-modifications-write-cree')
      },
      userData,
      'ecriture-opencode',
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
          `après redémarrage : mêmes fichiers créés et mêmes totaux (${replayed.header})`
        )
      },
      userData,
      'ecriture-opencode',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}

/**
 * Fichier créé par Bob 2.0.9 (fiche 203, recette réelle) : son diff dit `oldText: ""`, même pour
 * un fichier neuf. L'app a regardé le disque quand Bob l'a proposé et l'a enregistré comme une
 * création : après redémarrage, le fichier existe, la ligne dit toujours « Création de … ».
 */
async function bobCreationPhase(scheme) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-creation-bob-'))
  const create = L('toolCall.label.create', { target: '' }).trim()
  const label = (ui) =>
    ui.ev(
      `[...document.querySelectorAll('[data-testid=tool]')].at(-1)?.querySelector('[data-testid=tool-label]')?.textContent ?? ''`
    )
  try {
    let live
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Crée notes/alpha.txt')
        const allow = `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`
        await ui.waitFor(`!!${allow}`)
        await ui.click(allow)
        await ui.ready()
        live = await label(ui)
        check(
          live.startsWith(create) && live.endsWith('alpha.txt'),
          `Bob, en direct : « ${live} » (fichier neuf, diff oldText "")`
        )
      },
      userData,
      'creation-bob'
    )
    await withApp(
      scheme,
      async (ui) => {
        const item = `document.querySelector('[data-testid=history-item] .history-open')`
        await ui.waitFor(`!!${item}`)
        await ui.click(item)
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length > 0`)
        await ui.ready()
        const reopened = await label(ui)
        check(
          reopened === live,
          `Bob, après redémarrage (le fichier existe) : toujours « ${reopened} »`
        )
        await ui.shot('F203-m-creation-bob-rouverte')
      },
      userData,
      'creation-bob'
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
