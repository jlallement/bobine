import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { conversationChanges } from '@shared/changes'
import { commandFolderOf } from '@shared/command-view'
import { createsFile } from '@shared/tool-label'
import { noticeText, type TranscriptItem } from '@shared/transcript'
import { noDuplicates } from '../conformance/invariants'
import type { TurnLimitSeen } from '@shared/turn-limit'
import { parseTrace, type Trace } from './acp-trace'
import { resolveProfiles } from './profiles'
import { replayTrace } from './trace-replay'
import { TurnLimitWatch } from './turn-limit'

const TRACES = join(__dirname, '__traces__')

/** Toutes les traces du dépôt (enregistrées par les sondes, ou reconstituées). */
function traces(): [string, Trace][] {
  const files = readdirSync(TRACES, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ndjson'))
    .sort()
  return files.map((f) => [f, parseTrace(readFileSync(join(TRACES, f), 'utf8'))])
}

/** Le vrai profil de l'agent de la trace : ses adaptateurs (diffs, échecs, sous-agents). */
function profileOf(agent: string) {
  const profile = resolveProfiles({
    appPath: resolve(__dirname, '../../..'),
    execPath: process.execPath,
    isPackaged: false,
    env: {}
  }).find((p) => p.id === agent)
  if (!profile) throw new Error(`Profil inconnu : ${agent}`)
  return profile
}

const cut = (text: string, max = 70) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** Le fil en clair, une ligne par élément : ce que l'instantané compare. */
function view(item: TranscriptItem): string {
  switch (item.kind) {
    case 'user':
      return `utilisateur : ${cut(item.text)}`
    case 'agent':
      return `agent : ${cut(item.text)}`
    case 'thought':
      return `réflexion : ${cut(item.text)}`
    case 'tool': {
      const permission = item.permission
        ? ` · autorisation ${typeof item.permission.state === 'object' ? item.permission.state.optionId : item.permission.state}`
        : ''
      const diffs = item.content.filter((c) => c.type === 'diff').length
      const work = item.work?.length ? ` · ${item.work.length} sous lui` : ''
      const subagent = item.subagent ? ` · sous-agent ${item.subagent.type ?? ''}`.trimEnd() : ''
      return `outil [${item.status}] ${cut(item.title, 50)} (${item.toolKind ?? '?'})${permission}${diffs ? ` · ${diffs} diff` : ''}${subagent}${work}`
    }
    case 'plan':
      return `plan : ${item.entries.map((e) => e.status).join(', ')}`
    case 'notice':
      return `avis (${item.level}) : ${cut(noticeText(item))}`
    default:
      return item.kind
  }
}

describe('traces ACP rejouées (fiche 139)', () => {
  const all = traces()

  it('il y a des traces, chacune avec son en-tête', () => {
    expect(all.length).toBeGreaterThanOrEqual(3)
    for (const [, trace] of all) {
      expect(trace.header.agent).toMatch(/^[a-z]+$/)
      expect(trace.header.version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it.each(all)('%s : nettoyée (ni chemin de l’utilisateur, ni jeton)', (file) => {
    const text = readFileSync(join(TRACES, file), 'utf8')
    expect(text).not.toContain(homedir())
    expect(text).not.toMatch(/\/Users\/|\/home\//)
    expect(text).not.toMatch(/\/mcp\/[0-9a-f]{16,}/)
  })

  it.each(all)('%s : le fil rejoué est celui de l’instantané, sans doublon', (file, trace) => {
    const { transcript } = replayTrace(trace, profileOf(trace.header.agent))
    const prompts = trace.lines.filter(
      (l) => l.from === 'client' && 'method' in l.msg && l.msg.method === 'session/prompt'
    ).length
    // Le rejeu de `session/load` ramène les messages d'avant : comptés avec ceux envoyés.
    const replayed = transcript.items.filter((i) => i.kind === 'user').length - prompts
    expect(noDuplicates(transcript.items, prompts + replayed)).toEqual([])
    expect(transcript.items.map(view)).toMatchSnapshot(relative(TRACES, join(TRACES, file)))
  })
})

describe('formes relevées dans les traces', () => {
  const byName = (name: string) => {
    const found = traces().find(([f]) => f.includes(name))
    if (!found) throw new Error(`trace absente : ${name}`)
    return replayTrace(found[1], profileOf(found[1].header.agent)).transcript.items
  }

  it('Bob, refus puis Stop : la carte refusée est « refusée », celle en attente « interrompue »', () => {
    const tools = byName('taches-autorisations').filter((i) => i.kind === 'tool')
    expect(tools.find((t) => t.title.startsWith('node -e'))?.status).toBe('refused')
    expect(tools.find((t) => t.title.includes('node --test test/server'))?.status).toBe('cancelled')
  })

  it('Bob, rejeu tardif : l’échange rejoué puis la réponse, une seule fois chacun', () => {
    const items = byName('rejeu-tardif')
    expect(
      items.filter((i) => i.kind === 'agent').map((i) => i.kind === 'agent' && i.text)
    ).toEqual(['pong', 'pong 2'])
  })

  // Fiche 202 : OpenCode 2.2.5 ne joint aucun diff au `write` terminé ; le fichier créé doit
  // pourtant compter dans Modifications › Conversation, en direct comme à la réouverture.
  const changesOf = (name: string) =>
    Object.fromEntries(
      conversationChanges(byName(name)).map((c) => [
        c.path.replace('/dossier/', ''),
        { created: c.created, added: c.added, removed: c.removed, old: c.diffs[0]?.oldText }
      ])
    )

  it.each([
    'creation-autorisee-d-office.ndjson',
    'creation-autorisee-d-office-2.ndjson',
    'creation-autorisation-demandee.ndjson',
    'creation-autorisation-demandee-2.ndjson'
  ])('OpenCode, %s : le fichier créé par write compte, une fois', (name) => {
    const changes = changesOf(name)
    expect(changes['nouveau.txt']).toEqual({ created: true, added: 1, removed: 0, old: null })
    expect(changes['notes.md']).toMatchObject({ created: false, added: 1, removed: 1 })
  })

  it('OpenCode, réécriture par write : comptée avec l’autorisation (son diff), pas sans', () => {
    expect(changesOf('creation-autorisation-demandee.ndjson')['autre.md']).toEqual({
      created: false,
      added: 1,
      removed: 1,
      old: 'ancien contenu\n'
    })
    // Sans autorisation, l'ancien texte n'est dit nulle part : rien plutôt qu'un diff faux.
    expect(changesOf('creation-autorisee-d-office.ndjson')['autre.md']).toBeUndefined()
  })

  // Fiche 203, correctif de recette : OpenCode 2.2.5 envoie `workdir` RELATIF et l'emplacement
  // absolu ; la carte dit « Dans dossier/docs » sans répéter l'emplacement, et alerte hors du
  // dossier pour `../autre`.
  const commandOf = (name: string) => {
    const tool = byName(name).find((i) => i.kind === 'tool' && i.toolKind === 'execute')
    if (tool?.kind !== 'tool') throw new Error('commande absente')
    return commandFolderOf(tool.command?.cwd, '/dossier', tool.locations)
  }

  it('OpenCode, commande dans un sous-dossier (workdir relatif) : dite courte, une fois', () => {
    expect(commandOf('commande-dans-un-sous-dossier')).toEqual({
      full: '/dossier/docs',
      short: 'dossier/docs',
      resolved: '/dossier/docs',
      outside: false
    })
  })

  it('OpenCode, commande hors du dossier (workdir « ../autre ») : alerte, rien de masqué', () => {
    expect(commandOf('commande-hors-du-dossier-refusee')).toEqual({
      full: '../autre',
      outside: true
    })
  })

  // Fiche 203, correctif de recette avec Bob 2.0.9 : Bob crée `notes/alpha.txt` avec un diff
  // `oldText: ""` (pas `null`), dans la demande d'autorisation comme dans la fin. Le fichier
  // n'existait pas quand Bob l'a proposé : c'est une création, à la demande comme à la fin (fil
  // enregistré, donc à la réouverture). Un fichier vide existant garde « Modification ».
  const bobCreation = (exists: (path: string) => boolean) => {
    const found = traces().find(([f]) => f.includes('bob-2.0.9/creation-fichier-neuf'))
    if (!found) throw new Error('trace absente')
    const asked: string[] = []
    const replay = replayTrace(found[1], profileOf('bob'), '/dossier', (path) => {
      asked.push(path)
      return exists(path)
    })
    const permission = replay.events.find((e) => e.type === 'permission-request')
    if (permission?.type !== 'permission-request') throw new Error('demande absente')
    const tool = replay.transcript.items.find((i) => i.kind === 'tool' && i.toolKind === 'edit')
    if (tool?.kind !== 'tool') throw new Error('outil absent')
    const atRequest = {
      toolKind: permission.toolCall.kind ?? undefined,
      content: permission.toolCall.content ?? []
    }
    return { asked, atRequest, tool }
  }

  it('Bob 2.0.9, fichier neuf (oldText "", absent quand il est proposé) : une création', () => {
    const { asked, atRequest, tool } = bobCreation(() => false)
    expect(asked).toEqual(['/dossier/notes/alpha.txt'])
    expect(createsFile(atRequest)).toBe(true)
    expect(tool.status).toBe('completed')
    expect(createsFile(tool)).toBe(true)
    expect(conversationChanges([tool])[0]).toMatchObject({ created: true, added: 1, removed: 0 })
  })

  it('Bob 2.0.9, même forme sur un fichier vide existant : une modification', () => {
    const { atRequest, tool } = bobCreation(() => true)
    expect(createsFile(atRequest)).toBe(false)
    expect(createsFile(tool)).toBe(false)
    expect(tool.content.find((c) => c.type === 'diff')).toMatchObject({ oldText: '' })
  })

  // Fiche 211, trace réelle de Bob 2.0.9 : une commande `execute` n'arrive qu'avec
  // `rawInput.command` (ni `cwd`, ni `locations`) ; l'alerte « hors du dossier » de la fiche 203
  // ne peut rien en dire. Les risques sont lus dans la ligne de commande et portés par la carte.
  it('Bob 2.0.9, écriture hors du dossier puis sudo : risques sur les deux cartes', () => {
    const tools = byName('bob-2.0.9/commande-hors-dossier-et-sudo').filter((i) => i.kind === 'tool')
    const [write, sudo] = tools
    if (write?.kind !== 'tool' || sudo?.kind !== 'tool') throw new Error('cartes absentes')
    expect(write.locations).toEqual([])
    expect(write.command?.cwd).toBeUndefined()
    expect(commandFolderOf(write.command?.cwd, '/dossier', write.locations)?.outside).toBe(false)
    expect(write.permission?.risks).toEqual([
      { kind: 'outside-folder', path: '/maison/dehors/x.properties' }
    ])
    expect(sudo.permission?.risks).toEqual([{ kind: 'privilege', via: 'sudo' }])
    expect(tools.map((t) => t.kind === 'tool' && t.status)).toEqual(['refused', 'refused'])
  })

  // Fiche 209, trace réelle de Bob 2.0.9 (`session.maxTurns` à 2) : un tour arrêté par la limite
  // après deux lectures, le message suivant refusé en 6 ms sans une mise à jour, puis la relance
  // du processus, `session/load` et le message renvoyé. Le rejeu enchaîne les deux processus (une
  // seule trace) ; `TurnLimitWatch`, l'observateur de l'hôte, lit les mêmes événements.
  it('Bob 2.0.9, limite d’étapes : travail arrêté, refus sans rien faire, fin normale après rechargement', () => {
    const found = traces().find(([f]) => f.includes('limite-etapes-session-rouverte'))
    if (!found) throw new Error('trace absente')
    const { events, transcript } = replayTrace(found[1], profileOf('bob'))
    const watch = new TurnLimitWatch()
    const ended: { stop: string; limit: TurnLimitSeen | undefined }[] = []
    for (const e of events) {
      if (e.type === 'user-message') watch.turnStarted('s', [])
      if (e.type === 'update') watch.note(e.update)
      if (e.type === 'turn-end')
        ended.push({ stop: e.stopReason, limit: watch.ended(e.stopReason, true) })
    }
    expect(ended).toEqual([
      // Carte A : l'agent a lu deux fichiers avant la limite : « Continuer ».
      { stop: 'max_turn_requests', limit: { refused: false, reopen: false } },
      // Carte B : refus sans une mise à jour : « Rouvrir la session et continuer » est proposé.
      { stop: 'max_turn_requests', limit: { refused: true, reopen: true } },
      // Après la relance et `session/load` : le tour va à son terme.
      { stop: 'end_turn', limit: undefined }
    ])
    // `session/load` ne rejoue que le premier message (le refusé n'y est pas, Bob l'a gardé sans
    // le rejouer) ; l'écho du message renvoyé, pendant le tour, est ignoré : le rejeu n'ajoute que
    // les deux messages envoyés (la suppression de la bulle du renvoi est celle de l'hôte, essayée
    // dans agent-host-turn-limit.test.ts).
    expect(
      transcript.items
        .filter((i) => i.kind === 'user')
        .map((i) => i.kind === 'user' && cut(i.text, 12))
    ).toEqual(['Lis a.txt, p…', 'Continue là …', 'Lis a.txt, p…', 'Continue là …'])
    // Trois lectures du fil, plus les deux que `session/load` rejoue : toutes terminées.
    const tools = transcript.items.filter((i) => i.kind === 'tool')
    expect(tools.map((t) => t.kind === 'tool' && t.status)).toEqual(Array(5).fill('completed'))
    expect(transcript.items.filter((i) => i.kind === 'turn-limit')).toHaveLength(2)
  })

  it('OpenCode : execute en erreur en échec, travail du sous-agent sous sa carte', () => {
    const tools = byName('execute-sous-agent').filter((i) => i.kind === 'tool')
    expect(tools.find((t) => t.title === 'execute')?.status).toBe('failed')
    const subagent = tools.find((t) => t.subagent)
    expect(subagent?.work?.length).toBe(3)
    expect(tools.some((t) => t.toolCallId.startsWith('ses_'))).toBe(false)
  })

  // Fiche 214, banc de la fiche 213 : la liste de tâches de Bob 2.0.9 (`kind: "other"`, titre
  // « Updating todo list ») porte ses tâches en texte à cases dans `rawInput.todos`.
  it('Bob 2.0.9, liste de tâches : les tâches de rawInput.todos arrivent aux données de la carte', () => {
    const tool = byName('liste-de-taches-autorisee').find((i) => i.kind === 'tool')
    if (tool?.kind !== 'tool') throw new Error('outil absent')
    expect(tool.toolKind).toBe('other')
    expect(tool.status).toBe('completed')
    expect(tool.todos).toEqual([
      { text: 'Ajouter mul(a, b) et div(a, b) dans src/math.js', state: 'in_progress' },
      { text: 'Ajouter les tests dans test/math.test.js', state: 'pending' },
      { text: 'Lancer les tests et committer', state: 'pending' }
    ])
  })

  // Fiche 214, recette du banc de la fiche 213 : Bob annule lui-même sa demande d'autorisation
  // (`$/cancel_request`, écriture hors du dossier bloquée par Bob). La carte ne reste pas en
  // attente : fermée, avec son origine (l'agent, pas l'utilisateur ni Stop).
  // Trace RÉELLE de Bob 2.0.9 : trois écritures demandées en parallèle ; « Toujours » sur la
  // première autorise le groupe, et Bob retire de lui-même les deux autres demandes
  // (`$/cancel_request`) parce qu'elles sont déjà autorisées, puis les trois outils se terminent
  // `completed`. La carte d'une demande retirée disparaît sans bruit, l'outil garde l'état que
  // l'agent lui donne. La trace est celle du relevé, où le client d'essai a répondu aux trois ; ici
  // l'utilisateur ne répond qu'à la première (comme dans l'app) : les réponses 1 et 2 sont écartées.
  it('Bob 2.0.9, $/cancel_request des demandes déjà autorisées : cartes retirées, outils terminés', () => {
    const found = traces().find(([f]) => f.includes('demandes-paralleles-cancel-request'))
    if (!found) throw new Error('trace absente')
    const answeredLater = (l: Trace['lines'][number]) =>
      l.from === 'client' && 'result' in l.msg && (l.msg.id === 1 || l.msg.id === 2)
    const trace: Trace = { ...found[1], lines: found[1].lines.filter((l) => !answeredLater(l)) }
    const replay = replayTrace(trace, profileOf('bob'))
    const resolved = replay.events.filter((e) => e.type === 'permission-resolved')
    expect(resolved.map((e) => e.requestId)).toEqual(['0', '1', '2'])
    expect(resolved).toContainEqual({
      type: 'permission-resolved',
      requestId: '1',
      optionId: null,
      cancelledBy: 'agent'
    })
    const tools = replay.transcript.items.filter((i) => i.kind === 'tool')
    expect(tools).toHaveLength(3)
    for (const tool of tools) expect(tool.status).toBe('completed')
    // Retirée par l'agent : plus de carte ni de « annulée » ; la première, répondue, est gardée.
    expect(tools.filter((t) => t.permission === undefined)).toHaveLength(2)
  })
})
