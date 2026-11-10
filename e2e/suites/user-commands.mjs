import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MOCK_LANG, check, withApp } from '../lib.mjs'

/** Texte cité par l'écho de l'agent factice, dans sa langue. */
const quoted = (text) => (MOCK_LANG === 'en' ? `“${text}”` : `« ${text} »`)

/**
 * Commandes « / » personnelles (fiche 045) : une commande créée dans les réglages, une commande du
 * projet (`.bobine/commands/revue.md`), le menu, et la consigne développée reçue par l'agent
 * (scénario `echo`, qui répète le prompt reçu).
 */
export async function userCommandsSuite(scheme) {
  console.log(`\n— Commandes personnelles (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-commands-'))
  mkdirSync(join(workspace, '.bobine', 'commands'), { recursive: true })
  writeFileSync(
    join(workspace, '.bobine', 'commands', 'revue.md'),
    '---\ndescription: Revue du projet\nhint: <fichier>\n---\n\nFais une revue de $ARGUMENTS.\n'
  )
  // Ancien dossier, d'avant le nom « Bobine » (fiche 069) : encore lu.
  mkdirSync(join(workspace, '.bob-desktop', 'commands'), { recursive: true })
  writeFileSync(
    join(workspace, '.bob-desktop', 'commands', 'ancienne.md'),
    '---\ndescription: Commande de l’ancien dossier\n---\n\nToujours là.\n'
  )
  const fill = async (ui, testId, text) => {
    await ui.ev(`${ui.$(testId)}.focus(); ${ui.$(testId)}.select(); true`)
    await ui.type(text)
    await ui.waitFor(`${ui.$(testId)}.value === ${JSON.stringify(text)}`)
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Réglages › Commandes : nouvelle commande personnelle.
        await ui.click(`document.querySelector('[aria-label="${L('sidebar.settings')}"]')`)
        await ui.waitFor(`!!document.querySelector('.settings-nav-item')`)
        await ui.click(
          `[...document.querySelectorAll('.settings-nav-item')].find((b) => b.innerText.trim() === ${JSON.stringify(L('settings.section.commands'))})`
        )
        await ui.waitFor(`!!${ui.$('commands-settings')}`)
        check(
          (await ui.ev(`${ui.$('project-commands-list')}?.innerText ?? ''`)).includes('/revue') &&
            (await ui.ev(`${ui.$('project-commands-list')}.innerText`)).includes('Revue du projet'),
          'réglages : commande du projet listée (revue.md, lecture seule)'
        )
        check(
          (await ui.ev(`${ui.$('project-commands-list')}.innerText`)).includes('/ancienne'),
          'réglages : commande de l’ancien dossier .bob-desktop/commands encore lue'
        )
        await ui.click(ui.$('command-add'))
        await ui.waitFor(`!!${ui.$('command-form')}`)
        await fill(ui, 'command-name', 'salut')
        await fill(ui, 'command-description', 'Dire bonjour')
        await fill(ui, 'command-prompt', 'Dis bonjour à $ARGUMENTS')
        await ui.click(ui.$('command-save'))
        await ui.waitFor(`!!document.querySelector('[data-testid=command-item][data-name=salut]')`)
        check(true, 'commande personnelle « /salut » enregistrée')
        await ui.shot('34-commandes-personnelles-reglages')
        await ui.press('Escape')
        await ui.waitFor(`!${ui.$('commands-settings')}`)

        // Menu « / » : les deux commandes, avec leur origine.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/')
        await ui.waitFor(`!!${ui.$('command-menu')}`)
        const items = await ui.ev(
          `[...document.querySelectorAll('[data-testid=command-item]')].map((i) => i.innerText.replace(/\\s+/g, ' ').trim())`
        )
        check(
          items.some(
            (i) => i.startsWith('/revue <fichier>') && i.endsWith(L('commandMenu.source.project'))
          ) &&
            items.some((i) => i.startsWith('/salut') && i.endsWith(L('commandMenu.source.user'))),
          'menu « / » : « /revue <fichier> » (Projet) et « /salut » (Vous)'
        )
        await ui.type('salut')
        await ui.waitFor(`document.querySelectorAll('[data-testid=command-item]').length === 1`)
        await ui.shot('35-commandes-personnelles-menu')
        await ui.type(' Jérôme')
        await ui.press('Enter')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(quoted('Dis bonjour à Jérôme')),
          '« /salut Jérôme » : l’agent reçoit la consigne développée'
        )

        // Commande du projet avec argument : Tab complète, l'argument remplace $ARGUMENTS.
        await ui.type('/revu')
        // « /review » (app) correspond aussi par sa description ; « /revue » est en tête.
        await ui.waitFor(
          `document.querySelector('[data-testid=command-item]')?.innerText.startsWith('/revue')`
        )
        await ui.press('Tab')
        await ui.waitFor(`${ui.$('composer-input')}.value === '/revue '`)
        await ui.type('src/app.js')
        await ui.press('Enter')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(quoted('Fais une revue de src/app.js.')),
          '« /revue src/app.js » : consigne du projet développée, reçue par l’agent'
        )
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
