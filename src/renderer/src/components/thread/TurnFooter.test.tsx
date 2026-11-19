import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AgentSnapshot } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { TurnFooter } from './TurnFooter'

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
