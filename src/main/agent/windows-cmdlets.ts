/**
 * Cmdlets PowerShell que Bobine sait lire (fiche 229, lot 3b) : une liste bornée, avec pour
 * chacune ses paramètres (nom complet, genre) et ses positions, d'après la documentation de
 * PowerShell 5.1 et 7. Le liage suit celui de PowerShell : nom exact ou **abréviation sans
 * ambiguïté** (`-Pat` → `-Path`, mais `-Pa` hésite avec `-PassThru` : inconnu), forme `-Nom:valeur`,
 * puis les opérandes restants dans l'ordre des positions. Un paramètre inconnu (`-Pth`), un
 * opérande de trop, une valeur manquante : la commande n'est pas lue (« écritures inconnues »).
 */
import { win32 } from 'node:path'

/** Genre d'un paramètre. */
type Kind =
  | 'path' // chemin visé (avec caractères génériques)
  | 'literal' // chemin visé, sans caractères génériques
  | 'destination' // chemin écrit (copie, déplacement, archive)
  | 'name' // nom relatif à `-Path` (New-Item -Name)
  | 'newName' // nouveau nom, dans le dossier de `-Path` (Rename-Item)
  | 'itemType' // genre d'élément créé (New-Item)
  | 'value' // une valeur sans effet sur ce qui est écrit
  | 'switch' // sans valeur
  | 'remote' // session distante : écrit ailleurs, inconnu

type Params = Readonly<Record<string, Kind>>

/** Paramètres communs à toutes les cmdlets, avec leurs alias. */
const COMMON: Params = {
  verbose: 'switch',
  vb: 'switch',
  debug: 'switch',
  db: 'switch',
  whatif: 'switch',
  wi: 'switch',
  confirm: 'switch',
  cf: 'switch',
  erroraction: 'value',
  ea: 'value',
  warningaction: 'value',
  wa: 'value',
  informationaction: 'value',
  infa: 'value',
  progressaction: 'value',
  proga: 'value',
  errorvariable: 'value',
  ev: 'value',
  warningvariable: 'value',
  wv: 'value',
  informationvariable: 'value',
  iv: 'value',
  outvariable: 'value',
  ov: 'value',
  outbuffer: 'value',
  ob: 'value',
  pipelinevariable: 'value',
  pv: 'value'
}

/** Ce qu'écrit une cmdlet, d'après ses paramètres liés. */
type Effect = 'path' | 'destination' | 'path+destination' | 'new-item' | 'rename'

interface Cmdlet {
  params: Params
  positions: readonly string[]
  effect: Effect
  /** Sans chemin donné, la cible vient du tuyau ou d'une question : inconnu. */
  needsPath?: boolean
}

const FILTERS: Params = {
  filter: 'value',
  include: 'value',
  exclude: 'value',
  credential: 'value',
  force: 'switch'
}

const CONTENT: Cmdlet = {
  params: {
    path: 'path',
    literalpath: 'literal',
    lp: 'literal',
    pspath: 'literal',
    value: 'value',
    passthru: 'switch',
    nonewline: 'switch',
    encoding: 'value',
    asbytestream: 'switch',
    stream: 'value',
    ...FILTERS
  },
  positions: ['path', 'value'],
  effect: 'path',
  needsPath: true
}

/** Écrivains, par nom canonique. */
const WRITERS: Record<string, Cmdlet> = {
  'set-content': CONTENT,
  'add-content': CONTENT,
  'clear-content': {
    params: { path: 'path', literalpath: 'literal', lp: 'literal', stream: 'value', ...FILTERS },
    positions: ['path'],
    effect: 'path',
    needsPath: true
  },
  'out-file': {
    params: {
      filepath: 'path',
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      encoding: 'value',
      append: 'switch',
      force: 'switch',
      noclobber: 'switch',
      nonewline: 'switch',
      width: 'value',
      inputobject: 'value'
    },
    positions: ['filepath', 'encoding'],
    effect: 'path',
    needsPath: true
  },
  'tee-object': {
    params: {
      filepath: 'path',
      literalpath: 'literal',
      lp: 'literal',
      append: 'switch',
      variable: 'value',
      inputobject: 'value',
      encoding: 'value'
    },
    positions: ['filepath'],
    effect: 'path'
  },
  'export-csv': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      delimiter: 'value',
      notypeinformation: 'switch',
      nti: 'switch',
      append: 'switch',
      force: 'switch',
      noclobber: 'switch',
      encoding: 'value',
      inputobject: 'value',
      useculture: 'switch',
      includetypeinformation: 'switch',
      quotefields: 'value',
      usequotes: 'value'
    },
    positions: ['path', 'delimiter'],
    effect: 'path',
    needsPath: true
  },
  'new-item': {
    params: {
      path: 'path',
      name: 'name',
      itemtype: 'itemType',
      type: 'itemType',
      value: 'value',
      target: 'value',
      force: 'switch',
      credential: 'value'
    },
    positions: ['path'],
    effect: 'new-item'
  },
  'remove-item': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      pspath: 'literal',
      recurse: 'switch',
      stream: 'value',
      ...FILTERS
    },
    positions: ['path'],
    effect: 'path',
    needsPath: true
  },
  'copy-item': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      pspath: 'literal',
      destination: 'destination',
      container: 'switch',
      recurse: 'switch',
      passthru: 'switch',
      tosession: 'remote',
      fromsession: 'remote',
      ...FILTERS
    },
    positions: ['path', 'destination'],
    effect: 'destination',
    needsPath: true
  },
  'move-item': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      pspath: 'literal',
      destination: 'destination',
      passthru: 'switch',
      ...FILTERS
    },
    positions: ['path', 'destination'],
    effect: 'path+destination',
    needsPath: true
  },
  'rename-item': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      pspath: 'literal',
      newname: 'newName',
      passthru: 'switch',
      force: 'switch',
      credential: 'value'
    },
    positions: ['path', 'newname'],
    effect: 'rename',
    needsPath: true
  },
  'expand-archive': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      destinationpath: 'destination',
      force: 'switch',
      passthru: 'switch'
    },
    positions: ['path', 'destinationpath'],
    effect: 'destination',
    needsPath: true
  },
  'compress-archive': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      destinationpath: 'destination',
      compressionlevel: 'value',
      update: 'switch',
      force: 'switch',
      passthru: 'switch'
    },
    positions: ['path', 'destinationpath'],
    effect: 'destination',
    needsPath: true
  },
  'set-itemproperty': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      name: 'value',
      value: 'value',
      type: 'value',
      passthru: 'switch',
      inputobject: 'value',
      ...FILTERS
    },
    positions: ['path', 'name', 'value'],
    effect: 'path',
    needsPath: true
  },
  'new-itemproperty': {
    params: {
      path: 'path',
      literalpath: 'literal',
      lp: 'literal',
      name: 'value',
      value: 'value',
      propertytype: 'value',
      type: 'value',
      ...FILTERS
    },
    positions: ['path', 'name'],
    effect: 'path',
    needsPath: true
  },
  'remove-itemproperty': {
    params: { path: 'path', literalpath: 'literal', lp: 'literal', name: 'value', ...FILTERS },
    positions: ['path', 'name'],
    effect: 'path',
    needsPath: true
  }
}

/** `mkdir`, `md` : fonction de PowerShell, `New-Item -ItemType Directory`. */
const MKDIR: Cmdlet = {
  params: { path: 'path', name: 'name', value: 'value', force: 'switch', credential: 'value' },
  positions: ['path'],
  effect: 'new-item'
}

/** Alias de PowerShell (5.1 et 7) vers le nom canonique. `sc`, `curl`, `wget` : exclus (ambigus). */
export const POWERSHELL_ALIASES: Readonly<Record<string, string>> = {
  ac: 'add-content',
  clc: 'clear-content',
  tee: 'tee-object',
  epcsv: 'export-csv',
  ni: 'new-item',
  rm: 'remove-item',
  del: 'remove-item',
  erase: 'remove-item',
  rd: 'remove-item',
  rmdir: 'remove-item',
  ri: 'remove-item',
  cp: 'copy-item',
  copy: 'copy-item',
  cpi: 'copy-item',
  mv: 'move-item',
  move: 'move-item',
  mi: 'move-item',
  ren: 'rename-item',
  rni: 'rename-item',
  sp: 'set-itemproperty',
  rp: 'remove-itemproperty'
}

/** Cmdlets et alias qui ne font que lire (quels que soient leurs arguments). */
export const POWERSHELL_READERS = new Set([
  'get-childitem',
  'gci',
  'ls',
  'dir',
  'get-content',
  'gc',
  'cat',
  'type',
  'select-string',
  'sls',
  'test-path',
  'get-location',
  'gl',
  'pwd',
  'get-command',
  'gcm',
  'measure-object',
  'measure',
  'get-process',
  'gps',
  'ps',
  'write-output',
  'write',
  'echo',
  'write-host',
  'get-item',
  'gi',
  'get-itemproperty',
  'gp',
  'resolve-path',
  'rvpa',
  'get-date',
  'get-filehash',
  'get-acl',
  'get-help',
  'help',
  'get-member',
  'gm',
  'select-object',
  'select',
  'where-object',
  'where',
  '?',
  'sort-object',
  'format-table',
  'ft',
  'format-list',
  'fl',
  'format-wide',
  'fw',
  'out-string',
  'out-host',
  'out-null',
  'convertto-json',
  'convertfrom-json',
  'get-psdrive',
  'gdr',
  'get-volume',
  'get-alias',
  'gal',
  'start-sleep',
  'sleep',
  'clear-host',
  'cls',
  'clear',
  'exit',
  'get-unique',
  'gu',
  'compare-object',
  'group-object',
  'group'
])

export interface CmdletReading {
  /** Chemins écrits, tels qu'écrits (relatifs au dossier courant). */
  writes: string[]
  /** Un chemin d'un autre fournisseur que le système de fichiers (`HKCU:\…`, `Cert:\…`). */
  providers: string[]
  /** La commande n'a pas pu être lue. */
  unknown: boolean
}

/** Mot de paramètre (`-Path`, `-Path:x`), sinon `undefined` (opérande). */
function parameter(word: string): { name: string; value?: string } | undefined {
  const match = /^-([a-z_][a-z0-9_]*)(?::(.*))?$/i.exec(word)
  if (!match) return undefined
  const name = (match[1] ?? '').toLowerCase()
  return match[2] === undefined ? { name } : { name, value: match[2] }
}

/** Nom complet d'un paramètre écrit (exact ou abréviation sans ambiguïté), sinon `undefined`. */
function resolveParam(written: string, params: Params): string | undefined {
  if (written in params) return written
  // Les alias courts (`lp`, `ea`) ne s'abrègent pas : seuls les noms longs se raccourcissent.
  const matches = Object.keys(params).filter((n) => n.length > 3 && n.startsWith(written))
  return matches.length === 1 ? matches[0] : undefined
}

export interface WordInput {
  values: string[]
  quoted: boolean
}

/** Valeurs liées à chaque paramètre ; `undefined` si le liage échoue. */
function bind(words: readonly WordInput[], spec: Cmdlet): Map<string, string[]> | undefined {
  const params: Params = { ...COMMON, ...spec.params }
  const bound = new Map<string, string[]>()
  const positional: string[][] = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (!word) continue
    const written =
      !word.quoted && word.values.length === 1 ? parameter(word.values[0] ?? '') : undefined
    if (!written) {
      positional.push(word.values)
      continue
    }
    const name = resolveParam(written.name, params)
    if (!name || bound.has(name)) return undefined
    const kind = params[name]
    if (kind === 'switch') {
      if (written.value !== undefined && !/^\$(true|false)$/i.test(written.value)) return undefined
      bound.set(name, [])
      continue
    }
    if (written.value !== undefined) {
      if (written.value === '') return undefined
      bound.set(name, [written.value])
      continue
    }
    const next = words[++i]
    if (!next) return undefined
    bound.set(name, next.values)
  }
  // Les opérandes prennent les positions restantes, dans l'ordre. `-LiteralPath` tient la place de
  // `-Path` (autre jeu de paramètres) : `Set-Content -LiteralPath a x` lie `x` à `-Value`.
  const pathBound = [...bound.keys()].some((n) => params[n] === 'path' || params[n] === 'literal')
  const free = spec.positions.filter(
    (p) => !bound.has(p) && !(pathBound && (params[p] === 'path' || params[p] === 'literal'))
  )
  if (positional.length > free.length) return undefined
  positional.forEach((values, n) => bound.set(free[n] ?? '', values))
  return bound
}

/** Valeurs liées aux paramètres d'un genre donné. */
function ofKind(bound: Map<string, string[]>, params: Params, kinds: readonly Kind[]): string[] {
  return [...bound].flatMap(([name, values]) =>
    kinds.includes(params[name] ?? 'value') ? values : []
  )
}

/** Chemin d'un autre fournisseur (`HKCU:`, `Registry::`, `Cert:\`, `Env:`), pas une lettre de lecteur. */
const PROVIDER = /^(?:[a-z][a-z0-9]+:|[a-z0-9.\\]*registry::)/i

/** Ce qu'écrit la cmdlet `name` (nom canonique ou alias de PowerShell) ; `undefined` si inconnue. */
export function readCmdlet(
  name: string,
  words: readonly WordInput[],
  piped: boolean
): CmdletReading | undefined {
  const canonical = POWERSHELL_ALIASES[name] ?? name
  const spec = name === 'mkdir' || name === 'md' ? MKDIR : WRITERS[canonical]
  if (!spec) return undefined
  const fail: CmdletReading = { writes: [], providers: [], unknown: true }
  const bound = bind(words, spec)
  if (!bound) return fail
  const params: Params = { ...COMMON, ...spec.params }
  if (ofKind(bound, params, ['remote']).length > 0) return fail
  const paths = ofKind(bound, params, ['path', 'literal'])
  const destinations = ofKind(bound, params, ['destination'])
  const providers = [...paths, ...destinations].filter((p) => PROVIDER.test(p))
  if (spec.needsPath && paths.length === 0) return fail
  // Sans chemin, une cible reçue par le tuyau (`gci | Remove-Item`) n'est pas connue.
  if (piped && paths.length === 0 && spec.effect !== 'new-item') return fail
  const writes = targets(spec, bound, params, paths, destinations)
  if (!writes) return fail
  return { writes: writes.filter((p) => !PROVIDER.test(p)), providers, unknown: false }
}

/** Chemins écrits selon l'effet de la cmdlet ; `undefined` si on ne sait pas. */
function targets(
  spec: Cmdlet,
  bound: Map<string, string[]>,
  params: Params,
  paths: string[],
  destinations: string[]
): string[] | undefined {
  switch (spec.effect) {
    case 'path':
      return paths
    case 'destination':
      // Sans destination : le dossier courant.
      return destinations.length > 0 ? destinations : ['.']
    case 'path+destination':
      return [...paths, ...(destinations.length > 0 ? destinations : ['.'])]
    case 'rename': {
      const newName = ofKind(bound, params, ['newName'])
      if (newName.length !== 1 || paths.length !== 1 || /[\\/]/.test(newName[0] ?? ''))
        return undefined
      return [...paths, win32.join(win32.dirname(paths[0] ?? ''), newName[0] ?? '')]
    }
    case 'new-item': {
      const type = (ofKind(bound, params, ['itemType'])[0] ?? 'file').toLowerCase()
      // Liens (symbolique, jonction, physique) : ce qu'ils permettront d'écrire n'est pas lu.
      if (!['file', 'directory'].includes(type)) return undefined
      const names = ofKind(bound, params, ['name'])
      if (names.length > 1) return undefined
      const bases = paths.length > 0 ? paths : ['.']
      if (names.length === 0) return paths.length > 0 ? paths : undefined
      return bases.map((b) => win32.join(b, names[0] ?? ''))
    }
  }
}
