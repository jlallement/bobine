import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MOCK_LANG, check, withApp } from '../lib.mjs'

/** Colle un texte dans la zone de saisie (presse-papiers simulé). */
const pasteText = (text) => `(() => {
  const data = new DataTransfer()
  data.setData('text/plain', ${JSON.stringify(text)})
  const input = document.querySelector('[data-testid=composer-input]')
  input.focus()
  const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
  input.dispatchEvent(event)
  // Un collage synthétique n'insère jamais le texte : « laissé au navigateur » = non empêché.
  return !event.defaultPrevented
})()`

/** Images et fichiers dans le message (fiche 005) ; texte collé, fichiers exclus (fiche 155). */
export async function attachmentsSuite(scheme) {
  console.log(`\n— Pièces jointes (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-ws-'))
  mkdirSync(join(workspace, 'src'))
  writeFileSync(join(workspace, 'src', 'app.ts'), 'export const app = 1\n')
  writeFileSync(join(workspace, 'README.md'), '# Projet\n')
  // Exclu pour l'agent factice, qui lit les fichiers d'exclusion comme Bob (fiche 155).
  writeFileSync(join(workspace, 'secret.txt'), 'clé\n')
  writeFileSync(join(workspace, '.bobignore'), 'secret.txt\n')
  const long = Array.from({ length: 45 }, (_, i) => `ligne ${i + 1}`).join('\n')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Image collée (PNG 1×1) : vignette dans la zone de saisie.
        await ui.ev(`(() => {
          const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
          const data = new DataTransfer()
          data.items.add(new File([bytes], 'capture.png', { type: 'image/png' }))
          const input = document.querySelector('[data-testid=composer-input]')
          input.focus()
          input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
          return true
        })()`)
        await ui.waitFor(`!!document.querySelector('[data-testid=attachment] img')`)
        check(true, 'image collée : vignette dans la zone de saisie')

        // Mention @ : recherche dans le dossier, le fichier est joint.
        await ui.type('/scenario echo voir @app')
        await ui.waitFor(
          `!!${ui.$('file-menu')} && document.querySelectorAll('[data-testid=file-item]').length > 0`
        )
        check(
          (await ui.ev(`document.querySelector('[data-testid=file-item]').innerText`)).includes(
            'app.ts'
          ),
          '@app : le fichier du dossier est proposé'
        )
        const box = await ui.ev(
          `(() => { const m = ${ui.$('file-menu')}.getBoundingClientRect(); const h = document.querySelector('.main-header').getBoundingClientRect(); return { top: m.top, bottom: m.bottom, header: h.bottom, inner: innerHeight } })()`
        )
        check(
          box.top >= box.header && box.bottom <= box.inner,
          'menu « @ » entier dans la fenêtre (accueil, zone de saisie centrée)'
        )
        await ui.shot('17-mention')
        await ui.press('Enter')
        await ui.waitFor(`${ui.$('composer-input')}.value === '/scenario echo voir @src/app.ts '`)
        check(
          (await ui.ev(`document.querySelectorAll('[data-testid=attachment]').length`)) === 2,
          'Entrée : chemin inséré dans le texte, fichier ajouté aux pièces jointes'
        )
        await ui.shot('18-pieces-jointes')
        await ui.press('Enter')
        await ui.waitFor(`!!${ui.$('msg-attachments')}`)
        await ui.ready()
        const reply = await ui.lastAgentText()
        check(
          reply.includes(MOCK_LANG === 'en' ? 'image: image/png' : 'image : image/png') &&
            reply.includes(MOCK_LANG === 'en' ? 'embedded resource' : 'ressource intégrée') &&
            reply.includes('app.ts'),
          'l’agent reçoit l’image et le contenu du fichier'
        )
        check(
          (await ui.ev(
            `${ui.$('msg-attachments')}.querySelectorAll('img, .attachment').length`
          )) === 2 && !(await ui.ev(`!!${ui.$('attachments')}`)),
          'pièces jointes affichées dans le message, zone de saisie vidée'
        )
        await ui.shot('19-message-joint')

        // Glisser-déposer : toute la conversation reçoit les fichiers, pas seulement la saisie.
        const center = (selector) =>
          ui.ev(
            `(() => { const b = ${selector}.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`
          )
        const thread = await center(ui.$('thread'))
        await ui.dragFiles([join(workspace, 'README.md')], thread, { drop: false })
        await ui.waitFor(`!!${ui.$('drop-overlay')}`)
        check(true, 'fichier glissé sur le fil : indication sur toute la conversation')
        await ui.shot('19b-deposer')
        await ui.dragFiles([join(workspace, 'README.md')], thread)
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=attachment]')].some((a) => a.innerText.includes('README.md'))`
        )
        check(
          !(await ui.ev(`!!${ui.$('drop-overlay')}`)),
          'déposé au milieu du fil : joint au message, indication retirée'
        )
        await ui.dragFiles([join(workspace, 'src', 'app.ts')], await center(ui.$('composer-input')))
        await ui.waitFor(`document.querySelectorAll('[data-testid=attachment]').length === 2`)
        check(true, 'déposé sur la zone de saisie : toujours joint')

        // Fichier exclu par l'agent (fiche 155) : confirmation avant de le joindre.
        const chips = `document.querySelectorAll('[data-testid=attachment]').length`
        const input = await center(ui.$('composer-input'))
        await ui.dragFiles([join(workspace, 'secret.txt')], input)
        await ui.waitFor(`!!${ui.$('excluded-confirm')}`)
        check(
          (await ui.ev(`${ui.$('excluded-confirm')}.innerText`)).includes('.bobignore') &&
            (await ui.ev(chips)) === 2,
          'fichier exclu par l’agent : confirmation demandée, pas encore joint'
        )
        await ui.shot('19c-fichier-exclu')
        await ui.click(ui.$('excluded-skip'))
        await ui.waitFor(`!${ui.$('excluded-confirm')}`)
        check((await ui.ev(chips)) === 2, '« Ne pas joindre » : rien de joint')
        await ui.dragFiles([join(workspace, 'secret.txt')], input)
        await ui.waitFor(`!!${ui.$('excluded-confirm')}`)
        await ui.click(ui.$('excluded-attach'))
        await ui.waitFor(`${chips} === 3`)
        check(true, '« Joindre quand même » : le fichier est joint')

        // Long texte collé (fiche 155) : une puce, qui part en bloc de texte à part.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/scenario echo colle')
        await ui.ev(pasteText(long))
        await ui.waitFor(`!!${ui.$('attachment-pasted')}`)
        const label = L('composer.attachment.pastedLines', {
          name: L('attachments.pastedText'),
          count: 45
        })
        check(
          (await ui.ev(`${ui.$('attachment-pasted')}.innerText.trim()`)) === label &&
            (await ui.ev(`${ui.$('composer-input')}.value`)) === '/scenario echo colle',
          `texte long collé : puce « ${label} », saisie inchangée`
        )
        const leftToInput = await ui.ev(pasteText('court'))
        check(
          leftToInput === true && (await ui.ev(chips)) === 4,
          'texte court collé : laissé à la saisie, comme avant (pas de puce)'
        )
        await ui.press('Enter')
        await ui.waitFor(`document.querySelectorAll('.msg-user').length === 2`)
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes('Texte collé (45 lignes)'),
          'l’agent reçoit le texte collé en bloc de texte annoncé'
        )
        check(
          (
            await ui.ev(
              `[...document.querySelectorAll('[data-testid=msg-attachments]')].at(-1).innerText`
            )
          ).includes(label),
          'fil : la puce du texte collé dans le message'
        )

        // Aperçu, puis « Remettre dans la saisie ».
        await ui.ev(pasteText(long))
        await ui.waitFor(`!!${ui.$('attachment-pasted')}`)
        await ui.click(ui.$('attachment-pasted'))
        await ui.waitFor(`${ui.$('pasted-text')}?.innerText.includes('ligne 45')`)
        await ui.shot('19d-texte-colle')
        await ui.click(ui.$('pasted-put-back'))
        await ui.waitFor(`!${ui.$('pasted-dialog')} && !${ui.$('attachment-pasted')}`)
        check(
          (await ui.ev(`${ui.$('composer-input')}.value`)).includes('ligne 45'),
          '« Remettre dans la saisie » : le texte revient dans le message, la puce part'
        )
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
