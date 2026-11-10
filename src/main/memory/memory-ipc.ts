/**
 * Canaux IPC de la mémoire (fiche 182), branchés par `ipc.ts`. Les arguments viennent du renderer :
 * vérifiés ici. Une décision ne porte que des identifiants : le texte retenu est relu dans le fil
 * du main. Une modification de l'écran passe par les mêmes validations que l'outil (format, bornes,
 * secrets).
 */
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import type { IpcHandlers } from '@shared/ipc'
import { isMemoryName, parseMemoryDraft, type MemoryPlace } from '@shared/memory'
import { findSecret } from '../secret-scan'
import type { MemoryService } from './service'

type MemoryChannel = Extract<keyof IpcHandlers, `memory:${string}`>

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

const obj = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) throw new Error(`Paramètre invalide : ${name}`)
  return value as Record<string, unknown>
}

function placeOf(value: unknown): MemoryPlace {
  const raw = obj(value, 'place')
  if (raw['scope'] === 'user') return { scope: 'user' }
  if (raw['scope'] === 'project')
    return { scope: 'project', projectId: str(raw['projectId'], 'projectId') }
  throw new Error('Paramètre invalide : place')
}

/** Ce que la mémoire demande à l'app (dialogues, Finder) : injecté, testable sans Electron. */
export interface MemoryIpcDeps {
  chooseDirectory: () => Promise<string | null>
  saveMarkdown: (defaultName: string) => Promise<string | null>
  reveal: (path: string) => void
  /** Titre de l'export (« Mémoire — Vous », « Mémoire — bobine »), dans la langue de l'app. */
  exportTitle: (place: MemoryPlace) => string
}

export function memoryHandlers(
  service: MemoryService | undefined,
  deps?: MemoryIpcDeps
): Pick<IpcHandlers, MemoryChannel> {
  const available = () => {
    if (!service) throw new Error('Mémoire indisponible')
    return service
  }
  return {
    'memory:decide': async (decision) => {
      const d = obj(decision, 'decision')
      return available().decide({
        conversationId: str(d['conversationId'], 'conversationId'),
        proposalId: str(d['proposalId'], 'proposalId'),
        accept: d['accept'] === true,
        ...(d['force'] === true ? { force: true } : {})
      })
    },
    'memory:projects': async (workspace) => {
      const memory = available()
      const projects = await memory.store.projects()
      const here = typeof workspace === 'string' ? memory.locate('project', workspace) : undefined
      const current = here?.place.scope === 'project' ? here.place.projectId : undefined
      const keyState = await memory.store.keyState()
      return { projects, keyState, ...(current ? { current } : {}) }
    },
    'memory:list': async (place) => {
      const memory = available()
      // `dirOf` refuse un identifiant qui serait un chemin.
      const where = placeOf(place)
      memory.store.dirOf(where)
      return memory.store.scan(where)
    },
    'memory:save': async (place, entry, expected) => {
      const where = placeOf(place)
      const parsed = parseMemoryDraft({ ...obj(entry, 'entry'), scope: where.scope })
      if ('error' in parsed) return { ok: false, error: parsed.error }
      const { scope: _scope, ...draft } = parsed.draft
      const secret = findSecret(`${draft.name}\n${draft.description}\n${draft.body}`)
      if (secret) return { ok: false, error: { code: 'secret', message: secret } }
      if (expected !== null && typeof expected !== 'string')
        throw new Error('Paramètre invalide : expected')
      // Modifié par l'utilisateur : son origine reste dite (contenu externe), l'auteur devient lui.
      const current = await available().store.get(where, draft.name)
      const source = current?.source ? { source: current.source } : {}
      const written = await available().store.write(
        where,
        { ...draft, by: 'user', ...source },
        { expected }
      )
      if (written.ok) return { ok: true }
      if (written.reason === 'full') return { ok: false, error: { code: 'full', message: 'full' } }
      if (written.reason === 'locked') {
        return { ok: false, error: { code: 'locked', message: 'locked' } }
      }
      return { ok: false, changed: true }
    },
    'memory:remove': async (place, name, expected) => {
      if (!isMemoryName(name)) throw new Error('Paramètre invalide : name')
      if (expected !== undefined && typeof expected !== 'string') {
        throw new Error('Paramètre invalide : expected')
      }
      return (await available().store.remove(placeOf(place), name, expected)).ok
    },
    'memory:clear': async (place) => available().store.clear(placeOf(place)),
    'memory:approve': async (place, name, version) => {
      if (!isMemoryName(name)) throw new Error('Paramètre invalide : name')
      const where = placeOf(place)
      const current = await available().store.get(where, name)
      // Mêmes contrôles qu'une modification : jamais un secret validé pour les agents.
      if (current && findSecret(`${current.name}\n${current.description}\n${current.body}`)) {
        return { ok: false, reason: 'secret' }
      }
      return available().store.approve(where, name, str(version, 'version'))
    },
    'memory:move': async (from, to, name, expected) => {
      if (!isMemoryName(name)) throw new Error('Paramètre invalide : name')
      if (expected !== undefined && typeof expected !== 'string') {
        throw new Error('Paramètre invalide : expected')
      }
      return available().store.move(placeOf(from), placeOf(to), name, expected)
    },
    'memory:attach': async (projectId, folder) => {
      const memory = available()
      const id = str(projectId, 'projectId')
      memory.store.dirOf({ scope: 'project', projectId: id })
      const chosen = typeof folder === 'string' && folder ? folder : await deps?.chooseDirectory()
      if (!chosen) return null
      const root = memory.locate('project', chosen)?.folder
      if (!root) throw new Error('Paramètre invalide : folder')
      return memory.store.attach(id, root)
    },
    'memory:export': async (place) => {
      const memory = available()
      const where = placeOf(place)
      if (!deps) throw new Error('Mémoire indisponible')
      const title = deps.exportTitle(where)
      const file = await deps.saveMarkdown(`${title}.md`)
      if (!file) return null
      await writeFile(file, await memory.store.exportMarkdown(where, title), 'utf8')
      return file
    },
    'memory:reveal': async (place) => {
      const dir = available().store.dirOf(placeOf(place))
      if (existsSync(dir)) deps?.reveal(dir)
      return undefined
    }
  }
}
