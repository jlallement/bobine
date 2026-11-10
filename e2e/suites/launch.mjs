import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

/** Lancer l'app du projet : serveur de dev, journal, ouverture dans le navigateur (fiche 030). */
export async function launchSuite(scheme) {
  console.log(`\n— Lancer l’app (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-launch-'))
  const probe = createServer()
  await new Promise((r) => probe.listen(0, '127.0.0.1', r))
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  mkdirSync(join(workspace, '.bob'))
  writeFileSync(
    join(workspace, '.bob/launch.json'),
    JSON.stringify({
      version: '0.0.1',
      configurations: [
        { name: 'web', runtimeExecutable: process.execPath, runtimeArgs: ['server.js'], port }
      ]
    })
  )
  writeFileSync(
    join(workspace, 'server.js'),
    `require('node:http').createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end('<title>Mon app</title><h1>Mon app tourne</h1>') })
      .listen(Number(process.env.PORT), '127.0.0.1', () => console.log('Serveur prêt sur ' + process.env.PORT))`
  )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Lance l’app')
        await ui.waitFor(`!!${ui.$('questions')}`)
        check(
          (await ui.ev(`${ui.$('questions')}.innerText`)).includes('server.js'),
          'commande montrée à l’utilisateur avant le lancement'
        )
        await ui.shot('25-lancer-confirmation')
        await ui.press('1')
        await ui.ready()
        const reply = await ui.lastAgentText()
        check(
          reply.includes(`started: http://localhost:${port}/`) &&
            reply.includes(`Serveur prêt sur ${port}`) &&
            reply.includes('Mon app tourne'),
          'serveur démarré, journal lu, page ouverte et lue par l’agent'
        )
        check(
          (await ui.ev(`${ui.$('browser-address')}?.value`)) === `http://localhost:${port}/` &&
            (await ui.ev(`${ui.$('dev-server')}?.dataset.status`)) === 'running',
          'navigateur sur l’app ; serveur « web » en marche sous la barre d’adresse'
        )
        await ui.click(ui.$('dev-server-logs'))
        await ui.waitFor(`${ui.$('dev-server-log-text')}?.innerText.includes('Serveur prêt')`)
        check(true, 'journal du serveur visible dans l’onglet')
        await ui.shot('26-serveur-journal')
        await ui.click(ui.$('dev-server-stop'))
        await ui.waitFor(`${ui.$('dev-server')}?.dataset.status === 'exited'`)
        check(true, 'serveur arrêté depuis l’onglet')
      },
      undefined,
      'lancer-app',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
