import { describe, expect, it } from 'vitest'
import { folderChunks } from './command-view'

describe('Pastille du dossier de la conversation dans la commande (fiche 214)', () => {
  const WS = '/Users/ada/projet'
  const chip = { folder: WS, name: 'projet' }

  it('le dossier en toutes lettres devient une pastille, le reste est du texte', () => {
    expect(folderChunks(`cd ${WS} && npm test`, WS)).toEqual(['cd ', chip, ' && npm test'])
    expect(folderChunks(`ls ${WS}/src`, WS)).toEqual(['ls ', chip, '/src'])
    expect(folderChunks(`cp "${WS}" '${WS}';`, WS)).toEqual(['cp "', chip, '" \'', chip, "';"])
    expect(folderChunks(`FOO=${WS}`, WS)).toEqual(['FOO=', chip])
    expect(folderChunks(WS, WS)).toEqual([chip])
    expect(folderChunks(`${WS}/`, `${WS}/`)).toEqual([chip, '/'])
  })

  it('rien au moindre doute : voisin, milieu de mot, racine, `..`, `$`, sans dossier', () => {
    expect(folderChunks(`ls ${WS}-copie`, WS)).toEqual([`ls ${WS}-copie`])
    expect(folderChunks(`ls ${WS}2/x`, WS)).toEqual([`ls ${WS}2/x`])
    expect(folderChunks(`ls x${WS}`, WS)).toEqual([`ls x${WS}`])
    expect(folderChunks('ls /', '/')).toEqual(['ls /'])
    expect(folderChunks(`ls ${WS}`, `${WS}/../projet`)).toEqual([`ls ${WS}`])
    expect(folderChunks(`ls ${WS}`, '/Users/$USER/p')).toEqual([`ls ${WS}`])
    expect(folderChunks(`ls ${WS}`, undefined)).toEqual([`ls ${WS}`])
    expect(folderChunks(`ls ${WS}`, 'projet')).toEqual([`ls ${WS}`])
    expect(folderChunks('ls projet ~/projet', WS)).toEqual(['ls projet ~/projet'])
  })

  it('le nom d’un dossier au nom piégé est rendu visible', () => {
    const [, tricky] = folderChunks('ls /p/pro​jet', '/p/pro​jet')
    expect(typeof tricky === 'object' && tricky.name).toContain('U+200B')
  })

  it('concaténé, le texte est exactement celui de l’agent', () => {
    const text = `cd ${WS} && cat ${WS}/a "${WS}" x${WS}`
    const back = folderChunks(text, WS)
      .map((c) => (typeof c === 'string' ? c : c.folder))
      .join('')
    expect(back).toBe(text)
  })
})
