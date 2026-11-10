/**
 * Extraits de contenu pour le journal au niveau Trace (fiche 080) : tronqués, secrets masqués.
 * Pur, pour les tests.
 *
 * Masqués : les valeurs déclarées secrètes (clés d'API passées aux agents), les formes connues
 * de clés et de jetons (`sk-…`, `Bearer …`, champs `apiKey`, `token`, `password`…), le jeton du
 * serveur d'outils de l'app (`/mcp/<jeton>`) — détection partagée avec la mémoire
 * (`secret-scan.ts`, fiche 182).
 */
import { addSecret, maskSecrets } from './secret-scan.ts'

/** Taille d'un extrait, en caractères. */
export const EXCERPT_CHARS = 500
export const MASK = '«masqué»'

export { addSecret }

export function redact(text: string): string {
  return maskSecrets(text, MASK)
}

/** Valeur en texte (JSON sinon), masquée puis tronquée : « … (+N car.) » au-delà. */
export function excerpt(value: unknown, max = EXCERPT_CHARS): string {
  let text: string
  if (typeof value === 'string') text = value
  else {
    try {
      text = JSON.stringify(value) ?? String(value)
    } catch {
      text = String(value)
    }
  }
  const clean = redact(text).replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}… (+${clean.length - max} car.)` : clean
}
