/**
 * Ce qui compte comme « l'agent avance » pour le bandeau de silence (fiche 194, recette du
 * 2026-11-23) : toute ligne ACP reçue, sauf les mises à jour d'état seules (commandes, mode,
 * options, infos de session, consommation). OpenCode 2.3.0 qui ne joint pas son modèle (proxy
 * injoignable, réseau coupé) réessaie sans fin en n'envoyant que des `session_info_update`
 * (`_meta["opencode/retry"]`, toutes les 30 s) : compter ces octets cachait le silence, le tour
 * restait sur « Réfléchit… » sans aucun signe. Générique : aucune différence d'agent ici.
 */

/** Mises à jour qui disent un état, jamais un travail : texte, réflexion, outil, plan en sont un. */
const STATUS_ONLY_UPDATES = [
  'available_commands_update',
  'current_mode_update',
  'config_option_update',
  'session_info_update',
  'usage_update'
]

const SESSION_UPDATE = /"method"\s*:\s*"session\\?\/update"/
const STATUS_ONLY = new RegExp(`"sessionUpdate"\\s*:\\s*"(?:${STATUS_ONLY_UPDATES.join('|')})"`)

/**
 * Ligne JSON-RPC reçue de l'agent qui n'est qu'une mise à jour d'état. Lue sans être analysée : dans
 * une chaîne JSON, les guillemets sont échappés (`\"`), si bien qu'un texte qui cite
 * `"sessionUpdate":"usage_update"` ne ressemble jamais à la clé elle-même.
 */
export function statusOnlyLine(line: string): boolean {
  return SESSION_UPDATE.test(line) && STATUS_ONLY.test(line)
}

/**
 * Découpe les octets reçus en lignes et dit, pour chacune, si l'agent avance (`true`) ou ne fait
 * que donner un état (`false`). Une ligne arrivée en morceaux compte à son dernier morceau.
 */
export class ProgressLines {
  private readonly decoder = new TextDecoder()
  private buffer = ''
  private readonly onLine: (progress: boolean) => void

  constructor(onLine: (progress: boolean) => void) {
    this.onLine = onLine
  }

  bytes(chunk: Uint8Array): void {
    // Le saut de ligne n'est cherché que dans la partie nouvelle (comme `AcpLog`).
    let from = this.buffer.length
    this.buffer += this.decoder.decode(chunk, { stream: true })
    let end: number
    while ((end = this.buffer.indexOf('\n', from)) >= 0) {
      const line = this.buffer.slice(0, end)
      this.buffer = this.buffer.slice(end + 1)
      from = 0
      if (line.trim()) this.onLine(!statusOnlyLine(line))
    }
  }
}
