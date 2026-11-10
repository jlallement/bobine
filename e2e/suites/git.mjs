import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Barre de titre et branche git (fiche 049) : titre aligné à gauche avec le menu de la
 * conversation, dégradé quand le fil défile dessous, plus de bouton terminal ; branche du dossier
 * dans la zone de saisie, qui ouvre « Modifications » sur l'état git. Vrai dépôt git local, sur une
 * branche `feat`, scénario `modifications`.
 */
export async function gitSuite(scheme) {
  console.log(`\n— Barre de titre et branche (${scheme})`)
  const dir = mkdtempSync(join(tmpdir(), 'bob-e2e-git-'))
  const workspace = join(dir, 'projet')
  mkdirSync(workspace)
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
      .toString()
      .trim()
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  git('checkout', '-q', '-b', 'feat')
  const shade = `Number(getComputedStyle(document.querySelector('.main-header'), '::after').opacity)`
  const scroller = `document.querySelector('.main > .scroll')`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.waitFor(`${ui.$('git-branch')}?.innerText.trim() === 'feat'`)
        check(
          !(await ui.ev(`${ui.$('git-branch')}.dataset.dirty`)) &&
            (await ui.ev(`!!${ui.$('git-branch')}.closest('.composer-context')`)) &&
            !(await ui.ev(`!!${ui.$('terminal-toggle')}`)) &&
            !(await ui.ev(`!!${ui.$('title-menu')}`)),
          'branche du dossier sous la zone de saisie ; ni bouton terminal ni titre (brouillon)'
        )

        await ui.send('Fais les modifications')
        await ui.ready()
        await ui.waitFor(`${ui.$('git-branch')}?.dataset.dirty === 'true'`)
        check(true, 'après le tour de l’agent : point sur la branche (modifications non commitées)')

        // Titre à gauche, avec le menu de la conversation.
        await ui.waitFor(`!!${ui.$('title-menu')}`)
        const box = await ui.ev(
          `(() => { const t = ${ui.$('title-menu')}.getBoundingClientRect(); const h = document.querySelector('.main-header').getBoundingClientRect(); return { left: t.left - h.left, width: h.width } })()`
        )
        check(
          (await ui.ev(`${ui.$('title-menu')}.innerText.trim()`)) === 'Fais les modifications' &&
            box.left < 40,
          'titre de la conversation aligné à gauche'
        )
        await ui.click(ui.$('title-menu'))
        await ui.waitFor(`!!${ui.$('title-rename')}`)
        await ui.shot('38-menu-titre')
        await ui.click(ui.$('title-rename'))
        await ui.waitFor(`!!${ui.$('title-input')}`)
        await ui.ev(`${ui.$('title-input')}.focus(); ${ui.$('title-input')}.select(); true`)
        await ui.type('Modifs du README')
        await ui.enter()
        await ui.waitFor(`${ui.$('title-menu')}?.innerText.trim() === 'Modifs du README'`)
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=history-item]')].some((i) => i.innerText.includes('Modifs du README'))`
        )
        check(true, '« Renommer » depuis le titre : en place, et dans la barre latérale')
        await ui.click(ui.$('title-menu'))
        await ui.waitFor(`!!${ui.$('title-delete')}`)
        await ui.click(ui.$('title-delete'))
        await ui.waitFor(`!!${ui.$('delete-dialog')}`)
        await ui.click(`${ui.$('delete-dialog')}.querySelector('.btn.ghost')`)
        // Radix bloque les clics sur la page le temps de refermer la boîte.
        await ui.waitFor(
          `!${ui.$('delete-dialog')} && document.body.style.pointerEvents !== 'none'`
        )
        check(true, '« Supprimer » depuis le titre : même confirmation que la barre latérale')

        // Branche : « Modifications » sur l'état git du dossier.
        await ui.click(ui.$('git-branch'))
        await ui.waitFor(
          `${ui.$('changes-view-git')}?.getAttribute('aria-selected') === 'true' && document.querySelectorAll('[data-testid=changes-file]').length === 2`
        )
        check(true, 'clic sur la branche : « Modifications » sur l’état git, 2 fichiers')
        await ui.shot('73-branche-modifications')

        // « Committer » hors worktree (fiche 123) : fichiers cochés, message proposé, « Défaire » ;
        // ni « Ouvrir une PR » ni « Fusionner ».
        check(
          (await ui.ev(`document.querySelectorAll('[data-testid=changes-check]').length`)) === 2 &&
            (await ui.ev(`!!${ui.$('changes-commit')}`)) &&
            !(await ui.ev(`!!${ui.$('worktree-pr')} || !!${ui.$('worktree-merge')}`)),
          'vue Git hors worktree : cases à cocher et « Committer », sans PR ni fusion'
        )
        const appRow = `[...document.querySelectorAll('[data-testid=changes-file]')].find((r) => r.innerText.includes('app.js'))`
        await ui.click(`${appRow}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(
          `${ui.$('changes-commit')}.innerText === ${JSON.stringify(L('worktreeCycle.commit.actionCount', { count: 1 }))}`
        )
        await ui.click(ui.$('changes-commit'))
        await ui.waitFor(`!!${ui.$('changes-commit-message')}`)
        check(
          (await ui.ev(`${ui.$('changes-commit-message')}.value`)) ===
            'docs: modifs du README\n\n- README.md',
          'message proposé : type deviné, titre de la conversation, fichier coché'
        )
        // 0.11, D4 : curseur à la fin ; le message suit les cases cochées tant qu'il n'est pas
        // retouché (le commit a932731 annonçait un fichier décoché).
        const message = `${ui.$('changes-commit-message')}.value`
        check(
          (await ui.ev(
            `${ui.$('changes-commit-message')}.selectionStart === ${message}.length`
          )) === true,
          'formulaire ouvert : curseur à la fin du message'
        )
        await ui.click(`${appRow}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(`${message}.includes('- src/app.js (new)')`)
        await ui.click(`${appRow}.querySelector('[data-testid=changes-check]')`)
        await ui.waitFor(
          `${message} === ${JSON.stringify('docs: modifs du README\n\n- README.md')}`
        )
        check(true, 'cocher puis décocher src/app.js : le message proposé suit les cases cochées')
        await ui.shot('123-committer-hors-worktree')
        await ui.click(ui.$('changes-commit-confirm'))
        await ui.waitFor(`!!${ui.$('changes-commit-undo')}`)
        await ui.waitFor(`document.querySelectorAll('[data-testid=changes-file]').length === 1`)
        check(
          git('log', '--format=%s', '-1') === 'docs: modifs du README' &&
            git('show', '--name-only', '--format=', 'HEAD') === 'README.md' &&
            git('status', '--porcelain', '-uall') === '?? src/app.js',
          'commit dans le dossier de la conversation : le fichier coché seulement'
        )
        await ui.shot('123-committe-hors-worktree')
        await ui.click(ui.$('changes-commit-undo'))
        await ui.waitFor(
          `${ui.$('changes-commit-note')}?.innerText === ${JSON.stringify(L('worktreeCycle.commit.undone'))}`
        )
        await ui.waitFor(`document.querySelectorAll('[data-testid=changes-file]').length === 2`)
        check(
          git('log', '--format=%s', '-1') === 'init' &&
            git('status', '--porcelain', '-uall') === 'M  README.md\n?? src/app.js',
          '« Défaire » : le commit est défait, ses modifications reviennent'
        )
        await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(`!${ui.$('side-panel')}`)
        await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(
          `${ui.$('changes-view-conversation')}?.getAttribute('aria-selected') === 'true'`
        )
        check(true, 'pastille des modifications : vue de la conversation')
        await ui.click(
          `${ui.$('side-panel')}.querySelector('[aria-label="${L('sidePanel.close')}"]')`
        )
        await ui.waitFor(`!${ui.$('side-panel')}`)

        // Pendant une réponse : les boutons au survol de la réponse ne touchent pas « Écrit… ».
        await ui.send('/scenario lent')
        await ui.waitFor(
          `!!document.querySelector('.working') && document.querySelectorAll('.msg-agent-actions').length > 0`
        )
        const gap = await ui.ev(
          `(() => { const a = [...document.querySelectorAll('.msg-agent-actions')].at(-1).getBoundingClientRect(); const w = document.querySelector('.working').getBoundingClientRect(); return Math.round(w.top - a.bottom) })()`
        )
        check(gap >= 2, `boutons de la réponse et indicateur d’activité séparés (${gap} px)`)
        await ui.ready()

        // Fondus du fil : en haut quand le fil défile sous la barre, en bas tant qu'il en reste.
        const fades = async () => ({
          top: await ui.ev(shade),
          bottom: await ui.ev(
            `Number(getComputedStyle(document.querySelector('.thread-dock'), '::before').opacity)`
          )
        })
        await ui.ev(`${scroller}.scrollTop = 0; true`)
        await sleep(150)
        const atTop = await fades()
        await ui.ev(`${scroller}.scrollTop = 300; true`)
        await sleep(150)
        const middle = await fades()
        await ui.ev(`${scroller}.scrollTop = ${scroller}.scrollHeight; true`)
        await sleep(150)
        const atEnd = await fades()
        check(
          atTop.top < 0.05 &&
            atTop.bottom > 0.95 &&
            middle.top > 0.95 &&
            middle.bottom > 0.95 &&
            atEnd.top > 0.95 &&
            atEnd.bottom < 0.05,
          `fondus du fil : haut ${atTop.top} → ${middle.top}, bas ${middle.bottom} → ${atEnd.bottom}`
        )
        // Flèche « Aller en bas » : seulement en ayant remonté le fil ; un clic y ramène.
        check(!(await ui.ev(`!!${ui.$('scroll-to-bottom')}`)), 'en bas du fil : pas de flèche')
        await ui.ev(`${scroller}.scrollTop = 300; true`)
        await ui.waitFor(`!!${ui.$('scroll-to-bottom')}`)
        await ui.shot('39-degrade-titre')
        await ui.click(ui.$('scroll-to-bottom'))
        await ui.waitFor(
          `${scroller}.scrollHeight - ${scroller}.scrollTop - ${scroller}.clientHeight < 2 && !${ui.$('scroll-to-bottom')}`
        )
        check(true, 'flèche « Aller en bas » : montrée en remontant, ramène en bas du fil')
        // Fil remonté, puis conversation plus courte que la page : pas de flèche.
        await ui.ev(`${scroller}.scrollTop = 300; true`)
        await ui.waitFor(`!!${ui.$('scroll-to-bottom')}`)
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!!${ui.$('welcome')}`)
        await ui.ready()
        // Dans un dépôt git, la première réponse de l'agent reçoit le contexte des conversations
        // filles (fiche 118) et l'index de la mémoire (fiche 182), que l'écho recopie en entier :
        // coupés ici, pour une réponse courte.
        await ui.ev(
          `window.api.settings.setPreferences({ childProposals: 'never', memoryEnabled: false }).then(() => true)`
        )
        await ui.send('/scenario echo')
        await ui.ready()
        check(
          (await ui.ev(`${scroller}.scrollHeight <= ${scroller}.clientHeight`)) &&
            !(await ui.ev(`!!${ui.$('scroll-to-bottom')}`)),
          'conversation plus courte que la page : pas de flèche « Aller en bas »'
        )

        // Barre latérale : libellés de « Nouvelle conversation » et « Mon activité » alignés.
        const labels = await ui.ev(
          `['new-conversation', 'open-activity'].map((id) => Math.round(document.querySelector('[data-testid="' + id + '"] .label').getBoundingClientRect().left))`
        )
        check(labels[0] === labels[1], `libellés du haut de la barre latérale alignés (${labels})`)
      },
      undefined,
      'modifications',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
