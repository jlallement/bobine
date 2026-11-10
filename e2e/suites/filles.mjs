import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'
import { conversationTooltip } from '../sidebar-tooltip.mjs'

/** Coût d'un tour de l'agent factice (0,0125 $), écrit comme l'app dans la langue des essais. */
const TURN_COST = new Intl.NumberFormat(LANG, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4
}).format(0.0125)
const spaced = (text) => (text ?? '').replace(/\s/g, ' ')

/**
 * Conversations filles lancées par l'utilisateur (fiche 097, étape 1) : « Lancer en parallèle… »,
 * la fille sous sa mère, la carte « Sous-tâches », le compte rendu, son envoi avec le prochain
 * message, la mère supprimée. Dans un dépôt git jetable : une fille travaille dans un worktree.
 */
export async function fillesSuite(scheme) {
  console.log(`\n— Conversations filles (${scheme})`)
  const { workspace, git } = repository()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const row = (id) => `document.querySelector('[data-testid=history-item][data-id="${id}"]')`
        const rows = `[...document.querySelectorAll('[data-testid=history-item]')]`
        const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        const launch = async (trigger, item, prompt) => {
          await ui.click(trigger)
          const enabled = `${ui.$(item)} && !${ui.$(item)}.hasAttribute('data-disabled')`
          await ui.waitFor(`!!(${enabled})`)
          await ui.click(ui.$(item))
          await ui.waitFor(`!!${ui.$('child-dialog')}`)
          await ui.ev(`${ui.$('child-prompt')}.focus()`)
          await ui.type(prompt)
        }

        await ui.send('Organise le carnet')
        await ui.ready()
        const mother = await activeId()
        // Onglet Modifications du panneau (fiche 161), rouvert par « + » s'il a été fermé.
        const changesTab = `document.querySelector('.side-panel-tab[data-tab=changes]')`
        const openChanges = async () => {
          if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!!${ui.$('side-panel')}`)
          if (await ui.ev(`!!${changesTab}`)) await ui.click(changesTab)
          else {
            await ui.click(ui.$('panel-more'))
            await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
            await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=changes]')`)
          }
          await ui.waitFor(`!!${ui.$('changes-tab')}`)
        }
        const closePanel = async () => {
          await ui.click(
            `${ui.$('side-panel')}.querySelector('[aria-label="${L('sidePanel.close')}"]')`
          )
          await ui.waitFor(`!${ui.$('side-panel')}`)
        }
        await openChanges()
        check(
          !(await ui.ev(`!!${ui.$('changes-view-children')}`)),
          'Modifications d’une conversation sans fille : pas de vue « Filles » (fiche 161)'
        )
        await closePanel()

        // « Lancer en parallèle… » depuis le menu du titre : agent et modèle de la mère.
        await launch(ui.$('title-menu'), 'title-launch-child', '/scenario modifications')
        const defaults = await ui.ev(
          `({ agent: ${ui.$('child-agent')}?.value, model: ${ui.$('child-model')}?.value })`
        )
        check(
          defaults.agent === 'mock' && defaults.model === 'factice-rapide',
          'fenêtre : agent et modèle de la mère par défaut'
        )
        await ui.shot('filles-1-lancer')
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
        await ui.waitFor(`${rows}.some((r) => r.classList.contains('nested'))`)
        const first = await ui.ev(`${rows}.find((r) => r.classList.contains('nested'))?.dataset.id`)
        check(
          (await activeId()) === mother &&
            (await ui.ev(`${rows}.map((r) => r.dataset.id).join(' ')`)).startsWith(
              `${mother} ${first}`
            ),
          'la fille est sous sa mère, la mère reste affichée'
        )

        // Fin du tour de la fille : son compte rendu dans le fil de la mère.
        await ui.waitFor(`!!${ui.$('child-report')}`, 30000)
        const branch = await ui.ev(
          `document.querySelector('[data-testid=subtask-row] .subtask-branch')?.innerText`
        )
        // Replié (fiche 171) : titre, coût et première phrase ; le détail se déplie.
        check(
          (await ui.ev(`${ui.$('child-report-toggle')}.getAttribute('aria-expanded')`)) ===
            'false' && !(await ui.ev(`!!${ui.$('child-report-excerpt')}`)),
          'compte rendu replié par défaut'
        )
        await ui.click(ui.$('child-report-toggle'))
        const report = await ui.ev(`${ui.$('child-report')}.innerText`)
        check(
          branch?.startsWith('bobine/') &&
            report.includes(branch) &&
            report.includes(L('children.files', { count: 2 })) &&
            report.includes('deux fichiers modifiés') &&
            !!(await ui.ev(`!!${ui.$('child-report-pending')}`)),
          'compte rendu : branche, fichiers, fin de la réponse, en attente du prochain message'
        )
        // Coût de la fille (fiche 117) : sur sa ligne, en total de la carte, sur son compte rendu.
        await ui.waitFor(`!!${ui.$('subtask-cost')}`)
        const cost = await ui.ev(
          `({ row: ${ui.$('subtask-cost')}.innerText, total: ${ui.$('subtasks-total')}?.innerText, report: ${ui.$('child-report-usage')}?.innerText, turns: ${ui.$('child-report-turns')}?.innerText })`
        )
        check(
          spaced(cost.row) === spaced(TURN_COST) &&
            spaced(cost.total) === spaced(TURN_COST) &&
            spaced(cost.report) === spaced(TURN_COST) &&
            cost.turns === L('children.report.turns', { count: 1 }),
          `coût de la fille : sa ligne, le total de la carte, son compte rendu (${spaced(cost.report)})`
        )
        // Finie, à lire : sous sa mère, en gras, état et origine dans l'infobulle (fiche 149).
        await ui.waitFor(
          `${row(first)}?.classList.contains('nested') && ${row(first)}.querySelector('.child-state')?.dataset.state === 'unread'`
        )
        check(
          (await ui.ev(`${row(first)}.classList.contains('unread')`)) &&
            (await ui.ev(`${row(first)}.dataset.branch`)) === branch &&
            (await ui.ev(`!!${row(first)}.querySelector('.row-slot')`)) &&
            (await ui.ev(
              `${row(first)}.querySelector('.child-state').getAttribute('aria-label')`
            )) === L('inbox.reason.report') &&
            (
              await conversationTooltip(ui, `${row(first)}.querySelector('.history-open')`)
            ).includes('Organise le carnet'),
          'liste : fille finie, à lire, sous sa mère avec son icône de non-lu (fiche 149)'
        )
        check(git('status', '--porcelain') === '', 'la fille travaille dans son worktree')

        // Une deuxième fille, depuis le menu de la liste : elle attend un accord.
        await launch(
          `${row(mother)}.querySelector('[data-testid=history-more]')`,
          'history-launch-child',
          '/scenario permission'
        )
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30000)
        await ui.waitFor(
          `!!document.querySelector('[data-testid=subtask-row][data-state=waiting]')`,
          30000
        )
        check(
          (await ui.ev(`${ui.$('subtasks')}.innerText`)).includes(
            L('children.card.waiting', { count: 1 })
          ),
          'carte « Sous-tâches » : une ligne par fille, avec son état'
        )
        await ui.shot('filles-2-sous-taches')
        const alignment = await ui.ev(`(() => {
          const rows = [...document.querySelectorAll('[data-testid=subtask-row]')]
          return rows.map((row) => ({
            title: row.querySelector('.subtask-title').getBoundingClientRect().left,
            state: row.querySelector('[data-testid=subtask-status]').getBoundingClientRect().left,
            open: row.querySelector('[data-testid=subtask-open]').getBoundingClientRect().left,
            text: row.querySelector('[data-testid=subtask-status]').textContent.trim(),
            label: row.querySelector('[data-testid=subtask-status]').getAttribute('aria-label')
          }))
        })()`)
        check(
          alignment.length === 2 &&
            ['title', 'state', 'open'].every(
              (key) =>
                Math.max(...alignment.map((row) => row[key])) -
                  Math.min(...alignment.map((row) => row[key])) <
                1
            ) &&
            alignment.every((row) => row.text === '' && row.label),
          'carte : titres, icônes seules et boutons Ouvrir alignés, états accessibles'
        )

        // Vue « Filles » des Modifications (fiche 161) : ses deux filles, comme la carte.
        await openChanges()
        await ui.waitFor(`!!${ui.$('changes-view-children')}`)
        await ui.click(ui.$('changes-view-children'))
        await ui.waitFor(`!!${ui.$('children-view')}`)
        const worktrees = await ui.ev(
          `[...document.querySelectorAll('[data-testid=child-worktree]')].map((r) => r.dataset.id + ':' + r.dataset.state)`
        )
        const card = await ui.ev(
          `[...document.querySelectorAll('[data-testid=subtask-row]')].map((r) => r.dataset.id + ':' + r.dataset.state)`
        )
        check(
          (await ui.ev(`${ui.$('changes-view-children')}.innerText`)).replace(/\s+/g, ' ') ===
            `${L('changes.view.children')} 2` &&
            JSON.stringify(worktrees) === JSON.stringify(card) &&
            (await ui.ev(
              `document.querySelector('[data-testid=child-worktree]').innerText.includes(${JSON.stringify(branch)})`
            )),
          `vue « Filles » : ses filles directes, dans l’état de la carte (${worktrees.join(', ')})`
        )
        await ui.shot('filles-161-vue-filles')
        await closePanel()

        // Le compte rendu part à l'agent de la mère avec le prochain message, une seule fois.
        await ui.send('/scenario echo')
        await ui.ready()
        const told = await ui.lastAgentText()
        check(
          told.includes('<child_conversations>') &&
            told.includes(branch) &&
            !(await ui.ev(`!!${ui.$('child-report-pending')}`)),
          'le compte rendu part avec le prochain message'
        )
        await ui.send('/scenario echo')
        await ui.ready()
        check(
          !(await ui.lastAgentText()).includes('child_conversations'),
          'et une seule fois (pas de réveil, pas de répétition)'
        )

        // « Ouvrir » : la fille qui attend son accord.
        await ui.click(
          `document.querySelector('[data-testid=subtask-row][data-state=waiting] [data-testid=subtask-open]')`
        )
        await ui.waitFor(`!!document.querySelector('[data-testid=permission]')`, 30000)
        check((await activeId()) !== mother, '« Ouvrir » affiche la fille')
        // En-tête de la fille (fiche 117) : d'où elle vient ; son fil commence par son départ.
        check(
          (await ui.ev(`${ui.$('title-origin')}?.innerText`)) ===
            L('conversationTitle.from', { title: 'Organise le carnet' }) &&
            (await ui.ev(
              `document.querySelector('[data-testid=thread]').firstElementChild?.dataset.testid`
            )) === 'worktree-origin',
          'fille : « ↳ depuis « mère » » dans l’en-tête, son départ en tête du fil'
        )
        await ui.shot('filles-3-fille-ouverte')
        await ui.click(
          `document.querySelector('[data-testid=permission] button[data-kind=allow_once]')`
        )
        await ui.ready()
        await ui.click(ui.$('title-origin'))
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === '${mother}'`
        )
        check(!(await ui.ev(`!!${ui.$('title-origin')}`)), '« ↳ depuis » ramène à la mère')

        // Dossier = projet (fiche 131) : les deux filles, chacune dans son worktree, restent sous
        // leur mère, dans le dossier du dépôt ; aucun dossier ne porte le nom d'un worktree.
        const away = async () => ui.hover(await ui.center(ui.$('composer-input')))
        const kids = await ui.ev(
          `${rows}.filter((r) => r.dataset.mother === '${mother}').map((r) => r.dataset.id)`
        )
        for (const id of kids) {
          if (!(await ui.ev(`${row(id)}?.classList.contains('unread')`))) continue
          await ui.click(`${row(id)}.querySelector('.history-open')`)
          await ui.waitFor(`document.querySelector('.history-item.active')?.dataset.id === '${id}'`)
          await ui.click(`${row(mother)}.querySelector('.history-open')`)
          await away()
          await ui.waitFor(`!${row(id)}?.classList.contains('unread')`)
        }
        await ui.click(ui.$('history-grouping'))
        await ui.waitFor(`!!${ui.$('grouping-folder')}`)
        await ui.click(ui.$('grouping-folder'))
        await away()
        await ui.waitFor(`!!document.querySelector('[data-testid=folder-group]')`)
        const folders = await ui.ev(
          `[...document.querySelectorAll('[data-testid=folder-group]')].map((g) => ({
            name: g.querySelector('[data-testid=folder-head]').textContent,
            rows: [...g.querySelectorAll('[data-testid=history-item]')].map((r) => (r.classList.contains('nested') ? '↳' : '') + r.dataset.id),
            links: g.querySelectorAll('[data-testid=child-link]').length
          }))`
        )
        const home = folders.find((f) => f.rows.includes(mother))
        check(
          kids.length === 2 &&
            home?.name === workspace.split('/').at(-1) &&
            home.rows[0] === mother &&
            [...home.rows.slice(1)].sort().join(' ') ===
              kids
                .map((id) => `↳${id}`)
                .sort()
                .join(' ') &&
            home.links === 2 &&
            folders.every((f) => !/^\d{8}-/.test(f.name)),
          `Dossiers : deux filles en worktree sous leur mère, dans le dossier du dépôt (${JSON.stringify(folders)})`
        )
        await ui.shot('filles-5-dossiers')
        await ui.click(ui.$('history-grouping'))
        await ui.waitFor(`!!${ui.$('grouping-recent')}`)
        await ui.click(ui.$('grouping-recent'))
        await away()

        // Mère supprimée : ses filles restent, en conversations ordinaires.
        await ui.click(`${row(mother)}.querySelector('[data-testid=history-more]')`)
        await ui.waitFor(`!!${ui.$('history-delete')}`)
        await ui.click(ui.$('history-delete'))
        await ui.waitFor(`!!${ui.$('delete-confirm')}`)
        await ui.click(ui.$('delete-confirm'))
        await ui.waitFor(`!${row(mother)}`)
        await sleep(300)
        check(
          (await ui.ev(
            `${rows}.filter((r) => r.dataset.branch || r.closest('[data-testid=inbox]')).length`
          )) === 2 &&
            !(await ui.ev(`${rows}.some((r) => r.classList.contains('nested'))`)) &&
            !(await ui.ev(`!!document.querySelector('[data-testid=history-item] .child-state')`)),
          'mère supprimée : les filles restent, en conversations en worktree ordinaires'
        )
        await ui.shot('filles-4-mere-supprimee')
      },
      undefined,
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
  await fillesAgentSuite(scheme)
  await fillesProposedSuite(scheme)
}

/** Un dépôt git jetable, avec ce que modifie le scénario `modifications` de l'agent factice. */
function repository() {
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-filles-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return { workspace, git }
}

/**
 * Étape 2 : l'agent lance et suit ses filles par les outils de l'app (scénarios `filles`,
 * `filles-refus`, `filles-plafond`, `fille-message`). L'agent factice répond `echo` hors de ces
 * scénarios : le réveil groupé de la mère montre ce qu'elle a reçu.
 */
async function fillesAgentSuite(scheme) {
  console.log(`\n— Conversations filles lancées par l’agent (${scheme})`)
  const { workspace } = repository()
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-filles-instructions-'))
  let receipt
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          receipt = await agentChildren(ui, main)
        } finally {
          main.close()
        }
      },
      userData,
      'echo',
      // Deux agents vivants au plus : la mère et ses filles dépassent la limite dès la deuxième
      // fille ; aucune fille en cours ne doit être arrêtée pour faire de la place (fiche 043).
      { BOBINE_WORKSPACE: workspace, BOBINE_MAX_LIVE: '2' },
      // Le menu « Réglages » est ouvert depuis le processus principal.
      [`--inspect=${MAIN_PORT}`]
    )
    if (!receipt) throw new Error('Essai des consignes interrompu avant son résultat')
    // Le texte accepté par message_child reste dans le fil sauvegardé, replié après redémarrage.
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(
          `document.querySelector('[data-testid=history-item][data-id="${receipt.mother}"] .history-open')`
        )
        await instructionDetails(ui, receipt, 'reprise-apres-redemarrage')
      },
      userData,
      'echo',
      { BOBINE_WORKSPACE: workspace, BOBINE_MAX_LIVE: '2' }
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
}

async function agentChildren(ui, main) {
  const rows = `[...document.querySelectorAll('[data-testid=history-item]')]`
  const rowOf = (title) =>
    `${rows}.find((r) => !r.hasAttribute('data-preparing') && r.innerText.includes(${JSON.stringify(title)}))`
  const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
  // Sous la mère dans tous les états (fiche 149).
  const children = () => ui.ev(`${rows}.filter((r) => r.dataset.mother).length`)
  const card = () => ui.ev(`${ui.$('proposals')}?.innerText ?? ''`)
  /** Ligne en attente de la carte « Tâches proposées » (fiche 112) pour cette fille. */
  const pendingRow = (title) =>
    `document.querySelector('[data-testid=proposal-row][data-title=${JSON.stringify(title)}][data-outcome=pending]')`
  /** Décide d'une proposition : `action` start (Lancer), here (Faire ici) ou refuse (Refuser). */
  const approve = async (title, action = 'start') => {
    await ui.waitFor(`!!${pendingRow(title)}`, 30000)
    const button = `${pendingRow(title)}.querySelector('[data-testid=proposal-${action}]')`
    // Pointeur d'abord amené sur le bouton, puis visée de nouveau : une proposition qui arrive
    // déplace la mise en page sous le pointeur immobile ; Chromium y voit un survol de la zone de
    // saisie, qui lève la pause du fil (fiche 124), et le fil redescend après la première visée
    // (échec intermittent « En-tête 2 », fiches 143 et 148). Comme une main qui vise une cible qui
    // vient de bouger.
    await ui.hover(await ui.center(button))
    await sleep(200)
    await ui.click(button)
    await ui.waitFor(`!${pendingRow(title)}`)
  }

  await ui.send('Organise le carnet')
  await ui.ready()
  const mother = await activeId()

  // `filles` : une carte « Tâches proposées » pour les propositions du tour (fiche 112). L'agent
  // factice enchaîne ses deux `start_child` : la deuxième proposition arrive une fois la première
  // décidée, sur la même carte. Deux filles, la mère au repos, un seul réveil.
  await ui.send('/scenario filles')
  await ui.waitFor(`!!${pendingRow('Import CSV')}`, 30000)
  const asked = await card()
  check(
    asked.includes(L('children.proposals.title', { count: 1 })) &&
      asked.includes(L('children.proposals.pending', { count: 1 })) &&
      asked.includes(L('children.proposals.start')) &&
      asked.includes(L('children.proposals.here')) &&
      asked.includes(L('children.proposals.refuse')) &&
      (await ui.ev(`document.querySelectorAll('[data-testid=proposals]').length`)) === 1 &&
      (await ui.ev(`document.querySelectorAll('[data-testid=tool]').length`)) === 0,
    'start_child : carte « Tâches proposées », l’appel caché derrière'
  )
  // La consigne se déplie ; les options montrent l'agent de la mère et son modèle.
  await ui.click(`${pendingRow('Import CSV')}.querySelector('[data-testid=proposal-title]')`)
  await ui.waitFor(`${ui.$('proposal-prompt')}?.innerText.includes('/scenario modifications')`)
  await ui.click(`${pendingRow('Import CSV')}.querySelector('[data-testid=proposal-options]')`)
  await ui.waitFor(`!!${ui.$('proposal-model')}`)
  check(
    (await ui.ev(`${ui.$('proposal-agent')}.value`)) === 'mock' &&
      (await ui.ev(`${ui.$('proposal-model')}.options.length`)) > 1,
    'une ligne : consigne dépliable, agent et modèle de la mère proposés'
  )
  await ui.shot('filles-5-propositions')
  await approve('Import CSV')
  // La deuxième proposition rejoint la carte, la première y garde son issue.
  await ui.waitFor(`!!${pendingRow('Page d’aide')}`, 30000)
  const both = await card()
  check(
    both.includes(L('children.proposals.title', { count: 2 })) &&
      both.includes(L('children.proposals.started', { count: 1 })) &&
      both.includes(L('children.proposals.pending', { count: 1 })) &&
      (await ui.ev(`document.querySelectorAll('[data-testid=proposals]').length`)) === 1 &&
      (await ui.ev(
        `document.querySelector('[data-testid=proposal-row][data-title="Import CSV"] [data-testid=proposal-state]')?.innerText`
      )) === L('children.proposals.state.start'),
    'deuxième start_child du tour : même carte, deux lignes, la première « Lancée »'
  )
  await ui.shot('filles-5b-deux-propositions')
  await approve('Page d’aide')
  check(
    (await card()).includes(L('children.proposals.started', { count: 2 })) &&
      (await ui.ev(`document.querySelectorAll('[data-testid=proposal-start]').length`)) === 0,
    'lignes lancées : plus de bouton, le compte sur la carte'
  )
  await ui.waitFor(`!!${ui.$('wake-message')}`, 60000)
  await ui.ready()
  const told = await ui.lastAgentText()
  check(
    !(await ui.ev(`document.querySelector('[data-testid=child-report][data-outcome=error]')`)) &&
      (await ui.ev(
        `document.querySelectorAll('[data-testid=child-report][data-outcome=done]').length`
      )) === 2,
    'au-delà de la limite d’agents vivants, aucune fille n’est arrêtée (deux comptes rendus « fini »)'
  )
  check(
    (await children()) === 2 &&
      (await ui.ev(`document.querySelectorAll('[data-testid=child-report]').length`)) === 2 &&
      (await ui.ev(`${ui.$('child-started')}.innerText`)) ===
        L('children.startedByAgent', { title: 'Import CSV' }),
    'deux filles lancées par l’agent, sous la mère, avec leurs comptes rendus'
  )
  check(
    told.includes('<child_conversations>') &&
      told.includes('Import CSV') &&
      told.includes('Page d’aide') &&
      told.includes('have finished their turn') &&
      (await ui.ev(`document.querySelectorAll('[data-testid=wake-message]').length`)) === 1 &&
      !(await ui.ev(`!!${ui.$('child-report-pending')}`)),
    'réveil groupé : une seule fois, avec les deux comptes rendus'
  )
  await ui.ev(`${ui.$('wake-message')}.scrollIntoView({ block: 'center' }), true`)
  await ui.shot('filles-6-reveil')

  // `filles-refus` avec « Faire ici » : la consigne revient à l'agent, qui le dit (fiche 112).
  await ui.send('/scenario filles-refus')
  await approve('Page d’aide', 'here')
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Je fais la page d’aide ici') &&
      (await ui.lastAgentText()).includes('/scenario streaming-texte') &&
      (await children()) === 2 &&
      (await ui.ev(
        `document.querySelector('[data-testid=proposal-row][data-outcome=here] [data-testid=proposal-state]')?.innerText`
      )) === L('children.proposals.state.here'),
    '« Faire ici » : l’agent reçoit la consigne et la fait dans la conversation, pas de fille'
  )
  await ui.ev(
    `document.querySelector('[data-testid=proposal-row][data-outcome=here]').scrollIntoView({ block: 'center' }), true`
  )
  await ui.shot('filles-6b-faire-ici')
  // Refusée : l'agent le sait, aucune fille de plus.
  await ui.send('/scenario filles-refus')
  await approve('Page d’aide', 'refuse')
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Conversation fille refusée') && (await children()) === 2,
    'start_child refusé : résultat clair pour l’agent, pas de fille'
  )

  // `filles-rafale` (fiche 124, D13) : trois propositions en parallèle, qui arrivent pendant que
  // la première attend. Pointeur sur « Lancer » de la première, dépliée : les suivantes s'ajoutent
  // en dessous, ni la ligne ni son bouton ne bougent ; pointeur sorti, le fil rattrape le bas.
  const lastCard = `[...document.querySelectorAll('[data-testid=proposals]')].at(-1)`
  const scroller = `document.querySelector('.scroll')`
  const gapToBottom = () =>
    ui.ev(
      `(() => { const s = ${scroller}; return s.scrollHeight - s.scrollTop - s.clientHeight })()`
    )
  const first = pendingRow('Liste à lire')
  const startOfFirst = `${first}.querySelector('[data-testid=proposal-start]')`
  const startBox = () =>
    ui.ev(
      `(() => { const b = ${startOfFirst}.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`
    )
  await ui.send('/scenario filles-rafale')
  await ui.waitFor(`!!${first}`, 30000)
  await ui.click(`${first}.querySelector('[data-testid=proposal-title]')`)
  await ui.waitFor(`!!${first}.querySelector('[data-testid=proposal-prompt]')`)
  // Le fil suit le bas à ce moment-là : sans la pause sous le pointeur, il défilerait.
  await ui.waitFor(
    `(() => { const s = ${scroller}; return s.scrollHeight - s.scrollTop - s.clientHeight < 60 })()`
  )
  // Ce que le pointeur survole à partir d'ici (fiche 181) : la fiche 143 avait vu, sous charge
  // avec le SDK ACP 2.0, la pause levée par un `pointerover` inattendu ; non reproduit depuis.
  // En cas d'échec, la trace dit quel élément l'a reçu, où, et la place de la zone de saisie.
  await ui.ev(`(() => {
    window.__pointerTrace = []
    document.addEventListener('pointerover', (e) => {
      const el = e.target instanceof Element ? e.target : null
      const id = el?.closest('[data-testid]')?.getAttribute('data-testid') ?? el?.tagName
      const dock = document.querySelector('.thread-dock')?.getBoundingClientRect().top
      window.__pointerTrace.push(id + '@' + e.clientX + ',' + e.clientY + ' dock ' + Math.round(dock ?? 0) + ' t' + Math.round(performance.now()))
    }, true)
    return true
  })()`)
  const trace = async (ok, label) =>
    ok ? label : `${label} — survols : ${await ui.ev(`window.__pointerTrace.join(' | ')`)}`
  const aim = await ui.center(startOfFirst)
  await ui.hover(aim)
  await ui.ev('new Promise((r) => requestAnimationFrame(() => r(true)))')
  const before = await startBox()
  const inPlace =
    before.x === Math.round(aim.x) &&
    before.y === Math.round(aim.y) &&
    (await ui.ev(`${lastCard}.querySelectorAll('[data-testid=proposal-row]').length`)) === 1
  check(
    inPlace,
    await trace(
      inPlace,
      'propositions en rafale : pointeur en place avant les propositions suivantes'
    )
  )
  await ui.waitFor(`${lastCard}.querySelectorAll('[data-testid=proposal-row]').length === 3`, 30000)
  await ui.waitFor(`document.body.innerText.includes('l’application mobile')`)
  const after = await startBox()
  const order = await ui.ev(
    `[...${lastCard}.querySelectorAll('[data-testid=proposal-row]')].map((r) => r.dataset.title).join(' / ')`
  )
  await ui.shot('filles-6c-propositions-en-rafale')
  const still =
    order === 'Liste à lire / Tests serveur / Application mobile' &&
    after.x === before.x &&
    after.y === before.y &&
    (await ui.ev(`!!${first}.querySelector('[data-testid=proposal-prompt]')`)) &&
    (await ui.ev(
      `document.elementFromPoint(${before.x}, ${before.y})?.closest('button') === ${startOfFirst}`
    ))
  check(
    still,
    await trace(
      still,
      `propositions en rafale : ajoutées dessous, « Lancer » de la ligne dépliée immobile sous le pointeur (${JSON.stringify(before)} → ${JSON.stringify(after)})`
    )
  )
  // Pointeur sorti de la carte (sur la barre latérale) : le fil rattrape le bas.
  await ui.hover({ x: 20, y: 400 })
  await ui.waitFor(
    `(() => { const s = ${scroller}; return s.scrollHeight - s.scrollTop - s.clientHeight < 60 })()`
  )
  check((await gapToBottom()) < 60, 'pointeur sorti de la carte : le fil reprend le bas')
  for (const title of ['Liste à lire', 'Tests serveur', 'Application mobile']) {
    await approve(title, 'refuse')
  }
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Les trois propositions ont leur réponse') &&
      (await children()) === 2,
    'propositions en rafale refusées : le tour finit, pas de fille'
  )

  // `filles-plafond` : plafond réglé à 2 dans Réglages › Conversation.
  await main.evaluate(
    `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
  )
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-conversation'))
  await ui.waitFor(`${ui.$('settings-max-children')}?.innerText === '5'`)
  for (let i = 0; i < 3; i++) await ui.click(ui.$('settings-max-children-less'))
  await ui.waitFor(`${ui.$('settings-max-children')}.innerText === '2'`)
  await ui.shot('filles-7-plafond-reglage')
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
  await ui.send('/scenario filles-plafond')
  await approve('En-tête 1')
  await approve('En-tête 2')
  await ui.ready()
  const capped = await ui.lastAgentText()
  check(
    capped.includes('Cannot start the child conversation "En-tête 3"') &&
      !capped.includes('Cannot start the child conversation "En-tête 2"') &&
      capped.includes('Running child conversations') &&
      (await children()) === 4,
    'au-delà du plafond : start_child répond une erreur qui cite le réglage'
  )
  // « Lancer en parallèle… » grisé, avec une infobulle.
  await ui.click(ui.$('title-menu'))
  await ui.waitFor(`${ui.$('title-launch-child')}?.hasAttribute('data-disabled')`)
  // Position lue une fois le menu immobile (il s'ouvre en glissant). Sous charge (fiche 115, suites
  // en parallèle), un seul survol n'ouvre pas toujours l'infobulle : la souris est ramenée sur
  // l'élément jusqu'à ce qu'elle s'affiche.
  const limitTip = `document.querySelector('.tooltip')?.innerText === ${JSON.stringify(L('children.limit', { count: 2 }))}`
  for (let attempt = 0; ; attempt++) {
    const at = await ui.center(ui.$('title-launch-child'))
    await ui.hover({ x: at.x + (attempt % 2), y: at.y })
    try {
      await ui.waitFor(limitTip, 3000)
      break
    } catch (error) {
      if (attempt >= 4) throw error
    }
  }
  check(true, '« Lancer en parallèle… » grisé au plafond, l’infobulle dit pourquoi')
  await ui.shot('filles-8-plafond-menu')
  await ui.key('Escape')
  // Plafond remis à 5 (par défaut) : les deux filles qui attendent un accord restent en cours.
  await ui.ev(`window.api.settings.setPreferences({ maxChildren: 5 }).then(() => true)`)

  // `fille-message` : la mère écrit à sa fille (en file pendant son premier tour), la fille à sa mère.
  await ui.send('/scenario fille-message')
  await approve('Séparateur CSV')
  await ui.waitFor(`!!${rowOf('Séparateur CSV')}`, 30000)
  await ui.click(rowOf('Séparateur CSV'))
  await ui.waitFor(`!!${ui.$('queued-origin')}`, 30000)
  check(
    (await ui.ev(`${ui.$('queued-origin')}.innerText`)) ===
      L('children.from.parent', { title: 'Organise le carnet' }),
    'message_child : en file d’attente de la fille, « De la conversation mère »'
  )
  await ui.shot('filles-9-file-fille')
  await ui.waitFor(`${ui.$('message-origin')}?.dataset.origin === 'parent'`, 30000)
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('comes from your parent conversation'),
    'la fille reçoit le message, en sachant d’où il vient'
  )
  await ui.click(`document.querySelector('[data-testid=history-item][data-id="${mother}"]')`)
  await ui.waitFor(`${ui.$('message-origin')}?.dataset.origin === 'child'`, 30000)
  check(
    (await ui.ev(`${ui.$('message-origin')}.innerText`)) ===
      L('children.from.child', { title: 'Séparateur CSV' }),
    'message_parent : dans la mère, « De la conversation fille »'
  )
  await ui.ev(
    `document.querySelector('[data-testid=message-origin][data-origin=child]').scrollIntoView({ block: 'center' }), true`
  )
  await ui.shot('filles-10-message-mere')
  const instruction = await ui.ev(
    `window.api.conversations.view(${JSON.stringify(mother)}).then(v => v.transcript.items.findLast(i => i.kind === 'child-instruction'))`
  )
  if (!instruction) throw new Error('Consigne de reprise absente du fil de la mère')
  const receipt = { mother, ...instruction }
  await instructionDetails(ui, receipt, 'reprise')
  const launch = `document.querySelector('[data-testid=child-started][data-child-id="${instruction.childId}"]')`
  const initialPrompt = await ui.ev(
    `window.api.conversations.view(${JSON.stringify(mother)}).then(v=>v.transcript.items.find(i=>i.kind==='child-started'&&i.childId===${JSON.stringify(instruction.childId)}).prompt)`
  )
  check(!(await ui.ev(`${launch}.open`)), 'consigne initiale repliée par défaut')
  await ui.click(`${launch}.querySelector('summary')`)
  await ui.ev(`${launch}.scrollIntoView({block:'center'}), true`)
  check(
    (await ui.ev(`${launch}.querySelector('[data-testid=child-instruction-text]').textContent`)) ===
      initialPrompt,
    'consigne initiale complète, identique à celle du lancement'
  )
  await ui.shot('150-consigne-initiale')
  await ui.click(`${launch}.querySelector('summary')`)
  return receipt
}

/** Fiche 150 : texte complet, native details au clavier et retour à l'état replié. */
async function instructionDetails(ui, receipt, name) {
  const row = `document.querySelector('[data-testid=child-instruction][data-child-id="${receipt.childId}"]')`
  await ui.waitFor(`!!${row}`)
  check(!(await ui.ev(`${row}.open`)), `${name} : consigne repliée par défaut`)
  check(
    (await ui.ev(`${row}.querySelector('summary').innerText`)) ===
      L('children.instructionFor', { title: receipt.title }),
    `${name} : consigne rattachée à la bonne fille`
  )
  await ui.ev(
    `${row}.scrollIntoView({block:'center'}), ${row}.querySelector('summary').focus(), true`
  )
  if (name === 'reprise') await ui.shot('150-consigne-repliee')
  await ui.enter()
  await ui.waitFor(`${row}.open`)
  await ui.ev(`${row}.scrollIntoView({block:'center'}), true`)
  check(
    (await ui.ev(`${row}.querySelector('[data-testid=child-instruction-text]').textContent`)) ===
      receipt.prompt,
    `${name} : texte accepté par message_child conservé sans troncature`
  )
  await ui.shot(`150-consigne-${name}`)
  await ui.enter()
  await ui.waitFor(`!${row}.open`)
}

/**
 * Fiche 118 : l'agent propose des filles sans qu'on le lui dise, grâce au contexte de session.
 * Scénario `chantiers` : il propose deux filles seulement s'il a reçu `<bobine_capabilities>` (premier
 * message d'une session, réglage « Quand ça s'y prête ») ou la demande de `/split` ; sinon il fait
 * le travail lui-même. Une conversation neuve par essai : le contexte ne part qu'une fois par session.
 */
async function fillesProposedSuite(scheme) {
  console.log(`\n— Conversations filles proposées sans consigne (${scheme})`)
  const { workspace } = repository()
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          await proposedChildren(ui, main)
        } finally {
          main.close()
        }
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace },
      // Le menu « Réglages » est ouvert depuis le processus principal.
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

async function proposedChildren(ui, main) {
  const pending = `document.querySelectorAll('[data-testid=proposal-row][data-outcome=pending]')`
  const cards = () => ui.ev(`document.querySelectorAll('[data-testid=proposals]').length`)
  /** Refuse les propositions du tour, l'une après l'autre (le scénario les enchaîne). */
  const refuseAll = async (titles) => {
    for (const title of titles) {
      const row = `document.querySelector('[data-testid=proposal-row][data-title=${JSON.stringify(title)}]')`
      await ui.waitFor(`${row}?.dataset.outcome === 'pending'`, 30000)
      await ui.click(`${row}.querySelector('[data-testid=proposal-refuse]')`)
      await ui.waitFor(`${row}.dataset.outcome !== 'pending'`)
    }
    await ui.ready()
  }
  const titles = ['Fenêtre À propos', 'Essais plus courts']
  const fresh = async () => {
    await ui.click(ui.$('new-conversation'))
    await ui.waitFor(`!!${ui.$('welcome')}`)
    await ui.ready()
  }
  const setProposals = (value) =>
    ui.ev(`window.api.settings.setPreferences({ childProposals: '${value}' }).then(() => true)`)

  // Réglages › Conversation, trouvé par la recherche : « Quand ça s'y prête » par défaut.
  await main.evaluate(
    `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
  )
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.ev(`${ui.$('settings-search')}.focus(); true`)
  await ui.type(LANG === 'en' ? 'propose child' : 'proposer des')
  await ui.waitFor(
    `[...document.querySelectorAll('[data-testid=settings-result]')].some((r) => r.innerText.includes(${JSON.stringify(L('settings.conversation.childProposals.label'))}))`
  )
  await ui.enter()
  await ui.waitFor(`${ui.$('settings-conversation')}?.getAttribute('aria-current') === 'true'`)
  await ui.waitFor(`!!${ui.$('child-proposals-whenFitting')}`)
  check(
    (await ui.ev(`${ui.$('child-proposals-whenFitting')}.getAttribute('aria-checked')`)) === 'true',
    'recherche des réglages : « Proposer des conversations filles », « Quand ça s’y prête » par défaut'
  )
  await ui.click(ui.$('child-proposals-never'))
  await ui.waitFor(`${ui.$('child-proposals-never')}.getAttribute('aria-checked') === 'true'`)
  await ui.ev(`${ui.$('child-proposals-never')}.scrollIntoView({ block: 'center' }), true`)
  await ui.shot('filles-11-reglage-propositions')
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)

  // « Jamais » : pas de contexte de session, l'agent fait le travail lui-même.
  await ui.send('/scenario chantiers')
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Je fais les deux chantiers moi-même') &&
      (await cards()) === 0,
    '« Jamais » : pas de carte, l’agent fait les chantiers lui-même'
  )

  // « Quand ça s'y prête » : premier message d'une session, le contexte part ; la carte s'ouvre.
  await setProposals('whenFitting')
  await fresh()
  await ui.send('/scenario chantiers')
  await ui.waitFor(`${pending}.length === 1`, 30000)
  const card = await ui.ev(`${ui.$('proposals')}.innerText`)
  const first = await ui.ev(`${pending}[0].dataset.title`)
  check(
    card.includes(L('children.proposals.title', { count: 1 })) && first === titles[0],
    `« Quand ça s’y prête » : sans consigne, carte « Tâches proposées » (${first})`
  )
  await ui.shot('filles-12-propositions-contexte')
  await refuseAll(titles)
  check(
    (await ui.lastAgentText()).includes('(contexte de session)'),
    'l’agent a proposé grâce au contexte de session'
  )
  // Deuxième message de la même session : plus de contexte, il fait le travail lui-même.
  await ui.send('/scenario chantiers')
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Je fais les deux chantiers moi-même') &&
      (await cards()) === 1,
    'le contexte de session ne part qu’une fois'
  )

  // `/split` : la demande explicite suffit, même réglé sur « Jamais ».
  await setProposals('never')
  await fresh()
  const users = () => ui.ev(`document.querySelectorAll('.msg-user').length`)
  const before = await users()
  await ui.ev(`${ui.$('composer-input')}.focus(); true`)
  await ui.type('/split /scenario chantiers')
  await ui.press('Escape')
  await ui.press('Enter')
  await ui.waitFor(`${pending}.length === 1`, 30000)
  check(
    (await users()) === before + 1 &&
      (await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)) ===
        '/scenario chantiers',
    '/split : le message tapé part, sans la commande'
  )
  await ui.shot('filles-13-commande-filles')
  await refuseAll(titles)
  check(
    (await ui.lastAgentText()).includes('(/split)'),
    '/split : carte « Tâches proposées » sur demande, réglage « Jamais »'
  )
  await setProposals('whenFitting')
}
