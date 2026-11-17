import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { ToolCall } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

// Référence à une autre session dans le contenu d'un outil (ACP 1.31, instable, fiche 233).
const tool = (content: ToolItem['content']): ToolItem => ({
  kind: 'tool',
  id: 1,
  toolCallId: 'delegue_1',
  title: 'Déléguer l’exploration',
  toolKind: 'other',
  status: 'completed',
  content,
  locations: []
})

const session = { type: 'session', sessionId: 'sous-agent-exploration' } as const

describe('référence de session dans un outil (fiche 233)', () => {
  it('seule : la carte s’affiche sans détails vides à ouvrir', () => {
    const { container } = render(<ToolCall item={tool([session])} onRespond={vi.fn()} />)
    expect(screen.getByTestId('tool')).toBeTruthy()
    expect(container.querySelector('details')).toBeNull()
    expect(container.querySelector('.tool-row')).not.toBeNull()
  })

  it('avec un résultat : les détails montrent le résultat, la référence ne casse rien', () => {
    const { container } = render(
      <ToolCall
        item={tool([
          { type: 'content', content: { type: 'text', text: 'Le projet est simple.' } },
          session
        ])}
        onRespond={vi.fn()}
      />
    )
    const details = container.querySelector('details')
    if (!details) throw new Error('détails attendus')
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(screen.getByText('Le projet est simple.')).toBeTruthy()
    expect(container.querySelectorAll('.tool-output')).toHaveLength(1)
  })
})
