/**
 * Arguments du pilote : `pnpm pilote <commande> [options] [texte]`. Sans dépendance, testé
 * (`args.test.ts`).
 */

/** Options de chaque commande : `true` prend une valeur, `false` est un drapeau. */
export const COMMANDS = {
  lancer: {
    app: true,
    dossier: true,
    'profil-temporaire': false,
    profil: true,
    port: true,
    journal: true,
    lang: true,
    'agent-factice': true,
    'agents-neufs': false,
    'vrai-trousseau': false
  },
  arreter: {},
  etat: { json: false, long: false },
  attendre: { max: true, calme: true, json: false },
  capture: { demi: false, zone: true },
  envoyer: {},
  repondre: {},
  cliquer: {},
  panneau: {},
  note: { gravite: true, capture: false },
  intervention: { capture: false },
  journal: { resume: false },
  aide: {}
}

export const GRAVITES = ['bloquant', 'genant', 'mineur', 'idee']
export const ZONES = ['fil', 'carte', 'panneau', 'fenetre']

/**
 * Commande, options et texte libre (les mots restants, joints par une espace). Lève une erreur
 * lisible pour une commande ou une option inconnue, ou une valeur manquante.
 */
export function parseArgs(argv) {
  const [command = 'aide', ...rest] = argv
  const spec = COMMANDS[command]
  if (!spec) throw new Error(`commande inconnue : ${command} (pnpm pilote aide)`)
  const options = {}
  const words = []
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg === '--') {
      words.push(...rest.slice(i + 1))
      break
    }
    if (!arg.startsWith('--')) {
      words.push(arg)
      continue
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s, 2)
    if (!(name in spec)) throw new Error(`option inconnue pour ${command} : --${name}`)
    if (spec[name]) {
      const value = inline ?? rest[++i]
      if (value === undefined || (inline === undefined && value.startsWith('--'))) {
        throw new Error(`--${name} attend une valeur`)
      }
      options[name] = value
    } else {
      options[name] = true
    }
  }
  return { command, options, text: words.join(' ') }
}

/**
 * Durée lisible en millisecondes : `90s`, `3m`, `1h30m`, `1500ms`, ou un nombre seul (secondes).
 */
export function parseDuration(value) {
  const text = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000)
  const units = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }
  let total = 0
  let matched = ''
  for (const [, n, unit] of text.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) {
    total += Number(n) * units[unit]
    matched += `${n}${unit}`
  }
  if (!matched || matched !== text.replace(/\s+/g, '')) {
    throw new Error(`durée illisible : ${value} (ex. 90s, 3m, 1h30m)`)
  }
  return Math.round(total)
}

/** Durée en clair : « 42 s », « 3 min 05 s », « 1 h 02 min ». */
export function formatDuration(ms) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
