import { fireEvent, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { visibleText } from '@shared/command-view'
import { DiffView } from './DiffView'
import { ToolCall, WorkspaceContext } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const WS = '/Users/ada/projet'

const pending = {
  requestId: 'p1',
  state: 'pending' as const,
  options: [
    { optionId: 'allow', name: 'Allow once', kind: 'allow_once' as const },
    { optionId: 'reject', name: 'Reject', kind: 'reject_once' as const }
  ]
}

/** Commande comme OpenCode : `rawInput.command`, le dossier répété dans `locations`. */
const command = (extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id: 2,
  toolCallId: 't1',
  title: 'git status --short',
  toolKind: 'execute',
  status: 'pending',
  content: [],
  locations: [{ path: WS }],
  command: { text: 'git status --short' },
  permission: pending,
  ...extra
})

/** Écriture d'un fichier comme OpenCode : diff, `oldText: null` pour une création. */
const write = (path: string, oldText: string | null, extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id: 3,
  toolCallId: 't2',
  title: 'write',
  toolKind: 'edit',
  status: 'pending',
  content: [{ type: 'diff', path, oldText, newText: '# Notes QA\n' }],
  locations: [{ path }],
  permission: pending,
  ...extra
})

const view = (item: ToolItem, workspace: string | undefined = WS) =>
  render(
    <WorkspaceContext.Provider value={workspace}>
      <ToolCall item={item} onRespond={vi.fn()} />
    </WorkspaceContext.Provider>
  )

const cwdText = () => screen.getByTestId('command-cwd-text').textContent

describe('Carte « commande » : le dossier une seule fois (fiche 203)', () => {
  it('dossier de la conversation : « Dans projet », chemin entier en infobulle et lu', () => {
    view(command())
    expect(cwdText()).toBe('projet')
    const cwd = screen.getByTestId('command-cwd')
    expect(cwd.getAttribute('title')).toBe(WS)
    expect(screen.getByRole('group', { name: `Commande Dans ${WS}` })).toBeTruthy()
    // L'emplacement égal au dossier de la commande n'est plus répété sous la commande.
    expect(document.querySelector('.tool-locations')).toBeNull()
    expect(screen.queryByTestId('command-outside')).toBeNull()
  })

  it('sous-dossier : « Dans projet/src/renderer » ; emplacement égal (barre finale) masqué', () => {
    view(
      command({
        command: { text: 'pnpm vitest run ToolCall', cwd: `${WS}/src/renderer` },
        locations: [{ path: `${WS}/src/renderer/` }]
      })
    )
    expect(cwdText()).toBe('projet/src/renderer')
    expect(screen.getByTestId('command-cwd').getAttribute('title')).toBe(`${WS}/src/renderer`)
    expect(document.querySelector('.tool-locations')).toBeNull()
  })

  it('un emplacement différent du dossier reste affiché', () => {
    view(command({ locations: [{ path: WS }, { path: `${WS}/src` }] }))
    const shown = [...document.querySelectorAll('.tool-location code')].map((c) => c.textContent)
    expect(shown).toEqual([`${WS}/src`])
  })

  it('emplacement avec une ligne : jamais masqué', () => {
    view(command({ locations: [{ path: WS, line: 3 }] }))
    expect(document.querySelector('.tool-location code')?.textContent).toBe(`${WS}:3`)
  })

  it('hors du dossier : chemin entier, jamais raccourci, invisible rendu visible, alerte', () => {
    const outside = '/private/tmp/essai/un-dossier-au-nom-long/ailleurs‮gnp'
    view(command({ command: { text: 'rm -rf build && make', cwd: outside } }))
    expect(cwdText()).toBe(visibleText(outside))
    expect(cwdText()).not.toMatch(/‮/)
    expect(screen.getByTestId('command-cwd').getAttribute('title')).toBeNull()
    expect(screen.getByTestId('command-outside')).toBeTruthy()
    expect(screen.getByTestId('command-invisible')).toBeTruthy()
  })

  it('au moindre doute (`..`, `~`, relatif) : le chemin tel quel, en entier', () => {
    const { unmount } = view(command({ command: { text: 'ls', cwd: `${WS}/src/..` } }))
    expect(cwdText()).toBe(`${WS}/src/..`)
    unmount()
    const second = view(command({ command: { text: 'ls', cwd: '~/projet' } }))
    expect(cwdText()).toBe('~/projet')
    second.unmount()
    view(command({ command: { text: 'ls', cwd: 'src' } }))
    expect(cwdText()).toBe('src')
  })

  // Contrat réel d'OpenCode 2.2.5 (trace `commande-dans-un-sous-dossier`) : `workdir` RELATIF,
  // l'emplacement absolu. Avant le correctif : « Dans docs » et le chemin absolu répété dessous.
  const inDocs = (extra: Partial<ToolItem> = {}) =>
    command({
      title: 'ls',
      command: { text: 'ls', cwd: 'docs' },
      locations: [{ path: `${WS}/docs` }],
      ...extra
    })

  it('OpenCode, `workdir` relatif confirmé par l’emplacement : « Dans projet/docs », une fois', () => {
    view(inDocs())
    expect(cwdText()).toBe('projet/docs')
    expect(screen.getByTestId('command-cwd').getAttribute('title')).toBe(`${WS}/docs`)
    expect(screen.getByRole('group', { name: `Commande Dans ${WS}/docs` })).toBeTruthy()
    expect(document.querySelector('.tool-locations')).toBeNull()
    expect(screen.queryByTestId('command-outside')).toBeNull()
  })

  it('OpenCode, `workdir` relatif, après la décision, dépliée : toujours une fois', async () => {
    view(
      inDocs({
        status: 'completed',
        permission: { ...pending, state: { optionId: 'allow', kind: 'allow_once', name: 'Allow' } }
      })
    )
    const summary = document.querySelector('details.tool summary')
    if (!summary) throw new Error('Résumé absent')
    fireEvent.click(summary)
    expect((await screen.findByTestId('command-cwd-text')).textContent).toBe('projet/docs')
    expect(document.querySelector('.tool-locations')).toBeNull()
  })

  it('`workdir` relatif qui sort (`../..`) : alerte, chemin entier, emplacement gardé', () => {
    const { unmount } = view(
      command({ command: { text: 'ls', cwd: '../..' }, locations: [{ path: '/Users' }] })
    )
    expect(cwdText()).toBe('/Users')
    expect(screen.getByTestId('command-outside')).toBeTruthy()
    expect(document.querySelector('.tool-location code')?.textContent).toBe('/Users')
    unmount()
    // Sans emplacement : la valeur brute, l'alerte quand même.
    view(command({ command: { text: 'ls', cwd: '../..' }, locations: [] }))
    expect(cwdText()).toBe('../..')
    expect(screen.getByTestId('command-outside')).toBeTruthy()
  })

  it('`workdir` relatif sans emplacement, ou emplacement différent : brut, emplacement gardé', () => {
    const { unmount } = view(inDocs({ locations: [] }))
    expect(cwdText()).toBe('docs')
    expect(screen.getByTestId('command-cwd').getAttribute('title')).toBeNull()
    unmount()
    view(inDocs({ locations: [{ path: '/etc' }] }))
    expect(cwdText()).toBe('docs')
    expect(document.querySelector('.tool-location code')?.textContent).toBe('/etc')
    // L'emplacement de l'agent est hors du dossier : au moindre doute, l'alerte.
    expect(screen.getByTestId('command-outside')).toBeTruthy()
  })

  it('« Copier » après le dossier et ses mentions, dans la barre', () => {
    view(command({ command: { text: 'ls', cwd: '/tmp/x' } }))
    const bar = screen.getByTestId('command-block').querySelector('.cmd-bar')
    const children = [...(bar?.children ?? [])]
    expect(children.map((c) => c.className)).toEqual(['cmd-where', 'cmd-copy'])
    expect(within(children[0] as HTMLElement).getByTestId('command-outside')).toBeTruthy()
  })

  it('après la décision, dépliée : même barre, emplacement égal au dossier toujours masqué', async () => {
    view(
      command({
        status: 'completed',
        permission: { ...pending, state: { optionId: 'allow', kind: 'allow_once', name: 'Allow' } }
      })
    )
    const summary = document.querySelector('details.tool summary')
    if (!summary) throw new Error('Résumé absent')
    fireEvent.click(summary)
    expect((await screen.findByTestId('command-cwd-text')).textContent).toBe('projet')
    expect(document.querySelector('.tool-locations')).toBeNull()
  })
})

describe('Carte « fichier » : chemin relatif, création dite comme une création (fiche 203)', () => {
  it('création dans le dossier : « Création de notes.md », question, icône, nom seul', () => {
    view(write(`${WS}/notes.md`, null))
    expect(screen.getByTestId('tool-label').textContent).toBe('Création de notes.md')
    expect(screen.getByTestId('permission').querySelector('.pc-title')?.textContent).toBe(
      i18next.t('toolCall.permission.question.create')
    )
    expect(document.querySelector('.tool-icon')?.classList.contains('lucide-file-plus')).toBe(true)
    const path = screen.getByTestId('diff-path')
    expect(path.querySelector('.diff-path-dir')).toBeNull()
    expect(path.querySelector('.diff-path-name')?.textContent).toBe('notes.md')
    expect(path.getAttribute('title')).toBe(`${WS}/notes.md`)
    expect(document.querySelector('.diff-badge')?.textContent).toBe('nouveau fichier')
  })

  it('nom très long : la ligne d’outil garde le nom entier, extension comprise, dossier à part', () => {
    const name = 'guide-utilisateur-de-la-bobine-tres-long-nom-de-fichier.md'
    view(
      write(`${WS}/docs/${name}`, null, {
        status: 'completed',
        permission: { ...pending, state: { optionId: 'allow', kind: 'allow_once', name: 'Allow' } }
      })
    )
    const label = screen.getByTestId('tool-label')
    // Avant le correctif : « Création de …guide-…-nom-de-fichier.md », coupé à la fin par la CSS.
    expect(label.textContent).toBe(`Création de docs/${name}`)
    expect(screen.getByTestId('tool-label-name').textContent).toBe(name)
    expect(label.querySelector('.tool-file-dir')?.textContent).toBe('docs/')
    expect(label.getAttribute('title')).toContain(`${WS}/docs/${name}`)
  })

  it('modification (`oldText` vide ou non) : « Modification de », question inchangée', () => {
    view(write(`${WS}/notes.md`, ''))
    expect(screen.getByTestId('tool-label').textContent).toBe('Modification de notes.md')
    expect(screen.getByTestId('permission').querySelector('.pc-title')?.textContent).toBe(
      i18next.t('toolCall.permission.question.edit')
    )
    expect(document.querySelector('.tool-icon')?.classList.contains('lucide-file-pen-line')).toBe(
      true
    )
  })

  it('sous-dossier : dossier grisé à part (coupé par le début), nom entier', () => {
    view(write(`${WS}/src/renderer/src/components/thread/notes.md`, null))
    const path = screen.getByTestId('diff-path')
    const dir = path.querySelector('.diff-path-dir')
    expect(dir?.querySelector('bdi')?.getAttribute('dir')).toBe('ltr')
    expect(dir?.textContent).toBe('src/renderer/src/components/thread/')
    expect(path.querySelector('.diff-path-name')?.textContent).toBe('notes.md')
  })

  it('hors du dossier : avec `~`, chemin entier en infobulle', () => {
    const outside = '/Users/ada/Dev/autre-projet/packages/very-long-package-name/src/conf.ts'
    view(write(outside, 'a', { title: 'edit' }))
    const path = screen.getByTestId('diff-path')
    expect(path.querySelector('.diff-path-dir')?.textContent).toBe(
      '~/Dev/autre-projet/packages/very-long-package-name/src/'
    )
    expect(path.getAttribute('title')).toBe(outside)
  })

  it('chemin aux caractères bidi : rendus visibles partout (dossier, nom, infobulle)', () => {
    const trapped = `${WS}/src/‮gnp/fichier‮txt.exe`
    view(write(trapped, null))
    const path = screen.getByTestId('diff-path')
    expect(path.textContent).not.toMatch(/[‪-‮⁦-⁩]/)
    expect(path.getAttribute('title')).not.toMatch(/[‪-‮⁦-⁩]/)
    expect(path.textContent).toContain('U+202E')
  })
})

describe('DiffView ailleurs : pas d’en-tête, rien ne change (fiche 203)', () => {
  it('« bare » (Modifications, plan) : aucun chemin affiché', () => {
    render(<DiffView path={`${WS}/a.md`} oldText="a" newText="b" bare />)
    expect(screen.queryByTestId('diff-path')).toBeNull()
  })

  it('sans dossier de conversation : chemin avec `~`, entier en infobulle', () => {
    render(<DiffView path="/Users/ada/projet/a.md" oldText="a" newText="b" />)
    const path = screen.getByTestId('diff-path')
    expect(path.textContent).toBe('~/projet/a.md')
    expect(path.getAttribute('title')).toBe('/Users/ada/projet/a.md')
  })
})

type ToolPermissionRisks = NonNullable<NonNullable<ToolItem['permission']>['risks']>

describe('Carte à risque (fiche 211)', () => {
  const withAlways = {
    requestId: 'p1',
    state: 'pending' as const,
    options: [
      { optionId: 'allow', name: 'Allow once', kind: 'allow_once' as const },
      { optionId: 'allow_always', name: 'Always allow', kind: 'allow_always' as const },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' as const }
    ]
  }
  /** Commande comme Bob 2.0.9 : le texte seul, sans emplacement. */
  const bob = (text: string, risks?: ToolPermissionRisks): ToolItem =>
    command({
      title: text,
      locations: [],
      command: { text },
      permission: { ...withAlways, ...(risks ? { risks } : {}) }
    })
  const kinds = () =>
    [...document.querySelectorAll('.pc-actions button')].map((b) => b.getAttribute('data-kind'))

  it('écriture hors du dossier : bandeau lu avant les boutons, pas de « Toujours », pas de note', () => {
    view(
      bob('echo hi > ~/.testcontainers.properties', [
        { kind: 'outside-folder', path: '~/.testcontainers.properties' }
      ])
    )
    const banner = screen.getByTestId('permission-risks')
    expect(banner.getAttribute('role')).toBe('note')
    expect(banner.textContent).toBe(
      `${i18next.t('toolCall.permission.risk.outside')} ~/.testcontainers.properties`
    )
    expect(kinds()).toEqual(['allow_once', 'reject_once'])
    expect(screen.queryByTestId('permission-agent-always-note')).toBeNull()
    const card = screen.getByTestId('permission')
    const order = [...card.querySelectorAll('[data-testid=permission-risks], .pc-actions')]
    expect(order.map((e) => e.className)).toEqual(['pc-risks', 'pc-actions'])
  })

  it('sudo et dossier système : une ligne chacun', () => {
    view(
      bob('sudo ln -sf a /var/run/docker.sock', [
        { kind: 'privilege', via: 'sudo' },
        { kind: 'system-path', path: '/var/run/docker.sock' }
      ])
    )
    const lines = [...screen.getByTestId('permission-risks').querySelectorAll('li')]
    expect(lines.map((l) => l.textContent)).toEqual([
      i18next.t('toolCall.permission.risk.privilege', { via: 'sudo' }),
      `${i18next.t('toolCall.permission.risk.system')} /var/run/docker.sock`
    ])
  })

  it('chemin aux caractères bidi : rendu visible dans le bandeau', () => {
    view(bob('touch x', [{ kind: 'outside-folder', path: '/tmp/‮txt.exe' }]))
    const banner = screen.getByTestId('permission-risks')
    expect(banner.textContent).not.toMatch(/[‪-‮⁦-⁩]/)
    expect(banner.textContent).toContain(visibleText('/tmp/‮txt.exe'))
  })

  it('carte ordinaire (commande) : « Toujours » offert, la note dit que l’agent décide', () => {
    view(bob('ls -la /var/run/docker.sock'))
    expect(screen.queryByTestId('permission-risks')).toBeNull()
    expect(kinds()).toEqual(['allow_once', 'allow_always', 'reject_once'])
    expect(screen.getByTestId('permission-agent-always-note').textContent).toBe(
      i18next.t('toolCall.permission.agentAlwaysNote')
    )
    expect(screen.queryByTestId('permission-remember-note')).toBeNull()
  })

  it('outil que l’app retient elle-même : sa note à elle, pas celle de l’agent', () => {
    view(
      command({
        title: 'Updating todo list',
        toolKind: 'other',
        command: undefined,
        locations: [],
        permission: withAlways
      })
    )
    expect(screen.getByTestId('permission-remember-note')).toBeTruthy()
    expect(screen.queryByTestId('permission-agent-always-note')).toBeNull()
  })

  it('sans « Toujours » offert par l’agent : aucune note', () => {
    view(command())
    expect(screen.queryByTestId('permission-agent-always-note')).toBeNull()
  })

  it('conversation enregistrée avant (sans `risks`) : la carte comme avant', () => {
    view(bob('echo hi > /tmp/x'))
    expect(screen.queryByTestId('permission-risks')).toBeNull()
    expect(kinds()).toContain('allow_always')
  })
})
