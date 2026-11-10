/**
 * Noms des modèles tels que les agents les donnent (« openai/GPT-6.1 Sol ») : puce du modèle
 * (fiches 090, 092) et bascule vers un autre agent (fiche 108).
 */

/** Nom court d'un modèle : ce qui suit le dernier `/` (« openai/GPT-6.1 Sol » → « GPT-6.1 Sol »). */
export function shortModelName(name: string): string {
  const short = name.slice(name.lastIndexOf('/') + 1).trim()
  return short || name
}

/** Fournisseur d'un modèle : ce qui précède le dernier `/` (« openai/GPT-6.1 Sol » → « openai »). */
export function modelProvider(name: string): string | undefined {
  const cut = name.lastIndexOf('/')
  return cut > 0 && shortModelName(name) !== name ? name.slice(0, cut) : undefined
}
