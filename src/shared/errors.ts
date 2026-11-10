/** Message d'une erreur levée : son `message` si c'est une `Error`, sinon la valeur en texte. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
