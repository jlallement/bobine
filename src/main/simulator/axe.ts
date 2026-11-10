/**
 * Touchers et lecture de l'écran du simulateur par AXe (fiche 008, ADR-0009) : outil libre qui
 * envoie de vrais événements tactiles (HID) sans prendre la souris, et lit l'écran par
 * l'accessibilité d'iOS. Isolé ici : remplaçable plus tard par un outil natif livré avec l'app.
 *
 * AXe est livré avec l'app (`vendor/axe`, voir `scripts/fetch-axe`) ; à défaut, celui du PATH. Sa
 * version est vérifiée au premier usage (`axe --version`) : les options utilisées datent de 1.8.0.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Run } from './run'
import { t } from 'i18next'

export interface Frame {
  x: number
  y: number
  width: number
  height: number
}

/** Élément de `axe describe-ui` (champs utiles). */
export interface AxeElement {
  type?: string | null
  role?: string | null
  AXLabel?: string | null
  AXValue?: string | null
  AXUniqueId?: string | null
  title?: string | null
  enabled?: boolean
  frame?: Frame
  children?: AxeElement[]
}

export type HardwareButton = 'home' | 'lock' | 'siri' | 'side-button' | 'apple-pay'

/** Version minimale d'AXe : `stream-video --fps`, `key-combo`, `touch --delay` datent de là. */
export const MIN_AXE_VERSION = '1.8.0'

/**
 * Emplacements où chercher `axe` : d'abord les binaires livrés ou téléchargés (`bundled`, chemins
 * complets), puis le PATH et les dossiers usuels (l'app lancée du Finder n'a pas toujours le PATH
 * du shell).
 */
export function findAxe(
  env: NodeJS.ProcessEnv = process.env,
  bundled: readonly string[] = []
): string | undefined {
  for (const file of bundled) if (existsSync(file)) return file
  const dirs = [
    ...(env['PATH'] ?? '').split(':'),
    join(homedir(), '.local/bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin'
  ]
  for (const dir of dirs) {
    if (!dir) continue
    const file = join(dir, 'axe')
    if (existsSync(file)) return file
  }
  return undefined
}

export const AXE_MISSING =
  'Touch input needs AXe (open-source simulator automation tool), which is not installed. ' +
  'Ask the user to install it (https://github.com/cameroncooke/AXe), or use ios_open_url / ios_launch meanwhile.'

/** Résultat de `axe --version` : utilisable, ou pourquoi pas. */
export type AxeCheck =
  | { ok: true; version: string }
  | { ok: false; problem: 'missing' | 'unusable' | 'too-old'; version?: string; detail?: string }

/** Première version « x.y.z » de la sortie de `axe --version`. */
export function parseAxeVersion(output: string): string | undefined {
  return /\b(\d+\.\d+\.\d+)\b/.exec(output)?.[1]
}

/** Compare deux versions « x.y.z » : négatif si `a` est plus ancienne que `b`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** Le binaire répond-il à `--version`, en version suffisante ? */
export async function checkAxe(run: Run, binary: string | undefined): Promise<AxeCheck> {
  if (!binary) return { ok: false, problem: 'missing' }
  const result = await run(binary, ['--version'], { timeoutMs: 10_000 })
  const version = result.code === 0 ? parseAxeVersion(result.stdout.toString('utf8')) : undefined
  if (!version) {
    const detail = (result.stderr || result.stdout.toString('utf8')).trim().split('\n').at(-1)
    return { ok: false, problem: 'unusable', ...(detail ? { detail } : {}) }
  }
  if (compareVersions(version, MIN_AXE_VERSION) < 0) {
    return { ok: false, problem: 'too-old', version }
  }
  return { ok: true, version }
}

/** Explication pour l'utilisateur (onglet « Simulateur ») ; `undefined` si tout va bien. */
export function axeProblemText(check: AxeCheck, installHint?: string): string | undefined {
  if (check.ok) return undefined
  switch (check.problem) {
    case 'missing':
      return installHint ? t('axe.missingHint', { hint: installHint }) : t('axe.missing')
    case 'too-old':
      return t('axe.tooOld', { version: check.version ?? '?', minimum: MIN_AXE_VERSION })
    case 'unusable':
      return t('axe.silent', { detail: check.detail ? ` (${check.detail})` : '' })
  }
}

/** Même chose pour l'agent (résultat d'outil), avec la marche à suivre. */
export function axeProblemForAgent(check: AxeCheck): string {
  if (check.ok) return ''
  switch (check.problem) {
    case 'missing':
      return AXE_MISSING
    case 'too-old':
      return `Touch input needs AXe ${MIN_AXE_VERSION} or newer (found ${check.version ?? '?'}). Ask the user to update it (https://github.com/cameroncooke/AXe), or use ios_open_url / ios_launch meanwhile.`
    case 'unusable':
      return `AXe is installed but did not answer --version${check.detail ? ` (${check.detail})` : ''}. Ask the user to check its installation (https://github.com/cameroncooke/AXe), or use ios_open_url / ios_launch meanwhile.`
  }
}

export class Axe {
  private readonly run: Run
  readonly binary: string

  constructor(run: Run, binary: string) {
    this.run = run
    this.binary = binary
  }

  async describe(udid: string): Promise<AxeElement[]> {
    const out = await this.axe(['describe-ui', '--udid', udid])
    return JSON.parse(out) as AxeElement[]
  }

  async tap(udid: string, point: { x: number; y: number }, holdSeconds?: number): Promise<void> {
    if (holdSeconds) {
      await this.axe([
        'touch',
        '-x',
        String(point.x),
        '-y',
        String(point.y),
        '--down',
        '--up',
        '--delay',
        String(holdSeconds),
        '--udid',
        udid
      ])
    } else {
      await this.axe(['tap', '-x', String(point.x), '-y', String(point.y), '--udid', udid])
    }
  }

  async tapLabel(udid: string, label: string): Promise<void> {
    await this.axe(['tap', '--label', label, '--udid', udid])
  }

  async swipe(
    udid: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationSeconds: number
  ): Promise<void> {
    await this.axe([
      'swipe',
      '--start-x',
      String(from.x),
      '--start-y',
      String(from.y),
      '--end-x',
      String(to.x),
      '--end-y',
      String(to.y),
      '--duration',
      String(durationSeconds),
      '--udid',
      udid
    ])
  }

  async type(udid: string, text: string): Promise<void> {
    await this.axe(['type', '--stdin', '--udid', udid], text)
  }

  /** ⌘V au clavier matériel du simulateur : colle le presse-papiers de l'appareil. */
  async paste(udid: string): Promise<void> {
    await this.axe(['key-combo', '--modifiers', '227', '--key', '25', '--udid', udid])
  }

  async button(udid: string, button: HardwareButton): Promise<void> {
    await this.axe(['button', button, '--udid', udid])
  }

  private async axe(args: string[], input?: string): Promise<string> {
    const result = await this.run(this.binary, args, {
      timeoutMs: 30_000,
      ...(input !== undefined ? { input } : {})
    })
    if (result.code !== 0) {
      const message = (result.stderr || result.stdout.toString('utf8')).trim().split('\n').at(-1)
      throw new Error(`AXe ${args[0] ?? ''} : ${message || `code ${result.code}`}`)
    }
    return result.stdout.toString('utf8')
  }
}

const clean = (value: unknown, max = 100): string => {
  const text = (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Écran mis en forme pour l'agent : une ligne par élément nommé, avec une référence `ref_N` (le
 * centre de son cadre, en points). Les textes répétant le libellé de leur parent sont omis.
 */
export function formatScreen(
  roots: readonly AxeElement[],
  maxChars: number,
  refFor: (center: { x: number; y: number }) => string
): { lines: string[]; truncated: boolean; screen: { width: number; height: number } | null } {
  const lines: string[] = []
  let size = 0
  let truncated = false
  const rootFrame = roots[0]?.frame
  const walk = (el: AxeElement, depth: number, covered: string) => {
    if (truncated) return
    const type = clean(el.type) || clean(el.role).replace(/^AX/, '') || 'Element'
    const label = clean(el.AXLabel ?? el.title)
    const value = clean(el.AXValue, 60)
    let childDepth = depth
    let childCovered = covered
    const redundant = type === 'StaticText' && !!label && covered.includes(label)
    const named = !!(label || value) && type !== 'Application'
    if (named && !redundant && el.frame) {
      const { x, y, width, height } = el.frame
      const center = { x: Math.round(x + width / 2), y: Math.round(y + height / 2) }
      let line = `${'  '.repeat(depth)}- ${type}`
      if (label) line += ` "${label.replace(/"/g, "'")}"`
      if (value && value !== label) line += ` valeur="${value}"`
      if (el.AXUniqueId) line += ` id=${clean(el.AXUniqueId, 60)}`
      if (el.enabled === false) line += ' (désactivé)'
      line += ` [${refFor(center)}]`
      size += line.length + 1
      if (size > maxChars) {
        truncated = true
        return
      }
      lines.push(line)
      childDepth = depth + 1
      if (label) childCovered = label
    }
    for (const child of el.children ?? []) walk(child, childDepth, childCovered)
  }
  for (const root of roots) walk(root, 0, '')
  return {
    lines,
    truncated,
    screen: rootFrame
      ? { width: Math.round(rootFrame.width), height: Math.round(rootFrame.height) }
      : null
  }
}
