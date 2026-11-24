/**
 * Onglet « Échanges ACP » (fiche 135) rendu sans l'app : remplaçant des vérifications de composant
 * de la suite e2e `acp` (inventaire B, #2, #9 à #14). Le main est simulé par `window.api.acp` :
 * un instantané à l'ouverture, puis des lots poussés comme le ferait le main.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AcpExchange, AcpExchangesBatch } from '@shared/acp-exchanges'
import { AcpTab } from './AcpTab'

let seq = 0
const at = new Date(2026, 9, 24, 14, 2, 11, 204).getTime()
function exchange(direction: 'in' | 'out', message: object): AcpExchange {
  const text = JSON.stringify({ jsonrpc: '2.0', ...message })
  seq++
  return { seq, at: at + seq * 10, direction, text, bytes: text.length }
}
const chunk = (text: string) =>
  exchange('in', {
    method: 'session/update',
    params: {
      sessionId: 'ses_1',
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
    }
  })
const prompt = () =>
  exchange('out', { id: 12, method: 'session/prompt', params: { sessionId: 'ses_1', prompt: [] } })
const permission = () =>
  exchange('in', {
    id: 7,
    method: 'session/request_permission',
    params: { sessionId: 'ses_1', toolCall: { toolCallId: 't1', title: 'Modifier config.json' } }
  })

const original = window.api
let push: (batch: AcpExchangesBatch) => void = () => {}

function mount(snapshot: AcpExchange[]) {
  window.api = {
    ...original,
    acp: {
      watch: async () => ({ messages: snapshot }),
      unwatch: async () => undefined,
      onMessages: (listener: (batch: AcpExchangesBatch) => void) => {
        push = listener
        return () => {}
      }
    },
    log: { status: async () => ({ sizes: { agents: 10 } }), open: async () => undefined }
  } as unknown as Window['api']
  return render(
    <Tooltip.Provider>
      <AcpTab conversationId="c1" />
    </Tooltip.Provider>
  )
}
const rows = () => screen.queryAllByTestId('acp-row')
const whats = () => rows().map((row) => row.getAttribute('data-what'))

beforeEach(() => {
  seq = 0
})
afterEach(() => {
  window.api = original
})

describe('onglet « Échanges ACP » (fiche 135)', () => {
  it('pied : clés et jetons masqués, messages en mémoire seulement', async () => {
    const { container } = mount([prompt()])
    await waitFor(() => expect(rows()).toHaveLength(1))
    const foot = container.querySelector('.acp-foot')?.textContent ?? ''
    expect(foot).toContain('Clés et jetons masqués')
    expect(foot).toContain('en mémoire seulement')
    expect(foot).toMatch(/2\s?000/)
  })

  it('clic sur une ligne : JSON brut déplié, indenté et coloré ; second clic : replié', async () => {
    mount([prompt()])
    await waitFor(() => expect(rows()).toHaveLength(1))
    const row = rows()[0] as HTMLElement
    expect(screen.queryByTestId('acp-json')).toBeNull()
    fireEvent.click(row)
    const json = screen.getByTestId('acp-json')
    expect(row.getAttribute('aria-expanded')).toBe('true')
    // Indenté (plusieurs lignes) et en jetons colorés : clés, chaînes, littéraux.
    expect(json.textContent?.split('\n').length).toBeGreaterThan(3)
    expect(json.querySelector('.acp-json-key')?.textContent).toContain('"jsonrpc"')
    expect(json.querySelector('.acp-json-string')).toBeTruthy()
    expect(json.querySelector('.acp-json-literal')?.textContent).toBe('12')
    fireEvent.click(row)
    expect(screen.queryByTestId('acp-json')).toBeNull()
  })

  it('morceaux regroupés ; groupe déplié : ses N morceaux, un par ligne', async () => {
    mount([prompt(), chunk('Bon'), chunk('jour'), chunk(' !')])
    await waitFor(() => expect(rows()).toHaveLength(2))
    const group = rows()[1] as HTMLElement
    expect(group.hasAttribute('data-grouped')).toBe(true)
    expect(group.textContent).toContain('×3')
    fireEvent.click(group)
    const chunks = screen.getByTestId('acp-chunks')
    const lines = [...chunks.querySelectorAll('.acp-row.chunk')].map((l) => l.textContent)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('"Bon"')
    expect(lines[1]).toContain('"jour"')
    expect(lines[2]).toContain('" !"')
  })

  it('« Regrouper » décoché : un morceau par ligne, aucun groupe', async () => {
    mount([prompt(), chunk('Bon'), chunk('jour'), chunk(' !')])
    await waitFor(() => expect(rows()).toHaveLength(2))
    const toggle = screen.getByTestId('acp-group')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(rows()).toHaveLength(4)
    expect(rows().some((row) => row.hasAttribute('data-grouped'))).toBe(false)
  })

  it('filtre : seule la méthode cherchée reste ; sans correspondance, c’est dit', async () => {
    mount([prompt(), permission(), chunk('Bon')])
    await waitFor(() => expect(rows()).toHaveLength(3))
    fireEvent.change(screen.getByTestId('acp-filter'), {
      target: { value: 'request_permission' }
    })
    expect(whats()).toEqual(['session/request_permission'])
    fireEvent.change(screen.getByTestId('acp-filter'), { target: { value: 'introuvable' } })
    expect(rows()).toHaveLength(0)
    expect(screen.getByText('Aucun message ne correspond au filtre.')).toBeTruthy()
  })

  it('pause : la liste ne bouge plus, les arrivés sont comptés ; reprise : ils apparaissent', async () => {
    mount([prompt()])
    await waitFor(() => expect(rows()).toHaveLength(1))
    // En direct : un lot du main rejoint aussitôt la liste.
    act(() => push({ conversationId: 'c1', messages: [permission()] }))
    expect(rows()).toHaveLength(2)
    // Un lot d'une autre conversation n'arrive jamais ici.
    act(() => push({ conversationId: 'c2', messages: [prompt()] }))
    expect(rows()).toHaveLength(2)

    fireEvent.click(screen.getByTestId('acp-pause'))
    expect(screen.getByTestId('acp-pause').getAttribute('aria-pressed')).toBe('true')
    act(() => push({ conversationId: 'c1', messages: [chunk('a'), chunk('b')] }))
    expect(rows()).toHaveLength(2)
    expect(screen.getByTestId('acp-waiting').textContent).toBe('2 en attente')

    fireEvent.click(screen.getByTestId('acp-pause'))
    expect(screen.queryByTestId('acp-waiting')).toBeNull()
    expect(rows()).toHaveLength(3)
    expect(rows()[2]?.textContent).toContain('×2')
  })
})
