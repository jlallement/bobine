import * as Tooltip from '@radix-ui/react-tooltip'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueuedMessages } from './QueuedMessages'

const noop = () => {}

describe('QueuedMessages', () => {
  it('message d’une autre conversation : sa provenance devant le texte (fiche 097)', () => {
    render(
      <Tooltip.Provider>
        <QueuedMessages
          items={[
            {
              id: 'q1',
              text: 'Accepte le point-virgule.',
              attachments: [],
              from: { kind: 'parent', id: 'm', title: 'Carnet' }
            },
            { id: 'q2', text: 'De moi', attachments: [] }
          ]}
          busy
          onSendNow={noop}
          onEdit={noop}
          onRemove={noop}
        />
      </Tooltip.Provider>
    )
    expect(screen.getAllByTestId('queued-origin').map((o) => o.textContent)).toEqual([
      'De la conversation mère «\u00a0Carnet\u00a0»'
    ])
    expect(screen.getAllByTestId('queued-item')[0]?.textContent).toContain(
      'Accepte le point-virgule.'
    )
  })
})
