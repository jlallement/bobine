import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fontSource } from '../../src/main/platform.ts'
import { affirm, probes } from '../affirm.mjs'
import { L, check, withApp } from '../lib.mjs'

/**
 * Options d'ambiance : prénom et suggestions de l'accueil, thèmes Aurore et Nuit noire, police du
 * code, sommaire de la conversation, bobcoins dépensés (base de Bob d'essai, dans le détail de la
 * consommation d'une conversation qui compte en bobcoins).
 */
export async function funSuite(scheme) {
  console.log(`\n— Options d’ambiance (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-fun-home-'))
  mkdirSync(join(home, '.bob', 'db'), { recursive: true })
  const db = new DatabaseSync(join(home, '.bob', 'db', 'bob.db'))
  db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, costs TEXT, updated_at INTEGER)')
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?)').run('a', '{"cost":0.35}', Date.now())
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?)').run(
    'b',
    '{"cost":0.5}',
    Date.now() - 3 * 24 * 3600 * 1000
  )
  db.close()
  try {
    await withApp(
      scheme,
      async (ui) => {
        check(
          !(await ui.ev(`!!document.querySelector('.bob-spend')`)),
          'plus de compteur de bobcoins dans la barre latérale'
        )

        // Prénom dans l'accueil.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.ev(`${ui.$('settings-user-name')}.focus()`)
        await ui.type('Jérôme')
        await ui.ev(`${ui.$('settings-user-name')}.blur()`)
        // Aurore (clair, fiche 226) ou Nuit noire (sombre), d'après le mode imposé à la page.
        await ui.click(ui.$('settings-appearance'))
        const variant = scheme === 'dark' ? 'black' : 'aurora'
        await ui.click(ui.$(`theme-${variant}`))
        await ui.waitFor(`document.documentElement.dataset.palette === '${variant}'`)
        // Rendu réel (style calculé) : mesuré par la capture (plan de suppression, risque 2).
        const bg = variant === 'black' ? '#000000' : '#fbfcfe'
        await affirm(ui, variant === 'black' ? 'e0-nuit-noire' : 'e0-aurore', [
          probes.custom(
            variant === 'black'
              ? 'thème Nuit noire : fond noir'
              : 'thème Aurore : fond blanc froid',
            `const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
            return { ok: bg === ${JSON.stringify(bg)}, detail: bg }`
          )
        ])
        // Polices à chasse fixe installées, lues par le main (fiche 136) : Menlo par AppKit sur
        // macOS, DejaVu Sans Mono (présente sur tout Ubuntu) par fontconfig sous Linux (fiche 145).
        const codeFont = fontSource(process.platform) === 'appkit' ? 'Menlo' : 'DejaVu Sans Mono'
        await ui.waitFor(
          `[...${ui.$('settings-code-font')}.options].some((o) => o.value === ${JSON.stringify(codeFont)})`
        )
        await ui.ev(`(() => {
          const select = ${ui.$('settings-code-font')}
          select.value = ${JSON.stringify(codeFont)}
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })()`)
        await ui.waitFor(
          `getComputedStyle(document.documentElement).getPropertyValue('--font-code').includes(${JSON.stringify(codeFont)})`
        )
        check(true, `police du code : ${codeFont}`)
        await ui.click(ui.$('theme-system'))
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)
        check(
          ['morning', 'afternoon', 'evening']
            .map((moment) =>
              L('home.greetingWithName', { hello: L(`home.hello.${moment}`), name: 'Jérôme' })
            )
            .includes(await ui.ev(`document.querySelector('.greeting').innerText.trim()`)),
          'accueil : salutation selon l’heure, avec le prénom'
        )

        // Suggestion de départ : remplit la zone de saisie sans envoyer.
        await ui.click(`[...document.querySelectorAll('[data-testid=suggestion]')].at(-1)`)
        await ui.waitFor(
          `${ui.$('composer-input')}.value === ${JSON.stringify(L('home.suggestions.plan.text'))}`
        )
        check(
          !(await ui.ev(`!!document.querySelector('.msg-user')`)),
          'suggestion : texte dans la zone de saisie, rien n’est envoyé'
        )
        await ui.shot('e1-accueil')

        // Sommaire : un trait par message, liste au survol, clic → message.
        await ui.ev(`${ui.$('composer-input')}.select()`)
        for (const text of ['/scenario streaming-texte', '/scenario echo', '/scenario refus']) {
          await ui.send(text)
          await ui.ready()
        }
        // Le sommaire a besoin de la largeur du fil : panneau « Session » fermé (fiche 166).
        await ui.closePanel()
        await ui.waitFor(`document.querySelectorAll('.outline-bar').length === 3`)
        // La liste s'ouvre au survol réel (`:hover`) : un `mouseover` simulé ne l'ouvrait pas, le
        // clic tombait à côté et la vérification ne passait que par la place des messages (fiche 185).
        await ui.hover(await ui.center(`document.querySelector('.outline')`))
        await ui.waitFor(
          `getComputedStyle(document.querySelector('.outline-list')).display !== 'none' && document.querySelector('[data-testid=outline-item]').getBoundingClientRect().width > 0`
        )
        await ui.click(`document.querySelectorAll('[data-testid=outline-item]')[0]`)
        await ui.waitFor(
          `document.querySelector('.outline-bar.current') === document.querySelector('.outline-bar')`
        )
        await ui.shot('e2-sommaire')

        // Bobcoins : le coût de la conversation dans le détail de la consommation ; la dépense de
        // Bob sur ce Mac dans « Mon activité » (fiches 137, 144), par « Toute mon activité… ».
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-open-board')}`)
        await ui.click(ui.$('usage-open-board'))
        await ui.waitFor(`!!${ui.$('usage-spend-today')}`)
        await ui.ev(`${ui.$('usage-spend-today')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('e3-bobcoins')
        // Retour à la conversation : la page se referme.
        await ui.click(`document.querySelector('.history-item .history-open')`)
        await ui.waitFor(`!${ui.$('activity')} && !!${ui.$('composer-input')}`)

        // Budget épuisé : le message de Bob, pas « Internal error ».
        await ui.send('/scenario budget-depasse')
        await ui.waitFor(`document.body.innerText.includes('Budget Exceeded')`)
        await ui.shot('e4-budget')
      },
      undefined,
      'demo',
      {
        BOBINE_CONFIG_HOME: home,
        MOCK_AGENT_CURRENCY: 'bobcoins',
        MOCK_AGENT_COST_SOURCE: 'bob-db'
      }
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}
