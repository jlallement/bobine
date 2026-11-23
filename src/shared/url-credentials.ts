/**
 * Identifiants d'une adresse masqués avant affichage (fiche 275) : `http://nom:mot@proxy:3128`
 * devient `http://•••@proxy:3128`, dans une adresse seule comme dans un texte qui en contient. Ni
 * le nom ni le mot de passe ne s'affichent, ne vont au journal ni dans une capture.
 */
const USERINFO = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/]*@/gi

export const CREDENTIALS_MASK = '•••'

export function maskUrlCredentials(text: string): string {
  return text.replace(USERINFO, `$1${CREDENTIALS_MASK}@`)
}
