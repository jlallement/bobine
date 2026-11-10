/**
 * Scénarios « pendant le tour » (fiche 157) : une commande qui ne rend plus rien, un coût qui monte
 * pendant le tour, une réponse comptée en jetons sans coût. Formes génériques (extension de
 * terminal, `usage_update`), aucune n'est un relevé de Bob ou d'OpenCode. Rangés à part : le
 * catalogue de `scenarios.mts` est déjà long.
 */
import type { Scenario, Step } from './scenario.mts'

/** Silence de la commande : 1 500 pauses (60 s au délai par défaut de 40 ms). */
export const SILENT_TICKS = 1500

/** Coûts cumulés annoncés pendant `cout-qui-monte`, un par outil (en dollars). */
export const RISING_COSTS = [0.4, 0.8, 1.2, 1.6]

const update = (u: Extract<Step, { kind: 'update' }>['update']): Step => ({
  kind: 'update',
  update: u
})

/** Commande au format de l'extension de terminal, qui écrit une ligne puis se tait. */
function silentCommand(id: string): Step[] {
  const command = 'npm install'
  return [
    update({
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title: command,
      kind: 'execute',
      status: 'in_progress',
      content: [{ type: 'terminal', terminalId: id }],
      rawInput: { command },
      _meta: { terminal_info: { terminal_id: id } }
    }),
    { kind: 'pause', ticks: 2 },
    update({
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      _meta: { terminal_output_delta: { terminal_id: id, data: 'Résolution des dépendances…\n' } }
    }),
    { kind: 'pause', ticks: SILENT_TICKS },
    update({
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      _meta: { terminal_output_delta: { terminal_id: id, data: '42 paquets installés\n' } }
    }),
    update({
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      _meta: { terminal_exit: { terminal_id: id, exit_code: 0, signal: null } }
    })
  ]
}

/**
 * Un outil (lecture de fichier) pendant lequel l'agent annonce son coût cumulé ; une pause après sa
 * fin laisse au client le temps d'interrompre avant le suivant.
 */
function costlyTool(index: number, cost: number): Step[] {
  const id = `cout-${index + 1}`
  return [
    update({
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title: `Lire src/module-${index + 1}.ts`,
      kind: 'read',
      status: 'in_progress',
      rawInput: { path: `src/module-${index + 1}.ts` }
    }),
    { kind: 'pause', ticks: 3 },
    update({
      sessionUpdate: 'usage_update',
      used: 40_000 * (index + 1),
      size: 200_000,
      cost: { amount: cost, currency: 'USD' }
    }),
    { kind: 'pause', ticks: 3 },
    update({ sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' }),
    { kind: 'pause', ticks: 8 }
  ]
}

export const turnGuardScenarios: Record<string, Scenario> = {
  'commande-silencieuse': {
    description:
      'Commande dont la sortie s’arrête après une ligne, environ une minute (extension de terminal) : « Aucune sortie depuis N min », Interrompre (fiche 157)',
    steps: [
      { kind: 'text', text: 'J’installe les dépendances. ' },
      ...silentCommand('silencieuse-1'),
      { kind: 'text', text: 'Dépendances installées.' }
    ]
  },
  'cout-qui-monte': {
    description: `Quatre lectures, le coût cumulé annoncé pendant chacune (${RISING_COSTS.join(' → ')} $) : plafond franchi en plein outil, tour interrompu à sa fin (fiche 157)`,
    steps: [
      { kind: 'text', text: 'Je parcours les modules un par un. ' },
      ...RISING_COSTS.flatMap((cost, i) => costlyTool(i, cost)),
      { kind: 'text', text: 'Tous les modules sont lus.' }
    ]
  },
  'contexte-80': {
    description: 'Contexte rempli à 85 % : puce orange et « Compacter » à côté (fiche 157)',
    steps: [
      update({ sessionUpdate: 'usage_update', used: 170_000, size: 200_000 }),
      { kind: 'text', text: 'Le contexte se remplit.' }
    ]
  },
  'jetons-sans-cout': {
    description:
      'Réponse comptée en jetons, sans coût (à lancer avec `--sans-cout`, `MOCK_AGENT_USAGE=tokens`) : plafond en jetons à la fin du tour (fiche 157)',
    steps: [{ kind: 'text', text: 'Voici une réponse comptée en jetons, sans coût annoncé.' }]
  }
}
