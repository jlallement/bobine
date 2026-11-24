/**
 * Carte « Pull request » (fiche 176) rendue sans l'app ni `gh` : remplaçant des vérifications de
 * composant des suites e2e `pr-ci` (inventaire B, #4, #5) et `pr-ci-sans-ci` (inventaire A, #1 à
 * #3). La relève, la fusion et la consigne réelles (faux `gh`, minuteurs du main) restent dans
 * `pr-watch.test.ts` et dans l'e2e ; ici, l'état est donné à la carte, et ses clics vont à
 * `window.api.pr`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrCheck, PrTrack, PrView } from '@shared/pr-tracking'
import i18next from 'i18next'
import { PrCard } from './PrCard'

const PR_URL = 'https://github.com/o/r/pull/7'
const JOB_URL = 'https://github.com/o/r/actions/runs/1/job/2'
const t = i18next.t.bind(i18next)

function view(checks: PrCheck[], over: Partial<PrView> = {}): PrView {
  const summary = checks.some((c) => c.state === 'failed')
    ? 'failed'
    : checks.some((c) => c.state === 'pending')
      ? 'pending'
      : checks.length
        ? 'passed'
        : 'none'
  return {
    number: 7,
    url: PR_URL,
    title: 'Fais les modifications',
    state: 'open',
    draft: false,
    head: 'h1',
    checks,
    summary,
    comments: 0,
    mergeable: 'mergeable',
    base: 'main',
    mergeState: 'clean',
    ...over
  }
}
const found = (pr: PrView, over: Partial<Extract<PrTrack, { status: 'found' }>> = {}): PrTrack => ({
  status: 'found',
  pr,
  checkedAt: 0,
  options: { autoFix: false, autoMerge: false },
  ...over
})

const original = window.api
const api = {
  refresh: vi.fn(async () => undefined),
  setOptions: vi.fn(async () => undefined),
  fixChecks: vi.fn(async () => undefined),
  mergeNow: vi.fn(async () => undefined)
}
beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockClear()
  window.api = { ...original, pr: { ...original.pr, ...api } } as unknown as Window['api']
})
afterEach(() => {
  window.api = original
})

const text = (id: string) => screen.getByTestId(id).textContent
const checkbox = (id: string) => screen.getByTestId(id) as HTMLInputElement

describe('carte « Pull request » (fiche 176)', () => {
  it('rien sans PR ni `gh`', () => {
    const { container, rerender } = render(
      <PrCard conversationId="c1" track={{ status: 'unavailable' }} />
    )
    expect(container.innerHTML).toBe('')
    rerender(<PrCard conversationId="c1" track={{ status: 'none', checkedAt: 0 }} />)
    expect(container.innerHTML).toBe('')
  })

  it('PR ouverte, contrôles en cours : lien, état, ligne, choix d’office décochés', () => {
    const pending = [
      { name: 'CI / test', state: 'pending' as const },
      { name: 'CI / lint', state: 'pending' as const }
    ]
    render(<PrCard conversationId="c1" track={found(view(pending))} />)
    const link = screen.getByTestId('pr-link') as HTMLAnchorElement
    expect(link.textContent).toBe('#7 Fais les modifications')
    expect(link.href).toBe(PR_URL)
    expect(text('pr-state')).toBe(t('prTrack.state.open'))
    expect(text('pr-checks-line')).toBe(t('prTrack.checks.pending', { count: 2 }))
    expect(screen.getAllByTestId('pr-check').map((c) => c.dataset['state'])).toEqual([
      'pending',
      'pending'
    ])
    expect(screen.queryByTestId('pr-fix')).toBeNull()
    expect(checkbox('pr-auto-fix').checked).toBe(false)
    expect(checkbox('pr-auto-merge').checked).toBe(false)
  })

  it('contrôle en échec d’abord avec son lien ; commentaires, relecture, conflit ; « Corriger »', async () => {
    const pr = view(
      [
        { name: 'CI / test', state: 'failed', url: JOB_URL },
        { name: 'CI / lint', state: 'passed' }
      ],
      { comments: 2, review: 'changes-requested', mergeable: 'conflicting', mergeState: 'dirty' }
    )
    render(<PrCard conversationId="c1" track={found(pr)} />)
    expect(text('pr-checks-line')).toBe(
      `${t('prTrack.checks.failed', { count: 1 })} · ${t('prTrack.checks.passed', { count: 1 })}`
    )
    const first = screen.getAllByTestId('pr-check')[0]?.querySelector('a')
    expect(first?.textContent).toBe('CI / test')
    expect(first?.getAttribute('href')).toBe(JOB_URL)
    expect(text('pr-meta')).toBe(
      [
        t('prTrack.comments', { count: 2 }),
        t('prTrack.review.changes-requested'),
        t('prTrack.mergeable.conflicting')
      ].join(' · ')
    )
    expect(screen.getByTestId('pr-meta').classList.contains('pr-conflicting')).toBe(true)
    // Rien ne part à l'agent sans clic ; le clic demande la consigne au main.
    expect(api.fixChecks).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('pr-fix'))
    await waitFor(() => expect(api.fixChecks).toHaveBeenCalledWith('c1'))
  })

  it('fusion d’office cochée en conflit : la raison est dite, en alerte', () => {
    const pr = view([{ name: 'CI / test', state: 'failed' }], { mergeable: 'conflicting' })
    render(
      <PrCard
        conversationId="c1"
        track={found(pr, { options: { autoFix: false, autoMerge: true } })}
      />
    )
    const waiting = screen.getByTestId('pr-waiting')
    expect(waiting.dataset['wait']).toBe('conflicting')
    expect(waiting.textContent).toBe(t('prTrack.wait.conflicting', { base: 'main' }))
    expect(waiting.classList.contains('pr-warn')).toBe(true)
  })

  it('cocher un choix d’office le transmet au main', async () => {
    render(<PrCard conversationId="c1" track={found(view([]), { ci: 'awaited' })} />)
    fireEvent.click(checkbox('pr-auto-merge'))
    await waitFor(() => expect(api.setOptions).toHaveBeenCalledWith('c1', { autoMerge: true }))
  })
})

describe('carte « Pull request » sans CI (fiche 176, 0.9.1, D20)', () => {
  it('ni workflow ni contrôle requis : « Aucune CI détectée », « Fusionner maintenant » proposé', async () => {
    render(<PrCard conversationId="c1" track={found(view([]), { ci: 'none' })} />)
    const line = screen.getByTestId('pr-checks-line')
    expect(line.dataset['ci']).toBe('none')
    expect(line.textContent).toBe(t('prTrack.checksNoCi'))
    const mergeNow = screen.getByTestId('pr-merge-now') as HTMLButtonElement
    expect(mergeNow.disabled).toBe(false)
    expect(mergeNow.title).toBe('')
    fireEvent.click(mergeNow)
    await waitFor(() => expect(api.mergeNow).toHaveBeenCalledWith('c1'))
  })

  it('fusion d’office cochée : jamais sans contrôle, la carte le dit sans alarme', () => {
    render(
      <PrCard
        conversationId="c1"
        track={found(view([]), { ci: 'none', options: { autoFix: false, autoMerge: true } })}
      />
    )
    const waiting = screen.getByTestId('pr-waiting')
    expect(waiting.dataset['wait']).toBe('no-ci')
    expect(waiting.textContent).toBe(t('prTrack.wait.no-ci'))
    expect(waiting.classList.contains('pr-warn')).toBe(false)
  })

  it('branche à reprendre : « Fusionner maintenant » désactivé, la raison en infobulle', () => {
    render(
      <PrCard
        conversationId="c1"
        track={found(view([], { mergeState: 'behind' }), { ci: 'none' })}
      />
    )
    const mergeNow = screen.getByTestId('pr-merge-now') as HTMLButtonElement
    expect(mergeNow.disabled).toBe(true)
    expect(mergeNow.title).toBe(t('prTrack.wait.behind', { base: 'main' }))
    fireEvent.click(mergeNow)
    expect(api.mergeNow).not.toHaveBeenCalled()
  })

  it('avec une CI : pas de « Fusionner maintenant »', () => {
    render(<PrCard conversationId="c1" track={found(view([]), { ci: 'awaited' })} />)
    expect(text('pr-checks-line')).toBe(t('prTrack.checksAwaited'))
    expect(screen.queryByTestId('pr-merge-now')).toBeNull()
  })
})
