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
import { L, check, withApp } from '../lib.mjs'

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
        const rows = await ui.ev(
          `[...${card}.querySelectorAll('.worktree-setup-command-row dt')].map((d) => d.innerText)`
        )
        check(
          JSON.stringify(rows) ===
            JSON.stringify([L('worktreeSetup.atCreate'), L('worktreeSetup.atRemove')]) &&
            (await ui.ev(`${ui.$('worktree-setup-archive')}.innerText`)).includes(archiveMarker),
          'les deux commandes que l’accord couvre sont montrées, « à la création » et « à la suppression » (D1)'
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
        check(
          (await ui.ev(users)) === 0 &&
            (await ui.ev(`${ui.$('worktree-setup-approve')}.classList.contains('primary')`)) &&
            (await ui.ev(`!!${ui.$('worktree-setup-skip')}`)) &&
            (await ui.ev(`${card}.querySelector('.worktree-setup-files')?.innerText`)) === '.env',
          'à autoriser : message en attente dit sur la carte, action principale pleine, « Continuer sans préparer », fichier copié listé'
        )
        await ui.shot('175-preparation-a-autoriser')

        // Fichier changé entre l'affichage et l'accord : rien ne tourne, nouvelle carte (D2).
        writeFileSync(join(workspace, '.bobine', 'worktree.json'), config(step('prêt')))
        await ui.click(ui.$('worktree-setup-approve'))
        await ui.waitFor(`!!${ui.$('worktree-setup-changed')}`)
        check(
          (await ui.ev(`${card}.dataset.state`)) === 'approval' &&
            (await ui.ev(`${ui.$('worktree-setup-command')}.innerText`)).includes('prêt') &&
            !existsSync(join(first, 'prepared.txt')) &&
            (await ui.ev(`!!${ui.$('worktree-setup-held')}`)) &&
            (await ui.ev(users)) === 0,
          'fichier changé avant l’accord : rien lancé, nouvelle commande montrée, message toujours en attente (D2)'
        )
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
        check(
          readFileSync(join(first, 'prepared.txt'), 'utf8').trim() === 'prêt' &&
            (await ui.ev(`${ui.$('worktree-setup-output')}.textContent`)).includes('Fini.'),
          'préparation autorisée : lancée, réussie, sortie gardée, message retenu envoyé ensuite'
        )
        await ui.ev(`${card}.querySelectorAll('details').forEach((d) => (d.open = true))`)
        await ui.ev(`document.querySelector('.scroll')?.scrollTo(0, 0)`)
        await ui.shot('175-preparation-reussie')

        // Deuxième worktree : l'accord vaut pour ce dépôt, la commande part d'elle-même.
        const second = await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'done'`, 30000)
        check(
          !!second &&
            existsSync(join(second, 'prepared.txt')) &&
            existsSync(join(second, '.env')) &&
            !(await ui.ev(`!!${ui.$('worktree-setup-approve')}`)),
          'worktree suivant : préparation lancée d’office (accord retenu pour le dépôt)'
        )
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
        check(
          (await ui.ev(users)) === 0 &&
            (await ui.ev(`${ui.$('worktree-setup-held')}.innerText`)).replace(/\s/g, ' ') ===
              L('worktreeSetup.heldRunning', { count: 1 }).replace(/\s/g, ' ') &&
            (await ui.ev(`!!${ui.$('worktree-setup-proceed')}`)),
          'commande en cours : « Votre message attend… » sur la carte, « Arrêter », « Continuer sans attendre » (D4)'
        )
        await ui.shot('175-preparation-message-en-cours')
        await ui.click(ui.$('worktree-setup-stop'))
        await ui.waitFor(`${card}?.dataset.state === 'failed'`, 15000)
        await ui.waitFor(`${users} === 1`, 30000)
        check(
          (await ui.ev(`${ui.$('worktree-setup-state')}.innerText`)) === L('worktreeSetup.stopped'),
          '« Arrêter » : commande arrêtée, carte « Arrêtée », message envoyé (D4)'
        )
        await ui.ready()

        // « Continuer sans attendre » : le message part, la commande continue.
        slowNext()
        await newWorktree()
        await ui.waitFor(running, 30000)
        await typeAndSend('Sans attendre')
        await ui.waitFor(`!!${ui.$('worktree-setup-proceed')}`)
        await ui.click(ui.$('worktree-setup-proceed'))
        await ui.waitFor(`${users} === 1`, 30000)
        check(
          (await ui.ev(`${card}.dataset.state`)) === 'running' &&
            !(await ui.ev(`!!${ui.$('worktree-setup-stop')}`)),
          '« Continuer sans attendre » : message envoyé, la commande tourne encore (D4)'
        )
        await ui.ready()
        await ui.shot('175-preparation-sans-attendre')

        // Commande changée dans le dossier d'origine : l'accord ne vaut plus ; « Continuer sans
        // préparer » libère le message.
        writeFileSync(
          join(source, '.bobine', 'worktree.json'),
          JSON.stringify({ setup: 'echo "autre" > prepared.txt' })
        )
        const skipped = await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'approval'`)
        await typeAndSend('Sans préparation')
        await ui.waitFor(`!!${ui.$('worktree-setup-held')}`)
        await ui.click(ui.$('worktree-setup-skip'))
        await ui.waitFor(`${card}?.dataset.state === 'skipped'`)
        await ui.waitFor(`${users} === 1`, 30000)
        await ui.ready()
        check(
          !!skipped && !existsSync(join(skipped, 'prepared.txt')),
          '« Continuer sans préparer » : commande non lancée, message envoyé'
        )
        await ui.shot('175-preparation-sans')

        // `archive` seule : sa carte à autoriser, le message n'attend pas ; autorisée, elle tourne
        // à la suppression du worktree (D6).
        writeFileSync(join(source, '.bobine', 'worktree.json'), config(undefined))
        await newWorktree()
        await ui.waitFor(`${card}?.dataset.state === 'approval'`)
        check(
          !(await ui.ev(`!!${ui.$('worktree-setup-command')}`)) &&
            (await ui.ev(`${ui.$('worktree-setup-approve')}.innerText`)) ===
              L('worktreeSetup.approveArchive'),
          '`archive` seule : carte à autoriser, sans commande à la création (D6)'
        )
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
  await scheduledRunSuite(scheme)
}

/**
 * Tâche planifiée « dans un nouveau worktree » d'un dépôt dont la commande de préparation n'est
 * pas autorisée (D3) : l'exécution n'attend pas l'accord, elle part sans la préparation, et son
 * historique le dit.
 */
async function scheduledRunSuite(scheme) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-preparation-planifiee-'))
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-preparation-projet-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: project,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(project, 'README.md'), '# Tâche\n')
  writeFileSync(join(project, '.gitignore'), 'prepared.txt\n')
  mkdirSync(join(project, '.bobine'))
  writeFileSync(
    join(project, '.bobine', 'worktree.json'),
    JSON.stringify({ setup: 'echo "lancée" > prepared.txt' })
  )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const now = Date.now()
  writeFileSync(
    join(userData, 'scheduled-tasks.json'),
    JSON.stringify({
      version: 1,
      tasks: [
        {
          id: 'preparee',
          name: 'Revue dans un worktree',
          instruction: 'Relis le code.',
          folder: project,
          profileId: 'mock',
          worktree: true,
          catchUp: true,
          paused: false,
          schedule: { kind: 'daily', time: '09:00' },
          createdAt: new Date(now - 86_400_000).toISOString(),
          // Échéance passée d'une minute : elle part au lancement.
          nextRunAt: new Date(now - 60_000).toISOString(),
          runs: []
        }
      ]
    })
  )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const run = `document.querySelector('[data-testid=scheduled-task][data-id="preparee"] [data-testid=scheduled-run]')`
        await ui.waitFor(`!!${ui.$('history-scheduled-tag')}`, 30000)
        await ui.click(ui.$('open-scheduled'))
        await ui.waitFor(`${run}?.dataset.outcome === 'done'`, 30000)
        check(
          (await ui.ev(`${run}.querySelector('.scheduled-run-tags')?.innerText ?? ''`)).includes(
            L('scheduled.setupNotApproved')
          ),
          'tâche planifiée, préparation non autorisée : l’exécution finit sans l’attendre, son historique le dit (D3)'
        )
        await ui.shot('175-tache-planifiee-sans-preparation')
        await ui.click(`${run}.querySelector('[data-testid=scheduled-run-open]')`)
        await ui.waitFor(`!${ui.$('scheduled-page')}`)
        await ui.waitFor(`${ui.$('worktree-setup')}?.dataset.state === 'skipped'`)
        await ui.ready()
        check(
          !(await ui.ev(`!!${ui.$('worktree-setup-approve')}`)) &&
            (await ui.ev(`${ui.$('worktree-setup')}.innerText`)).includes(
              L('worktreeSetup.unattendedHint').slice(0, 20)
            ),
          'sa conversation : carte « non lancée », exécution planifiée dite, sans bouton'
        )
      },
      userData,
      'streaming-texte'
    )
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
}
