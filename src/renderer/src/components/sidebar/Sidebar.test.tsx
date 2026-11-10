import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionDetails, AttentionState } from '@shared/attention'
import type { ChildLaunch } from '@shared/children'
import { Sidebar } from './Sidebar'
import { SIDEBAR_WIDTH_KEY } from './sidebar-width'

const conversation = (id: string, change: Partial<ConversationSummary> = {}) =>
  ({
    id,
    title: `Conversation ${id}`,
    profileId: 'mock',
    profileLabel: 'Agent factice',
    workspace: '/projet',
    updatedAt: '2026-10-20T18:00:00.000Z',
    status: 'stopped',
    draft: false,
    ...change
  }) satisfies ConversationSummary

function sidebar(
  conversations: ConversationSummary[],
  extra: {
    attention?: AttentionState
    details?: AttentionDetails
    launches?: ChildLaunch[]
    launchRows?: Record<string, string>
    activeId?: string
    activityOpen?: boolean
    onActivity?: () => void
    scheduledOpen?: boolean
    onScheduled?: () => void
    onSearch?: () => void
    onSelect?: (id: string) => void
    onLaunchChild?: (c: ConversationSummary) => void
  } = {}
) {
  return (
    <Tooltip.Provider>
      <Sidebar
        open
        onToggle={vi.fn()}
        conversations={conversations}
        activeId={extra.activeId ?? null}
        attention={extra.attention ?? {}}
        attentionDetails={extra.details ?? {}}
        childLaunches={extra.launches ?? []}
        childLaunchRows={extra.launchRows ?? {}}
        {...(extra.onLaunchChild ? { onLaunchChild: extra.onLaunchChild } : {})}
        activityOpen={extra.activityOpen ?? false}
        onActivity={extra.onActivity ?? vi.fn()}
        scheduledOpen={extra.scheduledOpen ?? false}
        onScheduled={extra.onScheduled ?? vi.fn()}
        notifications={false}
        onNotificationsChange={vi.fn()}
        onOpenNotificationSettings={vi.fn()}
        onOpenSettings={vi.fn()}
        snapshot={null}
        onNew={vi.fn()}
        onSelect={extra.onSelect ?? vi.fn()}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        onOpenBeside={vi.fn()}
        onPin={vi.fn()}
        onArchive={vi.fn()}
        onExport={vi.fn()}
        onSearch={extra.onSearch ?? vi.fn()}
        onResumeSession={vi.fn()}
      />
    </Tooltip.Provider>
  )
}

beforeEach(() => localStorage.clear())

/** Identifiants des lignes, dans l'ordre affiché ; `↳` devant une fille sous sa mère. */
const shown = () =>
  screen
    .queryAllByTestId('history-item')
    .map((row) => `${row.classList.contains('nested') ? '↳' : ''}${row.dataset.id}`)
    .join(' ')

/** Lire l'infobulle accessible réelle, sans conserver le title qui déclenchait une autre bulle. */
async function rowTip(id: string): Promise<string> {
  const button = document.querySelector(`[data-id="${id}"] .history-open`)
  if (!button) throw new Error(`Ligne absente : ${id}`)
  expect(button.closest('[title]')).toBeNull()
  expect(button.querySelector('[title], title')).toBeNull()
  fireEvent.focus(button)
  const tooltip = await screen.findByRole('tooltip')
  expect(screen.getAllByRole('tooltip')).toHaveLength(1)
  expect(button.getAttribute('aria-describedby')).toBe(tooltip.id)
  const text = tooltip.textContent ?? ''
  fireEvent.blur(button)
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
  return text
}

describe('liste des conversations (fiche 095)', () => {
  const a = conversation('a')
  const b = conversation('b')
  const c = conversation('c')

  it('ne bouge pas sous le pointeur ; réordonne à la sortie', () => {
    const view = render(sidebar([a, b, c]))
    fireEvent.pointerOver(screen.getAllByTestId('history-item')[1] ?? document.body)
    // « c » vient d'avoir de l'activité : le main la remonte en tête.
    view.rerender(sidebar([c, a, b]))
    expect(shown()).toBe('a b c')
    // Une conversation nouvelle pendant ce temps : en fin de liste, rien ne se décale.
    view.rerender(sidebar([conversation('d'), c, a, b]))
    expect(shown()).toBe('a b c d')
    fireEvent.pointerOver(screen.getByTestId('new-conversation'))
    expect(shown()).toBe('d c a b')
  })

  it('se réordonne aussi quand le pointeur quitte la fenêtre', () => {
    const view = render(sidebar([a, b, c]))
    const row = screen.getAllByTestId('history-item')[0] ?? document.body
    fireEvent.pointerOver(row)
    view.rerender(sidebar([c, a, b]))
    expect(shown()).toBe('a b c')
    fireEvent.pointerOut(row, { relatedTarget: null })
    expect(shown()).toBe('c a b')
  })

  it('reste figée tant qu’un menu de la liste est ouvert', () => {
    const view = render(sidebar([a, b, c]))
    const more = screen.getAllByTestId('history-more')[1]
    if (!more) throw new Error('menu absent')
    fireEvent.keyDown(more, { key: 'Enter' })
    expect(screen.getByTestId('history-pin')).toBeTruthy()
    view.rerender(sidebar([c, a, b]))
    expect(shown()).toBe('a b c')
    fireEvent.keyDown(screen.getByTestId('history-pin'), { key: 'Escape' })
    expect(shown()).toBe('c a b')
  })

  it('un menu refermé hors de la liste ne la laisse pas figée', () => {
    const view = render(sidebar([a, b, c]))
    const more = screen.getAllByTestId('history-more')[0]
    if (!more) throw new Error('menu absent')
    fireEvent.pointerOver(more)
    fireEvent.keyDown(more, { key: 'Enter' })
    // Le menu est à côté de la liste (portail) : le pointeur y va, choisit, le menu disparaît.
    const pin = screen.getByTestId('history-pin')
    fireEvent.pointerOver(pin)
    fireEvent.click(pin)
    expect(screen.queryByTestId('history-pin')).toBeNull()
    view.rerender(sidebar([c, a, b]))
    fireEvent.pointerOver(document.body)
    expect(shown()).toBe('c a b')
  })

  it('une branche garde sa place, sans flèche ; son origine dans l’infobulle (fiche 131)', async () => {
    const branch = conversation('br', {
      title: 'Conversation a · branche',
      branchedFrom: { id: 'a', title: 'Ancien titre' }
    })
    const orphan = conversation('or', { branchedFrom: { id: 'supprimee', title: 'Supprimée' } })
    render(sidebar([branch, b, a, orphan]))
    expect(shown()).toBe('br b a or')
    // Titre actuel de l'original s'il est dans la liste, sinon celui retenu à la création.
    expect(await rowTip('br')).toContain('Branche de «\u00a0Conversation a\u00a0»')
    expect(await rowTip('or')).toContain('Branche de «\u00a0Supprimée\u00a0»')
    expect(document.querySelector('.row-slot')).toBeNull()
  })

  it('branche et original distinguables : repère visible, titre complet en infobulle (fiche 125)', async () => {
    const branch = conversation('br', {
      title: 'Conversation a · branche',
      branchedFrom: { id: 'a', title: 'Conversation a' }
    })
    render(sidebar([branch, a]))
    const row = document.querySelector('[data-id=br]')
    // Le titre sans sa marque, puis le repère, qui ne se coupe jamais.
    expect(row?.querySelector('.label')?.textContent).toBe('Conversation a')
    expect(row?.querySelector('[data-testid=history-branch-tag]')?.textContent).toBe('')
    expect(row?.querySelector('[data-testid=history-branch-tag] svg')).toBeTruthy()
    const tip = await rowTip('br')
    expect(tip.split('\n')).toEqual([
      'Conversation a · branche',
      'Branche de «\u00a0Conversation a\u00a0»',
      '/projet'
    ])
    // L'original n'a pas de repère.
    expect(document.querySelector('[data-id=a] [data-testid=history-branch-tag]')).toBeNull()
  })
})

describe('titres au bord (fiche 131)', () => {
  it('plus de colonne d’icône vide : seule une fille sous sa mère en a une, avec son lien', async () => {
    render(
      sidebar(
        [
          conversation('a'),
          conversation('w', { branch: 'bobine/w', project: '/projet' }),
          conversation('br', { branchedFrom: { id: 'a', title: 'Conversation a' } }),
          conversation('f', { startedFrom: { id: 'a', title: 'Conversation a' } }),
          conversation('q')
        ],
        {
          attention: { q: 'request' },
          details: { q: { reason: 'question', detail: 'OAuth ?', since: Date.now() } }
        }
      )
    )
    expect(shown()).toBe('a ↳f w br q')
    const slots = [...document.querySelectorAll('.row-slot')].map(
      (slot) => slot.closest<HTMLElement>('[data-testid=history-item]')?.dataset.id
    )
    expect(slots).toEqual(['f'])
    expect(document.querySelectorAll('[data-id=f] [data-testid=child-link]')).toHaveLength(1)
    // Plus de flèche ↳ ni d'icône git dans la liste ; la branche du worktree est dans l'infobulle.
    expect(screen.queryByTestId('history-branch-of')).toBeNull()
    expect(screen.queryByTestId('history-branch')).toBeNull()
    expect(await rowTip('w')).toContain('Worktree bobine/w')
    // La raison est en infobulle, l'icône à droite du titre ; aucune seconde ligne.
    const state = document.querySelector('[data-id=q] .row-meta .child-state')
    expect(state?.getAttribute('data-reason')).toBe('question')
    expect(document.querySelector('[data-testid=inbox-line]')).toBeNull()
    expect(document.querySelector('[data-id=q] .history-open')?.firstElementChild?.className).toBe(
      'row-main'
    )
  })

  it('lien des filles : la première part sous la mère, la dernière s’arrête au coude', () => {
    const child = (id: string) => conversation(id, { startedFrom: { id: 'm', title: 'Mère' } })
    render(sidebar([conversation('m'), child('f1'), child('f2'), child('f3')]))
    const trunk = (id: string) =>
      document.querySelector(`[data-id=${id}] [data-testid=child-link] path`)?.getAttribute('d')
    expect(trunk('f1')).toMatch(/^M8 4 L8 32/)
    expect(trunk('f2')).toMatch(/^M8 0 L8 32/)
    expect(trunk('f3')).toMatch(/^M8 0 L8 10 Q/)
  })

  it('à droite : roue, coche verte d’une fille finie (le mot pour les lecteurs), sinon le jour', async () => {
    const old = new Date(Date.now() - 3 * 86_400_000).toISOString()
    render(
      sidebar([
        conversation('m', { status: 'busy', updatedAt: new Date().toISOString() }),
        conversation('f', { startedFrom: { id: 'm', title: 'Mère' } }),
        conversation('v', { updatedAt: old }),
        conversation('t', { updatedAt: new Date().toISOString() })
      ])
    )
    expect(document.querySelector('[data-id=m] .row-meta .spin')).toBeTruthy()
    const done = document.querySelector('[data-id=f] .child-state')
    expect(done?.getAttribute('data-state')).toBe('done')
    expect(done?.getAttribute('aria-label')).toBe('Finie')
    expect(await rowTip('f')).toContain(': Finie')
    expect(document.querySelector('[data-id=v] [data-testid=history-day]')?.textContent).not.toBe(
      ''
    )
    expect(document.querySelector('[data-id=t] [data-testid=history-day]')).toBeNull()
    // « Nouvelle conversation » et « Mon activité » gardent leur pastille.
    for (const id of ['new-conversation', 'open-activity']) {
      expect(screen.getByTestId(id).firstElementChild?.classList.contains('icon-badge')).toBe(true)
    }
  })
})

describe('sections (fiche 131)', () => {
  const now = Date.now()
  const sections = () =>
    [...document.querySelectorAll<HTMLElement>('[data-section]')].map((s) => s.dataset.section)
  const toggle = (id: string) => fireEvent.click(screen.getByTestId(id))

  it('dans l’ordre : Épinglées, Récents, Archivées (repliée) ; vides absentes', () => {
    const list = [
      conversation('a', { archived: true }),
      conversation('p', { pinned: true }),
      conversation('r'),
      conversation('q')
    ]
    const view = render(
      sidebar(list, {
        attention: { q: 'request' },
        details: { q: { reason: 'permission', detail: 'écrire', since: now } }
      })
    )
    expect(sections()).toEqual(['pinned', 'history', 'archived'])
    // Archivées : repliée par défaut, sans compteur ; l'ancienne section d'attention est absente.
    expect(screen.getByTestId('history-archived-toggle').getAttribute('aria-expanded')).toBe(
      'false'
    )
    expect(screen.getByTestId('history-archived-toggle').textContent).toBe('Archivées')
    expect(document.querySelector('[data-section=archived] [data-testid=history-item]')).toBeNull()
    expect(document.querySelector('[data-section=inbox]')).toBeNull()
    view.rerender(sidebar([conversation('r')]))
    expect(sections()).toEqual(['history'])
  })

  it('chaque section se replie, et le reste au redémarrage', () => {
    const list = [
      conversation('p', { pinned: true }),
      conversation('r'),
      conversation('a', {
        archived: true
      })
    ]
    const view = render(sidebar(list))
    toggle('section-toggle-pinned')
    toggle('section-toggle-history')
    toggle('history-archived-toggle')
    expect(shown()).toBe('a')
    view.unmount()
    render(sidebar(list))
    expect(shown()).toBe('a')
    expect(screen.getByTestId('section-toggle-history').getAttribute('aria-expanded')).toBe('false')
  })

  it('un état qui change ne déplace pas la conversation et garde le repli choisi', () => {
    const list = [conversation('p', { pinned: true }), conversation('r')]
    const view = render(sidebar(list))
    toggle('section-toggle-pinned')
    toggle('section-toggle-history')
    expect(shown()).toBe('')
    view.rerender(
      sidebar(list, {
        attention: { p: 'request', r: 'done' },
        details: {
          p: { reason: 'permission', detail: 'écrire', since: now },
          r: { reason: 'done', since: now }
        }
      })
    )
    expect(shown()).toBe('')
    toggle('section-toggle-pinned')
    toggle('section-toggle-history')
    expect(shown()).toBe('p r')
    expect(screen.queryByTestId('inbox-head')).toBeNull()
  })

  it('un filet sous la zone du haut, seulement quand la liste a défilé', () => {
    render(sidebar([conversation('r')]))
    const fixed = screen.getByTestId('sidebar-fixed')
    const list = screen.getByTestId('history')
    expect(fixed.classList.contains('scrolled')).toBe(false)
    expect(fixed.contains(screen.getByTestId('new-conversation'))).toBe(true)
    expect(fixed.contains(screen.getByTestId('open-activity'))).toBe(true)
    list.scrollTop = 40
    fireEvent.scroll(list)
    expect(fixed.classList.contains('scrolled')).toBe(true)
    list.scrollTop = 0
    fireEvent.scroll(list)
    expect(fixed.classList.contains('scrolled')).toBe(false)
  })
})

describe('Mon activité et Rechercher (fiche 144)', () => {
  it('« Rechercher » en icône dans l’en-tête, à gauche du bouton qui masque la barre', () => {
    const onSearch = vi.fn()
    render(sidebar([conversation('r')], { onSearch }))
    const header = document.querySelector('.sidebar-header') as HTMLElement
    const buttons = [...header.querySelectorAll('button')]
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toBe(screen.getByTestId('open-search'))
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Rechercher')
    fireEvent.click(screen.getByTestId('open-search'))
    expect(onSearch).toHaveBeenCalledOnce()
  })

  it('« Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte', () => {
    const onActivity = vi.fn()
    const { rerender } = render(sidebar([conversation('r')], { onActivity }))
    const row = screen.getByTestId('open-activity')
    expect(row.previousElementSibling).toBe(screen.getByTestId('new-conversation'))
    expect(row.textContent).toBe('Mon activité⇧⌘U')
    expect(row.classList.contains('active')).toBe(false)
    fireEvent.click(row)
    expect(onActivity).toHaveBeenCalledOnce()
    rerender(sidebar([conversation('r')], { onActivity, activityOpen: true }))
    expect(screen.getByTestId('open-activity').classList.contains('active')).toBe(true)
  })
})

describe('mode Dossiers : le dossier est le projet (fiche 131)', () => {
  const mother = conversation('m', { title: 'Carnet', workspace: '/depots/carnet' })
  const child = (id: string) =>
    conversation(id, {
      workspace: `/depots/.worktrees/carnet/20261023-1747-${id}`,
      project: '/depots/carnet',
      branch: `bobine/${id}`,
      startedFrom: { id: 'm', title: 'Carnet' }
    })
  const folders = () =>
    [...document.querySelectorAll('[data-testid=folder-group]')].map(
      (group) =>
        `${group.querySelector('[data-testid=folder-head]')?.textContent}: ${[
          ...group.querySelectorAll<HTMLElement>('[data-testid=history-item]')
        ]
          .map((row) => `${row.classList.contains('nested') ? '↳' : ''}${row.dataset.id}`)
          .join(' ')}`
    )

  beforeEach(() => localStorage.setItem('bob:historique-regroupement', '"folder"'))

  it('deux filles en worktree sous leur mère, dans son dossier ; pas de compteur', () => {
    render(sidebar([child('f1'), conversation('n', { workspace: '/notes' }), mother, child('f2')]))
    expect(screen.getByTestId('section-toggle-history').textContent).toBe('Dossiers')
    expect(folders()).toEqual(['carnet: m ↳f1 ↳f2', 'notes: n'])
    expect(document.querySelector('[data-testid=folder-head] svg')).toBeTruthy()
    expect(document.querySelector('.folder-count')).toBeNull()
  })

  it('un dossier se replie (seul son nom reste), et le reste au redémarrage', () => {
    const list = [mother, child('f1'), conversation('n', { workspace: '/notes' })]
    const view = render(sidebar(list))
    const head = () => screen.getAllByTestId('folder-head')[0] ?? document.body
    fireEvent.click(head())
    expect(head().getAttribute('aria-expanded')).toBe('false')
    expect(folders()).toEqual(['carnet: ', 'notes: n'])
    view.unmount()
    render(sidebar(list))
    expect(folders()).toEqual(['carnet: ', 'notes: n'])
    expect(head().getAttribute('title')).toBe('/depots/carnet')
  })
})

describe('conversations filles dans la liste (fiche 097)', () => {
  const mother = conversation('m', { title: 'Carnet' })
  const child = (id: string, change: Partial<ConversationSummary> = {}) =>
    conversation(id, {
      branch: `bobine/${id}`,
      startedFrom: { id: 'm', title: 'Carnet' },
      ...change
    })
  const openMenu = (index: number) => {
    const more = screen.getAllByTestId('history-more')[index]
    if (!more) throw new Error('menu absent')
    fireEvent.keyDown(more, { key: 'Enter' })
  }

  it('nouvelle fille : visible dès la liste reçue, même sous le pointeur (diagnostic 149)', () => {
    const view = render(sidebar([mother]))
    fireEvent.pointerOver(screen.getByTestId('history-item'))
    view.rerender(sidebar([child('new', { status: 'starting' }), mother]))
    expect(shown()).toBe('m ↳new')
    expect(document.querySelector('[data-id=new] .child-state')?.getAttribute('data-state')).toBe(
      'running'
    )
  })

  it('une nouvelle fille révèle Récents replié', () => {
    const view = render(sidebar([mother]))
    fireEvent.click(screen.getByTestId('section-toggle-history'))
    view.rerender(sidebar([child('new', { status: 'starting' }), mother]))
    expect(screen.getByTestId('section-toggle-history').getAttribute('aria-expanded')).toBe('true')
    expect(shown()).toBe('m ↳new')
  })

  it('une nouvelle fille révèle son dossier et reste sous sa mère quand elle attend', () => {
    localStorage.setItem('bob:historique-regroupement', '"folder"')
    const view = render(sidebar([mother]))
    fireEvent.click(screen.getByTestId('folder-head'))
    const list = [child('new', { status: 'busy' }), mother]
    view.rerender(sidebar(list))
    expect(shown()).toBe('m ↳new')
    view.rerender(sidebar(list, { attention: { new: 'request' } }))
    expect(shown()).toBe('m ↳new')
    expect(document.querySelector('[data-id=new]')?.classList.contains('nested')).toBe(true)
    expect(screen.getByTestId('folder-head').getAttribute('aria-expanded')).toBe('true')
  })

  it('sous sa mère, son état à droite ; plus d’icône git (fiche 131)', () => {
    render(
      sidebar(
        [
          child('f1', { status: 'busy' }),
          child('f2'),
          child('f3', { status: 'busy' }),
          mother,
          conversation('w', { branch: 'bobine/w' })
        ],
        { attention: { f2: 'done', f3: 'request' } }
      )
    )
    // Tous les états restent sous la mère, sans déplacer les conversations qui attendent.
    expect(shown()).toBe('m ↳f1 ↳f2 ↳f3 w')
    const states = [...document.querySelectorAll('[data-testid=history-item] .child-state')].map(
      (icon) => icon.getAttribute('data-state')
    )
    expect(states).toEqual(['running', 'unread', 'waiting'])
    expect(document.querySelector('[data-id=f1] .child-state')?.getAttribute('aria-label')).toBe(
      'En cours'
    )
    // La branche du worktree n'est plus une icône : elle est sur la ligne pour les essais, et dans
    // l'infobulle ; la réponse à lire garde son titre en gras et son icône sur place.
    expect(screen.queryAllByTestId('history-branch')).toHaveLength(0)
    expect(document.querySelector<HTMLElement>('[data-id=w]')?.dataset.branch).toBe('bobine/w')
    expect(screen.queryAllByTestId('attention-dot')).toHaveLength(0)
    expect(document.querySelector('[data-id=f2]')?.classList.contains('unread')).toBe(true)
  })

  it('« Lancer en parallèle… » : dans un dépôt git, sous le plafond, pas pour une fille', async () => {
    const childCapacity = vi.fn(async (id: string) => ({
      inRepo: id !== 'h',
      active: 0,
      max: 2
    }))
    window.api.conversations = { childCapacity } as unknown as Window['api']['conversations']
    const onLaunchChild = vi.fn()
    render(sidebar([mother, child('f1'), conversation('h')], { onLaunchChild }))
    openMenu(0)
    const launch = await screen.findByTestId('history-launch-child')
    await vi.waitFor(() => expect(launch.hasAttribute('data-disabled')).toBe(false))
    fireEvent.click(launch)
    expect(onLaunchChild).toHaveBeenCalledWith(mother)

    // Une fille ne lance pas de fille.
    openMenu(1)
    expect(screen.queryByTestId('history-launch-child')).toBeNull()
    fireEvent.keyDown(screen.getByTestId('history-pin'), { key: 'Escape' })

    // Hors dépôt git : désactivé.
    openMenu(2)
    const disabled = await screen.findByTestId('history-launch-child')
    await vi.waitFor(() => expect(childCapacity).toHaveBeenCalledWith('h'))
    await vi.waitFor(() => expect(disabled.hasAttribute('data-disabled')).toBe(true))
  })

  it('« Lancer en parallèle… » : désactivé au plafond des filles en cours (ADR-0020)', async () => {
    const childCapacity = vi.fn(async () => ({ inRepo: true, active: 2, max: 2 }))
    window.api.conversations = { childCapacity } as unknown as Window['api']['conversations']
    render(sidebar([mother], { onLaunchChild: vi.fn() }))
    openMenu(0)
    await vi.waitFor(() => expect(childCapacity).toHaveBeenCalledWith('m'))
    // Le menu reste ouvert quand la réponse arrive ; l'élément est grisé.
    await vi.waitFor(() =>
      expect(screen.getByTestId('history-launch-child').hasAttribute('data-disabled')).toBe(true)
    )
    expect(screen.getByTestId('history-pin')).toBeTruthy()
  })
})

describe('états sur place (fiche 149)', () => {
  const mother = conversation('m', { title: 'Carnet', pinned: true })
  const child = conversation('f', { startedFrom: { id: 'm', title: 'Carnet' } })

  it('une mère épinglée garde ses filles ; une fille archivée reste dans les archives', () => {
    render(sidebar([child, conversation('a', { ...child, id: 'a', archived: true }), mother]))
    expect(shown()).toBe('m ↳f')
    expect(document.querySelector('[data-id=f]')?.closest('[data-section=pinned]')).toBeTruthy()
    expect(document.querySelector('[data-id=m] .child-state')).toBeNull()
    fireEvent.click(screen.getByTestId('history-archived-toggle'))
    expect(shown()).toBe('m ↳f a')
  })

  it('la préparation révèle la section, sans commande sur la ligne provisoire ; remplacement sans doublon', () => {
    const view = render(sidebar([mother]))
    fireEvent.click(screen.getByTestId('section-toggle-pinned'))
    const launches: ChildLaunch[] = [{ id: 'launch', motherId: 'm', title: 'Import CSV' }]
    view.rerender(sidebar([mother], { launches }))
    expect(shown()).toBe('m ↳child-launch:launch')
    const preparing = document.querySelector('[data-preparing]')
    expect(preparing?.querySelector('.history-more')).toBeNull()
    expect(preparing?.querySelector('.history-open')?.getAttribute('aria-disabled')).toBe('true')
    expect(preparing?.querySelector('.child-state')?.getAttribute('aria-label')).toBe(
      'Création du worktree…'
    )
    view.rerender(
      sidebar([child, mother], {
        launches: [{ id: 'launch', motherId: 'm', title: 'Import CSV', conversationId: 'f' }]
      })
    )
    expect(shown()).toBe('m ↳f')
    expect(document.querySelector('[data-preparing]')).toBeNull()
    view.rerender(sidebar([child, mother]))
    expect(shown()).toBe('m ↳f')
  })

  it('l’échec d’une création enlève sa ligne provisoire', () => {
    const view = render(
      sidebar([mother], { launches: [{ id: 'x', motherId: 'm', title: 'Essai' }] })
    )
    expect(document.querySelector('[data-preparing]')).toBeTruthy()
    view.rerender(sidebar([mother]))
    expect(shown()).toBe('m')
  })

  it('la vraie fille remplace sa préparation sans bouger sous le pointeur', () => {
    const old = { ...child, id: 'old' }
    const view = render(
      sidebar([mother, old], { launches: [{ id: 'x', motherId: 'm', title: 'Nouvelle' }] })
    )
    expect(shown()).toBe('m ↳child-launch:x ↳old')
    fireEvent.pointerOver(document.querySelector('[data-preparing]') ?? document.body)
    view.rerender(sidebar([mother, old, child], { launchRows: { 'child-launch:x': 'f' } }))
    expect(shown()).toBe('m ↳f ↳old')
    expect(document.querySelector('[data-preparing]')).toBeNull()
  })

  it('questions, autorisations, erreurs et réponses restent à leur place ; détails dans l’infobulle', async () => {
    const a = conversation('a')
    const b = conversation('b')
    const view = render(sidebar([a, b]))
    fireEvent.pointerOver(screen.getAllByTestId('history-item')[0] ?? document.body)
    view.rerender(
      sidebar([b, a], {
        attention: { a: 'request', b: 'error' },
        details: { a: { reason: 'question', detail: 'OAuth ?', since: 1 } }
      })
    )
    expect(shown()).toBe('a b')
    expect(document.querySelector('[data-id=a] .child-state')?.getAttribute('data-reason')).toBe(
      'question'
    )
    expect(await rowTip('a')).toContain('OAuth')
    expect(document.querySelector('[data-id=b] .child-state')?.getAttribute('data-state')).toBe(
      'error'
    )
    expect(screen.queryByTestId('inbox')).toBeNull()
    view.rerender(sidebar([b, a], { attention: { a: 'done' } }))
    expect(shown()).toBe('a b')
    expect(document.querySelector('[data-id=a] .child-state')?.getAttribute('data-state')).toBe(
      'unread'
    )
    fireEvent.pointerOver(screen.getByTestId('new-conversation'))
    expect(shown()).toBe('b a')
  })
})

describe('largeur de la barre latérale (fiche 113)', () => {
  it('poignée entre 220 et 440 px, retenue, double-clic : 300 px', () => {
    // jsdom n'a pas la capture du pointeur.
    Element.prototype.setPointerCapture ??= () => {}
    localStorage.removeItem(SIDEBAR_WIDTH_KEY)
    const { container } = render(sidebar([]))
    const aside = container.querySelector('aside.sidebar') as HTMLElement
    const width = () => aside.style.getPropertyValue('--sidebar-width')
    const handle = screen.getByTestId('sidebar-resize')
    expect(width()).toBe('300px')
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 360 })
    expect(width()).toBe('360px')
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 900 })
    expect(width()).toBe('440px')
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10 })
    expect(width()).toBe('220px')
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBeNull()
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('220')
    // Sans appui, le pointeur qui passe ne change rien.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 })
    expect(width()).toBe('220px')
    fireEvent.doubleClick(handle)
    expect(width()).toBe('300px')
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('300')
    // Fenêtre étroite (demi-écran) : la conversation garde 500 px, le réglage n'est pas perdu.
    window.innerWidth = 760
    fireEvent(window, new Event('resize'))
    expect(width()).toBe('260px')
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('300')
    window.innerWidth = 1280
    fireEvent(window, new Event('resize'))
    expect(width()).toBe('300px')
  })

  it('« Tâches planifiées » sous « Mon activité » ; une exécution planifiée a son repère (fiche 178)', () => {
    const onScheduled = vi.fn()
    const run = conversation('p', { scheduled: { taskId: 't', name: 'Revue du matin' } })
    const { rerender } = render(sidebar([run, conversation('r')], { onScheduled }))
    const row = screen.getByTestId('open-scheduled')
    expect(row.previousElementSibling).toBe(screen.getByTestId('open-activity'))
    fireEvent.click(row)
    expect(onScheduled).toHaveBeenCalledOnce()
    rerender(sidebar([run], { onScheduled, scheduledOpen: true }))
    expect(screen.getByTestId('open-scheduled').classList.contains('active')).toBe(true)
    const tags = screen.getAllByTestId('history-scheduled-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0]?.getAttribute('aria-label')).toMatch(
      /^Exécution planifiée de «\s?Revue du matin\s?»$/
    )
  })
})
