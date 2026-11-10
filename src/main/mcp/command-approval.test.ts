import { describe, expect, it, vi } from 'vitest'
import type { CommandMemory } from '../approvals'
import { t as translate } from 'i18next'
import { alwaysInProject, approveCommand, type CommandApproval } from './command-approval'
import type { ToolContext } from './tools'

function setup(answer: string[] | null | 'late', always?: CommandMemory) {
  const late: ((choices: string[] | null) => void)[] = []
  const told: string[] = []
  const context: ToolContext = {
    workspace: '/projet',
    conversationId: 'c1',
    ask: vi.fn(async (_args, onLate) => {
      if (onLate) late.push(onLate)
      return answer
    }),
    proposeChild: async () => ({ action: 'refuse' as const }),
    tellAgent: (text) => told.push(text)
  }
  const session = new Set<string>()
  const approval = (command: string): CommandApproval => ({
    workspace: '/projet',
    command,
    question: `Lancer ${command} ?`,
    header: 'Terminal',
    allow: 'Lancer',
    allowDescription: 'Dans un onglet du terminal.',
    session,
    key: command,
    ...(always ? { always } : {}),
    texts: { retry: 'relance', refusedByUser: 'non', pending: 'attends', refused: 'refusé' }
  })
  return { context, session, approval, late, told }
}

function memory(): CommandMemory & { list: string[] } {
  const list: string[] = []
  return {
    list,
    has: (workspace, command) => list.includes(`${workspace}:${command}`),
    add: (workspace, command) => list.push(`${workspace}:${command}`)
  }
}

describe('approveCommand (fiche 072)', () => {
  it('trois choix ; « Toujours dans ce projet » retenu pour ce dossier seulement', async () => {
    const always = memory()
    const t = setup([alwaysInProject()], always)
    expect(await approveCommand(t.context, t.approval('pnpm dev'))).toBeUndefined()
    const options = vi.mocked(t.context.ask).mock.calls[0]?.[0].options.map((o) => o.label)
    expect(options).toEqual(['Lancer', alwaysInProject(), 'Refuser'])
    expect(always.list).toEqual(['/projet:pnpm dev'])
    // Autre conversation du même dossier : plus de question.
    const other = setup(null, always)
    expect(await approveCommand(other.context, other.approval('pnpm dev'))).toBeUndefined()
    expect(other.context.ask).not.toHaveBeenCalled()
    // Autre commande : la question revient.
    expect(await approveCommand(other.context, other.approval('rm -rf dist'))).toMatchObject({
      content: [{ type: 'text', text: 'refusé' }]
    })
  })

  it('« Lancer » : seulement pour cette conversation, rien de retenu', async () => {
    const always = memory()
    const t = setup(['Lancer'], always)
    await approveCommand(t.context, t.approval('make'))
    await approveCommand(t.context, t.approval('make'))
    expect(t.context.ask).toHaveBeenCalledTimes(1)
    expect(always.list).toEqual([])
  })

  it('sans mémoire « toujours » : deux choix, comme avant', async () => {
    const t = setup(['Lancer'])
    await approveCommand(t.context, t.approval('make'))
    const options = vi.mocked(t.context.ask).mock.calls[0]?.[0].options.map((o) => o.label)
    expect(options).toEqual(['Lancer', 'Refuser'])
  })

  it('réponse tardive « toujours » : retenue, l’agent est prévenu', async () => {
    const always = memory()
    const t = setup('late', always)
    expect(await approveCommand(t.context, t.approval('pnpm dev'))).toMatchObject({
      content: [{ type: 'text', text: 'attends' }]
    })
    t.late[0]?.([alwaysInProject()])
    expect(always.list).toEqual(['/projet:pnpm dev'])
    expect(t.told).toEqual(['relance'])
  })

  it('refus : résultat en erreur, marqué refusé pour la carte (fiche 122)', async () => {
    const t = setup([translate('approvals.refuse')])
    expect(await approveCommand(t.context, t.approval('npm test'))).toEqual({
      content: [{ type: 'text', text: 'refusé' }],
      isError: true,
      refused: true
    })
  })
})

describe('approveCommand : commandes refusées partout par l’agent (fiche 215, recette QA)', () => {
  it('refusée sans question ni lancement, même autorisée « toujours » ici', async () => {
    const always = memory()
    always.add('/projet', 'npm test && node --version')
    const t = setup(['Lancer'], always)
    t.context.deniedCommand = (command) =>
      command.includes('node --version') ? 'node --version' : undefined
    const result = await approveCommand(t.context, t.approval('npm test && node --version'))
    expect(result).toMatchObject({ refused: true, isError: true })
    expect(JSON.stringify(result)).toContain('node --version')
    expect(t.context.ask).not.toHaveBeenCalled()
    // Une commande que les règles ne refusent pas suit le chemin habituel.
    expect(await approveCommand(t.context, t.approval('npm test'))).toBeUndefined()
    expect(t.context.ask).toHaveBeenCalledTimes(1)
  })
})
