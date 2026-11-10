/**
 * Pilote de Bobine (fiche 206) : lit l'écran de Bobine en texte, attend sans rien coûter, agit en
 * secours et tient le journal du testeur. Voir docs/pilote.md.
 *
 *   pnpm pilote lancer [--app <.app|dossier>] [--dossier <d>] [--profil <d>] [--port N] …
 *   pnpm pilote etat [--json] [--long]
 *   pnpm pilote attendre [--max 20m] [--calme 3m]
 *   pnpm pilote capture [--demi] [--zone fil|carte|panneau|fenetre]
 *   pnpm pilote envoyer "<texte>" | repondre "<bouton>" | cliquer "<libellé>" | panneau <nom>
 *   pnpm pilote note --gravite bloquant|genant|mineur|idee [--capture] "<texte>"
 *   pnpm pilote intervention [--capture] "<pourquoi>"
 *   pnpm pilote journal [--resume]
 *   pnpm pilote arreter
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { answerCard, clickLabel, openPanel, sendMessage } from './actions.mjs'
import { formatDuration, GRAVITES, parseArgs, parseDuration, ZONES } from './args.mjs'
import { connect, sleep } from './cdp.mjs'
import { formatState } from './etat.mjs'
import { launch, readInstance, stop } from './instance.mjs'
import {
  appendEntry,
  formatSummary,
  localClock,
  readEntries,
  summarize,
  turnMs
} from './journal.mjs'
import { READ_SCREEN } from './lecture.mjs'
import { EXIT_CODES, Watcher } from './raison.mjs'
import { L, panelTab } from './textes.mjs'

/** Intervalle de lecture pendant `attendre` : une évaluation, quelques millisecondes de CPU. */
const POLL_MS = 1500

/** Page de l'instance pilotée, avec la page « active » (la fenêtre n'a pas le focus). */
async function page() {
  const p = await connect(readInstance().port)
  await p.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  return p
}

const read = (p) => p.ev(READ_SCREEN)

/** État en texte, ou une ligne qui dit pourquoi on ne peut pas le lire. */
async function stateText(options = {}) {
  let p
  try {
    p = await page()
    return formatState(await read(p), options)
  } catch (error) {
    return `Bobine injoignable : ${error.message}`
  } finally {
    p?.close()
  }
}

/** Zone à capturer, en pixels CSS de la fenêtre, ou rien pour la fenêtre entière. */
const ZONE_RECT = {
  fil: `document.querySelector('[data-testid=thread]')?.parentElement`,
  carte: `[...document.querySelectorAll('.permission-card')].at(-1)`,
  panneau: `document.querySelector('[data-testid=side-panel]')`
}

async function capture(options, name = 'capture') {
  const zone = options.zone ?? 'fenetre'
  if (!ZONES.includes(zone)) throw new Error(`zone inconnue : ${zone} (${ZONES.join(', ')})`)
  const instance = readInstance()
  const p = await page()
  try {
    let clip
    if (zone !== 'fenetre') {
      clip = await p.ev(`(() => {
        const e = ${ZONE_RECT[zone]}
        if (!e) return null
        const b = e.getBoundingClientRect()
        const x = Math.max(0, b.x), y = Math.max(0, b.y)
        return { x, y, width: Math.min(innerWidth, b.right) - x, height: Math.min(innerHeight, b.bottom) - y }
      })()`)
      if (!clip) throw new Error(`rien à capturer : pas de ${zone} à l’écran`)
    }
    const png = await p.screenshot(clip, options.demi ? 0.5 : 1)
    if (!png) throw new Error('capture vide (fenêtre cachée ou réduite ?)')
    const stamp = localClock(new Date()).replace(/:/g, '')
    const file = join(instance.journal, 'captures', `${stamp}-${name}-${zone}.png`)
    writeFileSync(file, Buffer.from(png, 'base64'))
    return file
  } finally {
    p.close()
  }
}

/** Attend qu'il faille l'humain ; écrit la raison, l'état, et l'entrée du journal. */
async function wait(options) {
  const max = parseDuration(options.max ?? '20m')
  const calme = parseDuration(options.calme ?? '3m')
  const watcher = new Watcher({ max, calme })
  const started = Date.now()
  let p = await page()
  let shot
  let outcome
  let failures = 0
  while (!outcome) {
    try {
      shot = await read(p)
      failures = 0
      outcome = watcher.observe(shot, Date.now())
    } catch (error) {
      // Page rechargée, fenêtre fermée : on se reconnecte ; Bobine arrêtée : erreur.
      if (++failures > 5) {
        outcome = { code: 'erreur', detail: `Bobine injoignable : ${error.message}` }
        break
      }
      p.close()
      await sleep(1000)
      p = await page().catch(() => p)
      continue
    }
    if (!outcome) await sleep(POLL_MS)
  }
  p.close()
  const waited = Date.now() - started
  const etat = shot ? formatState(shot) : ''
  const entry = {
    type: 'attente',
    raison: outcome.code,
    detail: outcome.detail || undefined,
    attenteMs: waited,
    tourMs: outcome.code === 'tour-fini' ? (turnMs(shot) ?? undefined) : undefined,
    etat
  }
  appendEntry(readInstance().journal, entry)
  if (options.json) console.log(JSON.stringify({ ...entry, etat: shot }))
  else {
    console.log(
      `${outcome.code}${outcome.detail ? ` — ${outcome.detail}` : ''} (${formatDuration(waited)})`
    )
    console.log(etat)
  }
  return EXIT_CODES[outcome.code]
}

/** Note ou intervention : texte, contexte (`etat`), capture si demandée. */
async function feedback(type, options, text) {
  if (!text) throw new Error(`texte manquant : pnpm pilote ${type} "…"`)
  if (type === 'note' && !GRAVITES.includes(options.gravite)) {
    throw new Error(`--gravite ${GRAVITES.join('|')} attendue`)
  }
  const instance = readInstance()
  let file
  if (options.capture) {
    file = await capture({ demi: true }, type).catch((e) => `(capture impossible : ${e.message})`)
  }
  const entry = appendEntry(instance.journal, {
    type,
    ...(type === 'note' ? { gravite: options.gravite } : {}),
    texte: text,
    capture: file && relative(instance.journal, file),
    etat: await stateText()
  })
  const what = type === 'note' ? 'Note' : 'Intervention'
  console.log(`${what} notée à ${localClock(entry.at)} : ${join(instance.journal, 'journal.md')}`)
}

/** Action de secours : connexion, action, entrée « action » dans le journal. */
async function act(command, text) {
  if (!text) throw new Error(`texte manquant : pnpm pilote ${command} "…"`)
  const p = await page()
  try {
    const lang = await p.ev('document.documentElement.lang')
    let done
    if (command === 'envoyer') {
      await sendMessage(p, text)
      done = `envoyé : ${text.slice(0, 80)}`
    } else if (command === 'repondre') {
      done = `répondu : ${await answerCard(p, text)}`
    } else if (command === 'cliquer') {
      done = `cliqué : ${await clickLabel(p, text)}`
    } else {
      const id = panelTab(text)
      if (!id) throw new Error(`panneau inconnu : ${text}`)
      const label = L(`panel.tab.${id}`, lang)
      done = `panneau : ${await openPanel(p, id, label, L('sidePanel.more', lang))}`
    }
    appendEntry(readInstance().journal, { type: 'action', texte: done })
    console.log(done)
  } finally {
    p.close()
  }
}

const HELP = readFileSync(new URL(import.meta.url), 'utf8')
  .split('*/')[0]
  .replace(/^\/\*\*?\n?/, '')
  .replace(/^ \* ?/gm, '')

async function main(argv) {
  const { command, options, text } = parseArgs(argv)
  switch (command) {
    case 'aide':
      console.log(HELP.trim())
      return 0
    case 'lancer': {
      const instance = await launch(options)
      appendEntry(instance.journal, {
        type: 'debut',
        texte: `Bobine lancée (pid ${instance.pid}, port ${instance.port}, profil ${instance.profil})`
      })
      console.log(`Bobine lancée : pid ${instance.pid}, port ${instance.port}`)
      console.log(`Journal : ${instance.journal}`)
      console.log(await stateText())
      return 0
    }
    case 'arreter': {
      const { instance, already } = await stop()
      appendEntry(instance.journal, { type: 'fin', texte: 'Bobine arrêtée' })
      console.log(already ? 'Bobine était déjà arrêtée' : `Bobine arrêtée (pid ${instance.pid})`)
      return 0
    }
    case 'etat': {
      const p = await page()
      try {
        const shot = await read(p)
        console.log(options.json ? JSON.stringify(shot) : formatState(shot, options))
      } finally {
        p.close()
      }
      return 0
    }
    case 'attendre':
      return wait(options)
    case 'capture':
      console.log(await capture(options))
      return 0
    case 'envoyer':
    case 'repondre':
    case 'cliquer':
    case 'panneau':
      await act(command, text)
      return 0
    case 'note':
    case 'intervention':
      await feedback(command, options, text)
      return 0
    case 'journal': {
      const dir = readInstance().journal
      if (options.resume) console.log(formatSummary(summarize(readEntries(dir))))
      else console.log(readFileSync(join(dir, 'journal.md'), 'utf8'))
      return 0
    }
  }
  return 0
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(`pilote : ${error.message}`)
    process.exit(error.message.startsWith('commande inconnue') ? 2 : 1)
  }
)
