import { fireEvent, render, screen } from '@testing-library/react'
import { t } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { ComposerInbox } from '../../useFileDrop'
import { lastUserText, TurnFooter } from './TurnFooter'

const snapshot = (status: AgentSnapshot['status']) => ({ status }) as AgentSnapshot
const noop = () => {}
const show = (status: AgentSnapshot['status'], background: boolean, items: TranscriptItem[]) =>
  render(
    <TurnFooter
      snapshot={snapshot(status)}
      background={background}
      conversationId="c-pied"
      items={items}
      workspace={undefined}
      onRetry={noop}
      onStop={noop}
    />
  )

const replied: TranscriptItem[] = [
  { kind: 'user', id: 1, text: 'Vérifie', at: 0 },
  { kind: 'agent', id: 2, text: 'Lancé.', at: 10_000 }
]

describe('travail après le tour dit une seule fois (fiche 261, revue UX)', () => {
  it('pied « Travaille encore… » sous la réponse : pas d’indicateur en bas du fil', () => {
    show('ready', true, replied)
    expect(screen.queryByTestId('working')).toBeNull()
  })

  it('travail après le tour sans réponse pour porter le pied : l’indicateur reste', () => {
    show('ready', true, [{ kind: 'user', id: 1, text: 'Vérifie', at: 0 }])
    expect(screen.getByTestId('working')).toBeTruthy()
  })

  it('tour en cours : l’indicateur, comme avant', () => {
    show('busy', false, [...replied, { kind: 'user', id: 3, text: 'Encore', at: 20_000 }])
    expect(screen.getByTestId('working')).toBeTruthy()
  })
})

describe('bandeaux du tour et relance (fiche 276)', () => {
  const user = (id: number, text: string, extra: Partial<TranscriptItem> = {}) =>
    ({ kind: 'user', id, text, at: 0, ...extra }) as TranscriptItem

  it('message du tour : le dernier de l’utilisateur, ni réveil d’une fille ni compaction', () => {
    expect(lastUserText([])).toBeUndefined()
    expect(lastUserText([user(1, 'Ajoute un test'), { kind: 'agent', id: 2, text: 'ok' }])).toBe(
      'Ajoute un test'
    )
    expect(
      lastUserText([
        user(1, 'Ajoute un test'),
        user(2, '/compact', { compaction: true }),
        user(3, 'Fini', { from: { id: 'f', title: 'Fille' } } as Partial<TranscriptItem>)
      ])
    ).toBe('Ajoute un test')
    expect(lastUserText([user(1, '   ')])).toBeUndefined()
  })

  it('silence : l’indicateur dit « Réponse en cours », sans verbe', () => {
    render(
      <TurnFooter
        snapshot={{ status: 'busy', silentSince: Date.now() - 300_000 } as AgentSnapshot}
        conversationId="c-silence"
        items={[user(1, 'Ajoute un test')]}
        workspace={undefined}
        onRetry={noop}
        onStop={noop}
      />
    )
    const working = screen.getByTestId('working')
    expect(working.getAttribute('data-activity')).toBe('silent')
    expect(working.textContent).toContain(t('activity.silent'))
    expect(screen.getByTestId('silence-banner')).toBeTruthy()
  })

  it('réglages réseau changés : « Relancer l’agent » relance, et le message revient dans la saisie', () => {
    const onRestart = vi.fn()
    const inbox = new ComposerInbox()
    const restore = vi.fn()
    inbox.subscribe({ files: noop, text: noop, conversationId: 'c-relance', restore })
    render(
      <TurnFooter
        snapshot={
          {
            status: 'busy',
            unreachable: { attempt: 3 },
            networkStale: true,
            info: { profileLabel: 'OpenCode' }
          } as AgentSnapshot
        }
        conversationId="c-relance"
        items={[user(1, 'Ajoute un test')]}
        workspace={undefined}
        onRetry={noop}
        onStop={noop}
        onRestart={onRestart}
        inbox={inbox}
      />
    )
    expect(screen.getByTestId('agent-unreachable-hint').textContent).toBe(
      t('agentRetry.networkStale', { agent: 'OpenCode' })
    )
    expect(screen.queryByTestId('agent-unreachable-settings')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('agentRetry.restart') }))
    expect(onRestart).toHaveBeenCalledTimes(1)
    // Remis dans la saisie, jamais envoyé.
    expect(restore).toHaveBeenCalledWith('Ajoute un test', [])
  })
})
