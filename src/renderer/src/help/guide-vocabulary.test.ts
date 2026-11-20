/**
 * Guide affiché dans l'app (fiche 266) : aucun mot retiré par le vocabulaire unique du travail
 * délégué (`retired-words.ts`). Liens, ancres et commentaires ne sont pas lus : les noms de pages et
 * d'ancres (`conversations-filles.md`, `#taches-proposees`) restent, pour ne casser aucun lien.
 */
import { describe, expect, it } from 'vitest'
import { RETIRED_EN, RETIRED_FR, visibleText } from '@shared/i18n/retired-words'
import { GUIDE_LANGS } from './guide'
import { loadGuidePages } from './guide-content'

function guideText(markdown: string): string {
  return visibleText(
    markdown
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<a id="[^"]*"><\/a>/g, '')
      .replace(/\]\([^)]*\)/g, ']')
  )
}

describe('guide : vocabulaire du travail délégué (fiche 266)', () => {
  for (const lang of GUIDE_LANGS) {
    it(`aucun mot retiré dans le guide (${lang})`, async () => {
      const retired = lang === 'fr' ? RETIRED_FR : RETIRED_EN
      const pages = await loadGuidePages(lang)
      const hits = Object.entries(pages).flatMap(([name, text]) =>
        guideText(text)
          .split('\n')
          .filter((line) => retired.some((re) => re.test(line)))
          .map((line) => `${name}: ${line.trim()}`)
      )
      expect(hits).toEqual([])
    })
  }

  it('les commentaires, liens et ancres ne comptent pas', () => {
    expect(
      guideText('Voir [la page](conversations-filles.md#suivre) <a id="filles"></a><!-- fille -->')
    ).toBe('Voir [la page] ')
  })
})
