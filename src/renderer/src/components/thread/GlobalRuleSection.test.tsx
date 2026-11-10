import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApprovalRulesView } from '@shared/approval-rules'
import type { TranscriptItem } from '@shared/transcript'
import { ToolCall, WorkspaceContext } from './ToolCall'
import { GlobalRulesContext } from './global-rules'
import { AgentCardContext } from './agent-card-context'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const WS = '/Users/ada/projet'

const OPTIONS = [
  { optionId: 'o1', name: 'Allow', kind: 'allow_once' as const },
  { optionId: 'a1', name: 'Always allow', kind: 'allow_always' as const },
  { optionId: 'r1', name: 'Reject', kind: 'reject_once' as const }
]

const command = (text: string, extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id: 2,
  toolCallId: `t-${text}`,
  title: text,
  toolKind: 'execute',
  status: 'pending',
  content: [],
  locations: [],
  command: { text },
  permission: { requestId: `req-${text}`, state: 'pending', options: OPTIONS },
  ...extra
})

const rules = (execute: { enabled: boolean; forbidden?: boolean }): ApprovalRulesView => ({
  profileId: 'bob',
  file: '~/.bob/settings/settings.json',
  exists: true,
  groups: [
    { id: 'read', enabled: true, forbidden: false, outsideWorkspace: false },
    {
      id: 'execute',
      enabled: execute.enabled,
      forbidden: execute.forbidden ?? false,
      outsideWorkspace: false
    }
  ],
  defaultGroups: false,
  otherGroups: [],
  commands: { allowed: ['ls', 'wc'], denied: ['rm'], defaultList: false },
  outsideWorkspaceAllowed: false,
  autoApprovalEnabled: true,
  forbiddenGroups: []
})

const get = vi.fn()
const change = vi.fn()
const original = window.api

beforeEach(() => {
  get.mockReset()
  change.mockReset()
  get.mockResolvedValue({ ok: true, rules: rules({ enabled: false }) })
  change.mockImplementation((_id: string, c: { prefix: string }) =>
    Promise.resolve({
      ok: true,
      rules: rules({ enabled: true }),
      notice: { prefix: c.prefix, singleWord: false, executeGroup: 'added' }
    })
  )
  window.api = { ...original, approvalRules: { get, change, open: vi.fn() } } as typeof window.api
})

afterEach(() => {
  window.api = original
})

const view = (item: ToolItem, withRules = true) => {
  const onRespond = vi.fn()
  const onManage = vi.fn()
  render(
    <WorkspaceContext.Provider value={WS}>
      <GlobalRulesContext.Provider value={withRules ? { profileId: 'bob', onManage } : null}>
        <ToolCall item={item} onRespond={onRespond} />
      </GlobalRulesContext.Provider>
    </WorkspaceContext.Provider>
  )
  return { onRespond, onManage }
}

describe('« Pour tous les projets » sur une carte de commande (fiche 215)', () => {
  it('replié par défaut ; commande entière proposée ; encadré « première fois »', async () => {
    view(command('npm run lint'))
    const toggle = await screen.findByTestId('global-rule-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('global-rule-prefix')).toBeNull()
    fireEvent.click(toggle)
    const inputs = screen.getAllByTestId<HTMLInputElement>('global-rule-prefix')
    expect(inputs.map((i) => i.value)).toEqual(['npm run lint'])
    expect(screen.getByTestId('global-rule-first-time')).toBeTruthy()
    expect(screen.queryByTestId('global-rule-one-word')).toBeNull()
  })

  it('« Autoriser partout » : écrit la règle, puis répond « toujours » (par genre) à la carte', async () => {
    const { onRespond } = view(command('npm run lint'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    fireEvent.click(screen.getByTestId('global-rule-allow'))
    await waitFor(() => expect(onRespond).toHaveBeenCalledWith('req-npm run lint', 'a1'))
    expect(change).toHaveBeenCalledWith('bob', {
      type: 'allowCommandEverywhere',
      prefix: 'npm run lint'
    })
  })

  it('profil qui déclare la portée de « Toujours » (fiche 214) : le texte reprend son libellé', async () => {
    render(
      <WorkspaceContext.Provider value={WS}>
        <AgentCardContext.Provider
          value={{
            name: 'IBM Bob',
            alwaysScope: { lasts: 'conversation', covers: { execute: 'parts' } }
          }}
        >
          <GlobalRulesContext.Provider value={{ profileId: 'bob', onManage: vi.fn() }}>
            <ToolCall item={command('npm run lint')} onRespond={vi.fn()} />
          </GlobalRulesContext.Provider>
        </AgentCardContext.Provider>
      </WorkspaceContext.Provider>
    )
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    expect(screen.getByText(/« Toujours dans cette conversation »/)).toBeTruthy()
  })

  it('« Refuser partout » : ajoute aux refusées et refuse la carte en cours', async () => {
    const { onRespond } = view(command('make deploy'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    fireEvent.click(screen.getByTestId('global-rule-deny'))
    await waitFor(() => expect(onRespond).toHaveBeenCalledWith('req-make deploy', 'r1'))
    expect(change).toHaveBeenCalledWith('bob', {
      type: 'addCommand',
      prefix: 'make deploy',
      list: 'denied'
    })
  })

  it('commande enchaînée : une partie par champ, `cd` vers le dossier ignoré, parties décochables', async () => {
    const { onRespond } = view(command(`cd ${WS} && npm test && npm run lint`))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    const inputs = screen.getAllByTestId<HTMLInputElement>('global-rule-prefix')
    expect(inputs.map((i) => i.value)).toEqual(['npm test', 'npm run lint'])
    fireEvent.click(screen.getAllByTestId('global-rule-part-on')[1] as HTMLElement)
    fireEvent.click(screen.getByTestId('global-rule-allow'))
    await waitFor(() => expect(onRespond).toHaveBeenCalled())
    expect(change).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledWith('bob', {
      type: 'allowCommandEverywhere',
      prefix: 'npm test'
    })
  })

  it('préfixe d’un seul mot : avertissement, sans blocage', async () => {
    view(command('npm run lint'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    fireEvent.change(screen.getByTestId('global-rule-prefix'), { target: { value: 'npm ' } })
    expect(screen.getByTestId('global-rule-one-word').textContent).toContain('npm publish')
  })

  it('erreur typée : dite, rien répondu à la carte', async () => {
    change.mockResolvedValue({ ok: false, error: { code: 'changed' } })
    const { onRespond } = view(command('npm test'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    fireEvent.click(screen.getByTestId('global-rule-allow'))
    expect((await screen.findByTestId('global-rule-error')).textContent).toMatch(
      /Rien n’a été écrit/
    )
    expect(onRespond).not.toHaveBeenCalled()
  })

  it('partie déjà couverte par les listes de Bob : montrée, ni cochable ni écrite', async () => {
    const { onRespond } = view(command('make && wc -l gros.txt && rm -rf build'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    expect(
      screen.getAllByTestId<HTMLInputElement>('global-rule-prefix').map((i) => i.value)
    ).toEqual(['make'])
    expect(screen.queryAllByTestId('global-rule-part-on')).toEqual([])
    const covered = screen.getAllByTestId('global-rule-covered').map((c) => c.textContent)
    expect(covered).toEqual(['wc -l gros.txtdéjà autorisée partout', 'rm -rf buildrefusée partout'])
    fireEvent.click(screen.getByTestId('global-rule-allow'))
    await waitFor(() => expect(onRespond).toHaveBeenCalled())
    expect(change).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledWith('bob', { type: 'allowCommandEverywhere', prefix: 'make' })
  })

  it('commande entièrement couverte : pas de section, « déjà autorisée partout · Gérer »', async () => {
    const { onManage } = view(command('wc -l gros.txt'))
    const line = await screen.findByTestId('global-rule-all-covered')
    expect(line.textContent).toMatch(/wc -l gros\.txt\s:\sdéjà autorisée partout/)
    expect(screen.queryByTestId('global-rule-toggle')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Gérer' }))
    expect(onManage).toHaveBeenCalled()
  })

  it('quand la règle vaut : prochaine conversation sans « Commandes de la liste », sinon tout de suite', async () => {
    view(command('npm test'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    const when = () => screen.getByTestId('global-rule-when').textContent ?? ''
    expect(when()).toMatch(/prochaine conversation/)
    expect(when()).toMatch(/Refuser partout\s*» s’applique tout de suite/)
    document.body.innerHTML = ''
    get.mockResolvedValue({ ok: true, rules: rules({ enabled: true }) })
    view(command('npm test'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    expect(when()).toMatch(/s’appliquent tout de suite/)
    expect(when()).not.toMatch(/prochaine conversation/)
  })

  it('groupe `execute` déjà permis : pas d’encadré « première fois »', async () => {
    get.mockResolvedValue({ ok: true, rules: rules({ enabled: true }) })
    view(command('npm test'))
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    expect(screen.queryByTestId('global-rule-first-time')).toBeNull()
  })

  it.each([
    [
      'agent sans règles',
      command('npm test'),
      false,
      { ok: true, rules: rules({ enabled: true }) }
    ],
    [
      'carte à risque (fiche 211)',
      command('sudo npm test', {
        permission: {
          requestId: 'r',
          state: 'pending',
          options: OPTIONS,
          risks: [{ kind: 'privilege', via: 'sudo' }]
        }
      }),
      true,
      { ok: true, rules: rules({ enabled: true }) }
    ],
    [
      'sans « Toujours » proposé (accord explicite voulu par Bob)',
      command('ls ~/.bob', {
        permission: {
          requestId: 'r',
          state: 'pending',
          options: OPTIONS.filter((o) => o.kind !== 'allow_always')
        }
      }),
      true,
      { ok: true, rules: rules({ enabled: true }) }
    ],
    ['fichier illisible', command('npm test'), true, { ok: false, error: { code: 'invalid-json' } }]
  ])('section absente : %s', async (_name, item, withRules, read) => {
    get.mockResolvedValue(read)
    view(item, withRules)
    await waitFor(() => expect(screen.getByTestId('permission')).toBeTruthy())
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByTestId('global-rule-toggle')).toBeNull()
  })

  it('après la réponse : la règle écrite rappelée sur la ligne, « Gérer » ouvre les réglages', async () => {
    const item = command('npm run lint')
    const { onRespond, onManage } = view(item)
    fireEvent.click(await screen.findByTestId('global-rule-toggle'))
    fireEvent.click(screen.getByTestId('global-rule-allow'))
    await waitFor(() => expect(onRespond).toHaveBeenCalled())
    render(
      <GlobalRulesContext.Provider value={{ profileId: 'bob', onManage }}>
        <ToolCall
          item={{
            ...item,
            id: 9,
            permission: {
              requestId: 'req-npm run lint',
              options: OPTIONS,
              state: { optionId: 'a1', name: 'Always allow', kind: 'allow_always' }
            }
          }}
          onRespond={vi.fn()}
        />
      </GlobalRulesContext.Provider>
    )
    const answer = await screen.findByTestId('global-rule-answer')
    expect(answer.textContent).toContain('npm run lint')
    fireEvent.click(screen.getByRole('button', { name: 'Gérer' }))
    expect(onManage).toHaveBeenCalled()
  })
})
