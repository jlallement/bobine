import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * Fil (fiche 156) : durée du tour, copier un message envoyé, image en grand et glissée vers le
 * Finder, « Ouvrir dans <éditeur> » (éditeurs imposés par `BOBINE_EDITORS`, lancement noté dans
 * `BOBINE_OPEN_LOG`), carte « Où en était-on ? » à la réouverture d'une conversation de la veille.
 */
export async function filSuite(scheme) {
  console.log(`\n— Fil : durée, copie, images, éditeur, reprise (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-fil-'))
  const openLog = join(mkdtempSync(join(tmpdir(), 'bob-e2e-ouvertures-')), 'ouvertures.log')
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  mkdirSync(join(workspace, 'src'))
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n')
  writeFileSync(join(workspace, 'plan.md'), '# Plan\n')
  writeFileSync(join(workspace, 'src', 'app.ts'), 'a\nb\nc\nd\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const opened = () => (existsSync(openLog) ? readFileSync(openLog, 'utf8') : '')
  const logged = async (pattern) => {
    for (let i = 0; i < 50 && !pattern.test(opened()); i++) await sleep(100)
    return pattern.test(opened())
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        const main = await mainProcess()
        await ui.ready()

        // Plan, puis de vraies modifications (non commitées) : de quoi nourrir la carte de reprise.
        await ui.send('/scenario plan')
        await ui.ready()
        await ui.send('/scenario modifications')
        await ui.ready()

        // Durée du tour, sous la dernière réponse, à côté de l'heure (pas une `.msg-time` de plus).
        const durations = await ui.ev(
          `[...document.querySelectorAll('[data-testid=turn-duration]')].map((d) => d.textContent)`
        )
        // Motifs tirés des textes de l'app (« 8 s », « 2 min 14 s » ; en anglais « 8s », « 2m 14s »).
        const durationPattern = (key, params) =>
          L(key, params)
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/NUM/g, '\\d+')
        const shapes = [
          durationPattern('transcript.duration.seconds', { seconds: 'NUM' }),
          durationPattern('transcript.duration.minutes', { minutes: 'NUM', seconds: 'NUM' })
        ].map((pattern) => new RegExp(`^${pattern}$`))
        check(
          durations.length === 2 && durations.every((d) => shapes.some((shape) => shape.test(d))),
          `durée de chaque tour sous sa dernière réponse (${durations.join(', ')})`
        )

        // Copier un message envoyé : son texte dans le presse-papiers (remis ensuite).
        const saved = await main.evaluate(`require('electron').clipboard.readText()`)
        const copy = `document.querySelector('[data-testid=copy-message]')`
        await ui.click(copy)
        await ui.waitFor(`${copy}.getAttribute('aria-label') === ${JSON.stringify(L('copy.done'))}`)
        const firstText = await ui.ev(`document.querySelector('.msg-user').textContent`)
        check(
          (await main.evaluate(`require('electron').clipboard.readText()`)) === firstText,
          'copier un message envoyé : son texte dans le presse-papiers'
        )
        await main.evaluate(
          `require('electron').clipboard.writeText(${JSON.stringify(saved ?? '')}), true`
        )
        await ui.ev(`document.querySelector('.msg-agent-group:last-of-type')?.scrollIntoView()`)
        await ui.hover(await ui.center(`[...document.querySelectorAll('.msg-agent-group')].at(-1)`))
        await ui.shot('156-duree-copie')

        // Image collée et envoyée : en grand au clic, Échap ferme, glissée vers le Finder.
        await ui.ev(`(() => {
          const bytes = Uint8Array.from(atob('${PNG}'), (c) => c.charCodeAt(0))
          const data = new DataTransfer()
          data.items.add(new File([bytes], 'capture.png', { type: 'image/png' }))
          const input = document.querySelector('[data-testid=composer-input]')
          input.focus()
          input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
          return true
        })()`)
        await ui.waitFor(`!!document.querySelector('[data-testid=attachment] img')`)
        await ui.send('/scenario echo regarde')
        await ui.ready()
        const thumb = `[...document.querySelectorAll('[data-testid=msg-attachments] [data-testid=image-zoom-open]')].at(-1)`
        await ui.click(thumb)
        await ui.waitFor(`!!${ui.$('image-zoom-image')}`)
        check(
          await ui.ev(`${ui.$('image-zoom-image')}.src.startsWith('data:image/png;base64,')`),
          'image du message : vue en grand au clic'
        )
        await ui.shot('156-image-en-grand')
        await ui.press('Escape')
        await ui.waitFor(`!${ui.$('image-zoom-dialog')}`)
        check(true, 'Échap ferme la vue en grand')
        // Le glisser natif part du main : le fichier temporaire est écrit (noté en essai).
        await ui.ev(
          `window.api.images.startDrag({ mimeType: 'image/png', data: '${PNG}', name: 'capture.png' })`
        )
        check(await logged(/^drag .*capture\.png$/m), 'glisser : image écrite pour le Finder')
        const dragged = opened().match(/^drag (.*)$/m)?.[1]
        check(!!dragged && existsSync(dragged), 'glisser : le fichier temporaire existe')

        // Ouvrir dans l'éditeur : VS Code par défaut (le premier installé), à la ligne.
        await ui.send('/scenario liens-fichiers')
        await ui.ready()
        const link = `[...document.querySelectorAll('[data-testid=file-link]')].find((a) => a.textContent === 'src/app.ts:3')`
        const editorButton = `${link}.parentElement.querySelector('[data-testid=open-in-editor]')`
        check(
          (await ui.ev(`${editorButton}.getAttribute('aria-label')`)) ===
            L('editor.open', { editor: 'VS Code' }),
          'lien de fichier : « Ouvrir dans VS Code »'
        )
        await ui.hover(await ui.center(link))
        await ui.shot('156-ouvrir-dans-editeur')
        await ui.click(editorButton)
        check(
          await logged(new RegExp(`^editor code \\S+ --goto \\S+/src/app\\.ts:3$`, 'm')),
          'VS Code : dossier, puis --goto fichier:ligne'
        )
        // Réglages › Général : les éditeurs installés ; IntelliJ IDEA choisi.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings-editor')}`)
        check(
          JSON.stringify(
            await ui.ev(`[...${ui.$('settings-editor')}.options].map((o) => o.textContent)`)
          ) === JSON.stringify(['VS Code', 'IntelliJ IDEA']),
          'Réglages › Général : les éditeurs installés seulement'
        )
        await ui.ev(`(() => {
          const select = ${ui.$('settings-editor')}
          const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
          set.call(select, 'idea')
          select.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        })()`)
        await ui.shot('156-reglage-editeur')
        await ui.press('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        await ui.waitFor(
          `${editorButton}.getAttribute('aria-label') === ${JSON.stringify(L('editor.open', { editor: 'IntelliJ IDEA' }))}`
        )
        await ui.click(editorButton)
        check(
          await logged(/^editor idea --line 3 \S+\/src\/app\.ts$/m),
          'IntelliJ IDEA : --line N fichier'
        )
        // Diff d'un fichier hors du dossier (`/projet/config.json`) : pas ouvert, un avis.
        await ui.send('/scenario diff')
        await ui.ready()
        const diffButton = `[...document.querySelectorAll('.diff-header [data-testid=open-in-editor]')].at(-1)`
        await ui.ev(`document.querySelectorAll('details.tool').forEach((d) => (d.open = true))`)
        await ui.waitFor(`!!${diffButton}`)
        await ui.click(diffButton)
        await ui.waitFor(
          `[...document.querySelectorAll('.notice')].some((n) => n.textContent.includes('config.json'))`
        )
        check(
          !/config\.json/.test(opened()),
          'fichier introuvable dans le dossier : pas d’éditeur lancé'
        )

        // « Où en était-on ? » : autre conversation, puis retour le surlendemain (horloge avancée
        // dans la page) : la carte, construite sans l'agent.
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        check(!(await ui.ev(`!!${ui.$('resume-card')}`)), 'pas de carte sans conversation')
        await ui.ev(`(() => {
          const real = Date.now.bind(Date)
          window.__realNow = real
          Date.now = () => real() + 2 * 86_400_000
          return true
        })()`)
        await ui.click(`document.querySelector('[data-testid=history-item] .history-open')`)
        await ui.waitFor(`!!${ui.$('resume-card')}`)
        await ui.waitFor(`!!${ui.$('resume-files')}`)
        const card = await ui.ev(`${ui.$('resume-card')}.innerText`)
        const lastText = await ui.ev(
          `[...document.querySelectorAll('.msg-user')].at(-1).textContent`
        )
        check(
          card.includes(L('resume.title')) &&
            card.includes(lastText) &&
            card.includes('README.md') &&
            card.includes('src/app.js'),
          'carte de reprise : dernière demande et fichiers modifiés non commités'
        )
        check(
          (await ui.ev(`!!${ui.$('resume-done')}`)) || (await ui.ev(`!!${ui.$('resume-todo')}`)),
          'carte de reprise : les tâches du plan'
        )
        await ui.ev(`${ui.$('resume-card')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('156-ou-en-etait-on')
        // Repliable, puis fermée : elle ne revient pas pour cette reprise.
        await ui.click(`${ui.$('resume-card')}.querySelector('.resume-title')`)
        await ui.waitFor(`!${ui.$('resume-card')}.open`)
        check(true, 'carte de reprise repliable')
        await ui.click(ui.$('resume-close'))
        await ui.waitFor(`!${ui.$('resume-card')}`)
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.click(`document.querySelector('[data-testid=history-item] .history-open')`)
        await ui.waitFor(`!!document.querySelector('.history-item.active')`)
        await sleep(500)
        check(
          !(await ui.ev(`!!${ui.$('resume-card')}`)),
          'fermée : pas de nouveau pour cette reprise'
        )
        await ui.ev(`(Date.now = window.__realNow, true)`)
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: workspace, BOBINE_OPEN_LOG: openLog, BOBINE_EDITORS: 'vscode,idea' },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
