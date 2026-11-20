import { afterEach, describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { appToolFallback, appToolLabel, appToolText, appToolsText } from './app-tools'

/** Libellé d'un appel, dans la langue courante. */
const text = (name: string, args: unknown) => {
  const label = appToolLabel(name, args)
  return label && appToolText(label)
}
const described = (name: string, args: unknown) => {
  const label = appToolLabel(name, args)
  return label && { text: appToolText(label), group: label.group }
}

describe('appToolLabel (fiche 047)', () => {
  afterEach(() => i18next.changeLanguage('fr'))

  it('ce que fait l’outil, d’après ses arguments', () => {
    expect(described('browser_type', { text: 'Ada', ref: 'ref_3' })).toEqual({
      text: 'Saisit «\u00a0Ada\u00a0»',
      group: 'browser'
    })
    expect(text('browser_navigate', { url: 'http://127.0.0.1:5173/compte' })).toBe(
      'Ouvre 127.0.0.1:5173/compte'
    )
    expect(text('browser_click', { ref: 'ref_12' })).toBe('Clique dans la page')
    expect(text('browser_scroll', { direction: 'down' })).toBe('Fait défiler la page vers le bas')
    expect(text('browser_resize', { preset: 'mobile', color_scheme: 'dark' })).toBe(
      'Affiche la page en taille mobile en sombre'
    )
    expect(text('browser_resize', {})).toBe('Change la taille de la page')
    expect(text('browser_tabs', { action: 'new', url: 'https://example.com' })).toBe(
      'Ouvre un onglet example.com'
    )
    expect(described('ios_tap', { label: 'Ajouter un' })).toEqual({
      text: 'Touche «\u00a0Ajouter un\u00a0»',
      group: 'ios'
    })
    expect(text('ios_tap', { x: 10, y: 20 })).toBe('Touche l’écran')
    expect(text('android_launch', { apk_path: '/build/app-debug.apk' })).toBe('Lance app-debug.apk')
    // Chemin long : le nom du fichier, jamais une fin coupée (« Lance … », fiche 122).
    expect(
      text('android_launch', {
        apk_path:
          '/Users/me/Development/bobine-recette/carnet-de-lecture/mobile/build/app/outputs/flutter-apk/app-debug.apk'
      })
    ).toBe('Lance app-debug.apk')
    expect(described('terminal_run', { command: 'pnpm test' })).toEqual({
      text: 'Lance «\u00a0pnpm test\u00a0» dans le terminal',
      group: 'terminal'
    })
    expect(text('preview_start', { name: 'web' })).toBe('Lance le serveur web')
  })

  it('valeur absente, sur plusieurs lignes ou trop longue ; outil inconnu', () => {
    expect(text('browser_type', {})).toBe('Saisit')
    expect(text('browser_navigate', null)).toBe('Ouvre une page')
    expect(text('browser_type', { text: 'ligne 1\n  ligne 2' })).toBe(
      'Saisit «\u00a0ligne 1 ligne 2\u00a0»'
    )
    const label = text('terminal_run', { command: 'x'.repeat(200) }) ?? ''
    expect(label).toContain('…')
    expect(label.length).toBeLessThan(90)
    expect(appToolLabel('outil_inconnu', {})).toBeUndefined()
  })

  it('libellé en code : suit la langue ; les anciennes conversations gardent leur texte', async () => {
    const label = appToolLabel('browser_scroll', { direction: 'down' })
    expect(label?.message).toEqual({ key: 'appTools.browser_scroll.down' })
    await i18next.changeLanguage('en')
    expect(label && appToolText(label)).toBe(i18next.t('appTools.browser_scroll.down'))
    expect(appToolText({ group: 'browser', label: 'Capture la page' })).toBe('Capture la page')
  })
})

describe('outils des filles : la fille par son titre (fiche 258, D18)', () => {
  afterEach(() => i18next.changeLanguage('fr'))
  const id = 'ddb49019-d530-4dc7-aae5-83d4301eb6b3'
  const named = (name: string, args: unknown, childTitle?: string) => {
    const label = appToolLabel(name, args, childTitle ? { childTitle } : {})
    // Espaces insécables de la typographie française : comparés comme des espaces.
    return label && appToolText(label).replace(/[\u00a0\u202f]/g, ' ')
  }

  it('recommend_merge : le titre de la fille, sinon ce que l’agent a donné', () => {
    expect(named('recommend_merge', { child: id, ready: true }, 'README')).toBe(
      'Recommande de fusionner « README »'
    )
    expect(named('recommend_merge', { child: id, ready: false }, 'README')).toBe(
      'Ne recommande pas encore de fusionner « README »'
    )
    expect(named('recommend_merge', { child: 'README', ready: true })).toBe(
      'Recommande de fusionner « README »'
    )
    expect(named('recommend_merge', {})).toBe('Donne son avis sur une fusion')
  })

  it('message_child et child_status : la fille quand elle est connue, jamais son identifiant', () => {
    expect(named('message_child', { child: id, message: 'Corrige le test' }, 'Endpoint')).toBe(
      'Écrit à « Endpoint » : Corrige le test'
    )
    expect(named('message_child', { child: id, message: 'Corrige le test' })).toBe(
      'Écrit à un travail : Corrige le test'
    )
    expect(named('child_status', { child: id }, 'Endpoint')).toBe('Regarde où en est « Endpoint »')
    expect(named('child_status', { child: id })).toBe('Regarde où en sont ses travaux')
  })

  it('en anglais', async () => {
    await i18next.changeLanguage('en')
    expect(named('recommend_merge', { child: id, ready: true }, 'README')).toBe(
      'Recommends merging “README”'
    )
    expect(named('message_child', { child: id, message: 'Fix it' }, 'Endpoint')).toBe(
      'Writes to “Endpoint”: Fix it'
    )
    expect(named('child_status', { child: id }, 'Endpoint')).toBe('Checks on “Endpoint”')
  })
})

describe('appToolsText (fiche 079)', () => {
  it('un libellé, plusieurs à la suite, ou rien', () => {
    const shot = { label: 'Capture la page', group: 'browser' as const }
    const film = { label: 'Filme la page', group: 'browser' as const }
    expect(appToolsText({ appTool: shot })).toBe('Capture la page')
    expect(appToolsText({ appTool: shot, appTools: [shot, film] })).toBe(
      'Capture la page · Filme la page'
    )
    expect(appToolsText({})).toBeUndefined()
  })
})

describe('outils de la mémoire et outil sans libellé (recette 0.11, C1)', () => {
  const plain = (s: string | undefined) => s?.replace(/[  ]/g, ' ')
  it('remember, recall, forget : ce que fait l’appel, groupe mémoire', () => {
    const remember = described('remember', {
      name: 'commit-en-francais',
      description: 'Dans ce projet, les messages de commit sont en français.'
    })
    expect(remember?.group).toBe('memory')
    expect(plain(remember?.text)).toBe(
      'Propose de retenir : Dans ce projet, les messages de commit sont en français.'
    )
    expect(text('remember', {})).toBe('Propose un souvenir')
    expect(plain(text('remember', { description: 'x'.repeat(200) }))?.length).toBeLessThan(90)
    expect(text('recall', { names: ['a', 'b'] })).toBe('Relit 2 souvenirs')
    expect(text('recall', { names: ['a'] })).toBe('Relit 1 souvenir')
    expect(text('recall', { names: 'a' })).toBe('Relit des souvenirs')
    expect(text('recall', { names: [] })).toBe('Relit des souvenirs')
    expect(text('forget', { name: 'commit-en-francais' })).toBe(
      'Propose d’oublier commit-en-francais'
    )
    expect(text('forget', {})).toBe('Propose d’oublier un souvenir')
  })

  it('outil de Bobine sans libellé : son nom, jamais le titre de l’agent', () => {
    expect(appToolLabel('nouvel_outil', {})).toBeUndefined()
    const fallback = appToolFallback('nouvel_outil')
    expect(fallback.group).toBe('bobine')
    expect(plain(appToolText(fallback))).toBe('Outil de Bobine : nouvel_outil')
  })
})
