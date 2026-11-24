/**
 * Entrées de l'agent jamais jetées par Chromium (fiche 250) : l'option est posée. Que Chromium la
 * respecte se vérifie dans l'e2e `browser` (saisie et téléchargement juste après la navigation).
 */
import { describe, expect, it } from 'vitest'
import { applyChromiumSwitches } from './chromium-switches'

describe('options de Chromium (fiche 250)', () => {
  it('les clics et touches de l’agent passent avant la première peinture et dans un onglet caché', () => {
    const appended: string[] = []
    applyChromiumSwitches({ appendSwitch: (name) => appended.push(name) })
    expect(appended).toContain('allow-pre-commit-input')
  })
})
