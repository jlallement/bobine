import { describe, expect, it } from 'vitest'
import type { ElicitationSchema } from './acp-sdk.mts'
import { choicesOf, validateElicitationContent } from './elicitation'

const schema: ElicitationSchema = {
  type: 'object',
  properties: {
    environnement: { type: 'string', title: 'Environnement', enum: ['dev', 'recette', 'prod'] },
    ticket: { type: 'string', title: 'Ticket', pattern: '^[A-Z]+-\\d+$' },
    email: { type: 'string', title: 'E-mail', format: 'email' },
    lien: { type: 'string', format: 'uri' },
    date: { type: 'string', format: 'date' },
    nom: { type: 'string', minLength: 2, maxLength: 5 },
    ratio: { type: 'number', minimum: 0, maximum: 1 },
    instances: { type: 'integer', minimum: 1, maximum: 10 },
    confirmer: { type: 'boolean' },
    regions: {
      type: 'array',
      items: {
        anyOf: [
          { const: 'eu', title: 'Europe' },
          { const: 'us', title: 'États-Unis' }
        ]
      },
      minItems: 1
    },
    equipe: {
      type: 'string',
      oneOf: [
        { const: 'a', title: 'Équipe A' },
        { const: 'b', title: 'Équipe B' }
      ]
    }
  },
  required: ['environnement', 'confirmer']
}

describe('validateElicitationContent', () => {
  it('accepte une réponse conforme et retire les champs vides facultatifs', () => {
    const result = validateElicitationContent(schema, {
      environnement: 'recette',
      ticket: 'BOB-42',
      email: 'jerome@example.com',
      lien: 'https://example.com',
      date: '2026-10-11',
      nom: 'Bob',
      ratio: 0.5,
      instances: 3,
      confirmer: true,
      regions: ['eu'],
      equipe: 'b',
      vide: undefined
    })
    expect(result.ok).toBe(true)
  })

  it('champs requis manquants ou vides', () => {
    const result = validateElicitationContent(schema, { environnement: '' })
    expect(result).toEqual({
      ok: false,
      errors: { environnement: 'Champ requis', confirmer: 'Champ requis' }
    })
  })

  it('chaque règle du schéma est appliquée', () => {
    const result = validateElicitationContent(schema, {
      environnement: 'staging',
      ticket: 'bob42',
      email: 'pas-un-email',
      lien: 'pas une url',
      date: '11/10/2026',
      nom: 'B',
      ratio: 2,
      instances: 2.5,
      confirmer: 'oui',
      regions: ['asie'],
      equipe: 'z',
      intrus: 1
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(
      [
        'confirmer',
        'date',
        'email',
        'environnement',
        'equipe',
        'instances',
        'intrus',
        'lien',
        'nom',
        'ratio',
        'regions',
        'ticket'
      ].sort()
    )
    expect(result.errors['intrus']).toBe('Champ inconnu')
  })

  it('réponse qui n’est pas un objet', () => {
    expect(validateElicitationContent(schema, null).ok).toBe(false)
    expect(validateElicitationContent(schema, ['a']).ok).toBe(false)
  })

  it('motif invalide fourni par l’agent : ne bloque pas', () => {
    const result = validateElicitationContent(
      { type: 'object', properties: { x: { type: 'string', pattern: '([' } } },
      { x: 'abc' }
    )
    expect(result.ok).toBe(true)
  })
})

describe('choicesOf', () => {
  it('enum, oneOf et anyOf (choix multiple)', () => {
    const p = (key: string) => {
      const property = schema.properties?.[key]
      if (!property) throw new Error(`champ absent : ${key}`)
      return property
    }
    expect(choicesOf(p('environnement'))?.map((c) => c.value)).toEqual(['dev', 'recette', 'prod'])
    expect(choicesOf(p('equipe'))).toEqual([
      { value: 'a', label: 'Équipe A' },
      { value: 'b', label: 'Équipe B' }
    ])
    expect(choicesOf(p('regions'))?.map((c) => c.label)).toEqual(['Europe', 'États-Unis'])
    expect(choicesOf(p('nom'))).toBeUndefined()
  })
})
