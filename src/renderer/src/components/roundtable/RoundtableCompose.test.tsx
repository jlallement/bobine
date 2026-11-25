/**
 * Tour de table dans la saisie (fiche 285, maquettes `lancement-*`, `premier-usage`,
 * `participants`, `fenetre-etroite`) : `/roundtable` et le bouton de la barre, la ligne (formes,
 * Entrée), le menu à cases (bornes, clavier), les refus du main qui gardent la question.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot } from '@shared/agent'
import type { RoundtableChoice } from '@shared/roundtable'
import type { RoundtableOptions, RoundtableStartResult } from '@shared/roundtable-ipc'
import css from '../../roundtable.css?raw'
import styles from '../../styles.css?raw'
import { Composer } from '../composer/Composer'
import { loadDraft, saveDraft } from '../../drafts'
import { requestRoundtableMenu } from './roundtable-menu-request'
import { options } from './test-fixtures'

vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const snapshot: AgentSnapshot = {
  status: 'ready',
  info: { profileId: 'agent-a', profileLabel: 'Agent A', workspace: '/tmp/projet' },
  controls: [],
  commands: [],
  promptCapabilities: { image: true, embeddedContext: true },
  queued: []
}

const deep: RoundtableChoice = {
  profileId: 'agent-a',
  model: { controlId: 'model', value: 'deep', name: 'vendor/DeepSeek V4.1 Flash' }
}
const glm: RoundtableChoice = {
  profileId: 'agent-a',
  model: { controlId: 'model', value: 'glm', name: 'GLM 5.3 Flash' }
}
const b: RoundtableChoice = { profileId: 'agent-b' }

const api = {
  options: vi.fn<(id: string) => Promise<RoundtableOptions>>(),
  start: vi.fn<(id: string, request: unknown) => Promise<RoundtableStartResult>>()
}
const recordSent = vi.fn<(id: string, entry: { text: string }) => Promise<void>>()
const saved = window.api

beforeEach(() => {
  // Brouillons d'un essai à l'autre (même conversation) : chacun part d'une saisie vide.
  saveDraft('conv-1', { text: '', attachments: [] })
  api.options.mockReset().mockResolvedValue(options())
  api.start.mockReset().mockResolvedValue({ ok: true, roundtableId: 'rt1' })
  recordSent.mockReset().mockResolvedValue(undefined)
  window.api = {
    ...saved,
    roundtable: api,
    conversations: { recordSent }
  } as unknown as typeof window.api
})
afterEach(() => {
  window.api = saved
})

function setup(
  participants: RoundtableChoice[] = [deep, glm, b],
  extra: Partial<ComponentProps<typeof Composer>> = {}
) {
  const setParticipants = vi.fn()
  const props = {
    onSend: vi.fn(),
    onAppCommand: vi.fn(),
    onSearchFiles: vi.fn(async () => []),
    onPickFiles: vi.fn(async () => []),
    onWarn: vi.fn(),
    onCancel: vi.fn(),
    onUnqueue: vi.fn(async () => undefined),
    onSendNow: vi.fn(),
    onRestart: vi.fn(),
    onConfigure: vi.fn(),
    onChooseWorkspace: vi.fn(),
    onSetControl: vi.fn(),
    onContinueInNew: vi.fn(),
    onAuthenticate: vi.fn(),
    onRetry: vi.fn(),
    onUseApiKey: vi.fn(async () => {}),
    onRunStep: vi.fn(),
    onTrustForSession: vi.fn(),
    onOpenTerminal: vi.fn()
  }
  const view = render(
    <Tooltip.Provider>
      <Composer
        snapshot={snapshot}
        settings={null}
        draftKey="conv-1"
        roundtable={{ participants, setParticipants }}
        {...props}
        {...extra}
      />
    </Tooltip.Provider>
  )
  const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
  const type = (value: string) => fireEvent.change(input, { target: { value } })
  const enter = () => fireEvent.keyDown(input, { key: 'Enter' })
  return { ...props, props, setParticipants, input, type, enter, view }
}

const line = () => screen.getByTestId('roundtable-line')
/** Espaces insécables de la typographie française ramenées à des espaces. */
const plain = (text: unknown) => String(text).replace(/[\u00a0\u202f]/g, ' ')

describe('lancement en deux gestes', () => {
  it('`/roundtable question` : étiquette et ligne, la question reste ; Entrée envoie', async () => {
    const t = setup()
    t.type('/roundtable Quelle file de tâches ?')
    expect(screen.getByTestId('roundtable-tag').textContent).toContain('Tour de table')
    expect(t.input.value).toBe('Quelle file de tâches ?')
    await waitFor(() => expect(api.options).toHaveBeenCalledWith('conv-1'))
    expect(within(line()).getByTestId('roundtable-participants').textContent).toContain(
      '3 participants'
    )
    expect(screen.getByTestId('roundtable-cost-full').textContent).toBe(
      '≈ 4 fois les jetons d’une question simple'
    )
    expect(line().textContent).toContain('+ synthèse')
    expect((screen.getByTestId('send') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => t.enter())
    expect(api.start).toHaveBeenCalledWith('conv-1', {
      question: 'Quelle file de tâches ?',
      participants: [deep, glm, b]
    })
    expect(t.onSend).not.toHaveBeenCalled()
    expect(t.input.value).toBe('')
    expect(screen.queryByTestId('roundtable-line')).toBeNull()
  })

  it('historique de la saisie : la question entre une seule fois, rappelée en tour de table', async () => {
    const t = setup()
    t.type('/roundtable Quelle file ?')
    await act(async () => t.enter())
    expect(api.start).toHaveBeenCalledTimes(1)
    expect(recordSent).toHaveBeenCalledTimes(1)
    expect(recordSent.mock.calls[0]?.[0]).toBe('conv-1')
    expect(recordSent.mock.calls[0]?.[1]).toMatchObject({ text: '/roundtable Quelle file ?' })
    // Refusé par le main : rien dans l'historique, la question reste.
    api.start.mockResolvedValueOnce({ ok: false, error: 'running' })
    t.type('/roundtable Encore ?')
    await act(async () => t.enter())
    expect(recordSent).toHaveBeenCalledTimes(1)
  })

  it('le bouton de la barre fait la même chose ; Échap ramène à une question simple', async () => {
    const t = setup()
    const toggle = screen.getByTestId('roundtable-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('roundtable-line')).toBeTruthy()
    t.type('Une question')
    fireEvent.keyDown(t.input, { key: 'Escape' })
    expect(screen.queryByTestId('roundtable-line')).toBeNull()
    expect(t.input.value).toBe('Une question')
    // Message ordinaire ensuite.
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('Une question', [])
    expect(api.start).not.toHaveBeenCalled()
  })

  it('✕ de la ligne ramène aussi à une question simple', () => {
    const t = setup()
    t.type('/roundtable x')
    fireEvent.click(screen.getByTestId('roundtable-close'))
    expect(screen.queryByTestId('roundtable-tag')).toBeNull()
    expect(t.input.value).toBe('x')
  })

  it('choisi dans le menu « / » : la commande est complétée, la saisie passe en tour de table', () => {
    const t = setup()
    t.type('/round')
    const item = screen
      .getAllByTestId('command-item')
      .find((el) => el.textContent?.includes('/roundtable'))
    expect(item?.textContent).toContain('Poser la question à plusieurs modèles')
    fireEvent.mouseDown(item as HTMLElement)
    expect(screen.getByTestId('roundtable-tag')).toBeTruthy()
    expect(t.input.value).toBe('')
  })

  it('`/roundtable` seul : l’app l’explique (rien n’est envoyé)', () => {
    const t = setup()
    t.type('/roundtable')
    // Menu « / » fermé (Entrée y compléterait la commande) : la commande seule part à l'app.
    fireEvent.keyDown(t.input, { key: 'Escape' })
    t.enter()
    expect(t.onAppCommand).toHaveBeenCalledWith('roundtable', '')
    expect(api.start).not.toHaveBeenCalled()
  })

  it('pas de tour de table sans participants retenus prévus par l’app, ni en Discussion', () => {
    setup([], { discussion: true })
    expect(screen.queryByTestId('roundtable-toggle')).toBeNull()
  })

  it('les deux formes du surcoût : la courte en saisie étroite, avec le mot « jetons »', async () => {
    const t = setup([deep, b])
    t.type('/roundtable q')
    await waitFor(() => expect(api.options).toHaveBeenCalled())
    expect(screen.getByTestId('roundtable-cost-full').textContent).toContain('3 fois les jetons')
    expect(screen.getByTestId('roundtable-cost-short').textContent).toBe('≈ 3 fois plus de jetons')
    // La feuille de style : sous 560 px de saisie, la forme courte remplace la longue, sans coupe.
    expect(css).toMatch(
      /@container \(max-width: 560px\) \{\s*\.roundtable-cost-full \{\s*display: none;\s*\}\s*\.roundtable-cost-short \{\s*display: inline;/
    )
    expect(css).toMatch(/\.roundtable-line \{[^}]*white-space: nowrap;/)
    expect(css).not.toMatch(/\.roundtable-line[^{]*\{[^}]*text-overflow: ellipsis/)
  })
})

describe('premier usage et menu des participants', () => {
  it('sans participants : « Choisir les participants », Entrée ouvre le menu', async () => {
    const t = setup([])
    t.type('/roundtable Question')
    expect(line().textContent).toContain('Choisir les participants')
    expect(line().textContent).toContain('2 à 5 modèles')
    expect((screen.getByTestId('send') as HTMLButtonElement).disabled).toBe(true)
    t.enter()
    await screen.findByTestId('roundtable-menu')
    expect(api.start).not.toHaveBeenCalled()
    expect(t.input.value).toBe('Question')
  })

  it('M13 : un seul participant coché, « 1 participant · il en faut au moins 2 »', async () => {
    const t = setup([deep])
    t.type('/roundtable Q')
    expect(within(line()).getByTestId('roundtable-participants').textContent).toContain(
      '1 participant'
    )
    expect(screen.getByTestId('roundtable-choose-hint').textContent).toBe('il en faut au moins 2')
    t.enter()
    expect(await screen.findByTestId('roundtable-menu')).toBeTruthy()
    expect(api.start).not.toHaveBeenCalled()
  })

  it('chaque case est retenue aussitôt ; dès deux, la ligne est prête et Entrée envoie', async () => {
    const t = setup([])
    t.type('/roundtable Question')
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const menu = await screen.findByTestId('roundtable-menu')
    await waitFor(() => expect(within(menu).getAllByTestId('roundtable-option')).toHaveLength(3))
    const option = (name: string) =>
      within(menu)
        .getAllByTestId('roundtable-option')
        .find((o) => o.textContent?.includes(name)) as HTMLElement
    fireEvent.click(option('DeepSeek'))
    expect(t.setParticipants).toHaveBeenLastCalledWith([deep])
    fireEvent.click(option('Agent B'))
    expect(t.setParticipants).toHaveBeenLastCalledWith([deep, b])
    expect(option('Agent B').getAttribute('aria-selected')).toBe('true')
    // Un agent sans choix de modèle tient sur une ligne : son nom n'est pas répété.
    expect(option('Agent B').querySelector('.roundtable-option-agent')).toBeNull()
    expect(option('GLM').querySelector('.roundtable-option-agent')?.textContent).toBe('Agent A')
    expect(line().textContent).toContain('2 participants')
    expect(screen.getByTestId('roundtable-cost-full').textContent).toContain('3 fois')
    // Aucune mention de gratuité, de prix ni de plafond dans le menu.
    expect(menu.textContent).not.toMatch(/gratuit|prix|plafond|\$/i)
    expect(menu.textContent).toContain(
      'Chacun reçoit la question et peut lire les fichiers de ce dossier.'
    )
  })

  it('clavier : liste à choix multiples, ↑ ↓ et Espace, Échap ferme', async () => {
    setup([deep])
    fireEvent.click(screen.getByTestId('roundtable-toggle'))
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const list = await screen.findByTestId('roundtable-menu-list')
    await waitFor(() => expect(within(list).getAllByRole('option')).toHaveLength(3))
    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.getAttribute('aria-multiselectable')).toBe('true')
    expect(document.activeElement).toBe(list)
    const options = within(list).getAllByRole('option')
    expect(list.getAttribute('aria-activedescendant')).toBe(options[0]?.id)
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(list.getAttribute('aria-activedescendant')).toBe(options[1]?.id)
    fireEvent.keyDown(list, { key: ' ' })
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'End' })
    expect(list.getAttribute('aria-activedescendant')).toBe(options[2]?.id)
    fireEvent.keyDown(list, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('roundtable-menu')).toBeNull())
  })

  it('5 participants au plus : les autres cases désactivées, avec la raison', async () => {
    const other = (value: string, name: string): RoundtableChoice => ({
      profileId: 'agent-a',
      model: { controlId: 'model', value, name }
    })
    const five = [deep, glm, b, other('mimo', 'MiMo v2.6 Flash'), other('nemo', 'Nemotron')]
    const t = setup(five)
    fireEvent.click(screen.getByTestId('roundtable-toggle'))
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const menu = await screen.findByTestId('roundtable-menu')
    await waitFor(() => expect(within(menu).getAllByRole('option')).toHaveLength(5))
    fireEvent.click(within(menu).getByTestId('roundtable-others'))
    const qwen = await within(menu).findByText('Qwen3 32B')
    const option = qwen.closest('[role=option]') as HTMLElement
    expect(option.getAttribute('aria-disabled')).toBe('true')
    expect(option.getAttribute('title')).toBe('5 participants au plus')
    fireEvent.click(option)
    expect(t.setParticipants).not.toHaveBeenCalled()
  })

  it('« Autres modèles… » : une recherche sans casse ni accents', async () => {
    setup([deep, b])
    fireEvent.click(screen.getByTestId('roundtable-toggle'))
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const menu = await screen.findByTestId('roundtable-menu')
    await waitFor(() => expect(within(menu).getAllByRole('option')).toHaveLength(3))
    fireEvent.click(within(menu).getByTestId('roundtable-others'))
    const search = await within(menu).findByTestId('roundtable-search')
    fireEvent.change(search, { target: { value: 'NEMO' } })
    expect(
      within(menu)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toContain('Nemotron 3.5 SuperAgent A')
    expect(within(menu).queryByText('MiMo v2.6 Flash')).toBeNull()
  })

  it('« Choisir un autre modèle » d’une carte : la saisie passe en tour de table, menu ouvert', async () => {
    setup()
    act(() => requestRoundtableMenu())
    expect(await screen.findByTestId('roundtable-menu')).toBeTruthy()
    expect(screen.getByTestId('roundtable-tag')).toBeTruthy()
  })
})

describe('relecture : clavier, focus, envoi lent, brouillon, Discussion', () => {
  const openMenu = async () => {
    fireEvent.click(screen.getByTestId('roundtable-toggle'))
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const menu = await screen.findByTestId('roundtable-menu')
    await waitFor(() => expect(within(menu).getAllByRole('option').length).toBeGreaterThan(0))
    return menu
  }

  it('« Autres modèles… » au clavier : Entrée ouvre la recherche, ne coche rien', async () => {
    const t = setup([deep, b])
    const menu = await openMenu()
    const others = within(menu).getByTestId('roundtable-others')
    fireEvent.keyDown(others, { key: 'Enter' })
    fireEvent.keyDown(others, { key: ' ' })
    expect(t.setParticipants).not.toHaveBeenCalled()
    // Le bouton reçoit son clic natif (Entrée, Espace) : la recherche s'ouvre.
    fireEvent.click(others)
    expect(await within(menu).findByTestId('roundtable-search')).toBeTruthy()
  })

  it('la liste ne contient que des options', async () => {
    setup([deep, b])
    const menu = await openMenu()
    fireEvent.click(within(menu).getByTestId('roundtable-others'))
    fireEvent.change(await within(menu).findByTestId('roundtable-search'), {
      target: { value: 'rien du tout' }
    })
    const list = within(menu).getByRole('listbox')
    expect([...list.children].every((c) => c.getAttribute('role') === 'option')).toBe(true)
    expect(within(menu).getByTestId('roundtable-none')).toBeTruthy()
  })

  it('Échap dans le menu : le focus revient à la saisie, Entrée envoie ensuite', async () => {
    const t = setup()
    t.type('/roundtable Q')
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const list = await screen.findByTestId('roundtable-menu-list')
    fireEvent.keyDown(list, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('roundtable-menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(t.input))
  })

  it('texte tapé pendant un envoi lent : gardé ; seule la question partie quitte la saisie', async () => {
    let release = () => {}
    api.start.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({ ok: true, roundtableId: 'rt1' })))
    )
    const t = setup()
    t.type('/roundtable Première')
    act(() => t.enter())
    t.type('Première, puis une suite tapée pendant l’envoi')
    await act(async () => release())
    expect(t.input.value).toBe('Première, puis une suite tapée pendant l’envoi')
  })

  it('« Choisir un autre modèle » sans tour possible ici : rien ne s’arme', () => {
    setup([deep, b], { discussion: true })
    act(() => requestRoundtableMenu())
    expect(screen.queryByTestId('roundtable-menu')).toBeNull()
    expect(screen.queryByTestId('roundtable-tag')).toBeNull()
  })

  it('Discussion : la commande n’est pas proposée dans le menu « / »', () => {
    const t = setup([deep, b], { discussion: true })
    t.type('/round')
    const names = screen.queryAllByTestId('command-item').map((el) => el.textContent ?? '')
    expect(names.some((n) => n.includes('/roundtable'))).toBe(false)
  })

  it('brouillon : le mode tour de table est retrouvé en revenant dans la conversation', () => {
    const first = setup()
    first.type('/roundtable À reprendre')
    first.view.unmount()
    const again = setup()
    expect(again.input.value).toBe('À reprendre')
    expect(screen.getByTestId('roundtable-tag')).toBeTruthy()
  })

  it('N3 : brouillon `/roundtable …` en Discussion : le préfixe reste dans le texte', () => {
    saveDraft('conv-1', { text: '/roundtable Garder', attachments: [] })
    const t = setup([deep, b], { discussion: true })
    expect(t.input.value).toBe('/roundtable Garder')
    expect(screen.queryByTestId('roundtable-tag')).toBeNull()
    expect(loadDraft('conv-1').text).toBe('/roundtable Garder')
  })

  it('N3 : l’agent a sa commande `/roundtable` : son brouillon reste à lui, préfixe compris', () => {
    saveDraft('conv-1', { text: '/roundtable Garder', attachments: [] })
    const t = setup([deep, b], {
      snapshot: { ...snapshot, commands: [{ name: 'roundtable', description: 'de l’agent' }] }
    })
    expect(t.input.value).toBe('/roundtable Garder')
    expect(screen.queryByTestId('roundtable-tag')).toBeNull()
    expect(loadDraft('conv-1').text).toBe('/roundtable Garder')
  })

  it('N3 : réglages du tour pas encore lus au montage : le brouillon est repris dès qu’ils le sont', () => {
    saveDraft('conv-1', { text: '/roundtable Reprendre', attachments: [] })
    const t = setup([deep, b], { roundtable: undefined })
    expect(t.input.value).toBe('/roundtable Reprendre')
    t.view.rerender(
      <Tooltip.Provider>
        <Composer
          snapshot={snapshot}
          settings={null}
          draftKey="conv-1"
          roundtable={{ participants: [deep, b], setParticipants: vi.fn() }}
          {...t.props}
        />
      </Tooltip.Provider>
    )
    expect(t.input.value).toBe('Reprendre')
    expect(screen.getByTestId('roundtable-tag')).toBeTruthy()
    expect(loadDraft('conv-1').text).toBe('/roundtable Reprendre')
  })

  it('lectures d’options concurrentes : seule la dernière réponse compte', async () => {
    let first: (o: RoundtableOptions) => void = () => {}
    api.options.mockResolvedValue(options({ freeSlots: 1 }))
    api.options.mockImplementationOnce(() => new Promise((resolve) => (first = resolve)))
    const t = setup()
    t.type('/roundtable Q')
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    await screen.findByTestId('roundtable-slots')
    // La première lecture (dépassée) arrive après : elle n'efface rien.
    await act(async () => first(options()))
    expect(screen.getByTestId('roundtable-slots')).toBeTruthy()
  })
})

describe('revue UX : saisie et menu', () => {
  const openMenu = async () => {
    fireEvent.click(screen.getByTestId('roundtable-participants'))
    const menu = await screen.findByTestId('roundtable-menu')
    await waitFor(() => expect(within(menu).getAllByRole('option').length).toBeGreaterThan(0))
    return menu
  }
  const names = (menu: HTMLElement) =>
    within(menu)
      .getAllByRole('option')
      .map((o) => o.querySelector('.roundtable-option-name')?.textContent)

  it('A2 : l’ordre des cases ne change pas pendant que le menu est ouvert', async () => {
    const t = setup([deep, b])
    t.type('/roundtable Q')
    const menu = await openMenu()
    fireEvent.click(within(menu).getByTestId('roundtable-others'))
    await within(menu).findByTestId('roundtable-search')
    const before = names(menu)
    const qwen = within(menu)
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('Qwen')) as HTMLElement
    fireEvent.click(qwen)
    expect(names(menu)).toEqual(before)
  })

  it('A2 : la recherche filtre toute la liste', async () => {
    const t = setup([deep, b])
    t.type('/roundtable Q')
    const menu = await openMenu()
    fireEvent.click(within(menu).getByTestId('roundtable-others'))
    fireEvent.change(await within(menu).findByTestId('roundtable-search'), {
      target: { value: 'flash' }
    })
    expect(names(menu)).toEqual(['DeepSeek V4.1 Flash', 'GLM 5.3 Flash', 'MiMo v2.6 Flash'])
  })

  it('B16 : les participants partent dans l’ordre des cases, pas des clics', async () => {
    const t = setup([b, glm, deep])
    t.type('/roundtable Q')
    await waitFor(() => expect(api.options).toHaveBeenCalled())
    await act(async () => t.enter())
    expect(api.start.mock.calls[0]?.[1]).toMatchObject({ participants: [deep, glm, b] })
  })

  it('B10 : Échap ferme le menu ; un second Échap aussitôt ne retire pas le mode', async () => {
    const t = setup()
    t.type('/roundtable Q')
    const menu = await openMenu()
    fireEvent.keyDown(within(menu).getByRole('listbox'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('roundtable-menu')).toBeNull())
    fireEvent.keyDown(t.input, { key: 'Escape' })
    expect(screen.getByTestId('roundtable-line')).toBeTruthy()
  })

  it('B11 : un tour en cours, le bouton de la barre et `/roundtable` désactivés', () => {
    const t = setup([deep, b], {
      roundtable: { participants: [deep, b], setParticipants: vi.fn(), running: true }
    })
    const toggle = screen.getByTestId('roundtable-toggle')
    expect(toggle.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('roundtable-line')).toBeNull()
    t.type('/roundtable Q')
    expect(screen.queryByTestId('roundtable-line')).toBeNull()
    t.type('/round')
    const items = screen.queryAllByTestId('command-item').map((el) => el.textContent ?? '')
    expect(items.some((n) => n.includes('/roundtable'))).toBe(false)
  })

  it('A1 : « 4 ▾ » en saisie très étroite, le nom entier pour le lecteur d’écran', () => {
    const t = setup([deep, glm, b])
    t.type('/roundtable Q')
    const pick = screen.getByTestId('roundtable-participants')
    expect(pick.getAttribute('aria-label')).toBe('3 participants')
    expect(pick.querySelector('.roundtable-pick-short')?.textContent).toBe('3')
    expect(css).toMatch(
      /@container \(max-width: 420px\) \{\s*\.roundtable-pick-full \{\s*display: none;/
    )
  })
})

describe('ce qui empêche le départ, dit clairement, la question gardée', () => {
  it.each([
    [
      { ok: false, error: 'selection', problem: 'duplicate' },
      'Ce modèle est déjà parmi les participants.'
    ],
    [
      { ok: false, error: 'slots', missing: 2 },
      'Il manque 2 places de travaux : rien n’est parti.'
    ],
    [{ ok: false, error: 'running' }, 'Un tour de table est déjà en cours dans cette conversation'],
    [{ ok: false, error: 'task' }, 'Pas de tour de table depuis un travail'],
    [{ ok: false, error: 'archived' }, 'Cette conversation est archivée'],
    [{ ok: false, error: 'discussion' }, 'Le tour de table se lance dans un projet']
  ] as [RoundtableStartResult, string][])('refus %o', async (result, text) => {
    api.start.mockResolvedValue(result)
    const t = setup()
    t.type('/roundtable Ma question')
    await act(async () => t.enter())
    expect(plain(screen.getByTestId('roundtable-refusal').textContent)).toContain(text)
    expect(plain(screen.getByRole('alert').textContent)).toContain(text)
    expect(t.input.value).toBe('Ma question')
    expect(screen.getByTestId('roundtable-tag')).toBeTruthy()
  })

  it('question trop longue : dit avant l’envoi, rien ne part, la question gardée', async () => {
    const t = setup()
    const long = 'x'.repeat(8_001)
    t.type(`/roundtable ${long}`)
    expect((await screen.findByTestId('roundtable-too-long')).textContent).toContain(
      'La question dépasse 8 000 caractères'
    )
    expect((screen.getByTestId('send') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => t.enter())
    expect(api.start).not.toHaveBeenCalled()
    expect(t.input.value).toBe(long)
    // Raccourcie : la ligne redevient prête.
    t.type('Courte ?')
    expect(screen.queryByTestId('roundtable-too-long')).toBeNull()
  })

  it('refus « question » du main : dit, la question gardée', async () => {
    api.start.mockResolvedValue({ ok: false, error: 'question' })
    const t = setup()
    t.type('/roundtable Ma question')
    await act(async () => t.enter())
    expect(screen.getByTestId('roundtable-refusal').textContent).toContain('raccourcissez-la')
    expect(t.input.value).toBe('Ma question')
  })

  it('erreur du canal : dite, la question gardée', async () => {
    api.start.mockRejectedValue(new Error('Le tour de table n’est pas encore disponible.'))
    const t = setup()
    t.type('/roundtable Ma question')
    await act(async () => t.enter())
    expect(screen.getByTestId('roundtable-refusal').textContent).toContain('pas encore disponible')
    expect(t.input.value).toBe('Ma question')
  })

  it('refus connu d’avance (depuis un travail) : la ligne le dit, Entrée ne fait rien', async () => {
    api.options.mockResolvedValue(options({ refused: 'task' }))
    const t = setup()
    t.type('/roundtable Q')
    await screen.findByTestId('roundtable-refused')
    expect(line().textContent).toContain('Pas de tour de table depuis un travail')
    await act(async () => t.enter())
    expect(api.start).not.toHaveBeenCalled()
    expect((screen.getByTestId('send') as HTMLButtonElement).disabled).toBe(true)
  })

  it('refus lu plus tôt (tour fini depuis) : relu à Entrée, le tour part', async () => {
    api.options.mockResolvedValue(options({ refused: 'running' }))
    const t = setup()
    t.type('/roundtable Q')
    await screen.findByTestId('roundtable-refused')
    api.options.mockResolvedValue(options())
    await act(async () => t.enter())
    expect(api.start).toHaveBeenCalledTimes(1)
  })

  it('places manquantes : la ligne le dit à la place du surcoût, avec « Réglages »', async () => {
    api.options.mockResolvedValue(options({ freeSlots: 1 }))
    const t = setup()
    t.type('/roundtable Q')
    const slots = await screen.findByTestId('roundtable-slots')
    expect(slots.textContent).toContain('Il manque 2 places de travaux')
    expect(within(slots).getByTestId('roundtable-slots-settings').textContent).toBe('Réglages')
    expect(screen.queryByTestId('roundtable-cost')).toBeNull()
    await act(async () => t.enter())
    expect(api.start).not.toHaveBeenCalled()
  })

  it('participant devenu indisponible : nommé, Entrée ouvre le menu', async () => {
    const opts = options()
    opts.agents = opts.agents.map((a) =>
      a.profileId === 'agent-b' ? { ...a, available: false, reason: 'Non installé' } : a
    )
    api.options.mockResolvedValue(opts)
    const t = setup()
    t.type('/roundtable Q')
    const note = await screen.findByTestId('roundtable-unavailable')
    expect(note.textContent).toContain('Agent B n’est plus disponible')
    t.enter()
    expect(await screen.findByTestId('roundtable-menu')).toBeTruthy()
    expect(api.start).not.toHaveBeenCalled()
  })
})

describe('barre de saisie repliée (GitHub, Linux à 760 px)', () => {
  it('au niveau 4, le bouton du tour de table passe dans le menu de 📎, comme les réglages', async () => {
    const callbacks: (() => void)[] = []
    const notify = () => callbacks.forEach((c) => c())
    const original = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        callbacks.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    try {
      setup([deep, b], { onCaptureScreen: vi.fn() })
      const bar = screen.getByTestId('composer-bar')
      // Ne tient qu'au niveau 4 (le CSS y cache le bouton : sa largeur ne compte plus).
      Object.defineProperty(bar, 'clientWidth', { configurable: true, get: () => 600 })
      Object.defineProperty(bar, 'scrollWidth', {
        configurable: true,
        get: () => (bar.dataset.fold === '4' ? 580 : 700)
      })
      act(() => notify())
      await waitFor(() => expect(bar.dataset.fold).toBe('4'))
      expect(
        screen.getByTestId('roundtable-toggle').closest('.roundtable-toggle-slot')
      ).toBeTruthy()
      fireEvent.pointerDown(screen.getByTestId('attach'), { button: 0, ctrlKey: false })
      const item = await screen.findByTestId('attach-roundtable')
      fireEvent.click(item)
      await waitFor(() => expect(screen.getByTestId('roundtable-tag')).toBeTruthy())
    } finally {
      globalThis.ResizeObserver = original
    }
  })

  it('le CSS cache le bouton à sa place aux niveaux 4 et 5, comme les réglages de la session', () => {
    expect(styles).toMatch(
      /:is\(\[data-fold='4'\], \[data-fold='5'\]\) > \.roundtable-toggle-slot\s*\{\s*display: none;/
    )
  })
})
