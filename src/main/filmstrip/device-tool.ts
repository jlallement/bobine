/**
 * Planche contact d'un appareil (fiches 075 et 076) : `ios_filmstrip` et `android_filmstrip` ont
 * la même forme — des gestes du panneau faits pendant le film, puis la planche et son texte.
 */
import type { AppTool, ToolArgs, ToolContent, ToolResult } from '../mcp/tools'
import { argsOf } from '../mcp/tools'
import { contactSheet, sheetText, type FilmFrame, type ImageCodec } from './sheet'
import { messageOf } from '@shared/errors'

/** Durée du film et nombre d'images de la planche (mêmes bornes pour tous les panneaux). */
export const FILM_DURATION = { fallback: 1500, min: 200, max: 5000 }
export const FILM_FRAMES = { fallback: 8, min: 2, max: 16 }
const MAX_ACTIONS = 30

/** Arguments communs : actions (parmi `filmable`, si donné), durée, nombre d'images. */
export function filmstripProperties(filmable?: readonly string[]): ToolArgs {
  return {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tool: { type: 'string', ...(filmable ? { enum: [...filmable] } : {}) },
          args: { type: 'object' }
        },
        required: ['tool']
      }
    },
    duration_ms: {
      type: 'number',
      description: `How long to film, at least until the actions end. Default ${FILM_DURATION.fallback}, ${FILM_DURATION.min}–${FILM_DURATION.max}.`
    },
    frames: {
      type: 'number',
      description: `Frames on the sheet at most. Default ${FILM_FRAMES.fallback}, ${FILM_FRAMES.min}–${FILM_FRAMES.max}.`
    }
  }
}

export interface DeviceFilmstripOptions {
  name: string
  description: string
  panel: NonNullable<AppTool['panel']>
  /** Outils du panneau que le film peut lancer (gestes), cherchés dans `tools`. */
  filmable: readonly string[]
  tools: readonly AppTool[]
  /** Outil dont la planche donne les coordonnées (`ios_tap`…). */
  clickTool: string
  /** Texte rendu quand aucune image n'est arrivée. */
  noFrame: string
  codec: ImageCodec
  film: (run: () => Promise<void>, durationMs: number) => Promise<FilmFrame[]>
  /** Taille de l'écran dans les coordonnées des touchers (points, dp). */
  screen: () => Promise<{ width: number; height: number } | null>
}

export function deviceFilmstripTool(options: DeviceFilmstripOptions): AppTool {
  const { filmable, tools, codec } = options
  return {
    definition: {
      name: options.name,
      description: options.description,
      inputSchema: { type: 'object', properties: filmstripProperties(filmable) }
    },
    // N'agit que sur l'appareil du panneau, comme les gestes qu'il filme.
    autoAllow: true,
    panel: options.panel,
    call: async (raw): Promise<ToolResult> => {
      const args = argsOf(raw)
      const bounded = (key: string, range: { fallback: number; min: number; max: number }) => {
        const value = args[key]
        return typeof value === 'number' && Number.isFinite(value)
          ? Math.round(Math.min(range.max, Math.max(range.min, value)))
          : range.fallback
      }
      const durationMs = bounded('duration_ms', FILM_DURATION)
      const maxFrames = bounded('frames', FILM_FRAMES)
      const list = args['actions'] ?? []
      const fail = (text: string): ToolResult => ({
        content: [{ type: 'text', text }],
        isError: true
      })
      if (!Array.isArray(list)) return fail('`actions`: a list is expected.')
      if (list.length > MAX_ACTIONS) return fail(`At most ${MAX_ACTIONS} actions.`)
      const notes: ToolContent[] = []
      let failure: string | undefined
      const frames = await options.film(async () => {
        for (const [index, item] of list.entries()) {
          const { tool: name, args: actionArgs } = argsOf(item)
          const action =
            typeof name === 'string' && filmable.includes(name)
              ? tools.find((candidate) => candidate.definition.name === name)
              : undefined
          if (!action) {
            failure = `Action ${index + 1}: unknown or not filmable (${String(name)}).`
            return
          }
          const result = await action
            .call(argsOf(actionArgs))
            .catch((error: unknown): ToolResult => fail(messageOf(error)))
          const text = result.content.flatMap((c) => (c.type === 'text' ? [c.text] : []))
          if (result.isError) {
            failure = `Action ${index + 1} (${name}): ${text.join(' ')}`
            return
          }
          notes.push(...text.map((line): ToolContent => ({ type: 'text', text: line })))
        }
      }, durationMs)
      const screen = await options.screen()
      const sheet = screen ? contactSheet(frames, { maxFrames, size: screen }, codec) : null
      const content: ToolContent[] = sheet
        ? [
            { type: 'text', text: sheetText(sheet, durationMs, options.clickTool) },
            { type: 'image', data: sheet.image.data, mimeType: sheet.image.mimeType }
          ]
        : [{ type: 'text', text: options.noFrame }]
      if (failure) content.push({ type: 'text', text: failure })
      return {
        content: [...content, ...notes],
        ...(failure || !sheet ? { isError: true } : {})
      }
    }
  }
}
