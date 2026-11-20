import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, check, sleep, withApp } from '../lib.mjs'

/** Titres des filles entre guillemets de la langue, en liste : « A » et « B ». */
const titles = (...list) =>
  new Intl.ListFormat(LANG, { type: 'conjunction' }).format(
    list.map((title) => L('childrenMerge.quote', { title }))
  )

const README = '# Démo\n\nVersion 1\n\n## Utilisation\n'
/** Ce qu'écrit le scénario `conflits` de l'agent factice quand on lui demande de résoudre. */
const RESOLVED = '# Démo\n\nVersion 2 et 3\n\n## Utilisation\n\nLancer `node src/app.js`.\n'
const MOTHER = 'Organise le carnet'
/** Fichier de la mère, modifié dans le dossier principal pendant que ses filles travaillent. */
const TODO = '- [ ] relire\n'
const TODO_DRAFT = '- [ ] relire\n- [ ] publier\n'
/** Les trois travaux proposés par le scénario `fusion-trois` (titres seulement : consignes là-bas). */
const CHILDREN = [{ title: 'Import CSV' }, { title: 'Page d’aide' }, { title: 'Notes de version' }]

/**
 * Fusionner les travaux d'une carte de groupe (fiches 120, 264), dans un dépôt git jetable : trois
 * travaux proposés par l'agent (`fusion-trois`), « Tout lancer » ; deux touchent README.md
 * (recouvrement dit), un a des modifications non commitées (exclu, dit) ; puis la fusion enchaînée
 * dans la carte, avec « Puis nettoyer » : la deuxième entre en conflit, l'agent factice le résout
 * (scénario `conflits`), la fusion reprend. Enfin, l'app redémarrée garde l'issue dans la carte.
 */
export async function fillesFusionSuite(scheme) {
  console.log(`\n— Fusionner toutes les filles (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-fusion-')))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-fusion-data-'))
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), README)
  writeFileSync(join(workspace, 'TODO.md'), TODO)
  git(workspace, 'init', '-q', '-b', 'main')
  git(workspace, 'add', '.')
  git(workspace, 'commit', '-q', '-m', 'init')
  git(workspace, 'config', 'user.name', 'e2e')
  git(workspace, 'config', 'user.email', 'e2e@example.invalid')
  /** Commit de tout le worktree, comme « Committer » ; réessayé si l'app lit l'index au même moment. */
  const commitAll = async (cwd, message) => {
    for (let attempt = 0; ; attempt++) {
      try {
        git(cwd, 'add', '-A')
        git(cwd, 'commit', '-q', '-m', message)
        return
      } catch (error) {
        if (attempt >= 5 || !String(error.message).includes('index.lock')) throw error
        await sleep(200)
      }
    }
  }
  const env = { BOBINE_WORKSPACE: workspace }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        // Une conversation déjà commencée (un brouillon n'a pas de travaux, fiche 097).
        await ui.send(`/scenario echo ${MOTHER}`)
        await ui.ready()
        await ui.send('/scenario fusion-trois')
        await ui.waitFor(`!!${ui.$('work-group-start-all')}`, 30000)
        const mother = await activeId()
        await ui.ev(`window.api.conversations.rename('${mother}', ${JSON.stringify(MOTHER)})`)
        await ui.click(ui.$('work-group-start-all'))
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=work-row][data-state=replied]').length === 3`,
          60000
        )
        check(
          !(await ui.ev(`!!${ui.$('subtasks')}`)) && !(await ui.ev(`!!${ui.$('child-report')}`)),
          'trois travaux sur les lignes de leur carte : ni « Sous-tâches » ni compte rendu séparé'
        )
        /** Dossier (worktree) de chaque fille, par titre. */
        const folders = Object.fromEntries(
          (
            await ui.ev(
              `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
            )
          ).map(([title, folder]) => [title, folder])
        )
        const [csv, help, notes] = CHILDREN.map((c) => folders[c.title])
        check(!!csv && !!help && !!notes, 'trois filles, chacune dans son worktree')
        // Ce que l'utilisateur ferait depuis la vue Git de chaque fille (fiche 110).
        await commitAll(csv, 'feat: import CSV')
        writeFileSync(join(help, 'README.md'), '# Démo\n\nVersion 3\n\n## Utilisation\n')
        await commitAll(help, 'docs: page d’aide')
        writeFileSync(join(notes, 'NOTES.md'), '# Notes de version\n')

        /** Revenir à la mère depuis une fille : la carte relit les branches. */
        const reread = async () => {
          // Comme un utilisateur : la ligne dépliée, puis « Ouvrir sa conversation » à l'écran.
          // Une ligne désignée par son travail, pas par sa place : des travaux lancés ensemble
          // peuvent encore changer de rang le temps que leurs dates arrivent (fiche 266).
          const id = await ui.ev(
            `document.querySelector('[data-testid=work-row]')?.dataset.childId`
          )
          const row = `document.querySelector('[data-testid=work-row][data-child-id="${id}"]')`
          const open = `${row}?.querySelector('[data-testid=work-open]')`
          if (!(await ui.ev(`!!${open}`))) {
            await ui.reveal(`${row}.querySelector('[data-testid=work-row-toggle]')`)
            await ui.click(`${row}.querySelector('[data-testid=work-row-toggle]')`)
          }
          await ui.waitFor(`!!${open}`)
          await ui.reveal(open)
          // La carte relit les branches au retour (plan de fusion) : la ligne gagne sa méta et peut
          // descendre d'une ligne. Comme un humain, on attend qu'elle ne bouge plus (fiche 266 :
          // l'appui tombait sur la ligne de transmission, juste au-dessus).
          await ui.waitFor(
            `(() => { const y = ${open}?.getBoundingClientRect().y; const s = window.__openY; window.__openY = y; return y !== undefined && s === y })()`,
            10000
          )
          await new Promise((resolve) => setTimeout(resolve, 300))
          await ui.waitFor(
            `(() => { const y = ${open}?.getBoundingClientRect().y; const s = window.__openY; window.__openY = y; return s === y })()`,
            10000
          )
          await ui.reveal(open)
          await ui.click(open)
          await ui.waitFor(`!!${ui.$('title-origin')}`)
          await ui.click(ui.$('title-origin'))
          await ui.waitFor(
            `document.querySelector('.history-item.active')?.dataset.id === '${mother}'`
          )
        }
        await reread()
        // Dans l'ordre des lignes : celui du lancement (revue UX, fiche 264).
        const order = await ui.ev(
          `[...document.querySelectorAll('[data-testid=work-row-name]')].map((n) => n.innerText).filter((t) => t !== 'Notes de version')`
        )
        const overlap = L('childrenMerge.summary.overlap', {
          titles: titles(...order),
          files: 'README.md'
        })
        const before = [
          L('childrenMerge.summary.all', { count: 2 }),
          overlap,
          L('childrenMerge.summary.dirty', { count: 1, titles: titles('Notes de version') })
        ].join(' ')
        await ui.waitFor(
          `${ui.$('subtasks-merge-summary')}?.innerText === ${JSON.stringify(before)}`,
          20000
        )
        check(
          (await ui.ev(`${ui.$('subtasks-merge-start')}.innerText`)) ===
            L('workGroup.merge.action', { count: 2, base: 'main' }),
          'pied de carte : deux prêtes, recouvrement sur README.md, la troisième non commitée et dite'
        )
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('120-fusion-pied')

        // La troisième est commitée : les trois sont prêtes.
        await commitAll(notes, 'docs: notes de version')
        await reread()
        await ui.waitFor(
          `${ui.$('subtasks-merge-start')}?.innerText === ${JSON.stringify(L('workGroup.merge.action', { count: 3, base: 'main' }))}`,
          20000
        )
        check(
          (await ui.ev(`${ui.$('subtasks-merge-summary')}.innerText`)) ===
            `${L('childrenMerge.summary.all', { count: 3 })} ${overlap}` &&
            !(await ui.ev(`${ui.$('subtasks-merge-cleanup')}.checked`)),
          '« Fusionner les 3 dans main », « Puis nettoyer » décoché par défaut'
        )

        // La mère a travaillé dans le dossier principal (fiche 123) : la fusion ne part pas, la
        // carte dit pourquoi, avec les fichiers, « Committer d'abord » et « Mettre de côté ».
        writeFileSync(join(workspace, 'TODO.md'), TODO_DRAFT)
        writeFileSync(join(workspace, 'brouillon.txt'), 'idée\n')
        await reread()
        await ui.waitFor(`!!${ui.$('main-dirty')}`, 20000)
        const dirtyFiles = await ui.ev(
          `[...document.querySelectorAll('[data-testid=main-dirty-file]')].map((f) => f.innerText)`
        )
        check(
          (await ui.ev(`${ui.$('main-dirty-title')}.innerText`)) ===
            L('worktreeCycle.mainDirty.title', { count: 2 }) &&
            dirtyFiles.join(',') === 'TODO.md,brouillon.txt' &&
            !(await ui.ev(`!!${ui.$('subtasks-merge-start')}`)),
          `fusion refusée d’avance : dossier principal non commité (${dirtyFiles.join(', ')})`
        )
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('123-fusion-refusee')
        await ui.click(ui.$('main-dirty-commit'))
        await ui.waitFor(`!!${ui.$('main-dirty-commit-message')}`)
        // Fiche 246 : rédigé par l'agent de la mère (factice), d'après les fichiers cochés.
        await ui.waitFor(`${ui.$('main-dirty-commit-draft')}?.dataset.state === 'agent'`, 15000)
        check(
          (await ui.ev(`${ui.$('main-dirty-commit-message')}.value`)).startsWith(
            'feat: update TODO.md and brouillon.txt\n\nMock agent draft: 2 file(s)'
          ),
          '« Committer d’abord » : message rédigé par l’agent de la mère, modifiable'
        )
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('123-fusion-committer-d-abord')
        await ui.click(ui.$('main-dirty-commit-cancel'))
        await ui.waitFor(`!${ui.$('main-dirty-commit-message')}`)

        await ui.click(ui.$('subtasks-merge-cleanup'))
        await ui.waitFor(`${ui.$('subtasks-merge-cleanup')}.checked`)
        // L'état « l'agent résout le conflit » dure le tour de la fille, parfois moins d'une
        // sonde : la carte est relevée au moment même où il apparaît.
        await ui.ev(`(() => {
          const state = (title) => [...document.querySelectorAll('[data-testid=work-row]')]
            .find((r) => r.innerText.includes(title))
            ?.querySelector('[data-testid=subtask-merge-state]')?.dataset.state
          const text = (id) => document.querySelector('[data-testid=' + id + ']')?.innerText
          window.__resolving = null
          window.__mergeTrace = { events: [], dom: [] }
          window.api.agent.onEvent(({ conversationId, event }) => {
            if (conversationId !== '${mother}' || event.type !== 'children-merge') return
            window.__mergeTrace.events.push({
              status: event.merge.status,
              rows: event.merge.rows.map((r) => ({ title: r.title, state: r.state }))
            })
          })
          let last
          const look = () => {
            const current = JSON.stringify([...document.querySelectorAll('[data-testid=work-row]')]
              .map((r) => ({ title: r.querySelector('[data-testid=work-row-name]')?.innerText,
                state: r.querySelector('[data-testid=subtask-merge-state]')?.dataset.state })))
            if (current !== last) window.__mergeTrace.dom.push(JSON.parse(last = current))
            // Dans l'ordre des lignes (lancement) : celle qui résout, celles d'avant, d'après.
            const states = [...document.querySelectorAll('[data-testid=work-row]')].map(
              (r) => r.querySelector('[data-testid=subtask-merge-state]')?.dataset.state
            )
            const at = states.indexOf('resolving')
            if (window.__resolving || at === -1) return
            window.__resolving = {
              states,
              at,
              progress: text('subtasks-merge-progress'),
              resolving: text('subtasks-merge-resolving'),
              stash: text('subtasks-merge-stash')
            }
          }
          new MutationObserver(look).observe(document.body, {
            subtree: true, childList: true, attributes: true, characterData: true
          })
          return true
        })()`)
        // « Mettre de côté » : git stash le temps de la fusion, remis après.
        await ui.click(ui.$('main-dirty-stash'))
        // La carte reste sous les yeux : le fil ne suit plus le bas pendant que les comptes rendus
        // de la fille arrivent.
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)

        // La deuxième entre en conflit : la fille le résout (scénario `conflits`).
        try {
          await ui.waitFor(`!!window.__resolving`, 30000)
        } catch (error) {
          console.log('Trace de fusion :', JSON.stringify(await ui.ev('window.__mergeTrace')))
          throw error
        }
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        const seen = await ui.ev(`window.__resolving`)
        check(
          seen.states.slice(0, seen.at).every((st) => st === 'merged') &&
            seen.states.slice(seen.at + 1).every((st) => st === 'pending') &&
            seen.progress ===
              L('workGroup.merge.progress', { count: seen.at, total: 3, base: 'main' }) &&
            seen.resolving === L('workGroup.merge.resolving'),
          `en cours : celles d’avant fusionnées, une en conflit résolu par son travail (dit), les suivantes en attente (${JSON.stringify(seen)})`
        )
        check(
          seen.stash === L('childrenMerge.stashKept', { count: 2 }),
          'pendant la fusion : les modifications de la mère sont mises de côté, et c’est dit'
        )
        await ui.shot('120-fusion-en-cours')
        await ui.shot('264-groupe-fusion-en-cours')

        await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'done'`, 90000)
        const result = await ui.ev(`${ui.$('subtasks-merge-result')}.innerText`)
        const done = L('workGroup.merge.result.done', { count: 3, base: 'main', duration: '§' })
        const [head, tail] = done.split('§')
        check(
          result.startsWith(head) &&
            result.includes(`${tail} ${L('childrenMerge.result.cleaned', { count: 3 })}`) &&
            result.endsWith(L('worktreeCycle.mainDirty.stashRestored', { count: 2 })),
          `fin : « ${result} »`
        )
        const childTexts = await ui.ev(
          `window.api.conversations.get().then((s) => Promise.all(s.conversations.filter((c) => ['Page d’aide', 'Import CSV'].includes(c.title)).map((c) => window.api.conversations.view(c.id)))).then((v) => v.flatMap((x) => x.transcript.items.filter((i) => i.kind === 'user').map((i) => ({ text: i.text, from: i.from?.kind }))))`
        )
        check(
          childTexts.some((m) => m.text.includes('left conflicts') && m.from === 'merge'),
          'la consigne de conflit de la fiche 110 est partie au travail, avec sa provenance (fiche 264)'
        )
        check(
          readFileSync(join(workspace, 'README.md'), 'utf8') === RESOLVED &&
            existsSync(join(workspace, 'src', 'app.js')) &&
            existsSync(join(workspace, 'NOTES.md')) &&
            git(workspace, 'status', '--porcelain', '--untracked-files=no') === 'M TODO.md' &&
            readFileSync(join(workspace, 'TODO.md'), 'utf8') === TODO_DRAFT &&
            readFileSync(join(workspace, 'brouillon.txt'), 'utf8') === 'idée\n' &&
            git(workspace, 'stash', 'list') === '',
          'main a les trois filles, conflit résolu ; les modifications de la mère sont revenues'
        )
        check(
          git(workspace, 'branch', '--list', 'bobine/*') === '' &&
            git(workspace, 'worktree', 'list').split('\n').length === 1 &&
            ![csv, help, notes].some((folder) => existsSync(folder)),
          '« Puis nettoyer » : worktrees et branches supprimés'
        )
        const badges = await ui.ev(
          `[...document.querySelectorAll('[data-testid=subtask-merge-state]')].map((b) => b.dataset.state + ':' + b.innerText)`
        )
        check(
          badges.length === 3 &&
            badges.every((b) => b === `merged:${L('workGroup.merge.row.merged')}`),
          `chaque ligne : « fusionné » seul (${badges.join(', ')})`
        )
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('120-fusion-finie')
        await ui.shot('264-groupe-fusionne')
      },
      userData,
      'conflits',
      env
    )

    // Redémarrage : l'issue de la fusion est dans le fil de la mère (fiche 103).
    await withApp(
      scheme,
      async (ui) => {
        const item = `[...document.querySelectorAll('[data-testid=history-item]')].find((r) => r.innerText.includes(${JSON.stringify(MOTHER)}))`
        await ui.waitFor(`!!${item}`, 20000)
        await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
        await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'done'`, 20000)
        check(true, 'après redémarrage : la carte dit toujours la fusion faite')
      },
      userData,
      'echo',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
