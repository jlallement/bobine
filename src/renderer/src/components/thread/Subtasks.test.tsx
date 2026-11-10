import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { fireEvent, render as testingRender, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import type { UsageDigest } from '@shared/usage'
import { Transcript } from './Transcript'
import { ChildStarted } from './Subtasks'

function render(ui: ReactNode) {
  return testingRender(ui, { wrapper: Tooltip.Provider })
}

const child = (id: string, usage?: UsageDigest): ConversationSummary => ({
  id,
  title: `Fille ${id}`,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: `/tmp/${id}`,
  updatedAt: '2026-10-22T10:00:00.000Z',
  status: 'ready',
  draft: false,
  branch: `bobine/${id}`,
  startedFrom: { id: 'mere', title: 'Mère' },
  ...(usage ? { usage } : {})
})

const started = (id: number, childId: string): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Fille ${childId}`,
  prompt: 'Fais-le',
  at: 1
})

const report = (id: number, childId: string, usage?: UsageDigest): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId,
  title: `Fille ${childId}`,
  outcome: 'done',
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Fini.',
  at: 2,
  ...(usage ? { usage } : {})
})

const usd = (amount: number) => ({ amount, currency: 'USD' })
const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s/g, ' ')

const view = (items: TranscriptItem[], children: ConversationSummary[]) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      subtasks={{ children, attention: {}, onOpen: vi.fn() }}
    />
  )

it('état en icône : détail au clavier, accès à la fille, sans libellé visible (149)', async () => {
  const onOpen = vi.fn()
  const item = started(1, 'a')
  if (item.kind !== 'child-started') throw new Error('lancement attendu')
  render(
    <ChildStarted
      item={item}
      items={[item]}
      info={{ children: [child('a')], attention: { a: 'done' }, onOpen }}
    />
  )
  const state = screen.getByRole('button', { name: /Ouvrir.*Fille a.*Finie, à lire/ })
  expect(state.textContent).toBe('')
  fireEvent.focus(state)
  expect((await screen.findByRole('tooltip')).textContent).toBe('Finie, à lire')
  fireEvent.click(state)
  expect(onOpen).toHaveBeenCalledExactlyOnceWith('a')
  expect(screen.getByTestId('subtask-open').textContent).toBe('Ouvrir')
})

describe('Coût des conversations filles (fiche 117)', () => {
  it('chaque ligne a son coût, l’en-tête le total ; le compte rendu, son coût (échanges au dépli)', () => {
    view(
      [started(1, 'a'), started(2, 'b'), report(3, 'a', { turns: 2, cost: usd(0.025) })],
      [child('a', { turns: 2, cost: usd(0.025) }), child('b', { turns: 1, cost: usd(0.0125) })]
    )
    expect(
      screen.getAllByTestId('subtask-cost').map((e) => e.textContent?.replace(/\s/g, ' '))
    ).toEqual(['0,025 $US', '0,0125 $US'])
    expect(text('subtasks-total')).toBe('0,0375 $US')
    expect(text('child-report-usage')).toBe('0,025 $US')
    expect(screen.queryByTestId('child-report-turns')).toBeNull()
    fireEvent.click(screen.getByTestId('child-report-toggle'))
    expect(text('child-report-turns')).toBe('2 échanges')
  })

  it('jetons sans coût : « 31k jetons », pas de total ; rien sans consommation ni pour un ancien compte rendu', () => {
    view(
      [started(1, 'a'), started(2, 'b'), started(3, 'c'), report(4, 'c')],
      [child('a', { total: 31_000, turns: 1 }), child('b', { cost: usd(1) }), child('c')]
    )
    const costs = screen.getAllByTestId('subtask-cost').map((e) => e.textContent)
    expect(costs).toHaveLength(2)
    expect(costs[0]).toBe('31k jetons')
    expect(screen.queryByTestId('subtasks-total')).toBeNull()
    expect(screen.queryByTestId('child-report-usage')).toBeNull()
  })
})

it('les consignes initiale et de reprise se déplient séparément, sans troncature ni HTML interprété (150)', () => {
  const initialPrompt = 'Consigne initiale\n\n' + 'Une instruction détaillée. '.repeat(8)
  const followup = 'Corrige <script>alert(1)</script>\n  Garde ces espaces.\nDernière ligne.'
  view(
    [
      {
        kind: 'child-started',
        id: 1,
        childId: 'a',
        title: 'Fille a',
        prompt: initialPrompt,
        at: 1
      },
      { kind: 'child-instruction', id: 2, childId: 'a', title: 'Fille a', prompt: followup, at: 2 }
    ],
    []
  )
  const initial = screen.getByTestId('child-started')
  const correction = screen.getByTestId('child-instruction')
  expect(initial.hasAttribute('open')).toBe(false)
  expect(correction.hasAttribute('open')).toBe(false)
  const body = screen.getAllByTestId('child-instruction-text')
  expect(body.map((e) => e.textContent)).toEqual([initialPrompt, followup])
  expect(document.querySelector('script')).toBeNull()
  const toggle = correction.querySelector('summary')
  if (!toggle) throw new Error('Résumé absent')
  fireEvent.click(toggle)
  expect(correction.hasAttribute('open')).toBe(true)
  expect(initial.hasAttribute('open')).toBe(false)
  fireEvent.click(toggle)
  expect(correction.hasAttribute('open')).toBe(false)
})

describe('Compte rendu replié (fiche 171)', () => {
  const long: TranscriptItem = {
    ...report(2, 'a', { turns: 1, cost: usd(0.0125) }),
    branch: 'bobine/a',
    excerpt: 'Voici le **bilan**. Suite du texte.\n\n1. un premier point ;\n2. un second'
  } as TranscriptItem

  it('deux lignes repliées : titre et coût, puis la première phrase ; détail au dépli', () => {
    view([started(1, 'a'), long], [child('a')])
    const toggle = screen.getByTestId('child-report-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(text('child-report-lead')).toBe('Voici le bilan.')
    expect(toggle.textContent).toContain('Afficher le détail')
    const reportEl = screen.getByTestId('child-report')
    expect(text('child-report-usage')).toBe('0,0125 $US')
    expect(reportEl.textContent).not.toContain('bobine/a')
    expect(screen.queryByTestId('child-report-excerpt')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const details = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(details?.textContent).toContain('bobine/a')
    expect(details?.textContent).toContain('rien modifié')
    expect(details?.textContent).toContain('1 échange')
    expect(screen.getByTestId('child-report-excerpt').querySelectorAll('li')).toHaveLength(2)
    expect(toggle.textContent).toContain('Masquer le détail')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('child-report-excerpt')).toBeNull()
  })

  it('le bouton de dépli est un vrai bouton : il se déplie au clavier', () => {
    view([started(1, 'a'), long], [child('a')])
    const toggle = screen.getByRole('button', { name: /Voici le bilan\..*Afficher le détail/ })
    expect(toggle.tagName).toBe('BUTTON')
    toggle.focus()
    expect(document.activeElement).toBe(toggle)
  })

  it('fondu seulement quand l’extrait est coupé : un extrait court n’a pas de bandeau', () => {
    const height = (scroll: number, client: number) => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scroll)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(client)
    }
    height(60, 60)
    const { unmount } = view([started(1, 'a'), long], [child('a')])
    fireEvent.click(screen.getByTestId('child-report-toggle'))
    expect(screen.getByTestId('child-report-excerpt').hasAttribute('data-clipped')).toBe(false)
    unmount()
    vi.restoreAllMocks()

    height(240, 108)
    view([started(1, 'a'), long], [child('a')])
    fireEvent.click(screen.getByTestId('child-report-toggle'))
    expect(screen.getByTestId('child-report-excerpt').hasAttribute('data-clipped')).toBe(true)
    vi.restoreAllMocks()
  })
})
