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
 * (scénario `conflits`) et la fusion s'arrête là, résolution à relire (fiche 289, journal Bricole
 * 21:16-21:17) ; « Voir la résolution ». L'app redémarrée garde cet état ; la fusion repart sur un
 * clic (« Mettre de côté »), puis l'app redémarrée garde l'issue dans la carte.
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
        /** Dossier (worktree) de chaque fille, par titre. */
        const folders = Object.fromEntries(
          (
            await ui.ev(
              `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
            )
          ).map(([title, folder]) => [title, folder])
        )
        const [csv, help, notes] = CHILDREN.map((c) => folders[c.title])
        // Un worktree par fille : vérifié dans `parcours-deleguer` ; ici, une garde, pour ne
        // jamais committer hors d'un dossier d'essai.
        if (!csv || !help || !notes) throw new Error(`worktrees des filles introuvables`)
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
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('120-fusion-pied')

        // La troisième est commitée : les trois sont prêtes.
        await commitAll(notes, 'docs: notes de version')
        await reread()
        await ui.waitFor(
          `${ui.$('subtasks-merge-start')}?.innerText === ${JSON.stringify(L('workGroup.merge.action', { count: 3, base: 'main' }))}`,
          20000
        )

        // La mère a travaillé dans le dossier principal (fiche 123) : la fusion ne part pas, la
        // carte dit pourquoi, avec les fichiers, « Committer d'abord » et « Mettre de côté ».
        writeFileSync(join(workspace, 'TODO.md'), TODO_DRAFT)
        writeFileSync(join(workspace, 'brouillon.txt'), 'idée\n')
        await reread()
        await ui.waitFor(`!!${ui.$('main-dirty')}`, 20000)
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
              title: [...document.querySelectorAll('[data-testid=work-row-name]')][at]?.innerText,
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
        await ui.shot('120-fusion-en-cours')
        await ui.shot('264-groupe-fusion-en-cours')

        // Fiche 289 (journal Bricole, 21:16-21:17) : le conflit résolu par l'agent reste dans la
        // branche du travail ; la fusion s'arrête là, la carte demande une relecture. Contrôles qui ne
        // lèvent pas : sur une version sans le correctif, la fusion va au bout et ils le disent.
        const result = ui.$('subtasks-merge-result')
        await ui.waitFor(`['review', 'done'].includes(${result}?.dataset.status)`, 90000)
        const resolved = await ui.ev(
          `[...document.querySelectorAll('[data-testid=work-row]')].find((r) => r.querySelector('[data-testid=subtask-merge-state]')?.dataset.state === 'resolved')?.querySelector('[data-testid=work-row-name]')?.innerText ?? null`
        )
        const conflicted = seen.title
        check(
          (await ui.ev(`${result}?.dataset.status`)) === 'review' && resolved === conflicted,
          `fiche 289 : la fusion s’arrête après la résolution du conflit par l’agent, sa ligne dit « ${L('workGroup.merge.row.resolved')} » (${resolved})`
        )
        check(
          readFileSync(join(workspace, 'README.md'), 'utf8') !== RESOLVED &&
            !existsSync(join(workspace, 'NOTES.md')),
          'fiche 289 : rien de la résolution ni des travaux suivants n’est entré dans main'
        )
        const branch = folders[conflicted]
        check(
          !!branch &&
            readFileSync(join(branch, 'README.md'), 'utf8') === RESOLVED &&
            git(branch, 'status', '--porcelain') === '' &&
            git(branch, 'log', '-1', '--format=%P').split(' ').length === 2,
          'fiche 289 : la résolution est commitée dans la branche du travail (commit de fusion)'
        )
        check(
          (await ui.ev(`${result}?.innerText ?? ''`)).includes(
            L('childrenMerge.result.review', {
              title: titles(conflicted),
              files: 'README.md',
              base: 'main'
            })
          ),
          'fiche 289 : la carte nomme le travail, le fichier et la base, et demande une relecture'
        )
        // La chaîne finit après avoir posé « à relire » : la mise de côté revient juste après.
        for (let i = 0; i < 100 && git(workspace, 'stash', 'list') !== ''; i++) await sleep(100)
        check(
          git(workspace, 'stash', 'list') === '' &&
            readFileSync(join(workspace, 'TODO.md'), 'utf8') === TODO_DRAFT,
          'fusion arrêtée : les modifications mises de côté de la mère sont revenues'
        )
        // Le travail a fini son tour de résolution et la mise de côté est revenue : la carte relue
        // propose la reprise par ses refus habituels (dossier principal non commité).
        await ui.waitFor(`!!${ui.$('main-dirty')}`, 20000)
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('289-fusion-a-relire')

        // « Voir la résolution » : les modifications du travail, où se lit celle de README.md.
        await ui.waitFor(`!!${ui.$('subtasks-merge-resolution')}`, 5000)
        await ui.click(ui.$('subtasks-merge-resolution'))
        const shown = await ui
          .waitFor(
            `[...document.querySelectorAll('[data-testid=changes-file]')].some((f) => f.innerText.includes('README.md'))`,
            15000
          )
          .then(
            () => true,
            () => false
          )
        check(
          shown &&
            (
              await ui.ev(`document.querySelector('.history-item.active')?.innerText ?? ''`)
            ).includes(conflicted),
          '« Voir la résolution » : les modifications du travail montrent README.md'
        )
        // Onglet Conversation : toutes les modifications de l'agent dans ce travail, par fichier. Ici
        // son seul geste est la résolution (son travail d'avant a été commité « à la main ») : un seul
        // fichier, compté depuis le texte avec ses marques (+1 −5), pas contre la base (+1 −1).
        const listed = await ui.ev(
          `[...document.querySelectorAll('[data-testid=changes-file]')].map((f) => f.innerText.replace(/\\s+/g, ' ').trim())`
        )
        check(
          listed.length === 1 && /README\.md \+1 [−-]5/.test(listed[0]),
          `« Voir la résolution » : un seul fichier, README.md +1 −5 (${JSON.stringify(listed)})`
        )
        await ui.shot('289-voir-la-resolution')
      },
      userData,
      'conflits',
      env
    )

    // Redémarrage (fiche 289) : la fusion arrêtée « à relire » est dans le fil de la mère ; elle ne
    // part que sur un clic, par les refus habituels (ici, la mère a des modifications : « Mettre de
    // côté »).
    await withApp(
      scheme,
      async (ui) => {
        const item = `[...document.querySelectorAll('[data-testid=history-item]')].find((r) => r.innerText.includes(${JSON.stringify(MOTHER)}))`
        await ui.waitFor(`!!${item}`, 20000)
        await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
        await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'review'`, 20000)
        check(
          readFileSync(join(workspace, 'README.md'), 'utf8') !== RESOLVED &&
            (await ui.ev(
              `[...document.querySelectorAll('[data-testid=subtask-merge-state]')].some((s) => s.dataset.state === 'resolved')`
            )),
          'après redémarrage : toujours « à relire », main inchangé'
        )
        await ui.waitFor(`!!${ui.$('main-dirty-stash')}`, 20000)
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.click(ui.$('main-dirty-stash'))
        await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'done'`, 60000)
        check(
          readFileSync(join(workspace, 'README.md'), 'utf8') === RESOLVED &&
            existsSync(join(workspace, 'src', 'app.js')) &&
            existsSync(join(workspace, 'NOTES.md')) &&
            git(workspace, 'status', '--porcelain', '--untracked-files=no') === 'M TODO.md' &&
            readFileSync(join(workspace, 'TODO.md'), 'utf8') === TODO_DRAFT &&
            readFileSync(join(workspace, 'brouillon.txt'), 'utf8') === 'idée\n' &&
            git(workspace, 'stash', 'list') === '' &&
            git(workspace, 'log', '-1', '--format=%P').split(' ').length === 2,
          'au clic : main a les trois travaux, conflit résolu ; les modifications de la mère sont revenues'
        )
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('120-fusion-finie')
        await ui.shot('264-groupe-fusionne')
      },
      userData,
      'echo',
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
