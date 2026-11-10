import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { L, LANG, check, withApp, M } from '../lib.mjs'

/** Montant en bobcoins tel que l'app l'écrit dans la langue des essais. */
const bobcoins = (n) => `${n.toLocaleString(LANG)} Bobcoins`

/**
 * Options d'ambiance : prénom et suggestions de l'accueil, thèmes Sépia et Nuit noire, police du
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
        // Sépia (clair) ou Nuit noire (sombre), d'après le mode imposé à la page par les essais.
        await ui.click(ui.$('settings-appearance'))
        const variant = scheme === 'dark' ? 'black' : 'sepia'
        await ui.click(ui.$(`theme-${variant}`))
        await ui.waitFor(`document.documentElement.dataset.palette === '${variant}'`)
        check(
          (await ui.ev(
            `getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`
          )) === (variant === 'black' ? '#000000' : '#f4ecd8'),
          variant === 'black' ? 'thème Nuit noire : fond noir' : 'thème Sépia : fond papier'
        )
        await ui.shot(variant === 'black' ? 'e0-nuit-noire' : 'e0-sepia')
        // Polices à chasse fixe installées, lues par le main (fiche 136).
        await ui.waitFor(
          `[...${ui.$('settings-code-font')}.options].some((o) => o.value === 'Menlo')`
        )
        await ui.ev(`(() => {
          const select = ${ui.$('settings-code-font')}
          select.value = 'Menlo'
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })()`)
        await ui.waitFor(
          `getComputedStyle(document.documentElement).getPropertyValue('--font-code').includes('Menlo')`
        )
        check(true, 'police du code : Menlo')
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
        check(true, 'sommaire : un trait par message')
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
        check(true, 'sommaire : clic sur le premier message → affiché, trait mis en avant')
        await ui.shot('e2-sommaire')

        // Bobcoins : le coût de la conversation dans le détail de la consommation ; la dépense de
        // Bob sur ce Mac dans « Mon activité » (fiches 137, 144), par « Toute mon activité… ».
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-open-board')}`)
        check(
          (await ui.ev(`${ui.$('usage-details')}.innerText`)).includes(L('usage.cost')),
          'bobcoins : coût de la conversation'
        )
        await ui.click(ui.$('usage-open-board'))
        await ui.waitFor(`!!${ui.$('usage-spend-today')}`)
        // La carte de l'agent factice (celle d'IBM Bob s'y ajoute s'il est installé sur ce Mac).
        const spend = (
          await ui.ev(
            `[...document.querySelectorAll('[data-testid=usage-account]')].map((e) => e.innerText).find((t) => t.startsWith('${M('Agent factice')}')) ?? ''`
          )
        ).replace(/\s+/g, ' ')
        check(
          spend.startsWith(L('usage.board.account.title', { agent: M('Agent factice') })) &&
            spend.includes(`${L('usage.spend.today')} ${bobcoins(0.35)}`) &&
            spend.includes(`${L('usage.spend.week')} ${bobcoins(0.85)}`) &&
            [0.35, 0.85].some((n) => spend.includes(`${L('usage.spend.month')} ${bobcoins(n)}`)),
          `Bobcoins : aujourd’hui, 7 jours, ce mois, dans « Mon activité » (${spend})`
        )
        await ui.ev(`${ui.$('usage-spend-today')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('e3-bobcoins')
        // Retour à la conversation : la page se referme.
        await ui.click(`document.querySelector('.history-item .history-open')`)
        await ui.waitFor(`!${ui.$('activity')} && !!${ui.$('composer-input')}`)

        // Budget épuisé : le message de Bob, pas « Internal error ».
        await ui.send('/scenario budget-depasse')
        await ui.waitFor(`document.body.innerText.includes('Budget Exceeded')`)
        check(
          (await ui.ev(`document.body.innerText`)).includes(
            'Budget Exceeded — Oh no! It looks like you’ve gone over your budget allowance of 50 Bobcoins.'
          ),
          'budget dépassé : titre et description de Bob'
        )
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
