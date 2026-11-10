// Scénarios aux limites (fiche 139) joués à travers l'app : gestionnaire réel, fil enregistré, et
// les invariants de la grille. Persona « façon OpenCode » : ces formes ne sont propres à aucun agent.
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conversationChanges } from '@shared/changes'
import { noticeText, type TranscriptItem } from '@shared/transcript'
import { MAX_TERMINAL_OUTPUT } from '@shared/terminal-output'
import { environment, type App } from './harness'
import { agentConsistent, durableMatchesLive, noDuplicates, nothingRunning } from './invariants'
import { PERSONAS } from './personas'

const persona = PERSONAS['facon-opencode']

/** Joue `scenario`, puis vérifie les invariants ; rend le fil et l'app pour les vérifications propres. */
async function play(
  scenario: string,
  options: { extraArgs?: string[]; then?: string } = {}
): Promise<{ app: App; id: string; items: TranscriptItem[]; invariants: string[] }> {
  const env = environment(persona, options.extraArgs ? { extraArgs: options.extraArgs } : {})
  const app = env.launch()
  const id = await app.start()
  await app.prompt(id, `/scenario ${scenario}`)
  // Une panne réseau est réessayée (fiche 142) : le message suivant part une fois au repos.
  if (options.then) {
    await app.idle(id)
    await app.prompt(id, options.then)
  }
  await app.idle(id)
  const view = app.view(id)
  const invariants = [
    ...nothingRunning(view.transcript.items),
    ...noDuplicates(view.transcript.items, app.sent.get(id) ?? 0),
    ...agentConsistent(view)
  ]
  app.manager.stopAll()
  await app.manager.settled()
  invariants.push(...durableMatchesLive(app.view(id).transcript, env.durable(id)))
  return { app, id, items: app.view(id).transcript.items, invariants }
}

const notices = (items: TranscriptItem[]) =>
  items.flatMap((i) => (i.kind === 'notice' ? [noticeText(i)] : []))

describe.concurrent('scénarios aux limites, à travers l’app (fiche 139)', () => {
  it('réseau coupé en plein flux : cinq tentatives, une erreur, l’outil interrompu, le tour suivant passe', async () => {
    const { items, invariants } = await play('reseau-coupe', { then: '/scenario streaming-texte' })
    expect(invariants).toEqual([])
    expect(items.filter((i) => i.kind === 'notice' && i.level === 'error')).toHaveLength(1)
    expect(items.filter((i) => i.kind === 'user')).toHaveLength(2)
    const tools = items.filter((i) => i.kind === 'tool')
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((t) => t.status === 'cancelled')).toBe(true)
    expect(items.at(-1)?.kind).toBe('agent')
  })

  it('limite de débit (429) : réessayée seule, sans avis d’erreur, puis la réponse', async () => {
    const { items, invariants } = await play('limite-debit', { then: '/scenario streaming-texte' })
    expect(invariants).toEqual([])
    expect(notices(items)).toEqual([])
    const replies = items.flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
    expect(replies[0]).toBe('Limite levée : voici la réponse.')
    expect(items.at(-1)?.kind).toBe('agent')
  })

  it('diff de plus de 5 000 lignes : carte terminée, fil enregistré tel quel', async () => {
    const { items, invariants } = await play('diff-geant')
    expect(invariants).toEqual([])
    const card = items.find((i) => i.kind === 'tool')
    expect(card).toMatchObject({ status: 'completed' })
    const diff = card?.kind === 'tool' ? card.content[0] : undefined
    expect(diff?.type === 'diff' && diff.newText.split('\n').length).toBeGreaterThan(5000)
  })

  it('write d’OpenCode 2.2.5 sans diff : les fichiers créés comptent dans les modifications (fiche 202)', async () => {
    const { items, invariants } = await play('ecriture-opencode')
    expect(invariants).toEqual([])
    const changes = conversationChanges(items).map((c) => ({
      file: basename(c.path),
      created: c.created,
      added: c.added,
      removed: c.removed
    }))
    // Sans autorisation (diff refait de l'entrée de write), puis accordée (diff de la demande).
    expect(changes).toEqual([
      { file: 'nouveau.txt', created: true, added: 1, removed: 0 },
      { file: 'autorise.txt', created: true, added: 1, removed: 0 }
    ])
  })

  it('fichier binaire : octets bruts gardés dans le fil et sur le disque', async () => {
    const { items, invariants } = await play('fichier-binaire')
    expect(invariants).toEqual([])
    expect(JSON.stringify(items)).toContain('\\u0000')
  })

  it('sortie de commande de 1 Mio : gardée sous la limite, coupée par le début', async () => {
    const { app, id, invariants } = await play('sortie-1mo')
    expect(invariants).toEqual([])
    const terminal = app.view(id).transcript.terminals?.['term-big']
    expect(terminal?.output.length).toBeLessThanOrEqual(MAX_TERMINAL_OUTPUT)
    expect(terminal?.truncated).toBe(true)
    // La fin de la sortie reste : la dernière ligne de la commande.
    expect(terminal?.output).toMatch(/test 16383 ok \.+\n$/)
  })

  it('commandes « / » annoncées en cours de session : le menu les prend', async () => {
    const { app, id, invariants } = await play('commandes-en-cours')
    expect(invariants).toEqual([])
    expect(app.view(id).snapshot?.commands.map((c) => c.name)).toContain('revue')
  })

  it('emoji, droite à gauche, lignes très longues : texte intact, à l’écran et sur le disque', async () => {
    const { items, invariants } = await play('textes-limites')
    expect(invariants).toEqual([])
    const text = items.flatMap((i) => (i.kind === 'agent' ? [i.text] : [])).join('')
    for (const piece of ['👩🏽‍💻', '🏳️‍🌈', 'مرحبا بالعالم', 'שלום עולם']) expect(text).toContain(piece)
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeGreaterThan(5000)
  })

  it('démarrage lent : l’agent finit par être prêt, sans erreur', async () => {
    const started = Date.now()
    const { invariants } = await play('streaming-texte', {
      extraArgs: ['--demarrage-lent', '1500']
    })
    expect(invariants).toEqual([])
    expect(Date.now() - started).toBeGreaterThanOrEqual(1500)
  })
})
