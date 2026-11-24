import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MOCK_LANG, check, withApp } from '../lib.mjs'

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

        // Mention @ : recherche dans le dossier, le fichier est joint.
        await ui.type('/scenario echo voir @app')
        await ui.waitFor(
          `!!${ui.$('file-menu')} && document.querySelectorAll('[data-testid=file-item]').length > 0`
        )
        await ui.shot('17-mention')
        await ui.press('Enter')
        await ui.waitFor(`${ui.$('composer-input')}.value === '/scenario echo voir @src/app.ts '`)
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
        await ui.shot('19-message-joint')

        // Glisser-déposer : toute la conversation reçoit les fichiers, pas seulement la saisie.
        const center = (selector) =>
          ui.ev(
            `(() => { const b = ${selector}.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`
          )
        const thread = await center(ui.$('thread'))
        await ui.dragFiles([join(workspace, 'README.md')], thread, { drop: false })
        await ui.waitFor(`!!${ui.$('drop-overlay')}`)
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
        await ui.shot('19c-fichier-exclu')
        await ui.click(ui.$('excluded-skip'))
        await ui.waitFor(`!${ui.$('excluded-confirm')}`)
        await ui.dragFiles([join(workspace, 'secret.txt')], input)
        await ui.waitFor(`!!${ui.$('excluded-confirm')}`)
        await ui.click(ui.$('excluded-attach'))
        await ui.waitFor(`${chips} === 3`)

        // Long texte collé (fiche 155) : une puce, qui part en bloc de texte à part.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/scenario echo colle')
        await ui.ev(pasteText(long))
        await ui.waitFor(`!!${ui.$('attachment-pasted')}`)
        await ui.ev(pasteText('court'))
        await ui.press('Enter')
        await ui.waitFor(`document.querySelectorAll('.msg-user').length === 2`)
        await ui.ready()

        // Aperçu, puis « Remettre dans la saisie ».
        await ui.ev(pasteText(long))
        await ui.waitFor(`!!${ui.$('attachment-pasted')}`)
        await ui.click(ui.$('attachment-pasted'))
        await ui.waitFor(`${ui.$('pasted-text')}?.innerText.includes('ligne 45')`)
        await ui.shot('19d-texte-colle')
        await ui.click(ui.$('pasted-put-back'))
        await ui.waitFor(`!${ui.$('pasted-dialog')} && !${ui.$('attachment-pasted')}`)
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
