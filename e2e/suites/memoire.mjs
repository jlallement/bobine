import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Mémoire commune aux agents (fiche 182, ADR-0040), contre l'agent factice : la carte « Retenir ce
 * souvenir ? » pendant que le tour finit, « Non », puis « Retenir » ; pastille neutre de la barre
 * latérale ; carte d'un contenu externe (aucun bouton mis en avant, commande surlignée, Entrée dans
 * la saisie n'accepte rien) ; index reçu par la conversation suivante ; ligne « Mémoire » de
 * l'onglet Session ; Réglages › Mémoire (lire, modifier avec secret refusé, supprimer) ; famille
 * d'outils réglée ailleurs ; mémoire coupée : ni outil ni index. Fil étroit (900 px).
 */
export async function memoireSuite(scheme) {
  console.log(`\n— Mémoire (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-memoire-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: workspace })
  try {
    await withApp(
      scheme,
      async (ui) => {
        const main = await mainProcess()
        const menu = (id) =>
          main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById(${JSON.stringify(id)}).click(), true)`
          )
        const lastReply = () =>
          ui.ev(`[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText ?? ''`)
        const cards = `[...document.querySelectorAll('[data-testid=memory-card]')]`
        const card = `${cards}.at(-1)`
        const focusOnCard = () =>
          ui.ev(`!!document.activeElement?.closest('[data-testid=memory-card]')`)
        try {
          await ui.viewport(900)
          await ui.ready()

          // 1. Proposition : la carte attend, le tour est fini, rien n'a pris le focus.
          await ui.send('/scenario memoire-retient')
          await ui.ready()
          await ui.waitFor(`${cards}.length === 1`)
          check(
            (await ui.ev(`${card}.innerText`)).includes(L('memory.card.rememberTitle')) &&
              (await ui.ev(
                `${card}.querySelector('[data-testid=memory-accept]').classList.contains('primary')`
              )) &&
              !(await focusOnCard()),
            'carte « Retenir ce souvenir ? » : Retenir en avant, aucun bouton ne prend le focus'
          )
          check(
            (await ui.ev(`${ui.$('memory-pill')}?.innerText ?? ''`)).includes(L('memory.pill')),
            'pastille neutre « Mémoire » sur la conversation'
          )
          check(
            !(await ui.ev(`${card}.innerText`)).includes(L('memory.type.feedback')),
            'pas de type sur la carte, seulement la portée'
          )
          // Carte de l'outil : ce qu'il fait, pas son nom technique (recette 0.11, C1).
          const toolTitles = await ui.ev(
            `[...document.querySelectorAll('[data-testid=tool]')].map((t) => t.innerText).join('\\n')`
          )
          check(
            toolTitles.includes(
              L('appTools.remember.value', { value: 'Lancer les e2e touchées avant chaque push' })
            ),
            'carte de l’outil : « Propose de retenir : … », pas « remember »'
          )
          await ui.shot('182-1-carte-en-attente')

          // 2. « Non » : une ligne, plus de pastille.
          await ui.click(`${card}.querySelector('[data-testid=memory-decline]')`)
          await ui.waitFor(`!!${ui.$('memory-decided')}`)
          check(
            (await ui.ev(`${ui.$('memory-decided')}.innerText`)).includes(
              L('memory.decided.declined')
            ) && !(await ui.ev(`!!${ui.$('memory-pill')}`)),
            '« Non » : une ligne « Non retenu », pastille retirée'
          )
          // Le message suivant dit l'issue à l'agent (il le répète), sans nouvelle carte.
          await ui.send('/scenario memoire-retient')
          await ui.ready()
          check(
            (await ui.ev(`${cards}.length`)) === 0,
            'issue dite au message suivant, pas de carte'
          )

          // 3. Nouvelle proposition, « Retenir » : « Retenu » et « Voir ».
          await ui.send('/scenario memoire-retient')
          await ui.ready()
          await ui.waitFor(`${cards}.length === 1`)
          await ui.click(`${card}.querySelector('[data-testid=memory-accept]')`)
          await ui.waitFor(
            `[...document.querySelectorAll('[data-testid=memory-decided]')].some((d) => d.classList.contains('memory-decided-kept'))`
          )
          await ui.shot('182-2-decidees')

          // 4. Contenu externe : bandeau, commande surlignée, aucun bouton en avant ; Entrée dans
          // la saisie envoie le message, elle n'accepte pas la carte.
          await ui.send('/scenario memoire-injection')
          await ui.ready()
          await ui.waitFor(`${cards}.length === 1`)
          check(
            (await ui.ev(`${card}.dataset.risky`)) === 'true' &&
              (
                await ui.ev(`${card}.querySelector('[data-testid=memory-banner]').innerText`)
              ).includes(L('memory.card.command')) &&
              (
                await ui.ev(`${card}.querySelector('[data-testid=memory-command]').innerText`)
              ).includes('| sh') &&
              !(await ui.ev(
                `${card}.querySelector('[data-testid=memory-accept]').classList.contains('primary')`
              )) &&
              !(await ui.ev(`!!${card}.querySelector('.memory-body-folded')`)),
            'contenu externe : bandeau, commande surlignée, corps déplié, aucun bouton en avant'
          )
          await ui.shot('182-3-contenu-externe')
          await ui.send('Merci')
          await ui.ready()
          check(
            (await ui.ev(`${cards}.length`)) === 1 && !(await focusOnCard()),
            'Entrée dans la saisie : message envoyé, la carte attend toujours'
          )
          await ui.click(`${card}.querySelector('[data-testid=memory-decline]')`)
          await ui.waitFor(`${cards}.length === 0`)

          // 5. Conversation suivante : l'index arrive avec le premier message.
          await menu('new-conversation')
          await ui.waitFor(`!document.querySelector('.history-item.active')`)
          await ui.ready()
          await ui.send('/scenario memoire-index')
          await ui.ready()
          check((await lastReply()).includes('tests-e2e'), 'conversation suivante : index reçu')

          // 6. Onglet Session : ligne « Mémoire », qui mène aux réglages.
          const sessionTab = `document.querySelector('.side-panel-tab[data-tab=session] [role=tab]')`
          if (!(await ui.ev(`!!${sessionTab}`))) await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!!${sessionTab}`)
          await ui.click(sessionTab)
          await ui.waitFor(
            `!!document.querySelector('[data-testid=session-line][data-line=memory]')`
          )
          check(true, 'onglet Session : ligne « Mémoire »')
          await ui.shot('182-4-onglet-session')
          await ui.click(ui.$('session-memory-open'))
          await ui.waitFor(`!!${ui.$('memory-settings')}`)

          // 7. Réglages › Mémoire : le souvenir retenu, déplié sur place, modifié, supprimé.
          const entry = `document.querySelector('[data-testid=memory-entry][data-name=tests-e2e]')`
          await ui.waitFor(`!!${entry}`)
          await ui.shot('182-5-reglages-liste')
          await ui.click(`${entry}.querySelector('.memory-entry-head')`)
          await ui.waitFor(`!!${ui.$('memory-edit')}`)
          await ui.shot('182-6-reglages-souvenir')
          await ui.click(ui.$('memory-edit'))
          await ui.waitFor(`!!${ui.$('memory-editor-body')}`)
          await ui.ev(`(() => {
            const area = ${ui.$('memory-editor-body')}
            const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
            set.call(area, 'La clé est sk-proj-abcdefghijklmnop0123')
            area.dispatchEvent(new Event('input', { bubbles: true }))
          })()`)
          await ui.click(ui.$('memory-editor-save'))
          await ui.waitFor(`!!${ui.$('memory-editor-error')}`)
          check(
            (await ui.ev(`${ui.$('memory-editor-error')}.innerText`)) ===
              L('settings.memory.secret'),
            'modification : un secret est refusé'
          )
          await ui.shot('182-7-reglages-secret-refuse')
          await ui.press('Escape')
          await ui.waitFor(`!${ui.$('memory-editor')}`)
          await ui.click(`${entry}.querySelector('.memory-entry-head')`)
          await ui.click(ui.$('memory-delete'))
          await ui.click(ui.$('confirm-row-confirm'))
          await ui.waitFor(`!${entry}`)
          check(true, 'souvenir supprimé après confirmation')

          // 7 bis. Fichier posé hors de Bobine (éditeur, ou agent par son shell) : pas donné aux
          // agents, montré « Modifié hors de Bobine » jusqu'à « Garder ces modifications ».
          await main.evaluate(`(() => {
            const { join } = require('node:path')
            const fs = require('node:fs')
            const dir = join(require('electron').app.getPath('userData'), 'memory', 'user')
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(join(dir, 'pose.md'), '---\\nname: pose\\ndescription: Posé hors de Bobine\\ntype: user\\nupdated: 2026-11-07T00:00:00Z\\n---\\n\\nÉcrit par un éditeur.\\n')
            return true
          })()`)
          await ui.ev(`(() => {
            const picker = ${ui.$('memory-picker')}
            const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
            set.call(picker, 'user')
            picker.dispatchEvent(new Event('change', { bubbles: true }))
            return true
          })()`)
          const posed = `document.querySelector('[data-testid=memory-entry][data-name=pose]')`
          await ui.waitFor(`!!${posed}?.querySelector('[data-testid=memory-outside]')`)
          await ui.click(`${posed}.querySelector('.memory-entry-head')`)
          await ui.waitFor(`!!${ui.$('memory-approve')}`)
          await ui.shot('182-9-modifie-hors-de-bobine')
          await ui.click(ui.$('memory-approve'))
          await ui.waitFor(`!${posed}?.querySelector('[data-testid=memory-outside]')`)
          check(true, 'fichier modifié hors de Bobine : signalé, puis gardé après validation')

          // 8. Famille « Mémoire » des outils de Bobine : réglée ici, pas de second interrupteur.
          await ui.click(
            `[...document.querySelectorAll('.settings-nav-item')].find((b) => b.innerText.trim() === ${JSON.stringify(L('settings.section.mcp'))})`
          )
          const family = `document.querySelector('[data-testid=app-tool-family][data-id=memory]')`
          await ui.waitFor(`!!${family}`)
          check(
            (await ui.ev(`!!${family}.querySelector('[data-testid=app-tool-setting]')`)) &&
              !(await ui.ev(`!!${family}.querySelector('[data-testid=app-tool-enabled]')`)),
            'outils de Bobine : famille « Mémoire » sans interrupteur, avec le chemin du réglage'
          )

          // 9. Mémoire coupée : ni outil ni index pour les conversations suivantes.
          await ui.click(
            `[...document.querySelectorAll('.settings-nav-item')].find((b) => b.innerText.trim() === ${JSON.stringify(L('settings.section.memory'))})`
          )
          await ui.waitFor(`!!${ui.$('settings-memory-enabled')}`)
          await ui.click(ui.$('settings-memory-enabled'))
          await ui.waitFor(`${ui.$('settings-memory-enabled')}.checked === false`)
          await ui.shot('182-8-reglages-desactivee')
          await ui.press('Escape')
          await menu('new-conversation')
          await ui.waitFor(`!document.querySelector('.history-item.active')`)
          await ui.ready()
          await ui.send('/scenario memoire-sans-outil')
          await ui.ready()
          check(
            !(await lastReply()).includes('Outil remember reçu'),
            'mémoire coupée : pas d’outil'
          )
        } finally {
          main.close()
        }
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
