/**
 * Message de commit rédigé par l'agent (fiche 246, ADR-0056) : « Rédaction par… » et « Arrêter »
 * pendant la rédaction, le message reçu modifiable, le repli et sa raison, « Rédiger à nouveau ».
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommitDraftResult } from '@shared/commit-draft'
import type { CommitFile } from '@shared/worktree-cycle'
import { CommitForm } from './CommitForm'
import { rememberAgentLabels } from './useCommitDraft'

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')
const FILES: CommitFile[] = [
  { path: 'public/app.js', status: 'modified' },
  { path: 'public/filters.js', status: 'untracked' }
]

function deferred() {
  let resolve: (r: CommitDraftResult) => void = () => {}
  const promise = new Promise<CommitDraftResult>((r) => (resolve = r))
  return { promise, resolve }
}

describe('message de commit rédigé par l’agent (fiche 246)', () => {
  const commit = window.api.commit
  afterEach(() => {
    window.api.commit = commit
  })

  function setup(files: CommitFile[] = FILES) {
    rememberAgentLabels([{ id: 'c1', profileLabel: 'OpenCode' }])
    const answers: ReturnType<typeof deferred>[] = []
    const draft = vi.fn(() => {
      const answer = deferred()
      answers.push(answer)
      return answer.promise
    })
    const stop = vi.fn(async () => undefined)
    window.api.commit = { draft, stop } as unknown as Window['api']['commit']
    const onCommit = vi.fn()
    const view = render(
      <CommitForm
        conversationId="c1"
        files={files}
        place="conversation"
        busy={false}
        testid="t"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />
    )
    const field = () => screen.getByTestId('t-message') as HTMLTextAreaElement
    const confirm = () => screen.getByTestId('t-confirm') as HTMLButtonElement
    return { draft, stop, answers, onCommit, field, confirm, view }
  }

  it('rédaction en cours : « Rédaction par OpenCode… », champ en attente, « Committer » désactivé ; « Arrêter »', () => {
    const { draft, stop, field, confirm } = setup()
    expect(draft).toHaveBeenCalledWith('c1', { files: FILES, place: 'conversation' })
    expect(plain(screen.getByTestId('t-draft').textContent)).toMatch(
      /^Rédaction par OpenCode… < 1 sArrêter$/
    )
    expect(field().disabled).toBe(true)
    expect(field().value).toBe('')
    expect(confirm().disabled).toBe(true)
    fireEvent.click(screen.getByTestId('t-draft-stop'))
    expect(stop).toHaveBeenCalledWith('c1')
  })

  it('message reçu : dans le champ, modifiable ; « Rédigé par… » ; committé tel que retouché', async () => {
    const { answers, field, confirm, onCommit } = setup()
    await act(async () =>
      answers[0]?.resolve({
        source: 'agent',
        message: 'feat: add a reading status filter',
        agentLabel: 'OpenCode',
        ms: 4200,
        withMemory: true
      })
    )
    expect(field().disabled).toBe(false)
    expect(field().value).toBe('feat: add a reading status filter')
    expect(plain(screen.getByTestId('t-draft').textContent)).toBe(
      'Rédigé par OpenCode en 4 s, d’après 2 fichiers et la mémoire du projetRédiger à nouveau'
    )
    fireEvent.change(field(), { target: { value: 'feat: add the status filter' } })
    fireEvent.click(confirm())
    expect(onCommit).toHaveBeenCalledWith('feat: add the status filter')
  })

  it('cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace', async () => {
    const { draft, answers, field, view } = setup()
    await act(async () =>
      answers[0]?.resolve({
        source: 'agent',
        message: 'feat: two files',
        agentLabel: 'OpenCode',
        ms: 1000,
        withMemory: false
      })
    )
    fireEvent.change(field(), { target: { value: 'feat: mine' } })
    view.rerender(
      <CommitForm
        conversationId="c1"
        files={FILES.slice(0, 1)}
        place="conversation"
        busy={false}
        testid="t"
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    // Pas de relance automatique : chaque rédaction coûte.
    expect(draft).toHaveBeenCalledTimes(1)
    expect(field().value).toBe('feat: mine')
    expect(plain(screen.getByTestId('t-draft').textContent)).toBe(
      'Les fichiers cochés ont changé depuis la rédaction.Rédiger à nouveau'
    )
    fireEvent.click(screen.getByTestId('t-draft-again'))
    expect(draft).toHaveBeenCalledTimes(2)
    expect(draft).toHaveBeenLastCalledWith('c1', {
      files: FILES.slice(0, 1),
      place: 'conversation'
    })
    await act(async () =>
      answers[1]?.resolve({
        source: 'agent',
        message: 'feat: one file',
        agentLabel: 'OpenCode',
        ms: 1000,
        withMemory: false
      })
    )
    expect(field().value).toBe('feat: one file')
  })

  it('délai dépassé : repli en anglais déduit des fichiers, la raison, « Réessayer »', async () => {
    const { draft, answers, field, confirm } = setup()
    await act(async () =>
      answers[0]?.resolve({
        source: 'fallback',
        reason: 'timeout',
        agentLabel: 'OpenCode',
        message: 'ignored: the form recomputes it from the checked files'
      })
    )
    expect(field().value).toBe(
      'chore: update app.js and filters.js\n\n- public/app.js\n- public/filters.js (new)'
    )
    expect(confirm().disabled).toBe(false)
    const line = screen.getByTestId('t-draft')
    expect(line.dataset.reason).toBe('timeout')
    expect(plain(line.textContent)).toBe(
      'OpenCode n’a pas répondu en 45 s : message déduit des fichiers.Réessayer'
    )
    fireEvent.click(screen.getByTestId('t-draft-again'))
    expect(draft).toHaveBeenCalledTimes(2)
  })

  it('refus, erreur, connexion à refaire : la raison est dite', async () => {
    for (const [result, text] of [
      [
        { source: 'fallback', reason: 'refused', agentLabel: 'IBM Bob', message: '' },
        'IBM Bob a refusé de rédiger le message : message déduit des fichiers.'
      ],
      [
        {
          source: 'fallback',
          reason: 'failed',
          agentLabel: 'IBM Bob',
          message: '',
          detail: 'model overloaded'
        },
        'IBM Bob n’a pas pu rédiger le message (model overloaded) : message déduit des fichiers.'
      ],
      [
        { source: 'fallback', reason: 'needs-action', agentLabel: 'IBM Bob', message: '' },
        'IBM Bob demande une action (connexion, licence ou confiance) : ouvrez la conversation, puis réessayez. Message déduit des fichiers.'
      ]
    ] as const) {
      const { answers, view } = setup()
      await act(async () => answers[0]?.resolve(result as CommitDraftResult))
      expect(plain(screen.getByTestId('t-draft').textContent)).toBe(`${text}Réessayer`)
      view.unmount()
    }
  })

  it('réglage coupé : le repli, sans ligne d’explication', async () => {
    const { answers, field } = setup()
    await act(async () =>
      answers[0]?.resolve({ source: 'fallback', reason: 'disabled', message: '' })
    )
    await waitFor(() => expect(field().disabled).toBe(false))
    expect(field().value).toMatch(/^chore: update app\.js and filters\.js/)
    expect(screen.queryByTestId('t-draft')).toBeNull()
  })

  it('formulaire fermé pendant la rédaction : l’agent est arrêté', () => {
    const { stop, view } = setup()
    view.unmount()
    expect(stop).toHaveBeenCalledWith('c1')
  })
})
