import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Lpart, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Liens vers des fichiers dans la conversation (fiche 052) : aperçu d'un `.md` dans le panneau,
 * app par défaut pour le code, Finder pour un dossier, un exécutable ou un ⌥-clic. Les ouvertures
 * sont notées dans un journal (`BOBINE_OPEN_LOG`) : aucune vraie app ne s'ouvre.
 */
export async function linksSuite(scheme) {
  console.log(`\n— Liens vers des fichiers (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-liens-')))
  mkdirSync(join(workspace, 'docs'))
  mkdirSync(join(workspace, 'src'))
  writeFileSync(
    join(workspace, 'plan.md'),
    '# Plan de travail\n\n1. Lire [la suite](docs/suite.md)\n2. Écrire le code\n'
  )
  writeFileSync(join(workspace, 'docs', 'suite.md'), '# Suite\n\nDeuxième document.\n')
  writeFileSync(join(workspace, 'src', 'app.ts'), 'export const a = 1\n')
  writeFileSync(join(workspace, 'outil.command'), 'echo non\n')
  chmodSync(join(workspace, 'outil.command'), 0o755)
  const log = join(workspace, '..', `ouvertures-${scheme}-${Date.now()}.log`)
  writeFileSync(log, '')
  const opened = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
  const link = (text) =>
    `[...document.querySelectorAll('[data-testid=file-link]')].find((a) => a.textContent === ${JSON.stringify(text)})`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Montre les fichiers')
        await ui.ready()
        await ui.waitFor(`document.querySelectorAll('[data-testid=file-link]').length === 4`)
        check(true, 'liens de fichiers reconnus (le lien web reste un lien web)')

        await ui.click(link('le plan'))
        await ui.waitFor(
          `${ui.$('document-name')}?.innerText === 'plan.md' && ${ui.$('document-body')}.innerText.includes('Plan de travail')`
        )
        check(
          opened().length === 0,
          '.md du dossier : aperçu dans le panneau, rien d’ouvert ailleurs'
        )
        await ui.shot('41-apercu-md')
        await ui.click(
          `[...${ui.$('document-body')}.querySelectorAll('a')].find((a) => a.textContent === 'la suite')`
        )
        await ui.waitFor(`${ui.$('document-name')}?.innerText === 'suite.md'`)
        check(true, 'lien relatif dans l’aperçu : depuis le dossier du document (docs/suite.md)')

        await ui.click(link('src/app.ts:3'))
        const waitLog = async (line) => {
          for (let i = 0; i < 50 && !opened().includes(line); i++)
            await new Promise((r) => setTimeout(r, 100))
          return opened().includes(line)
        }
        check(await waitLog(`open ${join(workspace, 'src', 'app.ts')}`), 'code : app par défaut')
        await ui.click(link('docs'))
        check(await waitLog(`reveal ${join(workspace, 'docs')}`), 'dossier : montré dans le Finder')
        await ui.click(link('outil.command'))
        check(
          (await waitLog(`reveal ${join(workspace, 'outil.command')}`)) &&
            !opened().includes(`open ${join(workspace, 'outil.command')}`),
          'exécutable : montré dans le Finder, jamais ouvert'
        )
        await ui.waitFor(
          `document.body.innerText.includes(${JSON.stringify(Lpart('fileLink.executable'))})`
        )
        check(true, 'le fil dit pourquoi l’exécutable n’a pas été ouvert')
        await ui.ev(
          `${link('le plan')}.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true })); true`
        )
        check(
          await waitLog(`reveal ${join(workspace, 'plan.md')}`),
          '⌥-clic : montré dans le Finder'
        )

        await ui.click(ui.$('document-close'))
        await ui.waitFor(
          `!${ui.$('document-tab')} && !document.querySelector('[data-tab=document]')`
        )
        check(true, 'aperçu fermé : l’onglet disparaît')
      },
      undefined,
      'liens-fichiers',
      { BOBINE_WORKSPACE: workspace, BOBINE_OPEN_LOG: log }
    )

    // Page HTML (fiche 064) : dans le navigateur intégré, servie depuis son dossier.
    mkdirSync(join(workspace, 'site'))
    writeFileSync(
      join(workspace, 'site', 'index.html'),
      `<!doctype html><html><head><meta charset="utf-8"><title>Chargement</title>
<link rel="stylesheet" href="style.css"></head>
<body><h1 id="titre">Page d’essai</h1><p id="resultat">…</p>
<script type="module">
const data = await (await fetch('data.json')).json()
const cache = (await fetch('.env')).status
document.title = data.titre
document.getElementById('resultat').textContent = data.titre + ' · .env : ' + cache
</script></body></html>`
    )
    writeFileSync(join(workspace, 'site', 'style.css'), 'h1 { color: rgb(201, 100, 66); }')
    writeFileSync(join(workspace, 'site', 'data.json'), '{ "titre": "Données chargées" }')
    writeFileSync(join(workspace, 'site', '.env'), 'SECRET=ne-doit-pas-sortir')
    const openedBefore = opened().length
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Fais une page')
        await ui.ready()
        await ui.click(link('ouvrir la page'))
        await ui.waitFor(
          `/^http:\\/\\/127\\.0\\.0\\.1:/.test(${ui.$('browser-address')}?.value ?? '')`
        )
        const address = await ui.ev(`${ui.$('browser-address')}.value`)
        // Contenu de la page, lu dans son onglet (le module écrit le résultat une fois chargé).
        const main = await mainProcess()
        let page = ''
        try {
          for (let i = 0; i < 50 && !page.includes('Données'); i++) {
            page = await main.evaluate(
              `(require('electron').webContents.getAllWebContents().find((w) => w.getURL().startsWith('http://127.0.0.1:'))?.executeJavaScript("document.getElementById('resultat').textContent + ' · ' + getComputedStyle(document.getElementById('titre')).color")) ?? ''`
            )
            if (!page.includes('Données')) await new Promise((r) => setTimeout(r, 100))
          }
        } finally {
          main.close()
        }
        check(
          /^http:\/\/127\.0\.0\.1:\d+\/[\w-]+\/index\.html$/.test(address) &&
            page === 'Données chargées · .env : 404 · rgb(201, 100, 66)',
          `page HTML : navigateur intégré, style, module et fetch() chargés, .env refusé (${page})`
        )
        check(opened().length === openedBefore, 'rien d’ouvert dans une autre app')
        await ui.shot('42-apercu-html')
      },
      undefined,
      'lien-html',
      { BOBINE_WORKSPACE: workspace, BOBINE_OPEN_LOG: log },
      [`--inspect=${MAIN_PORT}`]
    )

    // Liens web (fiche 154) : adresse locale dans le navigateur intégré (⌥-clic : celui du Mac),
    // autre adresse dans le navigateur du Mac ; la fenêtre de l'app ne navigue jamais.
    const external = (url) => `external ${url}`
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Donne les liens')
        await ui.ready()
        const web = (text) =>
          `[...document.querySelectorAll('[data-testid=web-link]')].find((a) => a.textContent === ${JSON.stringify(text)})`
        await ui.waitFor(`!!${web('localhost')}`)
        const sentBefore = opened().length
        await ui.click(web('localhost'))
        await ui.waitFor(
          `/^http:\\/\\/localhost:3000\\/essai/.test(${ui.$('browser-address')}?.value ?? '')`
        )
        check(
          opened().length === sentBefore &&
            (await ui.ev(`!!document.querySelector('.side-panel-tab.active[data-tab=browser]')`)),
          'adresse locale : navigateur intégré du panneau, rien dans le navigateur du Mac'
        )
        await ui.click(web('example.org'))
        const waitLog = async (line) => {
          for (let i = 0; i < 50 && !opened().includes(line); i++)
            await new Promise((r) => setTimeout(r, 100))
          return opened().includes(line)
        }
        check(
          await waitLog(external('http://example.org/doc')),
          'autre adresse : navigateur du Mac'
        )
        await ui.ev(
          `${web('localhost')}.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true })); true`
        )
        check(
          await waitLog(external('http://localhost:3000/essai')),
          '⌥-clic sur une adresse locale : navigateur du Mac'
        )
        await ui.shot('43-liens-web')
      },
      undefined,
      'liens-web',
      { BOBINE_WORKSPACE: workspace, BOBINE_OPEN_LOG: log }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(log, { force: true })
  }
}
