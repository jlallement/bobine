import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Libellés de la 0.11 (recette réelle, C2, C4, C5 ; C1 est dans `memoire`) :
 * options d'autorisation de l'agent dans la langue de l'app d'après leur genre ACP ; un seul nom
 * pour l'agent, celui du profil, même s'il en annonce un autre ; dossiers récents coupés au milieu,
 * le nom du dossier entier.
 */
export async function libellesSuite(scheme) {
  console.log(`\n— Libellés 0.11 (${scheme})`)
  const root = mkdtempSync(join(tmpdir(), 'bob-e2e-libelles-'))
  // Chemin long, comme ceux de la recette : seul le nom du dossier les distingue.
  const workspace = join(
    root,
    'un-dossier-au-nom-tres-long-pour-la-recette',
    'encore-un-niveau-tres-long-de-plus',
    'projet-élève'
  )
  mkdirSync(workspace, { recursive: true })
  // Dossiers récents d'un profil qui a déjà servi : trois chemins longs, même début.
  const userData = join(root, 'donnees')
  mkdirSync(userData)
  const others = ['repo-bob', 'repo-oc'].map((name) => join(workspace, '..', name))
  for (const other of others) mkdirSync(other)
  writeFileSync(
    join(userData, 'settings.json'),
    JSON.stringify({ recentWorkspaces: [workspace, ...others] })
  )
  const profile = L('profiles.mock.label')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // C4 : l'agent annonce « Factice annoncé » ; l'app dit partout le nom du profil.
        const sidebar = await ui.ev(`document.querySelector('.who .name')?.innerText ?? ''`)
        const chip = await ui.ev(`${ui.$('agent-menu')}.innerText`)
        check(
          sidebar === profile && chip.includes(profile) && !chip.includes('Factice annoncé'),
          `un seul nom : « ${sidebar} », « ${chip.trim()} » (profil « ${profile} »)`
        )

        // C5 : options « Allow once / Reject » de l'agent, dites dans la langue de l'app.
        await ui.send('/scenario sous-agent-bob')
        const card = `document.querySelector('[data-testid=permission]')`
        await ui.waitFor(`!!${card}`)
        const buttons = await ui.ev(
          `[...${card}.querySelectorAll('.pc-actions button')].map((b) => b.innerText.trim())`
        )
        check(
          JSON.stringify(buttons) ===
            JSON.stringify([L('permissionOption.allow_once'), L('permissionOption.reject_once')]),
          `options d’autorisation traduites : ${buttons.join(' / ')}`
        )
        check(
          (await ui.ev(`${card}.querySelector('button[data-kind=allow_once]').title`)) ===
            'Allow once',
          'nom donné par l’agent en infobulle'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('011-autorisation-traduite')
        await ui.click(`${card}.querySelector('button[data-kind=allow_once]')`)
        await ui.ready()

        // C2 : dossiers récents coupés au milieu, nom du dossier entier, chemin en infobulle.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings-data')}`)
        await ui.click(ui.$('settings-data'))
        await ui.waitFor(`!!${ui.$('middle-path')}`)
        const row = await ui.ev(`(() => {
          const p = document.querySelector('[data-testid=middle-path]')
          const name = p.querySelector('.middle-path-name')
          const dir = p.querySelector('.middle-path-dir')
          return { title: p.title, name: name.innerText, nameCut: name.scrollWidth > name.clientWidth,
            dirCut: dir.scrollWidth > dir.clientWidth }
        })()`)
        check(
          row.name === 'projet-élève' &&
            !row.nameCut &&
            row.dirCut &&
            row.title === workspace &&
            (await ui.ev(
              `[...document.querySelectorAll('.middle-path-name')].map((n) => n.innerText).join('|')`
            )) === 'projet-élève|repo-bob|repo-oc',
          `dossier récent : nom entier « ${row.name} », début coupé, chemin en infobulle`
        )
        await ui.shot('011-dossiers-recents')
      },
      userData,
      'demo',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_NOM: 'Factice annoncé' }
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
