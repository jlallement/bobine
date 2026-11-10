import { describe, expect, it } from 'vitest'
import type { AppToolGroup } from '@shared/app-tools'
import { ALL_FEATURES } from '@shared/platform'
import type { TranscriptItem } from '@shared/transcript'
import {
  fittedPanelWidth,
  hiddenPanelTabs,
  loadClosedTabs,
  panelAutoOpens,
  panelFits,
  panelTabsUsed,
  saveClosedTabs,
  tabAfterClose,
  unavailablePanelTabs,
  visiblePanelTabs
} from './panel-tabs'

let nextId = 1
const tool = (groups: AppToolGroup[], work?: TranscriptItem[]): TranscriptItem => {
  const labels = groups.map((group) => ({ group, label: group }))
  const [first] = labels
  return {
    kind: 'tool',
    id: nextId++,
    toolCallId: `t${nextId}`,
    title: 'outil',
    status: 'completed',
    content: [],
    locations: [],
    ...(first ? { appTool: first } : {}),
    ...(labels.length > 1 ? { appTools: labels } : {}),
    ...(work ? { work } : {})
  }
}

describe('onglets du panneau (fiche 082)', () => {
  it('outils de l’app appelés, sous-agents et code compris ; liste de tâches non vide', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: nextId++, text: 'Teste' },
      tool(['browser']),
      tool(['ask']),
      tool(['terminal', 'android']),
      tool([], [tool(['ios'])]),
      { kind: 'plan', id: nextId++, entries: [] }
    ]
    expect([...panelTabsUsed(items)].sort()).toEqual([
      'android',
      'browser',
      'simulator',
      'terminal'
    ])
    const withPlan: TranscriptItem[] = [
      {
        kind: 'plan',
        id: nextId++,
        entries: [{ content: 'a', status: 'pending', priority: 'medium' }]
      },
      tool(['preview'])
    ]
    expect([...panelTabsUsed(withPlan)].sort()).toEqual(['browser', 'tasks'])
  })

  it('utilisés, actif, ouverts, modifications et aperçu, dans l’ordre d’arrivée déduit', () => {
    const visible = visiblePanelTabs({
      used: new Set(['tasks', 'browser']),
      active: 'android',
      opened: new Set(['terminal']),
      closed: new Set(),
      hasChanges: true,
      hasPreview: false
    })
    expect(visible).toEqual(['session', 'tasks', 'browser', 'terminal', 'android', 'changes'])
    expect(hiddenPanelTabs(visible)).toEqual(['simulator', 'acp'])
  })

  it('conversation neuve : l’onglet actif seul ; l’aperçu n’est jamais dans le menu « + »', () => {
    const visible = visiblePanelTabs({
      used: new Set(),
      active: 'tasks',
      opened: new Set(),
      closed: new Set(),
      hasChanges: false,
      hasPreview: true
    })
    expect(visible).toEqual(['session', 'tasks', 'document'])
    expect(hiddenPanelTabs(visible)).toEqual([
      'browser',
      'simulator',
      'android',
      'terminal',
      'acp',
      'changes'
    ])
  })

  it('outil absent de la plateforme (fiche 145) : ni onglet ni entrée du menu « + »', () => {
    const unavailable = unavailablePanelTabs({ ...ALL_FEATURES, simulator: false })
    const visible = visiblePanelTabs({
      used: new Set(['simulator', 'browser']),
      active: 'simulator',
      opened: new Set(),
      closed: new Set(),
      hasChanges: false,
      hasPreview: false,
      unavailable
    })
    expect(visible).toEqual(['session', 'browser'])
    expect(hiddenPanelTabs(visible, unavailable)).not.toContain('simulator')
    expect(unavailablePanelTabs(ALL_FEATURES).size).toBe(0)
  })

  it('onglet qui apparaît (fiche 154) : à droite, les autres ne bougent plus', () => {
    const base = {
      active: 'terminal' as const,
      opened: new Set<'terminal'>(['terminal']),
      closed: new Set<never>(),
      hasChanges: false,
      hasPreview: false
    }
    // Terminal et Tâches d'abord, le Navigateur après : il arrive à droite, pas en premier.
    const before = visiblePanelTabs({ ...base, used: new Set(['terminal', 'tasks']) })
    expect(before).toEqual(['session', 'terminal', 'tasks'])
    const after = visiblePanelTabs({
      ...base,
      used: new Set(['terminal', 'tasks', 'browser']),
      arrival: before
    })
    expect(after).toEqual(['session', 'terminal', 'tasks', 'browser'])
    // Sans ordre retenu (relance) : celui de la première utilisation dans le fil.
    expect(visiblePanelTabs({ ...base, used: new Set(['terminal', 'tasks', 'browser']) })).toEqual([
      'session',
      'terminal',
      'tasks',
      'browser'
    ])
    // Un onglet fermé disparaît de l'ordre retenu : rouvert, il revient à droite.
    expect(
      visiblePanelTabs({
        ...base,
        used: new Set(['terminal', 'tasks', 'browser']),
        closed: new Set(['tasks']),
        arrival: after
      })
    ).toEqual(['session', 'terminal', 'browser'])
    // Des onglets ouverts à la main viennent après ceux du fil, dans leur ordre d'ouverture.
    expect(
      visiblePanelTabs({
        ...base,
        used: new Set(['tasks']),
        opened: new Set(['android', 'browser']),
        active: 'browser'
      })
    ).toEqual(['session', 'tasks', 'android', 'browser'])
  })

  it('onglet fermé : caché même si l’outil a servi, sauf s’il est affiché', () => {
    const input = {
      used: new Set(['browser', 'tasks'] as const),
      opened: new Set(['terminal'] as const),
      closed: new Set(['session', 'browser', 'terminal', 'changes'] as const),
      hasChanges: true,
      hasPreview: false
    }
    expect(visiblePanelTabs({ ...input, active: 'tasks' })).toEqual(['tasks'])
    expect(visiblePanelTabs({ ...input, active: 'browser' })).toEqual(['browser', 'tasks'])
  })

  it('« Session » (fiche 166) : toujours en tête, hors ordre d’arrivée ; fermé, dans « + »', () => {
    const base = {
      used: new Set(['browser'] as const),
      active: 'browser' as const,
      opened: new Set<never>(),
      hasChanges: false,
      hasPreview: false
    }
    // Même retenu ailleurs dans l'ordre d'arrivée, il revient en tête.
    expect(
      visiblePanelTabs({ ...base, closed: new Set(), arrival: ['browser', 'session'] })
    ).toEqual(['session', 'browser'])
    const closed = visiblePanelTabs({ ...base, closed: new Set(['session']) })
    expect(closed).toEqual(['browser'])
    expect(hiddenPanelTabs(closed)[0]).toBe('session')
  })

  it('ouverture d’office (fiche 166) : panneau fermé, pas refusé, et 500 px pour la conversation', () => {
    const input = {
      open: false,
      dismissed: false,
      sessionClosed: false,
      windowWidth: 1280,
      sidebarWidth: 300,
      panelWidth: 380
    }
    expect(panelAutoOpens(input)).toBe(true)
    expect(panelAutoOpens({ ...input, windowWidth: 1179 })).toBe(false)
    expect(panelAutoOpens({ ...input, windowWidth: 1180 })).toBe(true)
    expect(panelAutoOpens({ ...input, windowWidth: 900, sidebarWidth: 0 })).toBe(true)
    expect(panelAutoOpens({ ...input, open: true })).toBe(false)
    expect(panelAutoOpens({ ...input, dismissed: true })).toBe(false)
    expect(panelAutoOpens({ ...input, sessionClosed: true })).toBe(false)
  })

  it('après fermeture : le voisin de droite, sinon de gauche ; rien s’il n’en reste pas', () => {
    expect(tabAfterClose(['browser', 'terminal', 'tasks'], 'terminal')).toBe('tasks')
    expect(tabAfterClose(['browser', 'terminal', 'tasks'], 'tasks')).toBe('terminal')
    expect(tabAfterClose(['tasks'], 'tasks')).toBeUndefined()
  })

  it('onglets fermés gardés d’un lancement à l’autre ; stockage illisible ignoré', () => {
    localStorage.clear()
    saveClosedTabs({ a: ['browser'], b: [], c: ['tasks', 'changes'] })
    expect(loadClosedTabs()).toEqual({ a: ['browser'], c: ['tasks', 'changes'] })
    localStorage.setItem('bobine.panel.closedTabs', '{"a":["browser","inconnu"],"b":3}')
    expect(loadClosedTabs()).toEqual({ a: ['browser'] })
    localStorage.setItem('bobine.panel.closedTabs', 'pas du json')
    expect(loadClosedTabs()).toEqual({})
  })
})

describe('place de la conversation à côté du panneau (fiche 173)', () => {
  it('le panneau cède jusqu’à 280 px pour garder 500 px à la conversation', () => {
    expect(fittedPanelWidth(380, 1440, 300)).toBe(380)
    expect(fittedPanelWidth(380, 1100, 300)).toBe(300)
    expect(fittedPanelWidth(380, 900, 220)).toBe(280)
  })

  it('sans place même à 280 px, il ne tient plus', () => {
    expect(panelFits(1000, 220)).toBe(true)
    expect(panelFits(999, 220)).toBe(false)
    expect(panelFits(780, 0)).toBe(true)
    expect(panelFits(720, 220)).toBe(false)
  })
})
