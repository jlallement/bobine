import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

/**
 * Préparation des worktrees (fiche 175) : `.worktreeinclude` copie le `.env` ignoré, les commandes
 * de `.bobine/worktree.json` (à la création et à la suppression) sont montrées et attendent
 * l'accord ; un fichier changé avant l'accord ne lance rien ; puis la commande tourne, et l'accord
 * vaut pour le worktree suivant. Pendant la commande, un message attend sur la carte : « Arrêter »,
 * « Continuer sans attendre ». `archive` seule a sa carte. Une tâche planifiée n'attend pas
 * l'accord (recette 0.9, défauts D1 à D6).
 */
export async function worktreeSetupSuite(scheme) {
  console.log(`\n— Préparation des worktrees (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-preparation-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Démo\n')
  writeFileSync(join(workspace, '.gitignore'), '.env\nprepared.txt\n')
  writeFileSync(join(workspace, '.worktreeinclude'), '.env\n')
  mkdirSync(join(workspace, '.bobine'))
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-preparation-hors-')))
  const archiveMarker = join(outside, 'archive-lancee')
  const config = (setup, archive = `touch ${archiveMarker}`) =>
    JSON.stringify({ ...(setup ? { setup } : {}), ...(archive ? { archive } : {}) })
  const step = (word) =>
    `echo "Installation des dépendances…"; sleep 1; echo "${word}" > prepared.txt; echo "Fini."`
  // Commande d'abord montrée ; remplacée avant l'accord (D2).
  writeFileSync(join(workspace, '.bobine', 'worktree.json'), config(step('montré')))
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  writeFileSync(join(workspace, '.env'), 'TOKEN=essai\n')
  const worktreePaths = () =>
    git('worktree', 'list', '--porcelain')
      .split('\n')
      .filter((l) => l.startsWith('worktree ') && l !== `worktree ${workspace}`)
      .map((l) => l.slice('worktree '.length))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const card = ui.$('worktree-setup')
        // Dossier d'origine du prochain worktree : celui de la conversation affichée.
        let source = workspace
        const seen = new Set()
        const newWorktree = async () => {
          const before = await ui.ev(`${ui.$('workspace-menu')}?.innerText.trim() ?? ''`)
          // Menu rouvert si le premier clic n'a rien ouvert (rendu du fil qui finit).
          for (let attempt = 0; ; attempt++) {
            await ui.click(ui.$('workspace-menu'))
            const opened = await ui
              .waitFor(`!!${ui.$('workspace-worktree')}`, 3000)
              .then(() => true)
              .catch(() => false)
            if (opened) break
            if (attempt === 2) throw new Error('menu du dossier : « Nouveau worktree » absent')
          }
          await ui.click(ui.$('workspace-worktree'))
          // Une autre branche que celle d'avant : le nouveau worktree est affiché.
          const menu = ui.$('workspace-menu')
          await ui.waitFor(
            `${menu}?.innerText.startsWith('bobine/') && ${menu}.innerText.trim() !== ${JSON.stringify(before)}`
          )
          await ui.ready()
          const path = worktreePaths().find((p) => !seen.has(p))
          seen.add(path)
          source = path
          return path
        }

        // Premier worktree : `.env` copié, commande montrée, à autoriser.
        const first = await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'approval'`)
        check(
          readFileSync(join(first, '.env'), 'utf8') === 'TOKEN=essai\n' &&
            !existsSync(join(first, 'prepared.txt')) &&
            (await ui.ev(`${ui.$('worktree-setup-command')}.innerText`)).includes('prepared.txt') &&
            (await ui.ev(`!!${ui.$('worktree-setup-approve')}`)),
          'worktree : .env ignoré copié, commande du dépôt à autoriser, pas lancée'
        )
        // Un message envoyé avant l'accord attend : la carte le dit, rien ne part à l'agent.
        const users = `document.querySelectorAll('.msg-user').length`
        const typeAndSend = async (text) => {
          await ui.ev(`${ui.$('composer-input')}.focus()`)
          await ui.type(text)
          await ui.enter()
        }
        await typeAndSend('Travail préparé')
        await ui.waitFor(`!!${ui.$('worktree-setup-held')}`)
        await ui.ev(`${card}.querySelector('details').open = true`)
        await ui.shot('175-preparation-a-autoriser')

        // Fichier changé entre l'affichage et l'accord : rien ne tourne, nouvelle carte (D2).
        writeFileSync(join(workspace, '.bobine', 'worktree.json'), config(step('prêt')))
        await ui.click(ui.$('worktree-setup-approve'))
        await ui.waitFor(`!!${ui.$('worktree-setup-changed')}`)
        await ui.shot('175-preparation-fichier-change')
        // Le changement est gardé dans le dépôt (le dépôt principal reste propre), et dans le
        // premier worktree, d'où part le suivant.
        git('commit', '-q', '-am', 'setup')
        writeFileSync(join(first, '.bobine', 'worktree.json'), config(step('prêt')))

        // « Autoriser et lancer » : en cours, puis réussie ; le message retenu part ensuite.
        await ui.click(ui.$('worktree-setup-approve'))
        await ui.waitFor(`${card}?.dataset.state === 'done'`, 30000)
        await ui.waitFor(`${users} === 1`, 30000)
        await ui.ready()
        await ui.ev(`${card}.querySelectorAll('details').forEach((d) => (d.open = true))`)
        await ui.ev(`document.querySelector('.scroll')?.scrollTo(0, 0)`)
        await ui.shot('175-preparation-reussie')

        // Deuxième worktree : l'accord vaut pour ce dépôt, la commande part d'elle-même.
        await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'done'`, 30000)
        check(
          git('status', '--porcelain') === '',
          'dépôt principal intact (aucun fichier suivi modifié)'
        )

        // Commande longue tant qu'un fichier `slow` est dans le dossier d'origine (même texte :
        // l'accord tient). Un message envoyé pendant qu'elle tourne attend sur la carte ;
        // « Arrêter » l'envoie avec l'arrêt (D4).
        const slow = `${step('prêt')}; if [ -f "$BOBINE_WORKTREE_SOURCE/slow" ]; then sleep 600; fi`
        writeFileSync(join(source, '.bobine', 'worktree.json'), config(slow))
        await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'approval'`)
        await ui.click(ui.$('worktree-setup-approve'))
        await ui.waitFor(`${card}?.dataset.state === 'done'`, 30000)
        const slowNext = () => {
          writeFileSync(join(source, '.bobine', 'worktree.json'), config(slow))
          writeFileSync(join(source, 'slow'), '')
        }
        const running = `${card}?.dataset.state === 'running' && !!${ui.$('worktree-setup-stop')}`
        slowNext()
        await newWorktree()
        await ui.waitFor(running, 30000)
        await typeAndSend('Pendant la préparation')
        await ui.waitFor(`!!${ui.$('worktree-setup-held')}`)
        await ui.shot('175-preparation-message-en-cours')
        await ui.click(ui.$('worktree-setup-stop'))
        await ui.waitFor(`${card}?.dataset.state === 'failed'`, 15000)
        await ui.waitFor(`${users} === 1`, 30000)
        await ui.ready()

        // « Continuer sans attendre » : le message part, la commande continue.
        slowNext()
        await newWorktree()
        await ui.waitFor(running, 30000)
        await typeAndSend('Sans attendre')
        await ui.waitFor(`!!${ui.$('worktree-setup-proceed')}`)
        await ui.click(ui.$('worktree-setup-proceed'))
        await ui.waitFor(`${users} === 1`, 30000)
        await ui.ready()
        await ui.shot('175-preparation-sans-attendre')

        // Commande changée dans le dossier d'origine : l'accord ne vaut plus ; « Continuer sans
        // préparer » libère le message.
        writeFileSync(
          join(source, '.bobine', 'worktree.json'),
          JSON.stringify({ setup: 'echo "autre" > prepared.txt' })
        )
        await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'approval'`)
        await typeAndSend('Sans préparation')
        await ui.waitFor(`!!${ui.$('worktree-setup-held')}`)
        await ui.click(ui.$('worktree-setup-skip'))
        await ui.waitFor(`${card}?.dataset.state === 'skipped'`)
        await ui.waitFor(`${users} === 1`, 30000)
        await ui.ready()
        await ui.shot('175-preparation-sans')

        // `archive` seule : sa carte à autoriser, le message n'attend pas ; autorisée, elle tourne
        // à la suppression du worktree (D6).
        writeFileSync(join(source, '.bobine', 'worktree.json'), config(undefined))
        await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'approval'`)
        await typeAndSend('Rien à attendre')
        await ui.waitFor(`${users} === 1`, 30000)
        await ui.click(ui.$('worktree-setup-approve'))
        await ui.waitFor(`${card}?.dataset.state === 'done'`)
        await ui.ready()
        await ui.shot('175-preparation-archive-seule')
        await ui.click(`document.querySelector('.history-item.active [data-testid=history-more]')`)
        await ui.waitFor(`!!${ui.$('history-delete')}`)
        await ui.click(ui.$('history-delete'))
        await ui.waitFor(`!!${ui.$('delete-dialog')}`)
        if ((await ui.ev(`${ui.$('delete-worktree')}?.checked`)) === false) {
          await ui.click(ui.$('delete-worktree'))
        }
        await ui.click(ui.$('delete-confirm'))
        await ui.waitFor(`!${ui.$('delete-dialog')}`)
        const deadline = Date.now() + 15000
        while (!existsSync(archiveMarker) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
        check(
          existsSync(archiveMarker),
          'archive autorisée : lancée à la suppression du worktree (D6)'
        )
      },
      undefined,
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
}
