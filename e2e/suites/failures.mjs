import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Pannes (fiche 041) : agent qui plante en plein tour puis relancé, agent figé qui ignore Stop,
 * historique abîmé au démarrage, journal de l'app.
 */
export async function failuresSuite(scheme) {
  console.log(`\n— Pannes (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-pannes-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.send('/scenario plantage')
        await ui.waitFor(`!!${ui.$('restart')}`)
        check(
          (await ui.ev(`document.querySelector('[data-testid=tool]')?.dataset.status`)) ===
            'cancelled',
          'plantage en plein tour : l’outil en cours est marqué interrompu'
        )
        const notices = await ui.ev(
          `[...document.querySelectorAll('.notice-error')].map((n) => n.innerText)`
        )
        check(
          notices.length === 1 && /code 3/.test(notices[0]) && /plantage simulé/.test(notices[0]),
          'un seul avis, avec le code de sortie et la fin de la sortie d’erreur'
        )
        await ui.shot('41-plantage')
        await ui.click(ui.$('restart'))
        await ui.ready()
        check(
          (await ui.ev(`document.querySelectorAll('.notice-error').length`)) === 1,
          '« Relancer » : le fil est gardé, avis de panne compris'
        )
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        check(
          (await ui.ev(`document.querySelectorAll('.msg-agent').length`)) === 2,
          'la conversation continue et l’agent répond'
        )

        await ui.send('/scenario muet')
        // Le texte fini, l'agent ne répond plus (« Stop » plus tôt interromprait le texte).
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText.includes('Je commence')`
        )
        await ui.click(ui.$('stop'))
        await ui.waitFor(`!!${ui.$('restart')}`, 20000)
        check(
          (await ui.ev(`document.body.innerText`)).includes(L('agentHost.exit.unresponsive')),
          'agent figé qui ignore Stop : arrêté au bout du délai, avec un message clair'
        )
        await ui.shot('42-agent-fige')
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes('Markdown'),
          'agent arrêté : écrire un message le relance, puis le message part'
        )

        const main = await mainProcess()
        try {
          check(
            await main.evaluate(
              `!!require('electron').Menu.getApplicationMenu().getMenuItemById('show-log')`
            ),
            'menu Aide → « Afficher le journal »'
          )
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      {},
      [`--inspect=${MAIN_PORT}`]
    )

    const log = join(userData, 'logs', 'main.log')
    check(
      existsSync(log) && /Agent mock .*exited/.test(readFileSync(log, 'utf8')),
      'journal : arrêts de l’agent écrits dans main.log'
    )

    // Historique abîmé : l'app démarre, reprend la dernière bonne copie et le dit.
    const conversations = join(userData, 'conversations')
    writeFileSync(join(conversations, 'index.json'), '[{"id": "tronqu')
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(
          `document.body.innerText.includes(${JSON.stringify(Lpart('profile.notice.historyDamaged', { count: 1 }))})`
        )
        check(true, 'historique abîmé : l’app démarre et prévient')
        check(
          (await ui.ev(`document.querySelectorAll('[data-testid=history-item]').length`)) >= 1,
          'la conversation est reprise de la dernière bonne copie'
        )
        await ui.shot('43-historique-abime')
      },
      userData
    )
    check(
      readdirSync(conversations).some((f) => f.startsWith('index.json.corrupt-')),
      'le fichier abîmé est mis de côté, pas écrasé'
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
