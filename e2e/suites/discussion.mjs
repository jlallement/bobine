import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Espace Discussion (fiche 224, maquettes E1–E6) : sélecteur Code | Discussion, accueil de chat,
 * document déposé (copié), écriture de l'agent accordée dans les documents et refusée ailleurs
 * (agent factice `discussion-document`, d'après Bob 2.1.0), carte du document et panneau
 * « Documents », « Continuer dans un projet… », retour à l'espace Code sans les discussions.
 */
export async function discussionSuite(scheme) {
  console.log(`\n— Espace Discussion (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-'))
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-projet-'))
  const outside = mkdtempSync(join(tmpdir(), 'bob-e2e-depot-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: workspace })
  const deposited = join(outside, 'Ventes T3.csv')
  writeFileSync(deposited, 'Région;Ventes\nOuest;308100\nNord;157300\n')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // E1 : l'espace Code, inchangé, avec le sélecteur.
        await ui.waitFor(`!!${ui.$('space-code')}`)
        check(
          await ui.ev(`${ui.$('space-code')}.getAttribute('aria-selected') === 'true'`),
          'au lancement : espace Code, sélecteur en tête de la barre latérale'
        )
        await ui.shot('discussion-1-code')

        // E2 : l'espace Discussion, accueil sans dossier ni branche.
        await ui.click(ui.$('space-discussion'))
        await ui.waitFor(`!!${ui.$('discussion-drop-hint')}`)
        await ui.ready()
        check(
          (await ui.ev(`!${ui.$('workspace-menu')} && !${ui.$('team-section')}`)) &&
            (await ui.ev(`${ui.$('new-conversation')}.innerText`)).includes(
              L('discussion.newDiscussion')
            ),
          'accueil de discussion : ni dossier, ni branche, ni Équipe ; « Nouvelle discussion »'
        )
        await ui.shot('discussion-2-accueil')

        // Un document déposé : copié dans la discussion, l'original intact.
        const id = await ui.ev(`window.api.conversations.get().then((s) => s.activeId)`)
        const added = await ui.ev(
          `window.api.documents.add(${JSON.stringify(id)}, [${JSON.stringify(deposited)}])`
        )
        check(added.join() === 'Ventes T3.csv' && existsSync(deposited), 'document déposé copié')

        // E3–E5 : le tour de l'agent ; écriture accordée dans les documents, refusée ailleurs.
        await ui.send('Fais la synthèse des ventes.')
        await ui.waitFor(`!!${ui.$('document-card')}`, 20000)
        await ui.ready()
        const text = await ui.ev(`${ui.$('thread')}.innerText`)
        const lead = (key) => L(key, { tool: '§' }).split('§')[0].trim()
        check(
          text.includes(lead('discussion.notice.writeAllowed')) &&
            text.includes(lead('discussion.notice.writeRefused')),
          'écriture accordée dans les documents, refusée hors du dossier, chacune dite'
        )
        check(
          (await ui.ev(`${ui.$('document-card')}.innerText`)).includes('Synthèse.md'),
          'carte du document créé par l’agent'
        )
        check(
          !readdirSync(join(userData, 'discussions', id)).includes('jamais.md'),
          'rien écrit hors du dossier'
        )
        // Panneau « Documents » : la liste et l'aperçu du document choisi.
        if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
        await ui.waitFor(`!!${ui.$('side-panel')}`)
        // Par son nom accessible : à 320 px (fiche 226), les onglets peuvent n'être que des icônes
        // (fiche 185) ; rangé dans « + » s'il n'a pas de place dans la rangée.
        const documentsTab = `document.querySelector('.side-panel-tab-main[aria-label=${JSON.stringify(L('panel.tab.documents'))}]')`
        await ui.waitFor(`!!${documentsTab}`)
        if (await ui.ev(`!!${documentsTab}.closest('[data-overflow]')`)) {
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=documents]')`)
        } else await ui.click(documentsTab)
        await ui.waitFor(`document.querySelectorAll('[data-testid=documents-row]').length === 2`)
        await ui.waitFor(`${ui.$('documents-preview')}?.innerText.includes('Synthèse')`)
        check(true, 'panneau « Documents » : deux documents, aperçu du plus récent')
        await ui.shot('discussion-3-documents')
        // Onglet « Session » : « Documents · Cette discussion », jamais l'identifiant de son dossier.
        const sessionTab = `document.querySelector('.side-panel-tab-main[aria-label=${JSON.stringify(L('panel.tab.session'))}]')`
        if (await ui.ev(`!!${sessionTab} && !${sessionTab}.closest('[data-overflow]')`)) {
          await ui.click(sessionTab)
        } else {
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=session]')`)
        }
        await ui.waitFor(`!!${ui.$('session-folder')}`)
        check(
          (await ui.ev(`${ui.$('session-folder')}.innerText`)) === L('sessionTab.thisDiscussion') &&
            !(await ui.ev(`${ui.$('session-tab')}.textContent`)).includes(id),
          'onglet « Session » : « Documents · Cette discussion », sans l’identifiant du dossier'
        )
        await ui.shot('discussion-3b-session')
        check(
          !(await ui.ev(`${ui.$('thread')}.textContent`)).includes(id),
          'fil d’une discussion : les outils disent « Documents », jamais l’identifiant du dossier'
        )

        // E4 : une commande demandée, dite en clair ; le détail replié.
        await ui.send('/scenario discussion-commande')
        await ui.waitFor(`!!${ui.$('permission')}`, 20000)
        check(
          (await ui.ev(`${ui.$('permission')}.innerText`)).includes(
            L('discussion.permission.details')
          ) && (await ui.ev(`${ui.$('permission-details')}.open === false`)),
          'carte d’autorisation en clair, commande repliée sous « Détails techniques »'
        )
        check(
          !(await ui.ev(`${ui.$('permission')}.textContent`)).includes(id),
          'commande d’une discussion : son dossier se dit « Documents », jamais son identifiant'
        )
        await ui.shot('discussion-5-autorisation')
        await ui.click(`${ui.$('permission')}.querySelector('.pc-actions .btn.ghost')`)
        await ui.waitFor(`!!${ui.$('permission-answer')}`)

        // E6 : « Continuer dans un projet… » depuis le menu du titre.
        await ui.click(ui.$('title-menu'))
        await ui.click(ui.$('title-continue-in-project'))
        await ui.waitFor(`!!${ui.$('continue-dialog')}`)
        // La case n'apparaît qu'une fois les documents comptés (lecture asynchrone).
        await ui.waitFor(`!!${ui.$('continue-copy')}`)
        check(
          await ui.ev(`${ui.$('continue-copy')}?.checked === true`),
          'dialogue : documents copiés par défaut'
        )
        await ui.shot('discussion-4-continuer')
        await ui.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
        await ui.waitFor(`!${ui.$('continue-dialog')}`)

        // Retour à l'espace Code : la discussion n'y est pas listée.
        await ui.click(ui.$('space-code'))
        await ui.waitFor(`${ui.$('space-code')}.getAttribute('aria-selected') === 'true'`)
        check(
          !(await ui.ev(`${ui.$('history')}.innerText`)).includes('Fais la synthèse'),
          'espace Code : les discussions n’y sont pas'
        )
      },
      userData,
      'discussion-document',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    for (const dir of [userData, workspace, outside]) rmSync(dir, { recursive: true, force: true })
  }
}
