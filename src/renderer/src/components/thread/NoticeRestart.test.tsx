import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { TurnControlsContext, type TurnControls } from '../../turn-controls'
import { Transcript } from './Transcript'

const pending: TranscriptItem = {
  kind: 'notice',
  id: 3,
  level: 'warning',
  message: { key: 'transcript.notice.appTools.iosPending' },
  appTools: 'ios-simulator',
  action: 'restart-agent'
}

function controls(restartAgent?: () => void): TurnControls {
  return {
    busy: false,
    cancel: () => {},
    stalledAfterMs: 1,
    answerCostCap: () => {},
    answerTurnLimit: () => {},
    ...(restartAgent ? { restartAgent } : {})
  }
}

const view = (items: TranscriptItem[], turn?: TurnControls) => {
  const thread = (
    <Transcript items={items} onRespondPermission={vi.fn()} onRespondElicitation={vi.fn()} />
  )
  return render(
    turn ? (
      <TurnControlsContext.Provider value={turn}>{thread}</TurnControlsContext.Provider>
    ) : (
      thread
    )
  )
}

describe('avis des outils apparus avec un projet, dans le fil (fiche 241)', () => {
  it('« Redémarrer l’agent » redémarre l’agent de la conversation', () => {
    const restartAgent = vi.fn()
    view([pending], controls(restartAgent))
    const notice = screen.getByTestId('notice-app-tools')
    expect(notice.dataset['family']).toBe('ios-simulator')
    expect(notice.textContent).toContain('Projet Xcode trouvé dans ce dossier')
    fireEvent.click(screen.getByRole('button', { name: 'Redémarrer l’agent' }))
    expect(restartAgent).toHaveBeenCalledTimes(1)
  })

  it('hors du fil principal (pas de contrôles du tour) : le texte, sans bouton', () => {
    view([pending])
    expect(screen.getByTestId('notice-app-tools').textContent).toContain('Projet Xcode trouvé')
    expect(screen.queryByRole('button', { name: 'Redémarrer l’agent' })).toBeNull()
  })

  it('ligne discrète une fois les outils reçus : ni icône ni bouton', () => {
    view(
      [
        {
          kind: 'notice',
          id: 4,
          level: 'info',
          message: { key: 'transcript.notice.appTools.iosSession' },
          appTools: 'ios-simulator'
        }
      ],
      controls(vi.fn())
    )
    const notice = screen.getByTestId('notice-app-tools')
    // Espaces insécables de la typographie française : comparés comme des espaces.
    expect(notice.textContent?.replace(/\s/g, ' ')).toBe(
      'Agent redémarré : outils iOS de Bobine ajoutés à la conversation.'
    )
    expect(notice.querySelector('svg')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Redémarrer l’agent' })).toBeNull()
  })
})
