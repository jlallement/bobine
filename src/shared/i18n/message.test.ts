import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { isMessage, translate, type Message } from './message'

describe('messages enregistrés en code (ADR-0014)', () => {
  afterEach(() => i18next.changeLanguage('fr'))

  it('traduits à l’affichage, dans la langue du moment', async () => {
    const message: Message = { key: 'toolGroup.failed', params: { count: 2 } }
    expect(translate(message)).toBe('2 échecs')
    await i18next.changeLanguage('en')
    expect(translate(message)).toBe('2 failed')
  })

  it('un message imbriqué est traduit lui aussi', () => {
    const message: Message = {
      key: 'usage.title',
      params: { agent: { key: 'composer.theAgent' } }
    }
    expect(translate(message)).toBe('Consommation · L’agent')
  })

  it('reconnaît un message, pas un texte', () => {
    expect(isMessage({ key: 'sidebar.status.ready' })).toBe(true)
    expect(isMessage('Prêt')).toBe(false)
    expect(isMessage(null)).toBe(false)
    expect(isMessage({ text: 'Prêt' })).toBe(false)
  })
})
